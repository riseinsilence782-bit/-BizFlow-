import { Router, Response } from 'express';
import { eq, and, or, ilike, inArray, asc, desc } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { db } from '../db/index.ts';
import {
  organizations,
  offices,
  divisions,
  districts,
  upazilas,
  unions,
  branches,
  employees,
  samities,
  samityCollectionSchedules,
  holidays,
  holidaySamities,
  roles,
  permissions,
  users,
  userOfficePermissions,
  sessions,
  members,
  loans,
  savings,
  transactions,
  accounts,
  auditLogs,
} from '../db/schema.ts';
import { ensureSeeded } from './seed.ts';
import { hashPassword, verifyPassword, generateSessionToken } from './crypto.ts';
import { requireAuth, requirePerm, AuthRequest } from '../middleware/auth.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const router = Router();

// Ensure initial reference data exists lazily on first API call (no top-level startup probes)
router.use(async (_req, res, next) => {
  try {
    await ensureSeeded();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ error: 'Database initialization failed. Please try again.' });
  }
});

// Helper: Resolve descendant office IDs when a parent office (e.g., Division/Zone/Organization) is selected
function getDescendantOfficeIds(allOffices: Array<{ id: number; parentOfficeId: number | null }>, rootId: number): number[] {
  const result = new Set<number>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const off of allOffices) {
      if (off.parentOfficeId !== null && result.has(off.parentOfficeId) && !result.has(off.id)) {
        result.add(off.id);
        added = true;
      }
    }
  }
  return Array.from(result);
}

// ============================================================
// 1. AUTHENTICATION & SESSION MANAGEMENT
// ============================================================
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const userRows = await db.select().from(users).where(eq(users.username, String(username).trim())).limit(1);
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = userRows[0];
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'This user account is deactivated.' });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      return res.status(423).json({
        error: `Account temporarily locked due to repeated failed attempts. Try again in ${minsLeft} minute(s).`,
      });
    }

    if (!user.passwordHash || !user.passwordSalt || !verifyPassword(String(password), user.passwordSalt, user.passwordHash)) {
      const attempts = user.failedAttempts + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await db
        .update(users)
        .set({ failedAttempts: attempts, lockedUntil: lockUntil })
        .where(eq(users.id, user.id));

      return res.status(401).json({
        error:
          attempts >= 5
            ? 'Account locked for 15 minutes after 5 failed login attempts.'
            : `Invalid username or password. ${5 - attempts} attempt(s) remaining before lockout.`,
      });
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      await tx.insert(sessions).values({
        token,
        userId: user.id,
        selectedOfficeId: null,
        expiresAt,
      });

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Security',
        action: 'LOGIN',
        recordId: user.id,
        recordCode: user.username,
        previousValues: null,
        newValues: JSON.stringify({ method: 'password', role: user.roleCode }),
      });
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roleCode: user.roleCode,
        roleName: user.roleName,
        permissions: JSON.parse(user.permissionsList),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication service error.' });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { username, password, fullName, email, roleCode } = req.body || {};
    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ error: 'Username, full name, email, and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.select().from(users).where(eq(users.username, String(username).trim())).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const chosenRoleCode = roleCode || 'BRANCH_MANAGER';
    const roleRows = await db.select().from(roles).where(eq(roles.roleCode, chosenRoleCode)).limit(1);
    const role = roleRows[0] || (await db.select().from(roles).limit(1))[0];

    const perms =
      role.roleCode === 'SUPER_ADMIN' || role.roleCode === 'HEAD_OFFICE_ADMIN'
        ? ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Office']
        : role.roleCode === 'FIELD_OFFICER'
        ? ['View', 'Create', 'Export']
        : role.roleCode === 'AUDITOR'
        ? ['View', 'Export']
        : ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export'];

    const { salt, hash } = hashPassword(String(password));
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const createdUser = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          username: String(username).trim(),
          passwordHash: hash,
          passwordSalt: salt,
          fullName: String(fullName).trim(),
          email: String(email).trim(),
          roleId: role.id,
          roleCode: role.roleCode,
          roleName: role.roleName,
          permissionsList: JSON.stringify(perms),
          status: 'Active',
        })
        .returning();

      const allOffices = await tx.select().from(offices);
      if (allOffices.length > 0 && role.roleCode !== 'SUPER_ADMIN' && role.roleCode !== 'HEAD_OFFICE_ADMIN') {
        for (const off of allOffices) {
          await tx.insert(userOfficePermissions).values({ userId: u.id, officeId: off.id, canManage: true });
        }
      }

      await tx.insert(sessions).values({ token, userId: u.id, expiresAt });
      await tx.insert(auditLogs).values({
        userId: u.id,
        username: u.username,
        module: 'Security',
        action: 'REGISTER_USER',
        recordId: u.id,
        recordCode: u.username,
        previousValues: null,
        newValues: JSON.stringify({ roleCode: role.roleCode }),
      });

      return u;
    });

    res.status(201).json({
      token,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        fullName: createdUser.fullName,
        email: createdUser.email,
        roleCode: createdUser.roleCode,
        roleName: createdUser.roleName,
        permissions: perms,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create staff account.' });
  }
});

router.post('/auth/firebase-login', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }
    const idToken = authHeader.slice(7).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || `${uid}@erp.local`;
    const displayName = decoded.name || email.split('@')[0];

    const roleRows = await db.select().from(roles).where(eq(roles.roleCode, 'HEAD_OFFICE_ADMIN')).limit(1);
    const role = roleRows[0] || (await db.select().from(roles).limit(1))[0];
    const defaultPerms = JSON.stringify(['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Office']);

    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || `user_${uid.slice(0, 6)}`;

    const [user] = await db
      .insert(users)
      .values({
        uid,
        username: `${baseUsername}_${uid.slice(0, 4)}`,
        fullName: displayName,
        email,
        roleId: role.id,
        roleCode: role.roleCode,
        roleName: role.roleName,
        permissionsList: defaultPerms,
        lastLoginAt: new Date(),
        status: 'Active',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, fullName: displayName, lastLoginAt: new Date() },
      })
      .returning();

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roleCode: user.roleCode,
        roleName: user.roleName,
        permissions: JSON.parse(user.permissionsList),
      },
    });
  } catch (err) {
    console.error('Firebase login error:', err);
    res.status(401).json({ error: 'Invalid Firebase authentication token.' });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    const { username, email, newPassword } = req.body || {};
    if (!username || !email || !newPassword) {
      return res.status(400).json({ error: 'Username, registered email, and new password are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const userRows = await db
      .select()
      .from(users)
      .where(and(eq(users.username, String(username).trim()), eq(users.email, String(email).trim())))
      .limit(1);

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'No matching active staff account found for that username and email.' });
    }

    const user = userRows[0];
    const { salt, hash } = hashPassword(String(newPassword));
    await db
      .update(users)
      .set({ passwordHash: hash, passwordSalt: salt, failedAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));

    await db.insert(auditLogs).values({
      userId: user.id,
      username: user.username,
      module: 'Security',
      action: 'PASSWORD_RESET',
      recordId: user.id,
      recordCode: user.username,
      previousValues: null,
      newValues: JSON.stringify({ resetAt: new Date().toISOString() }),
    });

    res.json({ message: 'Password updated successfully. You may now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

router.post('/auth/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const token = req.headers.authorization?.slice(7).trim();
    if (token && token.startsWith('erp_')) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }
    if (req.erpUser) {
      await db.insert(auditLogs).values({
        userId: req.erpUser.id,
        username: req.erpUser.username,
        module: 'Security',
        action: 'LOGOUT',
        recordId: req.erpUser.id,
        recordCode: req.erpUser.username,
        previousValues: null,
        newValues: null,
      });
    }
    res.json({ message: 'Signed out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed.' });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const authOffices =
      user.authorizedOfficeIds.length > 0
        ? await db.select().from(offices).where(inArray(offices.id, user.authorizedOfficeIds)).orderBy(asc(offices.officeCode))
        : [];
    const selectedOffice = authOffices.find((o) => o.id === user.selectedOfficeId) || authOffices[0] || null;

    res.json({
      user,
      authorizedOffices: authOffices,
      selectedOffice,
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Failed to load user profile.' });
  }
});

router.post('/auth/select-office', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { officeId } = req.body || {};
    const parsedId = Number(officeId);
    if (!parsedId || !req.erpUser!.authorizedOfficeIds.includes(parsedId)) {
      return res.status(403).json({ error: 'You are not authorized to access the selected office.' });
    }

    const token = req.headers.authorization?.slice(7).trim();
    if (token && token.startsWith('erp_')) {
      await db.update(sessions).set({ selectedOfficeId: parsedId }).where(eq(sessions.token, token));
    }

    const [selectedOffice] = await db.select().from(offices).where(eq(offices.id, parsedId)).limit(1);
    res.json({ selectedOffice });
  } catch (err) {
    console.error('Select office error:', err);
    res.status(500).json({ error: 'Failed to select working office.' });
  }
});

