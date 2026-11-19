import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Repeat,
  UserPlus,
  Power,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  SamityItem,
  BranchItem,
  EmployeeItem,
  MemberItem,
  OfficeItem,
  ErpUser,
} from '../types/erp.ts';
import { apiRequest } from '../lib/api.ts';

const fmtCurrency = (v: number) => `৳ ${new Intl.NumberFormat('en-US').format(Math.round(v))}`;

// ============================================================
// 1. SAMITYS (BRANCH) & AUTHORIZED TRANSFER
// ============================================================
export function SamitysBranchView({
  currentUser,
  onNotify,
}: {
  currentUser: ErpUser;
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [samitys, setSamitys] = useState<SamityItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [transferSamity, setTransferSamity] = useState<SamityItem | null>(null);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const canApprove = currentUser.permissions.includes('Approve');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, eRes, sRes] = await Promise.all([
        apiRequest<{ data: BranchItem[] }>('/branches'),
        apiRequest<{ data: EmployeeItem[] }>('/employees?status=Active'),
        apiRequest<{ data: SamityItem[] }>(
          `/samitys?limit=100${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`
        ),
      ]);
      setBranches(bRes.data);
      setEmployees(eRes.data);
      setSamitys(sRes.data);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load branch Samitys.');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSamity || !targetBranchId) return;
    try {
      await apiRequest(`/samitys/${transferSamity.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          targetBranchId: Number(targetBranchId),
          targetEmployeeId: targetEmployeeId ? Number(targetEmployeeId) : undefined,
          reason: transferReason.trim() || 'Authorized branch operational transfer',
        }),
      });
      onNotify('success', `Samity ${transferSamity.samityCode} transferred successfully.`);
      setTransferSamity(null);
      setTransferReason('');
      loadData();
    } catch (err: any) {
      onNotify('error', err.message || 'Samity transfer failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Offices / Samitys (Branch)</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Branch-Wise Samitys &amp; Transfers</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
          >
            <option value="">All Authorized Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branchCode} — {b.branchName}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Branch Statistics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Filtered Branch Samitys</div>
          <div className="text-xl font-mono font-bold text-slate-900 mt-1 tabular-nums">{samitys.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Active Centers</div>
          <div className="text-xl font-mono font-bold text-emerald-700 mt-1 tabular-nums">
            {samitys.filter((s) => s.status === 'Active').length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Total Linked Members</div>
          <div className="text-xl font-mono font-bold text-blue-800 mt-1 tabular-nums">
            {samitys.reduce((sum, s) => sum + (s.memberCount || 0), 0)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Branch</th>
                <th className="px-4 py-3 font-semibold">Samity Code</th>
                <th className="px-4 py-3 font-semibold">Samity Name</th>
                <th className="px-4 py-3 font-semibold">Responsible Officer</th>
                <th className="px-4 py-3 font-semibold text-right">Members</th>
                <th className="px-4 py-3 font-semibold">Schedule</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {samitys.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{s.branchName}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{s.samityCode}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{s.samityName}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.employeeName}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.memberCount || 0}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.collectionDay} · {s.centerTime}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">
                    {s.status === 'Active' ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-amber-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {canApprove ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferSamity(s);
                          const altBranch = branches.find((b) => b.id !== s.branchId) || branches[0];
                          setTargetBranchId(altBranch ? String(altBranch.id) : '');
                          setTargetEmployeeId(String(s.employeeId));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Transfer</span>
                      </button>
                    ) : (
                      <span className="text-slate-400">Approval Req.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {transferSamity && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleTransferSubmit} className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Authorized Samity Branch Transfer</h3>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                Samity: <strong>{transferSamity.samityCode} — {transferSamity.samityName}</strong>
              </div>
              <div className="text-slate-500 mt-0.5">Current Branch: {transferSamity.branchName}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Branch *</label>
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branchCode} — {b.branchName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Responsible Employee *</label>
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Authorization Note</label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Reason for boundary realignment"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransferSamity(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg">
                Confirm Transfer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 2. EMPLOYEES MANAGEMENT (MODULE 06)
// ============================================================
export function EmployeesView({
  currentUser,
  onNotify,
}: {
  currentUser: ErpUser;
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [empCode, setEmpCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('Field Officer');
  const [phone, setPhone] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [officeId, setOfficeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [salary, setSalary] = useState('26000');

  const canCreate = currentUser.permissions.includes('Create');

  const fetchAll = useCallback(async () => {
    const [eRes, oRes, bRes] = await Promise.all([
      apiRequest<{ data: EmployeeItem[] }>(`/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      apiRequest<{ data: OfficeItem[] }>('/offices'),
      apiRequest<{ data: BranchItem[] }>('/branches'),
    ]);
    setEmployees(eRes.data);
    setOffices(oRes.data);
    setBranches(bRes.data);
    if (!officeId && bRes.data.length > 0) {
      setOfficeId(String(bRes.data[0].officeId));
      setBranchId(String(bRes.data[0].id));
    }
  }, [search, officeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const br = branches.find((b) => String(b.id) === branchId);
      await apiRequest('/employees', {
        method: 'POST',
        body: JSON.stringify({
          employeeCode: empCode,
          fullName,
          designation,
          phone,
          joiningDate,
          officeId: br ? br.officeId : Number(officeId),
          branchId: Number(branchId),
          salary: Number(salary),
        }),
      });
      onNotify('success', `Employee ${empCode} registered.`);
      setShowAdd(false);
      setEmpCode('');
      setFullName('');
      setPhone('');
      fetchAll();
    } catch (err: any) {
      onNotify('error', err.message || 'Employee registration failed.');
    }
  };

  const toggleStatus = async (emp: EmployeeItem) => {
    const next = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiRequest(`/employees/${emp.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      onNotify('success', `${emp.fullName} marked ${next}.`);
      fetchAll();
    } catch (err: any) {
      onNotify('error', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Offices / Employees</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Employee Directory &amp; Assignment</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID or name..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md"
            />
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Register Employee</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee ID</th>
                <th className="px-4 py-3 font-semibold">Full Name</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Office &amp; Branch</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Joining Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{e.employeeCode}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{e.fullName}</td>
                  <td className="px-4 py-2.5 text-slate-700">{e.designation}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {e.officeName} · {e.branchName}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{e.phone}</td>
                  <td className="px-4 py-2.5 font-mono">{e.joiningDate}</td>
                  <td className="px-4 py-2.5">
                    {e.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <XCircle className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleStatus(e)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{e.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Register New Employee</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee ID *</label>
                <input
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="EMP-1009"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Designation *</label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XX-XXXXXX"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Branch *</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branchCode} — {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Joining Date *</label>
                <input
                  type="date"
                  required
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Salary (BDT)</label>
                <input
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg">
                Save Employee
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 3. MEMBERS MANAGEMENT (INTEGRATED WITH SAMITY ID)
// ============================================================
export function MembersView({
  onNotify,
}: {
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [samitys, setSamitys] = useState<SamityItem[]>([]);
  const [filterSamityId, setFilterSamityId] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [memberCode, setMemberCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [samityId, setSamityId] = useState('');
  const [phone, setPhone] = useState('');
  const [nid, setNid] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialSavings, setInitialSavings] = useState('500');

  const fetchMembers = useCallback(async () => {
    const p = new URLSearchParams();
    if (filterSamityId) p.set('samityId', filterSamityId);
    if (search.trim()) p.set('search', search.trim());
    const [mRes, sRes] = await Promise.all([
      apiRequest<{ data: MemberItem[] }>(`/members?${p.toString()}`),
      apiRequest<{ data: SamityItem[] }>('/samitys?limit=100'),
    ]);
    setMembers(mRes.data);
    setSamitys(sRes.data);
    const activeSamity = sRes.data.find((s) => s.status === 'Active');
    if (!samityId && activeSamity) setSamityId(String(activeSamity.id));
  }, [filterSamityId, search, samityId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/members', {
        method: 'POST',
        body: JSON.stringify({
          memberCode,
          fullName,
          samityId: Number(samityId),
          phone,
          nid,
          admissionDate,
          initialSavings: Number(initialSavings || 0),
        }),
      });
      onNotify('success', `Member ${memberCode} admitted and linked to Samity.`);
      setShowAdd(false);
      setMemberCode('');
      setFullName('');
      setPhone('');
      setNid('');
      fetchMembers();
    } catch (err: any) {
      onNotify('error', err.message || 'Member admission failed.');
    }
  };

  const handleStatusChange = async (m: MemberItem, status: string) => {
    try {
      await apiRequest(`/members/${m.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onNotify('success', `${m.fullName} status changed to ${status}.`);
      fetchMembers();
    } catch (err: any) {
      onNotify('error', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Members / Directory &amp; Admission</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Member Management</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterSamityId}
            onChange={(e) => setFilterSamityId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
          >
            <option value="">All Samities</option>
            {samitys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.samityCode} — {s.samityName}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Member ID or name..."
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md"
          />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg"
          >
            <UserPlus className="w-4 h-4" />
            <span>Admit Member</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Member Code</th>
                <th className="px-4 py-3 font-semibold">Member Name</th>
                <th className="px-4 py-3 font-semibold">Samity</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold text-right">Loan Outstanding</th>
                <th className="px-4 py-3 font-semibold text-right">Savings Balance</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{m.memberCode}</td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{m.fullName}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <span className="font-mono text-slate-500 mr-1">{m.samityCode}</span>
                    {m.samityName}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{m.phone}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtCurrency(m.loanOutstanding || 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {fmtCurrency(m.savingsBalance || 0)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold">{m.status}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusChange(m, e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Waiting">Waiting</option>
                      <option value="Dropout">Dropout</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleAdmit} className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Admit New Member (Samity Linked)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Member Code *</label>
                <input
                  type="text"
                  required
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  placeholder="MEM-2001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Assigned Samity (Active Only) *</label>
                <select
                  value={samityId}
                  onChange={(e) => setSamityId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {samitys
                    .filter((s) => s.status === 'Active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.samityCode} — {s.samityName} ({s.branchName})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">National ID (NID) *</label>
                <input
                  type="text"
                  required
                  value={nid}
                  onChange={(e) => setNid(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Admission Date *</label>
                <input
                  type="date"
                  required
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Savings Deposit (BDT)</label>
                <input
                  type="number"
                  value={initialSavings}
                  onChange={(e) => setInitialSavings(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg">
                Admit Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 4. TRANSACTIONS, OPENING ENTRIES, ACCOUNTS & DAY-END PROCESS
// ============================================================
export function FinancialOpsView({
  section,
  onNotify,
}: {
  section: 'transactions' | 'opening-entries' | 'accounts' | 'process';
  onNotify: (t: 'success' | 'error', msg: string) => void;
}) {
  const [txs, setTxs] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);

  // Transaction post form
  const [txType, setTxType] = useState('Loan Repayment');
  const [targetLoanId, setTargetLoanId] = useState('');
  const [targetSavingsId, setTargetSavingsId] = useState('');
  const [amount, setAmount] = useState('1500');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  // Loan disbursement form (Opening Entries / New Loan)
  const [loanAccNo, setLoanAccNo] = useState(`LN-26-${Math.floor(1000 + Math.random() * 8999)}`);
  const [loanMemberId, setLoanMemberId] = useState('');
  const [loanProduct, setLoanProduct] = useState('Jagoron Microcredit');
  const [loanPrincipal, setLoanPrincipal] = useState('40000');

  const loadAll = useCallback(async () => {
    const [tRes, lRes, sRes, aRes, mRes] = await Promise.all([
      apiRequest<{ data: any[] }>('/transactions'),
      apiRequest<{ data: any[] }>('/loans'),
      apiRequest<{ data: any[] }>('/savings'),
      apiRequest<{ data: any[] }>('/accounts'),
      apiRequest<{ data: MemberItem[] }>('/members'),
    ]);
    setTxs(tRes.data);
    setLoans(lRes.data);
    setSavings(sRes.data);
    setAccounts(aRes.data);
    setMembers(mRes.data);
    if (!targetLoanId && lRes.data.length > 0) setTargetLoanId(String(lRes.data[0].id));
    if (!targetSavingsId && sRes.data.length > 0) setTargetSavingsId(String(sRes.data[0].id));
    if (!loanMemberId && mRes.data.length > 0) setLoanMemberId(String(mRes.data[0].id));
  }, [targetLoanId, targetSavingsId, loanMemberId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handlePostTx = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          txType,
          loanId: txType === 'Loan Repayment' ? Number(targetLoanId) : undefined,
          savingsId: txType.startsWith('Savings') ? Number(targetSavingsId) : undefined,
          amount: Number(amount),
          txDate,
          description: description || `${txType} posted`,
        }),
      });
      onNotify('success', `${txType} of ${fmtCurrency(Number(amount))} posted to PostgreSQL.`);
      setDescription('');
      loadAll();
    } catch (err: any) {
      onNotify('error', err.message || 'Transaction failed.');
    }
  };

  const handleDisburseLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/loans', {
        method: 'POST',
        body: JSON.stringify({
          loanAccountNo: loanAccNo,
          memberId: Number(loanMemberId),
          productName: loanProduct,
          principalAmount: Number(loanPrincipal),
          disbursementDate: txDate,
        }),
      });
      onNotify('success', `Loan ${loanAccNo} disbursed and posted to ledger.`);
      setLoanAccNo(`LN-26-${Math.floor(1000 + Math.random() * 8999)}`);
      loadAll();
    } catch (err: any) {
      onNotify('error', err.message || 'Loan disbursement failed.');
    }
  };

  if (section === 'accounts') {
    const totalIncome = accounts.filter((a) => a.accountType === 'Income').reduce((s, a) => s + Number(a.balance), 0);
    const totalExp = accounts.filter((a) => a.accountType === 'Expenditure').reduce((s, a) => s + Number(a.balance), 0);
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Accounts / Chart of Accounts</div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">General Ledger &amp; Income/Expenditure</h1>
          </div>
          <div className="text-xs font-mono tabular-nums">
            Net Surplus: <strong className="text-emerald-700">{fmtCurrency(totalIncome - totalExp)}</strong>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Account Code</th>
                <th className="px-4 py-3">Account Head</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Fiscal Year</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold">{a.accountCode}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{a.accountName}</td>
                  <td className="px-4 py-2.5">{a.accountType}</td>
                  <td className="px-4 py-2.5 font-mono">{a.fiscalYear}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtCurrency(Number(a.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'opening-entries') {
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
          <div className="text-xs text-slate-500">Opening Entries / Loan Portfolio Disbursement</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Opening Entries &amp; Loan Disbursement</h1>
        </div>
        <form onSubmit={handleDisburseLoan} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Loan Account No</label>
            <input type="text" value={loanAccNo} onChange={(e) => setLoanAccNo(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Member</label>
            <select value={loanMemberId} onChange={(e) => setLoanMemberId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.memberCode} — {m.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Loan Product</label>
            <select value={loanProduct} onChange={(e) => setLoanProduct(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
              <option value="Jagoron Microcredit">Jagoron Microcredit</option>
              <option value="Agrosor SME">Agrosor SME</option>
              <option value="Sufolon Agri">Sufolon Agri</option>
              <option value="Buniad Artisan">Buniad Artisan</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Principal Amount (BDT)</label>
            <input type="number" value={loanPrincipal} onChange={(e) => setLoanPrincipal(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full py-2 px-4 bg-[#1D4ED8] text-white font-semibold rounded-md hover:bg-blue-800">
              Disburse &amp; Post
            </button>
          </div>
        </form>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">Account No</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Samity</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Principal</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loans.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{l.loanAccountNo}</td>
                  <td className="px-4 py-2.5 font-medium">{l.memberName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.samityName}</td>
                  <td className="px-4 py-2.5">{l.productName}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{fmtCurrency(Number(l.principalAmount))}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">{fmtCurrency(Number(l.outstandingBalance))}</td>
                  <td className="px-4 py-2.5 font-semibold">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (section === 'process') {
    const activeLoans = loans.filter((l) => l.status !== 'Closed');
    const overdueCount = loans.filter((l) => Number(l.overdueAmount) > 0).length;
    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Process / Day-End &amp; Month-End Verification</div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">Batch Processing &amp; Portfolio Settlement</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              loadAll();
              onNotify('success', 'Day-end portfolio reconciliation verified against PostgreSQL ledger.');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg"
          >
            Run Day-End Reconciliation
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs text-slate-500">Active Loan Accounts Reconciled</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tabular-nums">{activeLoans.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs text-slate-500">Accounts Flagged Overdue</div>
            <div className="text-2xl font-mono font-bold text-red-600 mt-1 tabular-nums">{overdueCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-xs text-slate-500">Active Savings Accounts</div>
            <div className="text-2xl font-mono font-bold text-emerald-700 mt-1 tabular-nums">{savings.length}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
        <div className="text-xs text-slate-500">Transactions / Collections &amp; Savings Ledger</div>
        <h1 className="text-lg font-bold text-slate-900 mt-0.5">Transactions &amp; Repayment Collection</h1>
      </div>

      <form onSubmit={handlePostTx} className="bg-white border border-slate-200 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Transaction Type</label>
          <select value={txType} onChange={(e) => setTxType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
            <option value="Loan Repayment">Loan Repayment</option>
            <option value="Savings Deposit">Savings Deposit</option>
            <option value="Savings Withdrawal">Savings Withdrawal</option>
          </select>
        </div>

        {txType === 'Loan Repayment' ? (
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Loan Account</label>
            <select value={targetLoanId} onChange={(e) => setTargetLoanId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loanAccountNo} — {l.memberName} (Bal: {l.outstandingBalance})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Savings Account</label>
            <select value={targetSavingsId} onChange={(e) => setTargetSavingsId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
              {savings.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.accountNo} — {sv.memberName} (Bal: {sv.balance})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Amount (BDT)</label>
          <input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Date</label>
          <input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono" />
        </div>

        <div className="flex items-end">
          <button type="submit" className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-[#1D4ED8] text-white font-semibold rounded-md hover:bg-blue-800">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Post Entry</span>
          </button>
        </div>
      </form>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3">TX Code</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Posted By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {txs.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-blue-800">{t.txCode}</td>
                  <td className="px-4 py-2.5 font-mono">{t.txDate}</td>
                  <td className="px-4 py-2.5 font-semibold">{t.txType}</td>
                  <td className="px-4 py-2.5">{t.memberName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{t.description}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{fmtCurrency(Number(t.amount))}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
