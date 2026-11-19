export interface ErpUser {
  id: number;
  uid?: string | null;
  username: string;
  fullName: string;
  email: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  authorizedOfficeIds?: number[];
  selectedOfficeId?: number | null;
}

export interface OfficeItem {
  id: number;
  organizationId: number;
  parentOfficeId: number | null;
  officeCode: string;
  officeName: string;
  officeNameBn: string | null;
  officeType: 'Organization' | 'Division' | 'Zone' | 'Area' | 'Branch' | 'Unit';
  address: string;
  phone: string | null;
  status: 'Active' | 'Inactive';
}

export interface BranchItem {
  id: number;
  officeId: number;
  zoneId: number | null;
  branchCode: string;
  branchName: string;
  branchNameBn: string | null;
  address: string;
  openingDate: string;
  status: string;
}

export interface EmployeeItem {
  id: number;
  employeeCode: string;
  fullName: string;
  fullNameBn: string | null;
  designation: string;
  phone: string;
  email: string | null;
  joiningDate: string;
  officeId: number;
  branchId: number;
  salary: string;
  status: 'Active' | 'Inactive';
  officeName?: string;
  officeCode?: string;
  branchName?: string;
}

export interface SamityItem {
  id: number;
  samityCode: string;
  samityName: string;
  samityNameBn: string | null;
  officeId: number;
  branchId: number;
  employeeId: number;
  location: string;
  samityType: string;
  collectionType: string;
  collectionDay: string;
  collectionDate: string;
  openingDate: string;
  centerTime: string;
  country: string;
  divisionId: number | null;
  districtId: number | null;
  upazilaId: number | null;
  unionId: number | null;
  villageStreet: string | null;
  zipCode: string | null;
  samityAddress: string;
  status: 'Active' | 'Inactive';
  remarks: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  officeCode?: string;
  officeName?: string;
  branchCode?: string;
  branchName?: string;
  employeeCode?: string;
  employeeName?: string;
  employeeDesignation?: string;
  memberCount?: number;
  activeMemberCount?: number;
}

export interface HolidayItem {
  id: number;
  officeId: number;
  centerName: string;
  holidayDate: string;
  description: string;
  holidayType: string;
  isAllSamities: boolean;
  createdBy: string;
  officeName?: string;
  officeCode?: string;
  samityIds?: number[];
}

export interface MemberItem {
  id: number;
  memberCode: string;
  fullName: string;
  fullNameBn: string | null;
  samityId: number;
  officeId: number;
  branchId: number;
  phone: string;
  nid: string;
  admissionDate: string;
  status: 'Active' | 'Inactive' | 'Dropout' | 'Waiting';
  samityCode?: string;
  samityName?: string;
  officeName?: string;
  activeLoanCount?: number;
  loanOutstanding?: number;
  savingsBalance?: number;
}

export interface DashboardData {
  repaymentStatus: { recoverable: number; collections: number; overdue: number };
  profitLoss: { income: number; expenditure: number; netProfit: number };
  monthProgress: { admission: number; disbursement: number; dropout: number };
  memberStats: { activeMembers: number; borrowers: number; waitingForLoan: number };
  realizableToday: { amount: number; accountCount: number };
  memberRatio: {
    total: number;
    borrowers: number;
    dormant: number;
    waiting: number;
    borrowerPct: number;
    dormantPct: number;
  };
  yearlyPerformance: Array<{
    fiscalYear: string;
    disbursement: number;
    repayment: number;
    savings: number;
  }>;
  overdueAging: Array<{
    range: string;
    borrowerCount: number;
    overdueAmount: number;
    outstandingAmount: number;
  }>;
}

export interface AuditLogItem {
  id: number;
  userId: number | null;
  username: string;
  module: string;
  action: string;
  recordId: number;
  recordCode: string | null;
  previousValues: string | null;
  newValues: string | null;
  createdAt: string;
}

export type ActiveNavKey =
  | 'home'
  | 'setup-holidays'
  | 'setup-holiday-create'
  | 'offices-samitys'
  | 'offices-samity-form'
  | 'offices-samitys-branch'
  | 'offices-employees'
  | 'members'
  | 'opening-entries'
  | 'transactions'
  | 'transfers'
  | 'reports'
  | 'accounts'
  | 'process'
  | 'security'
  | 'help'
  | 'audit-log'
  | 'payroll'
  | 'provident-fund'
  | 'branch-reports'
  | 'head-office-reports'
  | 'fixed-asset'
  | 'sms';