// ============================================================
// 2. OFFICE TREE, BRANCHES & CASCADING BANGLADESH LOCATIONS
// ============================================================
router.get('/offices/tree', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const search = String(req.query.search || '').trim().toLowerCase();

    const allOffices = await db.select().from(offices).orderBy(asc(offices.officeCode));
    const authorizedSet = new Set(user.authorizedOfficeIds);
    const authorizedOffices = allOffices.filter((o) => authorizedSet.has(o.id));

    const filtered = search
      ? authorizedOffices.filter(
          (o) =>
            o.officeCode.toLowerCase().includes(search) ||
            o.officeName.toLowerCase().includes(search) ||
            o.officeType.toLowerCase().includes(search)
        )
      : authorizedOffices;

    res.json({ offices: authorizedOffices, filtered });
  } catch (err) {
    console.error('Office tree error:', err);
    res.status(500).json({ error: 'Failed to load office hierarchy.' });
  }
});

router.get('/offices', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) {
      return res.json({ data: [] });
    }
    const rows = await db
      .select()
      .from(offices)
      .where(inArray(offices.id, user.authorizedOfficeIds))
      .orderBy(asc(offices.officeCode));
    res.json({ data: rows });
  } catch (err) {
    console.error('List offices error:', err);
    res.status(500).json({ error: 'Failed to fetch offices.' });
  }
});

router.post('/offices', requireAuth, requirePerm('Manage Office'), async (req: AuthRequest, res: Response) => {
  try {
    const { officeCode, officeName, officeNameBn, officeType, parentOfficeId, address, phone } = req.body || {};
    if (!officeCode || !officeName || !officeType || !address) {
      return res.status(400).json({ error: 'Office code, name, type, and address are required.' });
    }

    const dup = await db.select().from(offices).where(eq(offices.officeCode, String(officeCode).trim())).limit(1);
    if (dup.length > 0) {
      return res.status(409).json({ error: `Office code "${officeCode}" already exists.` });
    }

    const [org] = await db.select().from(organizations).limit(1);
    const created = await db.transaction(async (tx) => {
      const [off] = await tx
        .insert(offices)
        .values({
          organizationId: org.id,
          parentOfficeId: parentOfficeId ? Number(parentOfficeId) : null,
          officeCode: String(officeCode).trim(),
          officeName: String(officeName).trim(),
          officeNameBn: officeNameBn ? String(officeNameBn).trim() : null,
          officeType: String(officeType),
          address: String(address).trim(),
          phone: phone ? String(phone).trim() : null,
          status: 'Active',
        })
        .returning();

      if (off.officeType === 'Branch') {
        await tx.insert(branches).values({
          officeId: off.id,
          branchCode: `BR-${off.officeCode}`,
          branchName: off.officeName,
          branchNameBn: off.officeNameBn,
          address: off.address,
          openingDate: new Date().toISOString().slice(0, 10),
          status: 'Active',
        });
      }

      await tx.insert(auditLogs).values({
        userId: req.erpUser!.id,
        username: req.erpUser!.username,
        module: 'Office',
        action: 'CREATE',
        recordId: off.id,
        recordCode: off.officeCode,
        previousValues: null,
        newValues: JSON.stringify(off),
      });

      return off;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create office error:', err);
    res.status(500).json({ error: 'Failed to create office.' });
  }
});

router.get('/branches', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const officeIdParam = req.query.officeId ? Number(req.query.officeId) : null;
    const allOffices = await db.select({ id: offices.id, parentOfficeId: offices.parentOfficeId }).from(offices);

    let allowedOfficeIds = user.authorizedOfficeIds;
    if (officeIdParam) {
      const descendants = getDescendantOfficeIds(allOffices, officeIdParam);
      allowedOfficeIds = descendants.filter((id) => user.authorizedOfficeIds.includes(id));
    }

    if (allowedOfficeIds.length === 0) {
      return res.json({ data: [] });
    }

    const rows = await db
      .select()
      .from(branches)
      .where(inArray(branches.officeId, allowedOfficeIds))
      .orderBy(asc(branches.branchCode));

    res.json({ data: rows });
  } catch (err) {
    console.error('List branches error:', err);
    res.status(500).json({ error: 'Failed to load branches.' });
  }
});

router.get('/locations/divisions', requireAuth, async (_req, res) => {
  const rows = await db.select().from(divisions).orderBy(asc(divisions.divisionName));
  res.json({ data: rows });
});

router.get('/locations/districts', requireAuth, async (req, res) => {
  const divisionId = req.query.divisionId ? Number(req.query.divisionId) : null;
  const rows = divisionId
    ? await db.select().from(districts).where(eq(districts.divisionId, divisionId)).orderBy(asc(districts.districtName))
    : await db.select().from(districts).orderBy(asc(districts.districtName));
  res.json({ data: rows });
});

router.get('/locations/upazilas', requireAuth, async (req, res) => {
  const districtId = req.query.districtId ? Number(req.query.districtId) : null;
  const rows = districtId
    ? await db.select().from(upazilas).where(eq(upazilas.districtId, districtId)).orderBy(asc(upazilas.upazilaName))
    : await db.select().from(upazilas).orderBy(asc(upazilas.upazilaName));
  res.json({ data: rows });
});

router.get('/locations/unions', requireAuth, async (req, res) => {
  const upazilaId = req.query.upazilaId ? Number(req.query.upazilaId) : null;
  const rows = upazilaId
    ? await db.select().from(unions).where(eq(unions.upazilaId, upazilaId)).orderBy(asc(unions.unionCode))
    : await db.select().from(unions).orderBy(asc(unions.unionCode));
  res.json({ data: rows });
});

