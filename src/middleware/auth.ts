import { Request, Response, NextFunction } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { users, sessions, userOfficePermissions, offices, roles } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface ErpUserContext {
  id: number;
  uid: string | null;
  username: string;
  fullName: string;
  email: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  authorizedOfficeIds: number[];
  selectedOfficeId: number | null;
}

export interface AuthRequest extends Request {
  erpUser?: ErpUserContext;
}

async function buildUserContext(userRow: typeof users.$inferSelect, selectedOfficeId: number | null): Promise<ErpUserContext> {
  let perms: string[] = [];
  try {
    perms = JSON.parse(userRow.permissionsList);
  } catch {
    perms = [];
  }

  let authorizedOfficeIds: number[] = [];
  if (userRow.roleCode === 'SUPER_ADMIN' || userRow.roleCode === 'HEAD_OFFICE_ADMIN' || userRow.roleCode === 'AUDITOR') {
    const allOffices = await db.select({ id: offices.id }).from(offices);
    authorizedOfficeIds = allOffices.map((o) => o.id);
  } else {
    const rows = await db
      .select({ officeId: userOfficePermissions.officeId })
      .from(userOfficePermissions)
      .where(eq(userOfficePermissions.userId, userRow.id));
    authorizedOfficeIds = rows.map((r) => r.officeId);
  }

  const effectiveSelected =
    selectedOfficeId && authorizedOfficeIds.includes(selectedOfficeId)
      ? selectedOfficeId
      : authorizedOfficeIds[0] ?? null;

  return {
    id: userRow.id,
    uid: userRow.uid,
    username: userRow.username,
    fullName: userRow.fullName,
    email: userRow.email,
    roleCode: userRow.roleCode,
    roleName: userRow.roleName,
    permissions: perms,
    authorizedOfficeIds,
    selectedOfficeId: effectiveSelected,
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Empty token.' });
  }

  try {
    if (token.startsWith('erp_')) {
      const now = new Date();
      const sessionRows = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
        .limit(1);

      if (sessionRows.length === 0) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      }

      const session = sessionRows[0];
      const userRows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, session.userId), eq(users.status, 'Active')))
        .limit(1);

      if (userRows.length === 0) {
        return res.status(401).json({ error: 'User account is inactive or not found.' });
      }

      req.erpUser = await buildUserContext(userRows[0], session.selectedOfficeId);
      return next();
    }

    // Verify Firebase ID token
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || `${uid}@erp.local`;
    const displayName = decoded.name || email.split('@')[0];

    let userRows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (userRows.length === 0) {
      // Check if role exists
      const roleRows = await db.select().from(roles).where(eq(roles.roleCode, 'HEAD_OFFICE_ADMIN')).limit(1);
      const role = roleRows[0];
      const defaultPerms = JSON.stringify(['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Office']);
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') || `user_${uid.slice(0, 6)}`;

      const inserted = await db
        .insert(users)
        .values({
          uid,
          username: `${baseUsername}_${uid.slice(0, 4)}`,
          fullName: displayName,
          email,
          roleId: role ? role.id : 1,
          roleCode: role ? role.roleCode : 'HEAD_OFFICE_ADMIN',
          roleName: role ? role.roleName : 'Head Office Administrator',
          permissionsList: defaultPerms,
          status: 'Active',
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email, fullName: displayName },
        })
        .returning();
      userRows = inserted;
    }

    if (userRows[0].status !== 'Active') {
      return res.status(403).json({ error: 'Your user account has been deactivated.' });
    }

    const selectedOfficeHeader = req.headers['x-office-id'];
    const parsedOfficeId =
      typeof selectedOfficeHeader === 'string' && /^\d+$/.test(selectedOfficeHeader)
        ? Number(selectedOfficeHeader)
        : null;

    req.erpUser = await buildUserContext(userRows[0], parsedOfficeId);
    return next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }
};

export const requirePerm = (permCode: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.erpUser.permissions.includes(permCode)) {
      return res.status(403).json({
        error: `Access denied. Role "${req.erpUser.roleName}" lacks "${permCode}" permission.`,
      });
    }
    return next();
  };
};
