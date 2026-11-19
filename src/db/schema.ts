import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Organizations
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  orgCode: text('org_code').notNull().unique(),
  orgName: text('org_name').notNull(),
  shortName: text('short_name').notNull(),
  registrationNo: text('registration_no'),
  address: text('address').notNull(),
  phone: text('phone'),
  email: text('email'),
  status: text('status').notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Divisions (Administrative geography - Bangladesh)
export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  divisionCode: text('division_code').notNull().unique(),
  divisionName: text('division_name').notNull(),
  divisionNameBn: text('division_name_bn'),
});

// 3. Districts (Dependent on Division)
export const districts = pgTable('districts', {
  id: serial('id').primaryKey(),
  divisionId: integer('division_id')
    .references(() => divisions.id)
    .notNull(),
  districtCode: text('district_code').notNull().unique(),
  districtName: text('district_name').notNull(),
  districtNameBn: text('district_name_bn'),
});

// 4. Upazilas (Dependent on District)
export const upazilas = pgTable('upazilas', {
  id: serial('id').primaryKey(),
  districtId: integer('district_id')
    .references(() => districts.id)
    .notNull(),
  upazilaCode: text('upazila_code').notNull().unique(),
  upazilaName: text('upazila_name').notNull(),
  upazilaNameBn: text('upazila_name_bn'),
});

// 5. Unions (UnionCode dependent on Upazila)
export const unions = pgTable('unions', {
  id: serial('id').primaryKey(),
  upazilaId: integer('upazila_id')
    .references(() => upazilas.id)
    .notNull(),
  unionCode: text('union_code').notNull().unique(),
  unionName: text('union_name').notNull(),
  unionNameBn: text('union_name_bn'),
});

// 6. Offices (Hierarchical: Organization -> Division -> Zone -> Area -> Branch -> Unit)
export const offices = pgTable(
  'offices',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organization_id')
      .references(() => organizations.id)
      .notNull(),
    parentOfficeId: integer('parent_office_id'),
    officeCode: text('office_code').notNull().unique(),
    officeName: text('office_name').notNull(),
    officeNameBn: text('office_name_bn'),
    officeType: text('office_type').notNull(), // Organization | Division | Zone | Area | Branch | Unit
    address: text('address').notNull(),
    phone: text('phone'),
    status: text('status').notNull().default('Active'), // Active | Inactive
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_offices_parent').on(table.parentOfficeId)]
);

// 7. Zones
export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  officeId: integer('office_id')
    .references(() => offices.id)
    .notNull(),
  zoneCode: text('zone_code').notNull().unique(),
  zoneName: text('zone_name').notNull(),
  status: text('status').notNull().default('Active'),
});

// 8. Branches
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  officeId: integer('office_id')
    .references(() => offices.id)
    .notNull(),
  zoneId: integer('zone_id').references(() => zones.id),
  branchCode: text('branch_code').notNull().unique(),
  branchName: text('branch_name').notNull(),
  branchNameBn: text('branch_name_bn'),
  address: text('address').notNull(),
  openingDate: text('opening_date').notNull(),
  status: text('status').notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Employees