// ============================================================
// 3. MAIN DASHBOARD ANALYTICS (100% LIVE DB CALCULATIONS)
// ============================================================
router.get('/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const fiscalYearFilter = String(req.query.fiscalYear || 'ALL');
    const officeIdParam = req.query.officeId ? Number(req.query.officeId) : user.selectedOfficeId;
    const branchIdParam = req.query.branchId ? Number(req.query.branchId) : null;

    const allOffices = await db.select({ id: offices.id, parentOfficeId: offices.parentOfficeId }).from(offices);

    let scopedOfficeIds = user.authorizedOfficeIds;
    if (officeIdParam) {
      const descendants = getDescendantOfficeIds(allOffices, officeIdParam);
      scopedOfficeIds = descendants.filter((id) => user.authorizedOfficeIds.includes(id));
    }
    if (branchIdParam) {
      const [br] = await db.select().from(branches).where(eq(branches.id, branchIdParam)).limit(1);
      if (br) {
        scopedOfficeIds = scopedOfficeIds.filter((id) => id === br.officeId);
      }
    }

    if (scopedOfficeIds.length === 0) {
      return res.json({
        repaymentStatus: { recoverable: 0, collections: 0, overdue: 0 },
        profitLoss: { income: 0, expenditure: 0, netProfit: 0 },
        monthProgress: { admission: 0, disbursement: 0, dropout: 0 },
        memberStats: { activeMembers: 0, borrowers: 0, waitingForLoan: 0 },
        realizableToday: { amount: 0, accountCount: 0 },
        memberRatio: { total: 0, borrowers: 0, dormant: 0, waiting: 0, borrowerPct: 0, dormantPct: 0 },
        yearlyPerformance: [],
        overdueAging: [],
      });
    }

    const loanRows = await db.select().from(loans).where(inArray(loans.officeId, scopedOfficeIds));
    const filteredLoans = fiscalYearFilter !== 'ALL' ? loanRows.filter((l) => l.fiscalYear === fiscalYearFilter) : loanRows;

    const memberRows = await db.select().from(members).where(inArray(members.officeId, scopedOfficeIds));
    const savingsRows = await db.select().from(savings).where(inArray(savings.officeId, scopedOfficeIds));
    const accountRows = await db.select().from(accounts).where(inArray(accounts.officeId, scopedOfficeIds));

    // A. Repayment Status
    const recoverable = filteredLoans.reduce((s, l) => s + Number(l.recoverableAmount), 0);
    const collections = filteredLoans.reduce((s, l) => s + Number(l.collectedAmount), 0);
    const overdue = filteredLoans.reduce((s, l) => s + Number(l.overdueAmount), 0);

    // B. Profit / Loss
    const income = accountRows
      .filter((a) => a.accountType === 'Income')
      .reduce((s, a) => s + Number(a.balance), 0);
    const expenditure = accountRows
      .filter((a) => a.accountType === 'Expenditure')
      .reduce((s, a) => s + Number(a.balance), 0);
    const netProfit = income - expenditure;

    // C. Current Month Progress (2026-11)
    const currentMonthPrefix = String(req.query.month || '2026-11');
    const admission = memberRows.filter((m) => m.admissionDate.startsWith(currentMonthPrefix)).length;
    const disbursement = loanRows
      .filter((l) => l.disbursementDate.startsWith(currentMonthPrefix))
      .reduce((s, l) => s + Number(l.principalAmount), 0);
    const dropout = memberRows.filter((m) => m.status === 'Dropout').length;

    // D. Member Statistics
    const activeMembers = memberRows.filter((m) => m.status === 'Active').length;
    const borrowerMemberIds = new Set(
      loanRows.filter((l) => l.status === 'Active' || l.status === 'Overdue').map((l) => l.memberId)
    );
    const borrowers = borrowerMemberIds.size;
    const waitingForLoan = memberRows.filter((m) => m.status === 'Waiting' || (m.status === 'Active' && !borrowerMemberIds.has(m.id))).length;

    // Analytics 1: Realizable Till Today
    const activeOrOverdueLoans = filteredLoans.filter((l) => l.status !== 'Closed');
    const realizableAmount = activeOrOverdueLoans.reduce((s, l) => s + Number(l.recoverableAmount) - Number(l.collectedAmount) + Number(l.overdueAmount), 0);
    const realizableAccounts = activeOrOverdueLoans.length;

    // Analytics 2: Member, Borrower & Dormant Ratio
    const totalMembers = memberRows.length;
    const dormantMembers = memberRows.filter((m) => m.status === 'Inactive' || m.status === 'Dropout').length;
    const borrowerPct = totalMembers > 0 ? Math.round((borrowers / totalMembers) * 1000) / 10 : 0;
    const dormantPct = totalMembers > 0 ? Math.round((dormantMembers / totalMembers) * 1000) / 10 : 0;

    // Analytics 3: Year-wise Disbursement, Repayment & Savings
    const fySet = Array.from(new Set([...loanRows.map((l) => l.fiscalYear), ...savingsRows.map((sv) => sv.fiscalYear)])).sort();
    const yearlyPerformance = fySet.map((fy) => {
      const fyLoans = loanRows.filter((l) => l.fiscalYear === fy);
      const fySavings = savingsRows.filter((sv) => sv.fiscalYear === fy);
      return {
        fiscalYear: fy,
        disbursement: fyLoans.reduce((s, l) => s + Number(l.principalAmount), 0),
        repayment: fyLoans.reduce((s, l) => s + Number(l.collectedAmount), 0),
        savings: fySavings.reduce((s, sv) => s + Number(sv.balance), 0),
      };
    });

    // Analytics 4: Overdue Classification (Arrear Aging)
    const overdueLoans = filteredLoans.filter((l) => Number(l.overdueAmount) > 0);
    const buckets = [
      { label: '1–30 Days (Watch)', min: 1, max: 30 },
      { label: '31–90 Days (Substandard)', min: 31, max: 90 },
      { label: '91–180 Days (Doubtful)', min: 91, max: 180 },
      { label: '181+ Days (Bad & Loss)', min: 181, max: 999999 },
    ];
    const overdueAging = buckets.map((b) => {
      const matched = overdueLoans.filter((l) => l.overdueDays >= b.min && l.overdueDays <= b.max);
      return {
        range: b.label,
        borrowerCount: matched.length,
        overdueAmount: matched.reduce((s, l) => s + Number(l.overdueAmount), 0),
        outstandingAmount: matched.reduce((s, l) => s + Number(l.outstandingBalance), 0),
      };
    });

    res.json({
      repaymentStatus: { recoverable, collections, overdue },
      profitLoss: { income, expenditure, netProfit },
      monthProgress: { admission, disbursement, dropout },
      memberStats: { activeMembers, borrowers, waitingForLoan },
      realizableToday: { amount: Math.max(0, realizableAmount), accountCount: realizableAccounts },
      memberRatio: { total: totalMembers, borrowers, dormant: dormantMembers, waiting: waitingForLoan, borrowerPct, dormantPct },
      yearlyPerformance,
      overdueAging,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to compute dashboard metrics.' });
  }
});

// ============================================================
// 4. HOLIDAY MANAGEMENT (MODULE 04 & 05)
// ============================================================
router.get('/holidays', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const dateFilter = String(req.query.date || '').trim();
    const officeIdParam = req.query.officeId ? Number(req.query.officeId) : null;
    const samityIdParam = req.query.samityId ? Number(req.query.samityId) : null;
    const typeFilter = String(req.query.holidayType || '').trim();

    const allOffices = await db.select().from(offices);
    const officeMap = new Map(allOffices.map((o) => [o.id, o]));

    let allowedOfficeIds = user.authorizedOfficeIds;
    if (officeIdParam) {
      const descendants = getDescendantOfficeIds(allOffices, officeIdParam);
      allowedOfficeIds = descendants.filter((id) => user.authorizedOfficeIds.includes(id));
    }
    if (allowedOfficeIds.length === 0) {
      return res.json({ data: [] });
    }

    const conditions = [inArray(holidays.officeId, allowedOfficeIds)];
    if (dateFilter) {
      conditions.push(eq(holidays.holidayDate, dateFilter));
    }
    if (typeFilter) {
      conditions.push(eq(holidays.holidayType, typeFilter));
    }

    const rows = await db
      .select()
      .from(holidays)
      .where(and(...conditions))
      .orderBy(asc(holidays.holidayDate));

    const links = await db.select().from(holidaySamities);
    const linksByHoliday = new Map<number, number[]>();
    for (const ln of links) {
      const arr = linksByHoliday.get(ln.holidayId) || [];
      arr.push(ln.samityId);
      linksByHoliday.set(ln.holidayId, arr);
    }

    let enriched = rows.map((h) => ({
      ...h,
      officeName: officeMap.get(h.officeId)?.officeName || '',
      officeCode: officeMap.get(h.officeId)?.officeCode || '',
      samityIds: linksByHoliday.get(h.id) || [],
    }));

    if (samityIdParam) {
      enriched = enriched.filter((h) => h.isAllSamities || h.samityIds.includes(samityIdParam));
    }

    res.json({ data: enriched });
  } catch (err) {
    console.error('List holidays error:', err);
    res.status(500).json({ error: 'Failed to load holidays.' });
  }
});

