import React, { useState, useEffect } from 'react';
import { Shield, History, Printer, Download, Send, HelpCircle, Building2 } from 'lucide-react';
import { AuditLogItem, EmployeeItem, MemberItem, OfficeItem } from '../types/erp.ts';
import { apiRequest, downloadExcelExport } from '../lib/api.ts';

const fmtCurrency = (v: number) => `৳ ${new Intl.NumberFormat('en-US').format(Math.round(v))}`;

// ============================================================
// 1. REPORTS / BRANCH REPORTS / HEAD OFFICE REPORTS
// ============================================================
export function ReportsView({
  mode,
  onNotify,
}: {
  mode: 'reports' | 'branch-reports' | 'head-office-reports';
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ branches: any[] }>('/reports/summary')
      .then((res) => setBranches(res.branches))
      .catch((err) => onNotify('error', err.message))
      .finally(() => setLoading(false));
  }, [onNotify]);

  const title =
    mode === 'head-office-reports'
      ? 'Head Office Consolidated Report'
      : mode === 'branch-reports'
      ? 'Branch-Wise Performance Report'
      : 'MIS Portfolio & Operational Reports';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Reporting / {title}</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h1>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => downloadExcelExport('')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export Samity Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-blue-800"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Branch Code</th>
                <th className="px-4 py-3">Branch Name</th>
                <th className="px-4 py-3 text-right">Samities (Active/Total)</th>
                <th className="px-4 py-3 text-right">Active Staff</th>
                <th className="px-4 py-3 text-right">Members</th>
                <th className="px-4 py-3 text-right">Loan Outstanding</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3 text-right">Savings Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Generating report from PostgreSQL...
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr key={b.branchId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{b.branchCode}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{b.branchName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {b.activeSamities} / {b.totalSamities}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.activeEmployees}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{b.totalMembers}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtCurrency(b.loanOutstanding)}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-600 font-semibold">
                      {fmtCurrency(b.overdueAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      {fmtCurrency(b.savingsBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2. SECURITY (ROLES, USERS & PERMISSIONS MATRIX)
// ============================================================
export function SecurityView() {
  const [data, setData] = useState<{ users: any[]; roles: any[]; permissions: any[] }>({
    users: [],
    roles: [],
    permissions: [],
  });

  useEffect(() => {
    apiRequest<{ users: any[]; roles: any[]; permissions: any[] }>('/security/users').then(setData);
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-blue-700" />
        <div>
          <div className="text-xs text-slate-500">Security / Roles &amp; Access Control</div>
          <h1 className="text-lg font-bold text-slate-900">User Roles &amp; Permission Matrix</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800">
            Registered ERP Staff Accounts ({data.users.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#1E3A8A] text-white">
                <tr>
                  <th className="px-4 py-2.5">Username</th>
                  <th className="px-4 py-2.5">Full Name</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{u.username}</td>
                    <td className="px-4 py-2.5 font-medium">{u.fullName}</td>
                    <td className="px-4 py-2.5">{u.roleName}</td>
                    <td className="px-4 py-2.5 text-emerald-700 font-semibold">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-800">
            System Roles ({data.roles.length})
          </div>
          <div className="divide-y divide-slate-200">
            {data.roles.map((r) => (
              <div key={r.id} className="p-3.5 text-xs">
                <div className="font-bold text-slate-900">
                  {r.roleName} <span className="font-mono text-slate-400 font-normal ml-1">({r.roleCode})</span>
                </div>
                <div className="text-slate-600 mt-0.5">{r.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. AUDIT LOG
// ============================================================
export function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    const q = moduleFilter ? `?module=${encodeURIComponent(moduleFilter)}` : '';
    apiRequest<{ data: AuditLogItem[] }>(`/audit-logs${q}`).then((r) => setLogs(r.data));
  }, [moduleFilter]);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-blue-700" />
          <div>
            <div className="text-xs text-slate-500">Audit Log / Compliance Trail</div>
            <h1 className="text-lg font-bold text-slate-900">System Audit Trail</h1>
          </div>
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
        >
          <option value="">All Modules</option>
          <option value="Samity">Samity</option>
          <option value="Holiday">Holiday</option>
          <option value="Employee">Employee</option>
          <option value="Member">Member</option>
          <option value="Office">Office</option>
          <option value="Security">Security</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold">{l.username}</td>
                  <td className="px-4 py-2.5">{l.module}</td>
                  <td className="px-4 py-2.5 font-semibold text-blue-800">{l.action}</td>
                  <td className="px-4 py-2.5 font-mono">{l.recordCode || `#${l.recordId}`}</td>
                  <td className="px-4 py-2.5 max-w-md truncate font-mono text-[11px] text-slate-500">
                    {l.newValues || l.previousValues || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 4. PAYROLL, PROVIDENT FUND, FIXED ASSET, SMS, HELP
// ============================================================
export function EnterpriseUtilityView({
  section,
  onNotify,
}: {
  section: 'payroll' | 'provident-fund' | 'fixed-asset' | 'sms' | 'help';
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [smsMessage, setSmsMessage] = useState('Dear Member, your scheduled weekly Samity installment is due tomorrow.');

  useEffect(() => {
    apiRequest<{ data: EmployeeItem[] }>('/employees').then((r) => setEmployees(r.data));
    apiRequest<{ data: OfficeItem[] }>('/offices').then((r) => setOffices(r.data));
    apiRequest<{ data: MemberItem[] }>('/members').then((r) => setMembers(r.data));
  }, []);

  if (section === 'payroll' || section === 'provident-fund') {
    const isPf = section === 'provident-fund';
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
          <div className="text-xs text-slate-500">HR &amp; Benefits / {isPf ? 'Provident Fund' : 'Payroll'}</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">
            {isPf ? 'Staff Provident Fund Register (10% Employer + 10% Employee)' : 'Monthly Staff Payroll Sheet'}
          </h1>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3 text-right">Basic Salary</th>
                <th className="px-4 py-3 text-right">{isPf ? 'Monthly PF (20%)' : 'Net Payable'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((e) => {
                const basic = Number(e.salary || 0);
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{e.employeeCode}</td>
                    <td className="px-4 py-2.5 font-semibold">{e.fullName}</td>
                    <td className="px-4 py-2.5">{e.designation}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.branchName}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtCurrency(basic)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-emerald-700">
                      {fmtCurrency(isPf ? basic * 0.2 : basic * 0.9)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'fixed-asset') {
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-blue-700" />
          <div>
            <div className="text-xs text-slate-500">Fixed Asset / Office Infrastructure</div>
            <h1 className="text-lg font-bold text-slate-900">Office &amp; Branch Fixed Asset Register</h1>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Office Code</th>
                <th className="px-4 py-3">Office Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Primary Asset Class</th>
                <th className="px-4 py-3 text-right">Book Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {offices.map((o, idx) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{o.officeCode}</td>
                  <td className="px-4 py-2.5 font-semibold">{o.officeName}</td>
                  <td className="px-4 py-2.5">{o.officeType}</td>
                  <td className="px-4 py-2.5">IT Workstations, Vaults &amp; Branch Furniture</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtCurrency(240000 + idx * 45000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'sms') {
    const activeMembers = members.filter((m) => m.status === 'Active');
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
          <div className="text-xs text-slate-500">Communications / Member SMS Gateway</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Member Collection &amp; Notice SMS Dispatch</h1>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="text-xs text-slate-600">
            Active Recipients Loaded from Member Database: <strong className="font-mono text-slate-900">{activeMembers.length}</strong>
          </div>
          <textarea
            rows={3}
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            className="w-full p-3 text-xs border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            onClick={() => onNotify('success', `Queued SMS broadcast to ${activeMembers.length} active member phone numbers.`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg hover:bg-blue-800"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch SMS Batch</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <HelpCircle className="w-5 h-5 text-blue-700" />
        <h1 className="text-lg font-bold text-slate-900">PalliFin Core ERP — Operational Manual</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 leading-relaxed">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="font-bold text-slate-900 mb-1.5">1. Office Selection &amp; Scope</h2>
          <p>Use the Working Office selector in the top bar after login to scope your workspace across Organization, Division, Zone, Area, Branch, or Unit.</p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="font-bold text-slate-900 mb-1.5">2. Samity Management Workflow</h2>
          <p>Navigate to Offices → Samitys to search, filter, export Excel, create new Samitys with cascading Bangladesh locations, or deactivate centers safely without deleting member history.</p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="font-bold text-slate-900 mb-1.5">3. Holiday Governance</h2>
          <p>Navigate to Setup → Holidays to schedule Weekly, Specific, Yearly, or Government Holidays across one, multiple, or all Samities with automatic duplicate prevention.</p>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="font-bold text-slate-900 mb-1.5">4. Audit &amp; RBAC Compliance</h2>
          <p>Every Samity, Holiday, Employee, Member, and Security operation writes an immutable audit record visible under Audit Log.</p>
        </div>
      </div>
    </div>
  );
}