export const employees = pgTable(
  'employees',
  {
    id: serial('id').primaryKey(),
    employeeCode: text('employee_code').notNull().unique(),
    fullName: text('full_name').notNull(),
    fullNameBn: text('full_name_bn'),
    designation: text('designation').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    joiningDate: text('joining_date').notNull(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    branchId: integer('branch_id')
      .references(() => branches.id)
      .notNull(),
    salary: numeric('salary', { precision: 12, scale: 2 }).default('0').notNull(),
    status: text('status').notNull().default('Active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_employees_office').on(table.officeId),
    index('idx_employees_branch').on(table.branchId),
  ]
);

// 10. Samities
export const samities = pgTable(
  'samities',
  {
    id: serial('id').primaryKey(),
    samityCode: text('samity_code').notNull().unique(),
    samityName: text('samity_name').notNull(),
    samityNameBn: text('samity_name_bn'),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    branchId: integer('branch_id')
      .references(() => branches.id)
      .notNull(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    location: text('location').notNull(),
    samityType: text('samity_type').notNull(), // Female | Male | Mixed | SME | Agriculture
    collectionType: text('collection_type').notNull(), // Regular | Weekly | Fortnightly | Monthly | Special
    collectionDay: text('collection_day').notNull(), // Saturday..Friday
    collectionDate: text('collection_date').notNull(),
    openingDate: text('opening_date').notNull(),
    centerTime: text('center_time').notNull(),
    country: text('country').notNull().default('Bangladesh'),
    divisionId: integer('division_id').references(() => divisions.id),
    districtId: integer('district_id').references(() => districts.id),
    upazilaId: integer('upazila_id').references(() => upazilas.id),
    unionId: integer('union_id').references(() => unions.id),
    villageStreet: text('village_street'),
    zipCode: text('zip_code'),
    samityAddress: text('samity_address').notNull(),
    status: text('status').notNull().default('Active'),
    remarks: text('remarks'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_samities_office').on(table.officeId),
    index('idx_samities_branch').on(table.branchId),
    index('idx_samities_employee').on(table.employeeId),
    index('idx_samities_status').on(table.status),
  ]
);

// 11. Samity Collection Schedules
export const samityCollectionSchedules = pgTable('samity_collection_schedules', {
  id: serial('id').primaryKey(),
  samityId: integer('samity_id')
    .references(() => samities.id)
    .notNull(),
  collectionType: text('collection_type').notNull(),
  collectionDay: text('collection_day').notNull(),
  centerTime: text('center_time').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Holidays
export const holidays = pgTable(
  'holidays',
  {
    id: serial('id').primaryKey(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    centerName: text('center_name').notNull(), // e.g., "All Centers" or specific Samity name
    holidayDate: text('holiday_date').notNull(), // YYYY-MM-DD
    description: text('description').notNull(),
    holidayType: text('holiday_type').notNull(), // Weekly | Specific | Yearly | Government Holiday
    isAllSamities: boolean('is_all_samities').notNull().default(false),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_holidays_date').on(table.holidayDate)]
);

// 13. Holiday Samities (junction)
export const holidaySamities = pgTable(
  'holiday_samities',
  {
    id: serial('id').primaryKey(),
    holidayId: integer('holiday_id')
      .references(() => holidays.id, { onDelete: 'cascade' })
      .notNull(),
    samityId: integer('samity_id')
      .references(() => samities.id)
      .notNull(),
  },
  (table) => [uniqueIndex('uq_holiday_samity').on(table.holidayId, table.samityId)]
);

// 14. Roles
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  roleCode: text('role_code').notNull().unique(),
  roleName: text('role_name').notNull(),
  description: text('description').notNull(),
});

// 15. Permissions
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  permCode: text('perm_code').notNull().unique(), // View | Create | Edit | Delete | Approve | Export | Manage Office
  moduleName: text('module_name').notNull(),
  description: text('description').notNull(),
});

// 16. Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID when authenticated via Google SSO
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  passwordSalt: text('password_salt'),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  roleId: integer('role_id')
    .references(() => roles.id)
    .notNull(),
  roleCode: text('role_code').notNull(),
  roleName: text('role_name').notNull(),
  permissionsList: text('permissions_list').notNull(), // JSON array of granted permission codes
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  lastLoginAt: timestamp('last_login_at'),
  status: text('status').notNull().default('Active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. User Office Permissions
export const userOfficePermissions = pgTable(
  'user_office_permissions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    officeId: integer('office_id')
      .references(() => offices.id, { onDelete: 'cascade' })
      .notNull(),
    canManage: boolean('can_manage').notNull().default(true),
  },
  (table) => [uniqueIndex('uq_user_office').on(table.userId, table.officeId)]
);

// 18. Sessions
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  selectedOfficeId: integer('selected_office_id').references(() => offices.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Members
export const members = pgTable(
  'members',
  {
    id: serial('id').primaryKey(),
    memberCode: text('member_code').notNull().unique(),
    fullName: text('full_name').notNull(),
    fullNameBn: text('full_name_bn'),
    samityId: integer('samity_id')
      .references(() => samities.id)
      .notNull(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    branchId: integer('branch_id')
      .references(() => branches.id)
      .notNull(),
    phone: text('phone').notNull(),
    nid: text('nid').notNull(),
    admissionDate: text('admission_date').notNull(),
    status: text('status').notNull().default('Active'), // Active | Inactive | Dropout | Waiting
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_members_samity').on(table.samityId),
    index('idx_members_office').on(table.officeId),
  ]
);

// 20. Loans
export const loans = pgTable(
  'loans',
  {
    id: serial('id').primaryKey(),
    loanAccountNo: text('loan_account_no').notNull().unique(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    samityId: integer('samity_id')
      .references(() => samities.id)
      .notNull(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    productName: text('product_name').notNull(),
    principalAmount: numeric('principal_amount', { precision: 14, scale: 2 }).notNull(),
    outstandingBalance: numeric('outstanding_balance', { precision: 14, scale: 2 }).notNull(),
    recoverableAmount: numeric('recoverable_amount', { precision: 14, scale: 2 }).notNull(),
    collectedAmount: numeric('collected_amount', { precision: 14, scale: 2 }).notNull(),
    overdueAmount: numeric('overdue_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    overdueDays: integer('overdue_days').default(0).notNull(),
    disbursementDate: text('disbursement_date').notNull(),
    fiscalYear: text('fiscal_year').notNull().default('2025-2026'),
    status: text('status').notNull().default('Active'), // Active | Closed | Overdue
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_loans_samity').on(table.samityId),
    index('idx_loans_office').on(table.officeId),
  ]
);

// 21. Savings
export const savings = pgTable(
  'savings',
  {
    id: serial('id').primaryKey(),
    accountNo: text('account_no').notNull().unique(),
    memberId: integer('member_id')
      .references(() => members.id)
      .notNull(),
    samityId: integer('samity_id')
      .references(() => samities.id)
      .notNull(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    productType: text('product_type').notNull(), // General Savings | DPS | Voluntary
    balance: numeric('balance', { precision: 14, scale: 2 }).default('0').notNull(),
    openedDate: text('opened_date').notNull(),
    fiscalYear: text('fiscal_year').notNull().default('2025-2026'),
    status: text('status').notNull().default('Active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_savings_samity').on(table.samityId),
    index('idx_savings_office').on(table.officeId),
  ]
);

// 22. Transactions
export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    txCode: text('tx_code').notNull().unique(),
    officeId: integer('office_id')
      .references(() => offices.id)
      .notNull(),
    samityId: integer('samity_id').references(() => samities.id),
    memberId: integer('member_id').references(() => members.id),
    loanId: integer('loan_id').references(() => loans.id),
    savingsId: integer('savings_id').references(() => savings.id),
    txType: text('tx_type').notNull(), // Loan Disbursement | Loan Repayment | Savings Deposit | Savings Withdrawal | Service Charge
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    txDate: text('tx_date').notNull(),
    fiscalYear: text('fiscal_year').notNull().default('2025-2026'),
    description: text('description').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_tx_office').on(table.officeId),
    index('idx_tx_date').on(table.txDate),
  ]
);

// 23. Accounts (Chart of Accounts / Income & Expenditure ledger)
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  accountCode: text('account_code').notNull().unique(),
  accountName: text('account_name').notNull(),
  accountType: text('account_type').notNull(), // Income | Expenditure | Asset | Liability
  officeId: integer('office_id')
    .references(() => offices.id)
    .notNull(),
  balance: numeric('balance', { precision: 14, scale: 2 }).default('0').notNull(),
  fiscalYear: text('fiscal_year').notNull().default('2025-2026'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 24. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    username: text('username').notNull(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    recordId: integer('record_id').notNull(),
    recordCode: text('record_code'),
    previousValues: text('previous_values'),
    newValues: text('new_values'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_audit_module').on(table.module, table.recordId)]
);

// Relations
export const officesRelations = relations(offices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [offices.organizationId],
    references: [organizations.id],
  }),
  branches: many(branches),
  employees: many(employees),
  samities: many(samities),
}));

export const samitiesRelations = relations(samities, ({ one, many }) => ({
  office: one(offices, { fields: [samities.officeId], references: [offices.id] }),
  branch: one(branches, { fields: [samities.branchId], references: [branches.id] }),
  employee: one(employees, { fields: [samities.employeeId], references: [employees.id] }),
  members: many(members),
  loans: many(loans),
  savings: many(savings),
}));