router.post('/holidays', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const { officeId, samityIds, isAllSamities, holidayType, holidayDate, description } = req.body || {};

    const targetOfficeId = Number(officeId || user.selectedOfficeId || user.authorizedOfficeIds[0]);
    if (!targetOfficeId || !user.authorizedOfficeIds.includes(targetOfficeId)) {
      return res.status(403).json({ error: 'Unauthorized office selected for holiday creation.' });
    }
    if (!holidayType || !holidayDate || !description || !String(description).trim()) {
      return res.status(400).json({ error: 'Holiday type, business date, and description are required.' });
    }

    const selectedSamityIds: number[] = Array.isArray(samityIds) ? samityIds.map(Number).filter(Boolean) : [];
    const applyAll = Boolean(isAllSamities);

    if (!applyAll && selectedSamityIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one Samity or choose "Select All Samities".' });
    }

    // Resolve centerName label
    let centerName = 'All Centers';
    if (!applyAll) {
      const matchedSamities = await db.select().from(samities).where(inArray(samities.id, selectedSamityIds));
      if (matchedSamities.length === 0) {
        return res.status(400).json({ error: 'Selected Samities do not exist.' });
      }
      centerName =
        matchedSamities.length === 1
          ? matchedSamities[0].samityName
          : `${matchedSamities.length} Selected Samities (${matchedSamities.map((s) => s.samityCode).join(', ')})`;
    }

    // Prevent duplicate holiday entries on same date + office + centerName/type
    const dupCheck = await db
      .select()
      .from(holidays)
      .where(and(eq(holidays.officeId, targetOfficeId), eq(holidays.holidayDate, String(holidayDate))))
      .limit(20);

    if (dupCheck.some((d) => d.isAllSamities || applyAll || d.centerName === centerName)) {
      return res.status(409).json({
        error: `Duplicate holiday detected: A holiday already exists on ${holidayDate} for this office/center.`,
      });
    }

    const created = await db.transaction(async (tx) => {
      const [h] = await tx
        .insert(holidays)
        .values({
          officeId: targetOfficeId,
          centerName,
          holidayDate: String(holidayDate),
          description: String(description).trim(),
          holidayType: String(holidayType),
          isAllSamities: applyAll,
          createdBy: user.username,
        })
        .returning();

      if (!applyAll && selectedSamityIds.length > 0) {
        await tx.insert(holidaySamities).values(
          selectedSamityIds.map((sid) => ({
            holidayId: h.id,
            samityId: sid,
          }))
        );
      }

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Holiday',
        action: 'CREATE',
        recordId: h.id,
        recordCode: h.holidayDate,
        previousValues: null,
        newValues: JSON.stringify(h),
      });

      return h;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create holiday error:', err);
    res.status(500).json({ error: 'Failed to save holiday record.' });
  }
});

router.put('/holidays/:id', requireAuth, requirePerm('Edit'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const { holidayDate, description, holidayType } = req.body || {};

    const existingRows = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Holiday record not found.' });
    }
    const existing = existingRows[0];
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized to edit holidays outside your office scope.' });
    }
    if (!holidayDate || !description || !holidayType) {
      return res.status(400).json({ error: 'Date, description, and holiday type are required.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(holidays)
        .set({
          holidayDate: String(holidayDate),
          description: String(description).trim(),
          holidayType: String(holidayType),
        })
        .where(eq(holidays.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Holiday',
        action: 'UPDATE',
        recordId: id,
        recordCode: row.holidayDate,
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify(row),
      });
      return row;
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('Update holiday error:', err);
    res.status(500).json({ error: 'Failed to update holiday.' });
  }
});

router.delete('/holidays/:id', requireAuth, requirePerm('Delete'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const existingRows = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Holiday record not found.' });
    }
    const existing = existingRows[0];
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized to delete holidays outside your office scope.' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(holidays).where(eq(holidays.id, id));
      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Holiday',
        action: 'DELETE',
        recordId: id,
        recordCode: existing.holidayDate,
        previousValues: JSON.stringify(existing),
        newValues: null,
      });
    });

    res.json({ message: 'Holiday deleted successfully.' });
  } catch (err) {
    console.error('Delete holiday error:', err);
    res.status(500).json({ error: 'Failed to delete holiday.' });
  }
});

// ============================================================
// 5. EMPLOYEES MANAGEMENT (MODULE 06)
// ============================================================
router.get('/employees', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const officeIdParam = req.query.officeId ? Number(req.query.officeId) : null;
    const branchIdParam = req.query.branchId ? Number(req.query.branchId) : null;
    const statusFilter = String(req.query.status || '').trim();
    const search = String(req.query.search || '').trim();

    const allOffices = await db.select().from(offices);
    const allBranches = await db.select().from(branches);
    const officeMap = new Map(allOffices.map((o) => [o.id, o]));
    const branchMap = new Map(allBranches.map((b) => [b.id, b]));

    let allowedOfficeIds = user.authorizedOfficeIds;
    if (officeIdParam) {
      const descendants = getDescendantOfficeIds(allOffices, officeIdParam);
      allowedOfficeIds = descendants.filter((id) => user.authorizedOfficeIds.includes(id));
    }
    if (allowedOfficeIds.length === 0) {
      return res.json({ data: [] });
    }

    const conditions = [inArray(employees.officeId, allowedOfficeIds)];
    if (branchIdParam) conditions.push(eq(employees.branchId, branchIdParam));
    if (statusFilter) conditions.push(eq(employees.status, statusFilter));
    if (search) {
      conditions.push(or(ilike(employees.employeeCode, `%${search}%`), ilike(employees.fullName, `%${search}%`))!);
    }

    const rows = await db
      .select()
      .from(employees)
      .where(and(...conditions))
      .orderBy(asc(employees.employeeCode));

    const enriched = rows.map((e) => ({
      ...e,
      officeName: officeMap.get(e.officeId)?.officeName || '',
      officeCode: officeMap.get(e.officeId)?.officeCode || '',
      branchName: branchMap.get(e.branchId)?.branchName || '',
    }));

    res.json({ data: enriched });
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: 'Failed to load employees.' });
  }
});

router.post('/employees', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const { employeeCode, fullName, fullNameBn, designation, phone, email, joiningDate, officeId, branchId, salary } = req.body || {};
    if (!employeeCode || !fullName || !designation || !phone || !joiningDate || !officeId || !branchId) {
      return res.status(400).json({ error: 'All required employee fields must be filled.' });
    }
    if (!user.authorizedOfficeIds.includes(Number(officeId))) {
      return res.status(403).json({ error: 'Unauthorized office assignment.' });
    }

    const dup = await db.select().from(employees).where(eq(employees.employeeCode, String(employeeCode).trim())).limit(1);
    if (dup.length > 0) {
      return res.status(409).json({ error: `Employee ID "${employeeCode}" already exists.` });
    }

    const created = await db.transaction(async (tx) => {
      const [emp] = await tx
        .insert(employees)
        .values({
          employeeCode: String(employeeCode).trim(),
          fullName: String(fullName).trim(),
          fullNameBn: fullNameBn ? String(fullNameBn).trim() : null,
          designation: String(designation).trim(),
          phone: String(phone).trim(),
          email: email ? String(email).trim() : null,
          joiningDate: String(joiningDate),
          officeId: Number(officeId),
          branchId: Number(branchId),
          salary: String(salary || '25000'),
          status: 'Active',
        })
        .returning();

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Employee',
        action: 'CREATE',
        recordId: emp.id,
        recordCode: emp.employeeCode,
        previousValues: null,
        newValues: JSON.stringify(emp),
      });
      return emp;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Failed to register employee.' });
  }
});

router.patch('/employees/:id/status', requireAuth, requirePerm('Edit'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (status !== 'Active' && status !== 'Inactive') {
      return res.status(400).json({ error: 'Status must be Active or Inactive.' });
    }

    const [existing] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Employee not found.' });
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized office access.' });
    }

    const [updated] = await db.update(employees).set({ status }).where(eq(employees.id, id)).returning();
    await db.insert(auditLogs).values({
      userId: user.id,
      username: user.username,
      module: 'Employee',
      action: status === 'Active' ? 'ACTIVATE' : 'DEACTIVATE',
      recordId: id,
      recordCode: updated.employeeCode,
      previousValues: JSON.stringify({ status: existing.status }),
      newValues: JSON.stringify({ status }),
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('Toggle employee status error:', err);
    res.status(500).json({ error: 'Failed to update employee status.' });
  }
});

// ============================================================
// 6. SAMITY MANAGEMENT (MODULE 07 & 08)
// ============================================================
async function queryFilteredSamities(req: AuthRequest) {
  const user = req.erpUser!;
  const officeIdParam = req.query.officeId ? Number(req.query.officeId) : null;
  const branchIdParam = req.query.branchId ? Number(req.query.branchId) : null;
  const employeeIdParam = req.query.employeeId ? Number(req.query.employeeId) : null;
  const collectionDay = String(req.query.collectionDay || '').trim();
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  const allOffices = await db.select().from(offices);
  const allBranches = await db.select().from(branches);
  const allEmployees = await db.select().from(employees);

  const officeMap = new Map(allOffices.map((o) => [o.id, o]));
  const branchMap = new Map(allBranches.map((b) => [b.id, b]));
  const empMap = new Map(allEmployees.map((e) => [e.id, e]));

  let allowedOfficeIds = user.authorizedOfficeIds;
  if (officeIdParam) {
    const descendants = getDescendantOfficeIds(allOffices, officeIdParam);
    allowedOfficeIds = descendants.filter((id) => user.authorizedOfficeIds.includes(id));
  }

  if (allowedOfficeIds.length === 0) {
    return { rows: [], officeMap, branchMap, empMap };
  }

  const conditions = [inArray(samities.officeId, allowedOfficeIds)];
  if (branchIdParam) conditions.push(eq(samities.branchId, branchIdParam));
  if (employeeIdParam) conditions.push(eq(samities.employeeId, employeeIdParam));
  if (collectionDay) conditions.push(eq(samities.collectionDay, collectionDay));
  if (status) conditions.push(eq(samities.status, status));
  if (search) {
    conditions.push(
      or(
        ilike(samities.samityCode, `%${search}%`),
        ilike(samities.samityName, `%${search}%`),
        ilike(samities.samityNameBn, `%${search}%`)
      )!
    );
  }

  const sortBy = String(req.query.sortBy || 'samityCode');
  const sortDir = String(req.query.sortDir || 'asc') === 'desc' ? 'desc' : 'asc';
  const orderFn = sortDir === 'desc' ? desc : asc;

  const sortCol =
    sortBy === 'samityName'
      ? samities.samityName
      : sortBy === 'openingDate'
      ? samities.openingDate
      : sortBy === 'collectionDay'
      ? samities.collectionDay
      : sortBy === 'status'
      ? samities.status
      : sortBy === 'collectionDate'
      ? samities.collectionDate
      : samities.samityCode;

  const rows = await db
    .select()
    .from(samities)
    .where(and(...conditions))
    .orderBy(orderFn(sortCol));

  return { rows, officeMap, branchMap, empMap };
}

router.get('/samitys/next-code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const officeId = Number(req.query.officeId || req.erpUser!.selectedOfficeId || 1);
    const [off] = await db.select().from(offices).where(eq(offices.id, officeId)).limit(1);
    const prefix = off ? `SM-${off.officeCode}` : 'SM-00001';
    const existing = await db.select({ code: samities.samityCode }).from(samities).where(ilike(samities.samityCode, `${prefix}-%`));

    let maxSeq = 0;
    for (const r of existing) {
      const parts = r.code.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) maxSeq = num;
    }

    const nextCode = `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
    res.json({ nextCode });
  } catch (err) {
    console.error('Next samity code error:', err);
    res.status(500).json({ error: 'Failed to generate Samity code.' });
  }
});

router.get('/samitys/export', requireAuth, requirePerm('Export'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, officeMap, branchMap, empMap } = await queryFilteredSamities(req);

    const exportData = rows.map((s, i) => ({
      SL: i + 1,
      'Office Code': officeMap.get(s.officeId)?.officeCode || '',
      'Office Name': officeMap.get(s.officeId)?.officeName || '',
      'Branch Name': branchMap.get(s.branchId)?.branchName || '',
      'Samity Code': s.samityCode,
      'Samity Name': s.samityName,
      'Samity Name (Bangla)': s.samityNameBn || '',
      'Employee Name': empMap.get(s.employeeId)?.fullName || '',
      'Collection Day': s.collectionDay,
      'Collection Type': s.collectionType,
      'Center Time': s.centerTime,
      Address: s.samityAddress,
      'Opening Date': s.openingDate,
      Status: s.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Samity List');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Samity_List_Export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Samity export error:', err);
    res.status(500).json({ error: 'Failed to export Samity list.' });
  }
});

router.get('/samitys', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows, officeMap, branchMap, empMap } = await queryFilteredSamities(req);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paged = rows.slice((page - 1) * limit, page * limit);

    // Fetch member counts for paged samities
    const pagedIds = paged.map((s) => s.id);
    const memberRows = pagedIds.length > 0 ? await db.select().from(members).where(inArray(members.samityId, pagedIds)) : [];

    const data = paged.map((s) => {
      const sMembers = memberRows.filter((m) => m.samityId === s.id);
      return {
        ...s,
        officeCode: officeMap.get(s.officeId)?.officeCode || '',
        officeName: officeMap.get(s.officeId)?.officeName || '',
        branchCode: branchMap.get(s.branchId)?.branchCode || '',
        branchName: branchMap.get(s.branchId)?.branchName || '',
        employeeCode: empMap.get(s.employeeId)?.employeeCode || '',
        employeeName: empMap.get(s.employeeId)?.fullName || '',
        employeeDesignation: empMap.get(s.employeeId)?.designation || '',
        memberCount: sMembers.length,
        activeMemberCount: sMembers.filter((m) => m.status === 'Active').length,
      };
    });

    res.json({
      data,
      total,
      page,
      limit,
      totalPages,
      summary: {
        totalActive: rows.filter((r) => r.status === 'Active').length,
        totalInactive: rows.filter((r) => r.status === 'Inactive').length,
      },
    });
  } catch (err) {
    console.error('List samitys error:', err);
    res.status(500).json({ error: 'Failed to load Samity list.' });
  }
});

router.get('/samitys/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const [samity] = await db.select().from(samities).where(eq(samities.id, id)).limit(1);
    if (!samity) {
      return res.status(404).json({ error: 'Samity not found.' });
    }
    if (!user.authorizedOfficeIds.includes(samity.officeId)) {
      return res.status(403).json({ error: 'Access denied for this Samity office.' });
    }

    const [office] = await db.select().from(offices).where(eq(offices.id, samity.officeId)).limit(1);
    const [branch] = await db.select().from(branches).where(eq(branches.id, samity.branchId)).limit(1);
    const [employee] = await db.select().from(employees).where(eq(employees.id, samity.employeeId)).limit(1);

    const [division] = samity.divisionId ? await db.select().from(divisions).where(eq(divisions.id, samity.divisionId)).limit(1) : [null];
    const [district] = samity.districtId ? await db.select().from(districts).where(eq(districts.id, samity.districtId)).limit(1) : [null];
    const [upazila] = samity.upazilaId ? await db.select().from(upazilas).where(eq(upazilas.id, samity.upazilaId)).limit(1) : [null];
    const [unionRow] = samity.unionId ? await db.select().from(unions).where(eq(unions.id, samity.unionId)).limit(1) : [null];

    const samityMembers = await db.select().from(members).where(eq(members.samityId, id)).orderBy(asc(members.memberCode));
    const samityLoans = await db.select().from(loans).where(eq(loans.samityId, id));
    const samitySavings = await db.select().from(savings).where(eq(savings.samityId, id));
    const schedules = await db
      .select()
      .from(samityCollectionSchedules)
      .where(eq(samityCollectionSchedules.samityId, id))
      .orderBy(desc(samityCollectionSchedules.id));
    const history = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.module, 'Samity'), eq(auditLogs.recordId, id)))
      .orderBy(desc(auditLogs.id));

    res.json({
      samity,
      office,
      branch,
      employee,
      geo: { division, district, upazila, union: unionRow },
      stats: {
        totalMembers: samityMembers.length,
        activeMembers: samityMembers.filter((m) => m.status === 'Active').length,
        inactiveMembers: samityMembers.filter((m) => m.status !== 'Active').length,
        activeLoansCount: samityLoans.filter((l) => l.status !== 'Closed').length,
        totalLoanOutstanding: samityLoans.reduce((s, l) => s + Number(l.outstandingBalance), 0),
        totalSavingsBalance: samitySavings.reduce((s, sv) => s + Number(sv.balance), 0),
      },
      members: samityMembers,
      schedules,
      auditHistory: history,
    });
  } catch (err) {
    console.error('Get samity detail error:', err);
    res.status(500).json({ error: 'Failed to load Samity details.' });
  }
});

router.post('/samitys', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const body = req.body || {};
    const {
      samityCode,
      samityName,
      samityNameBn,
      officeId,
      branchId,
      employeeId,
      location,
      samityType,
      collectionType,
      collectionDay,
      collectionDate,
      openingDate,
      centerTime,
      country,
      divisionId,
      districtId,
      upazilaId,
      unionId,
      villageStreet,
      zipCode,
      samityAddress,
      status,
      remarks,
    } = body;

    if (
      !samityCode ||
      !samityName ||
      !officeId ||
      !branchId ||
      !employeeId ||
      !samityType ||
      !collectionType ||
      !collectionDay ||
      !collectionDate ||
      !openingDate ||
      !centerTime ||
      !samityAddress
    ) {
      return res.status(400).json({ error: 'All mandatory Basic & Address fields must be completed.' });
    }

    const numOfficeId = Number(officeId);
    const numBranchId = Number(branchId);
    const numEmpId = Number(employeeId);

    if (!user.authorizedOfficeIds.includes(numOfficeId)) {
      return res.status(403).json({ error: 'You are not authorized to create a Samity in the selected office.' });
    }

    const dup = await db.select().from(samities).where(eq(samities.samityCode, String(samityCode).trim())).limit(1);
    if (dup.length > 0) {
      return res.status(409).json({ error: `Duplicate Samity Code: "${samityCode}" already exists.` });
    }

    const [branchRow] = await db.select().from(branches).where(eq(branches.id, numBranchId)).limit(1);
    if (!branchRow || branchRow.officeId !== numOfficeId) {
      return res.status(400).json({ error: 'Selected Branch does not belong to the chosen Office.' });
    }

    const [empRow] = await db.select().from(employees).where(eq(employees.id, numEmpId)).limit(1);
    if (!empRow || empRow.status !== 'Active') {
      return res.status(400).json({ error: 'Assigned employee must exist and have Active status.' });
    }

    const created = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(samities)
        .values({
          samityCode: String(samityCode).trim(),
          samityName: String(samityName).trim(),
          samityNameBn: samityNameBn ? String(samityNameBn).trim() : null,
          officeId: numOfficeId,
          branchId: numBranchId,
          employeeId: numEmpId,
          location: String(location || villageStreet || samityAddress).trim(),
          samityType: String(samityType),
          collectionType: String(collectionType),
          collectionDay: String(collectionDay),
          collectionDate: String(collectionDate),
          openingDate: String(openingDate),
          centerTime: String(centerTime),
          country: String(country || 'Bangladesh'),
          divisionId: divisionId ? Number(divisionId) : null,
          districtId: districtId ? Number(districtId) : null,
          upazilaId: upazilaId ? Number(upazilaId) : null,
          unionId: unionId ? Number(unionId) : null,
          villageStreet: villageStreet ? String(villageStreet).trim() : null,
          zipCode: zipCode ? String(zipCode).trim() : null,
          samityAddress: String(samityAddress).trim(),
          status: status === 'Inactive' ? 'Inactive' : 'Active',
          remarks: remarks ? String(remarks).trim() : null,
          createdBy: user.username,
          updatedBy: user.username,
        })
        .returning();

      await tx.insert(samityCollectionSchedules).values({
        samityId: s.id,
        collectionType: s.collectionType,
        collectionDay: s.collectionDay,
        centerTime: s.centerTime,
        effectiveFrom: s.openingDate,
        isActive: s.status === 'Active',
        notes: 'Initial collection schedule on creation',
      });

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Samity',
        action: 'CREATE',
        recordId: s.id,
        recordCode: s.samityCode,
        previousValues: null,
        newValues: JSON.stringify(s),
      });

      return s;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create samity error:', err);
    res.status(500).json({ error: 'Failed to create Samity record.' });
  }
});

router.put('/samitys/:id', requireAuth, requirePerm('Edit'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const body = req.body || {};

    const [existing] = await db.select().from(samities).where(eq(samities.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Samity record not found.' });
    }
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized to edit Samity outside your office scope.' });
    }

    const nextCode = String(body.samityCode || existing.samityCode).trim();
    if (nextCode !== existing.samityCode) {
      const dup = await db.select().from(samities).where(eq(samities.samityCode, nextCode)).limit(1);
      if (dup.length > 0) {
        return res.status(409).json({ error: `Duplicate Samity Code: "${nextCode}" is already used.` });
      }
    }

    const nextEmpId = Number(body.employeeId || existing.employeeId);
    const [empRow] = await db.select().from(employees).where(eq(employees.id, nextEmpId)).limit(1);
    if (!empRow || empRow.status !== 'Active') {
      return res.status(400).json({ error: 'Assigned employee must be Active.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(samities)
        .set({
          samityCode: nextCode,
          samityName: String(body.samityName || existing.samityName).trim(),
          samityNameBn: body.samityNameBn !== undefined ? body.samityNameBn : existing.samityNameBn,
          employeeId: nextEmpId,
          location: String(body.location || existing.location).trim(),
          samityType: String(body.samityType || existing.samityType),
          collectionType: String(body.collectionType || existing.collectionType),
          collectionDay: String(body.collectionDay || existing.collectionDay),
          collectionDate: String(body.collectionDate || existing.collectionDate),
          openingDate: String(body.openingDate || existing.openingDate),
          centerTime: String(body.centerTime || existing.centerTime),
          country: String(body.country || existing.country),
          divisionId: body.divisionId !== undefined ? (body.divisionId ? Number(body.divisionId) : null) : existing.divisionId,
          districtId: body.districtId !== undefined ? (body.districtId ? Number(body.districtId) : null) : existing.districtId,
          upazilaId: body.upazilaId !== undefined ? (body.upazilaId ? Number(body.upazilaId) : null) : existing.upazilaId,
          unionId: body.unionId !== undefined ? (body.unionId ? Number(body.unionId) : null) : existing.unionId,
          villageStreet: body.villageStreet !== undefined ? body.villageStreet : existing.villageStreet,
          zipCode: body.zipCode !== undefined ? body.zipCode : existing.zipCode,
          samityAddress: String(body.samityAddress || existing.samityAddress).trim(),
          status: body.status === 'Inactive' ? 'Inactive' : 'Active',
          remarks: body.remarks !== undefined ? body.remarks : existing.remarks,
          updatedBy: user.username,
          updatedAt: new Date(),
        })
        .where(eq(samities.id, id))
        .returning();

      if (
        row.collectionDay !== existing.collectionDay ||
        row.collectionType !== existing.collectionType ||
        row.centerTime !== existing.centerTime
      ) {
        await tx
          .update(samityCollectionSchedules)
          .set({ isActive: false })
          .where(eq(samityCollectionSchedules.samityId, id));

        await tx.insert(samityCollectionSchedules).values({
          samityId: id,
          collectionType: row.collectionType,
          collectionDay: row.collectionDay,
          centerTime: row.centerTime,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          isActive: row.status === 'Active',
          notes: 'Schedule updated via Samity Edit',
        });
      }

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Samity',
        action: existing.employeeId !== row.employeeId ? 'REASSIGN_AND_UPDATE' : 'UPDATE',
        recordId: id,
        recordCode: row.samityCode,
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify(row),
      });

      return row;
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('Update samity error:', err);
    res.status(500).json({ error: 'Failed to update Samity.' });
  }
});

router.patch('/samitys/:id/status', requireAuth, requirePerm('Edit'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (status !== 'Active' && status !== 'Inactive') {
      return res.status(400).json({ error: 'Status must be Active or Inactive.' });
    }

    const [existing] = await db.select().from(samities).where(eq(samities.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Samity not found.' });
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized office access.' });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(samities)
        .set({ status, updatedBy: user.username, updatedAt: new Date() })
        .where(eq(samities.id, id))
        .returning();

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Samity',
        action: status === 'Active' ? 'ACTIVATE' : 'DEACTIVATE',
        recordId: id,
        recordCode: row.samityCode,
        previousValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status }),
      });

      return row;
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('Toggle samity status error:', err);
    res.status(500).json({ error: 'Failed to change Samity status.' });
  }
});

router.post('/samitys/:id/transfer', requireAuth, requirePerm('Approve'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const { targetBranchId, targetEmployeeId, reason } = req.body || {};

    const [existing] = await db.select().from(samities).where(eq(samities.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Samity not found.' });
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized source office.' });
    }

    const [targetBranch] = await db.select().from(branches).where(eq(branches.id, Number(targetBranchId))).limit(1);
    if (!targetBranch || !user.authorizedOfficeIds.includes(targetBranch.officeId)) {
      return res.status(403).json({ error: 'Target branch is invalid or outside your authorization.' });
    }

    const empId = targetEmployeeId ? Number(targetEmployeeId) : existing.employeeId;
    const [empRow] = await db.select().from(employees).where(eq(employees.id, empId)).limit(1);
    if (!empRow || empRow.status !== 'Active') {
      return res.status(400).json({ error: 'Target responsible employee must be Active.' });
    }

    const transferred = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(samities)
        .set({
          officeId: targetBranch.officeId,
          branchId: targetBranch.id,
          employeeId: empId,
          updatedBy: user.username,
          updatedAt: new Date(),
        })
        .where(eq(samities.id, id))
        .returning();

      await tx
        .update(members)
        .set({ officeId: targetBranch.officeId, branchId: targetBranch.id })
        .where(eq(members.samityId, id));

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Samity',
        action: 'BRANCH_TRANSFER',
        recordId: id,
        recordCode: row.samityCode,
        previousValues: JSON.stringify({ officeId: existing.officeId, branchId: existing.branchId, employeeId: existing.employeeId }),
        newValues: JSON.stringify({ officeId: targetBranch.officeId, branchId: targetBranch.id, employeeId: empId, reason: reason || 'Authorized branch transfer' }),
      });

      return row;
    });

    res.json({ data: transferred });
  } catch (err) {
    console.error('Transfer samity error:', err);
    res.status(500).json({ error: 'Failed to transfer Samity.' });
  }
});

// ============================================================
// 7. MEMBERS, LOANS, SAVINGS, TRANSACTIONS, ACCOUNTS, REPORTS, SECURITY, AUDIT
// ============================================================
router.get('/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const samityIdParam = req.query.samityId ? Number(req.query.samityId) : null;
    const search = String(req.query.search || '').trim();

    if (user.authorizedOfficeIds.length === 0) return res.json({ data: [] });

    const conditions = [inArray(members.officeId, user.authorizedOfficeIds)];
    if (samityIdParam) conditions.push(eq(members.samityId, samityIdParam));
    if (search) {
      conditions.push(or(ilike(members.memberCode, `%${search}%`), ilike(members.fullName, `%${search}%`))!);
    }

    const memberRows = await db.select().from(members).where(and(...conditions)).orderBy(asc(members.memberCode));
    const allSamities = await db.select().from(samities);
    const allOffices = await db.select().from(offices);
    const allLoans = await db.select().from(loans);
    const allSavings = await db.select().from(savings);

    const samMap = new Map(allSamities.map((s) => [s.id, s]));
    const offMap = new Map(allOffices.map((o) => [o.id, o]));

    const data = memberRows.map((m) => {
      const mLoans = allLoans.filter((l) => l.memberId === m.id && l.status !== 'Closed');
      const mSav = allSavings.filter((s) => s.memberId === m.id);
      return {
        ...m,
        samityCode: samMap.get(m.samityId)?.samityCode || '',
        samityName: samMap.get(m.samityId)?.samityName || '',
        officeName: offMap.get(m.officeId)?.officeName || '',
        activeLoanCount: mLoans.length,
        loanOutstanding: mLoans.reduce((sum, l) => sum + Number(l.outstandingBalance), 0),
        savingsBalance: mSav.reduce((sum, s) => sum + Number(s.balance), 0),
      };
    });

    res.json({ data });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to load members.' });
  }
});

router.post('/members', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const { memberCode, fullName, fullNameBn, samityId, phone, nid, admissionDate, initialSavings } = req.body || {};
    if (!memberCode || !fullName || !samityId || !phone || !nid || !admissionDate) {
      return res.status(400).json({ error: 'Member code, full name, Samity, phone, NID, and admission date are required.' });
    }

    const [samity] = await db.select().from(samities).where(eq(samities.id, Number(samityId))).limit(1);
    if (!samity) {
      return res.status(400).json({ error: 'Selected Samity does not exist.' });
    }
    if (samity.status !== 'Active') {
      return res.status(400).json({ error: 'Cannot admit members into an Inactive Samity.' });
    }
    if (!user.authorizedOfficeIds.includes(samity.officeId)) {
      return res.status(403).json({ error: 'Unauthorized to admit members into this Samity office.' });
    }

    const dup = await db.select().from(members).where(eq(members.memberCode, String(memberCode).trim())).limit(1);
    if (dup.length > 0) {
      return res.status(409).json({ error: `Member Code "${memberCode}" already exists.` });
    }

    const created = await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(members)
        .values({
          memberCode: String(memberCode).trim(),
          fullName: String(fullName).trim(),
          fullNameBn: fullNameBn ? String(fullNameBn).trim() : null,
          samityId: samity.id,
          officeId: samity.officeId,
          branchId: samity.branchId,
          phone: String(phone).trim(),
          nid: String(nid).trim(),
          admissionDate: String(admissionDate),
          status: 'Active',
        })
        .returning();

      await tx.insert(savings).values({
        accountNo: `SAV-${m.memberCode}`,
        memberId: m.id,
        samityId: samity.id,
        officeId: samity.officeId,
        productType: 'General Savings',
        balance: String(Number(initialSavings || 0)),
        openedDate: String(admissionDate),
        fiscalYear: '2025-2026',
        status: 'Active',
      });

      await tx.insert(auditLogs).values({
        userId: user.id,
        username: user.username,
        module: 'Member',
        action: 'CREATE',
        recordId: m.id,
        recordCode: m.memberCode,
        previousValues: null,
        newValues: JSON.stringify(m),
      });

      return m;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create member error:', err);
    res.status(500).json({ error: 'Failed to register member.' });
  }
});

router.patch('/members/:id/status', requireAuth, requirePerm('Edit'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!['Active', 'Inactive', 'Dropout', 'Waiting'].includes(status)) {
      return res.status(400).json({ error: 'Invalid member status.' });
    }

    const [existing] = await db.select().from(members).where(eq(members.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Member not found.' });
    if (!user.authorizedOfficeIds.includes(existing.officeId)) {
      return res.status(403).json({ error: 'Unauthorized office access.' });
    }

    const [updated] = await db.update(members).set({ status }).where(eq(members.id, id)).returning();
    res.json({ data: updated });
  } catch (err) {
    console.error('Update member status error:', err);
    res.status(500).json({ error: 'Failed to update member status.' });
  }
});

router.get('/loans', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) return res.json({ data: [] });
    const rows = await db.select().from(loans).where(inArray(loans.officeId, user.authorizedOfficeIds)).orderBy(desc(loans.id));
    const allMembers = await db.select().from(members);
    const allSamities = await db.select().from(samities);
    const mMap = new Map(allMembers.map((m) => [m.id, m]));
    const sMap = new Map(allSamities.map((s) => [s.id, s]));

    res.json({
      data: rows.map((l) => ({
        ...l,
        memberName: mMap.get(l.memberId)?.fullName || '',
        memberCode: mMap.get(l.memberId)?.memberCode || '',
        samityName: sMap.get(l.samityId)?.samityName || '',
      })),
    });
  } catch (err) {
    console.error('List loans error:', err);
    res.status(500).json({ error: 'Failed to load loans.' });
  }
});

router.post('/loans', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const { loanAccountNo, memberId, productName, principalAmount, disbursementDate } = req.body || {};
    if (!loanAccountNo || !memberId || !productName || !principalAmount || !disbursementDate) {
      return res.status(400).json({ error: 'All loan disbursement fields are required.' });
    }

    const [member] = await db.select().from(members).where(eq(members.id, Number(memberId))).limit(1);
    if (!member) return res.status(400).json({ error: 'Member not found.' });
    if (!user.authorizedOfficeIds.includes(member.officeId)) {
      return res.status(403).json({ error: 'Unauthorized office access.' });
    }

    const prin = Number(principalAmount);
    const created = await db.transaction(async (tx) => {
      const [loan] = await tx
        .insert(loans)
        .values({
          loanAccountNo: String(loanAccountNo).trim(),
          memberId: member.id,
          samityId: member.samityId,
          officeId: member.officeId,
          productName: String(productName),
          principalAmount: String(prin),
          outstandingBalance: String(prin),
          recoverableAmount: String(Math.round(prin * 0.2)),
          collectedAmount: '0',
          overdueAmount: '0',
          overdueDays: 0,
          disbursementDate: String(disbursementDate),
          fiscalYear: '2025-2026',
          status: 'Active',
        })
        .returning();

      await tx.insert(transactions).values({
        txCode: `TX-${Date.now()}`,
        officeId: member.officeId,
        samityId: member.samityId,
        memberId: member.id,
        loanId: loan.id,
        txType: 'Loan Disbursement',
        amount: String(prin),
        txDate: String(disbursementDate),
        fiscalYear: '2025-2026',
        description: `${productName} disbursement to ${member.fullName}`,
        createdBy: user.username,
      });

      return loan;
    });

    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Create loan error:', err);
    res.status(500).json({ error: 'Failed to disburse loan.' });
  }
});

router.get('/savings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) return res.json({ data: [] });
    const rows = await db.select().from(savings).where(inArray(savings.officeId, user.authorizedOfficeIds)).orderBy(desc(savings.id));
    const allMembers = await db.select().from(members);
    const allSamities = await db.select().from(samities);
    const mMap = new Map(allMembers.map((m) => [m.id, m]));
    const sMap = new Map(allSamities.map((s) => [s.id, s]));

    res.json({
      data: rows.map((sv) => ({
        ...sv,
        memberName: mMap.get(sv.memberId)?.fullName || '',
        memberCode: mMap.get(sv.memberId)?.memberCode || '',
        samityName: sMap.get(sv.samityId)?.samityName || '',
      })),
    });
  } catch (err) {
    console.error('List savings error:', err);
    res.status(500).json({ error: 'Failed to load savings accounts.' });
  }
});

router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) return res.json({ data: [] });
    const rows = await db.select().from(transactions).where(inArray(transactions.officeId, user.authorizedOfficeIds)).orderBy(desc(transactions.id));
    const allMembers = await db.select().from(members);
    const mMap = new Map(allMembers.map((m) => [m.id, m]));

    res.json({
      data: rows.map((t) => ({
        ...t,
        memberName: t.memberId ? mMap.get(t.memberId)?.fullName || '' : 'Office Ledger',
      })),
    });
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Failed to load transactions.' });
  }
});

router.post('/transactions', requireAuth, requirePerm('Create'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    const { txType, loanId, savingsId, amount, txDate, description } = req.body || {};
    const numAmt = Number(amount);
    if (!txType || !numAmt || numAmt <= 0 || !txDate) {
      return res.status(400).json({ error: 'Transaction type, positive amount, and date are required.' });
    }

    const created = await db.transaction(async (tx) => {
      let officeId = user.selectedOfficeId || user.authorizedOfficeIds[0];
      let samityId: number | null = null;
      let memberId: number | null = null;

      if (txType === 'Loan Repayment' && loanId) {
        const [loan] = await tx.select().from(loans).where(eq(loans.id, Number(loanId))).limit(1);
        if (!loan) throw new Error('Loan account not found.');
        officeId = loan.officeId;
        samityId = loan.samityId;
        memberId = loan.memberId;

        const nextOut = Math.max(0, Number(loan.outstandingBalance) - numAmt);
        const nextCol = Number(loan.collectedAmount) + numAmt;
        const nextOv = Math.max(0, Number(loan.overdueAmount) - numAmt);

        await tx
          .update(loans)
          .set({
            outstandingBalance: String(nextOut),
            collectedAmount: String(nextCol),
            overdueAmount: String(nextOv),
            status: nextOut === 0 ? 'Closed' : nextOv === 0 ? 'Active' : 'Overdue',
          })
          .where(eq(loans.id, loan.id));
      } else if ((txType === 'Savings Deposit' || txType === 'Savings Withdrawal') && savingsId) {
        const [sv] = await tx.select().from(savings).where(eq(savings.id, Number(savingsId))).limit(1);
        if (!sv) throw new Error('Savings account not found.');
        officeId = sv.officeId;
        samityId = sv.samityId;
        memberId = sv.memberId;

        const currentBal = Number(sv.balance);
        if (txType === 'Savings Withdrawal' && numAmt > currentBal) {
          throw new Error('Insufficient savings balance for withdrawal.');
        }
        const nextBal = txType === 'Savings Deposit' ? currentBal + numAmt : currentBal - numAmt;
        await tx.update(savings).set({ balance: String(nextBal) }).where(eq(savings.id, sv.id));
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          txCode: `TX-${Date.now()}`,
          officeId,
          samityId,
          memberId,
          loanId: loanId ? Number(loanId) : null,
          savingsId: savingsId ? Number(savingsId) : null,
          txType: String(txType),
          amount: String(numAmt),
          txDate: String(txDate),
          fiscalYear: '2025-2026',
          description: String(description || `${txType} posted`).trim(),
          createdBy: user.username,
        })
        .returning();

      return row;
    });

    res.status(201).json({ data: created });
  } catch (err: any) {
    console.error('Create transaction error:', err);
    res.status(400).json({ error: err.message || 'Failed to post transaction.' });
  }
});

router.get('/accounts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) return res.json({ data: [] });
    const rows = await db.select().from(accounts).where(inArray(accounts.officeId, user.authorizedOfficeIds)).orderBy(asc(accounts.accountCode));
    res.json({ data: rows });
  } catch (err) {
    console.error('List accounts error:', err);
    res.status(500).json({ error: 'Failed to load ledger accounts.' });
  }
});

router.get('/reports/summary', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.erpUser!;
    if (user.authorizedOfficeIds.length === 0) return res.json({ branches: [] });

    const branchRows = await db.select().from(branches).where(inArray(branches.officeId, user.authorizedOfficeIds));
    const samityRows = await db.select().from(samities).where(inArray(samities.officeId, user.authorizedOfficeIds));
    const empRows = await db.select().from(employees).where(inArray(employees.officeId, user.authorizedOfficeIds));
    const memberRows = await db.select().from(members).where(inArray(members.officeId, user.authorizedOfficeIds));
    const loanRows = await db.select().from(loans).where(inArray(loans.officeId, user.authorizedOfficeIds));
    const savingsRows = await db.select().from(savings).where(inArray(savings.officeId, user.authorizedOfficeIds));

    const branchSummary = branchRows.map((b) => {
      const bSamities = samityRows.filter((s) => s.branchId === b.id);
      const bEmps = empRows.filter((e) => e.branchId === b.id);
      const bMembers = memberRows.filter((m) => m.branchId === b.id);
      const bLoans = loanRows.filter((l) => l.officeId === b.officeId);
      const bSavings = savingsRows.filter((sv) => sv.officeId === b.officeId);

      return {
        branchId: b.id,
        branchCode: b.branchCode,
        branchName: b.branchName,
        totalSamities: bSamities.length,
        activeSamities: bSamities.filter((s) => s.status === 'Active').length,
        activeEmployees: bEmps.filter((e) => e.status === 'Active').length,
        totalMembers: bMembers.length,
        loanOutstanding: bLoans.reduce((sum, l) => sum + Number(l.outstandingBalance), 0),
        overdueAmount: bLoans.reduce((sum, l) => sum + Number(l.overdueAmount), 0),
        savingsBalance: bSavings.reduce((sum, sv) => sum + Number(sv.balance), 0),
      };
    });

    res.json({ branches: branchSummary });
  } catch (err) {
    console.error('Report summary error:', err);
    res.status(500).json({ error: 'Failed to generate branch report summary.' });
  }
});

router.get('/security/users', requireAuth, async (_req: AuthRequest, res: Response) => {
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      roleCode: users.roleCode,
      roleName: users.roleName,
      permissionsList: users.permissionsList,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.id));
  const roleRows = await db.select().from(roles).orderBy(asc(roles.id));
  const permRows = await db.select().from(permissions).orderBy(asc(permissions.id));
  res.json({ users: userRows, roles: roleRows, permissions: permRows });
});

router.get('/audit-logs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const moduleFilter = String(req.query.module || '').trim();
    const rows = moduleFilter
      ? await db.select().from(auditLogs).where(eq(auditLogs.module, moduleFilter)).orderBy(desc(auditLogs.id)).limit(150)
      : await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(150);
    res.json({ data: rows });
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Failed to load audit logs.' });
  }
});

export default router;
