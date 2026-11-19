import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Download,
  RefreshCw,
  Printer,
  Search,
  RotateCcw,
  Eye,
  Pencil,
  Power,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  SamityItem,
  OfficeItem,
  BranchItem,
  EmployeeItem,
  MemberItem,
  AuditLogItem,
  ErpUser,
} from '../types/erp.ts';
import { apiRequest, downloadExcelExport } from '../lib/api.ts';

interface SamityListViewProps {
  currentUser: ErpUser;
  selectedOffice: OfficeItem | null;
  onAddNew: () => void;
  onEdit: (samity: SamityItem) => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const fmtCurrency = (v: number) => `৳ ${new Intl.NumberFormat('en-US').format(Math.round(v))}`;

export function SamityListView({
  currentUser,
  selectedOffice,
  onAddNew,
  onEdit,
  onNotify,
}: SamityListViewProps) {
  const [rows, setRows] = useState<SamityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalActive: 0, totalInactive: 0 });
  const [loading, setLoading] = useState(true);

  // Dynamic Filter Dropdowns
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  // Filter state
  const [officeId, setOfficeId] = useState(selectedOffice ? String(selectedOffice.id) : '');
  const [branchId, setBranchId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [collectionDay, setCollectionDay] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('samityCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // View Details Modal state
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    samity: SamityItem;
    office: OfficeItem;
    branch: BranchItem;
    employee: EmployeeItem;
    geo: any;
    stats: {
      totalMembers: number;
      activeMembers: number;
      inactiveMembers: number;
      activeLoansCount: number;
      totalLoanOutstanding: number;
      totalSavingsBalance: number;
    };
    members: MemberItem[];
    auditHistory: AuditLogItem[];
  } | null>(null);

  const canCreate = currentUser.permissions.includes('Create');
  const canEdit = currentUser.permissions.includes('Edit');
  const canExport = currentUser.permissions.includes('Export');

  useEffect(() => {
    if (selectedOffice) setOfficeId(String(selectedOffice.id));
  }, [selectedOffice]);

  useEffect(() => {
    apiRequest<{ data: OfficeItem[] }>('/offices').then((r) => setOffices(r.data));
  }, []);

  useEffect(() => {
    const q = officeId ? `?officeId=${officeId}` : '';
    apiRequest<{ data: BranchItem[] }>(`/branches${q}`).then((r) => {
      setBranches(r.data);
      if (branchId && !r.data.some((b) => String(b.id) === branchId)) setBranchId('');
    });
    apiRequest<{ data: EmployeeItem[] }>(`/employees${q}`).then((r) => {
      setEmployees(r.data);
      if (employeeId && !r.data.some((e) => String(e.id) === employeeId)) setEmployeeId('');
    });
  }, [officeId]);

  const buildQueryString = useCallback(
    (includePaging = true) => {
      const p = new URLSearchParams();
      if (officeId) p.set('officeId', officeId);
      if (branchId) p.set('branchId', branchId);
      if (employeeId) p.set('employeeId', employeeId);
      if (collectionDay) p.set('collectionDay', collectionDay);
      if (status) p.set('status', status);
      if (search.trim()) p.set('search', search.trim());
      p.set('sortBy', sortBy);
      p.set('sortDir', sortDir);
      if (includePaging) {
        p.set('page', String(page));
        p.set('limit', String(limit));
      }
      return p.toString();
    },
    [officeId, branchId, employeeId, collectionDay, status, search, sortBy, sortDir, page, limit]
  );

  const fetchSamitys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        data: SamityItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        summary: { totalActive: number; totalInactive: number };
      }>(`/samitys?${buildQueryString(true)}`);
      setRows(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setSummary(res.summary);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load Samity records.');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString, onNotify]);

  useEffect(() => {
    fetchSamitys();
  }, [fetchSamitys]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleReset = () => {
    setOfficeId(selectedOffice ? String(selectedOffice.id) : '');
    setBranchId('');
    setEmployeeId('');
    setCollectionDay('');
    setStatus('');
    setSearch('');
    setPage(1);
  };

  const handleToggleStatus = async (s: SamityItem) => {
    const nextStatus = s.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiRequest(`/samitys/${s.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      onNotify('success', `Samity ${s.samityCode} is now ${nextStatus}.`);
      fetchSamitys();
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to change Samity status.');
    }
  };

  const handleViewDetails = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await apiRequest<any>(`/samitys/${id}`);
      setDetailData(res);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load Samity details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadExcelExport(buildQueryString(false));
      onNotify('success', 'Samity List exported to Excel (.xlsx).');
    } catch (err: any) {
      onNotify('error', err.message || 'Excel export failed.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Offices / Samitys / Samity List</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Samity List</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {canCreate && (
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add New</span>
            </button>
          )}
          {canExport && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Export Excel</span>
            </button>
          )}
          <button
            type="button"
            onClick={fetchSamitys}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Office</label>
            <select
              value={officeId}
              onChange={(e) => {
                setOfficeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Authorized Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.officeCode} — {o.officeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchCode} — {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeCode} — {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">CollectionDay</label>
            <select
              value={collectionDay}
              onChange={(e) => {
                setCollectionDay(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Days</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Samity</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchSamitys();
                  }
                }}
                placeholder="Code or Name..."
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  fetchSamitys();
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-md shrink-0"
                title="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shrink-0"
                title="Reset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Line */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-3 tabular-nums">
            <span>
              Total Matched: <strong className="text-slate-900 font-mono">{total}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Active: <strong className="text-emerald-700 font-mono">{summary.totalActive}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Inactive: <strong className="text-amber-700 font-mono">{summary.totalInactive}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print-container">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-3 py-3 font-semibold">SL</th>
                <th className="px-3 py-3 font-semibold">Office</th>
                <th className="px-3 py-3 font-semibold">
                  <button type="button" onClick={() => handleSort('samityCode')} className="inline-flex items-center gap-1 hover:text-blue-200">
                    <span>Samity Code</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">
                  <button type="button" onClick={() => handleSort('samityName')} className="inline-flex items-center gap-1 hover:text-blue-200">
                    <span>Samity Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">CollectionType</th>
                <th className="px-3 py-3 font-semibold">Employee Name</th>
                <th className="px-3 py-3 font-semibold">Address</th>
                <th className="px-3 py-3 font-semibold">
                  <button type="button" onClick={() => handleSort('collectionDay')} className="inline-flex items-center gap-1 hover:text-blue-200">
                    <span>Coll day</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">Coll Date</th>
                <th className="px-3 py-3 font-semibold">
                  <button type="button" onClick={() => handleSort('openingDate')} className="inline-flex items-center gap-1 hover:text-blue-200">
                    <span>Opening Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Samity Type</th>
                <th className="px-3 py-3 font-semibold">Center Time</th>
                <th className="px-3 py-3 font-semibold text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    Loading Samity records from PostgreSQL...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center text-slate-500">
                    No Samity records found. Adjust your filters or click Add New.
                  </td>
                </tr>
              ) : (
                rows.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-500">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-slate-500 mr-1">{s.officeCode}</span>
                      <span className="text-slate-800">{s.officeName}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-blue-800 tabular-nums">
                      {s.samityCode}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{s.samityName}</div>
                      {s.samityNameBn && <div className="text-[11px] text-slate-500">{s.samityNameBn}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{s.collectionType}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-900 font-medium">{s.employeeName}</div>
                      <div className="text-[11px] font-mono text-slate-500">{s.employeeCode}</div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px] truncate text-slate-600" title={s.samityAddress}>
                      {s.samityAddress}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{s.collectionDay}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{s.collectionDate}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{s.openingDate}</td>
                    <td className="px-3 py-2.5">
                      {s.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <XCircle className="w-3.5 h-3.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{s.samityType}</td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{s.centerTime}</td>
                    <td className="px-3 py-2.5 no-print">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(s.id)}
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(s)}
                              className="p-1.5 text-slate-700 hover:bg-slate-100 rounded"
                              title="Edit Samity"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              className={`p-1.5 rounded ${
                                s.status === 'Active'
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={s.status === 'Active' ? 'Deactivate Samity' : 'Activate Samity'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 no-print">
          <div className="tabular-nums">
            Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong> ·{' '}
            {total} record(s)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      {(detailLoading || detailData) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">
                  {detailLoading ? 'Loading Samity Profile...' : `${detailData?.samity.samityCode} — ${detailData?.samity.samityName}`}
                </h3>
                {detailData?.samity.samityNameBn && (
                  <p className="text-xs text-blue-200">{detailData.samity.samityNameBn}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailData(null)}
                className="text-blue-200 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-xs text-slate-500">Fetching live member, loan, savings, and audit records...</div>
            ) : (
              detailData && (
                <div className="p-6 overflow-y-auto space-y-6 text-xs">
                  {/* Calculated Portfolio Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Total Members</div>
                      <div className="text-base font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                        {detailData.stats.totalMembers}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Active Members</div>
                      <div className="text-base font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                        {detailData.stats.activeMembers}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Inactive / Other</div>
                      <div className="text-base font-mono font-bold text-amber-700 mt-0.5 tabular-nums">
                        {detailData.stats.inactiveMembers}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Active Loans ({detailData.stats.activeLoansCount})</div>
                      <div className="text-base font-mono font-bold text-blue-800 mt-0.5 tabular-nums">
                        {fmtCurrency(detailData.stats.totalLoanOutstanding)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-slate-500">Total Savings</div>
                      <div className="text-base font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                        {fmtCurrency(detailData.stats.totalSavingsBalance)}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-900">Office &amp; Branch</div>
                      <div>Office: {detailData.office?.officeCode} — {detailData.office?.officeName}</div>
                      <div>Branch: {detailData.branch?.branchCode} — {detailData.branch?.branchName}</div>
                      <div>Location: {detailData.samity.location}</div>
                      <div>Address: {detailData.samity.samityAddress}</div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-900">Schedule &amp; Officer</div>
                      <div>Employee: {detailData.employee?.fullName} ({detailData.employee?.employeeCode})</div>
                      <div>Designation: {detailData.employee?.designation}</div>
                      <div>Collection: {detailData.samity.collectionType} · {detailData.samity.collectionDay} at {detailData.samity.centerTime}</div>
                      <div>Opening Date: <span className="font-mono">{detailData.samity.openingDate}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-900">Administrative Geography</div>
                      <div>Division: {detailData.geo?.division?.divisionName || '—'}</div>
                      <div>District: {detailData.geo?.district?.districtName || '—'}</div>
                      <div>Upazila: {detailData.geo?.upazila?.upazilaName || '—'}</div>
                      <div>Union: {detailData.geo?.union ? `${detailData.geo.union.unionCode} (${detailData.geo.union.unionName})` : '—'}</div>
                    </div>
                  </div>

                  {/* Associated Members */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="font-bold text-slate-900 mb-2">Registered Members ({detailData.members.length})</div>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-3 py-2">Member Code</th>
                            <th className="px-3 py-2">Full Name</th>
                            <th className="px-3 py-2">Phone</th>
                            <th className="px-3 py-2">Admission</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {detailData.members.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                                No members admitted to this Samity yet.
                              </td>
                            </tr>
                          ) : (
                            detailData.members.map((m) => (
                              <tr key={m.id}>
                                <td className="px-3 py-2 font-mono font-semibold">{m.memberCode}</td>
                                <td className="px-3 py-2">{m.fullName} {m.fullNameBn ? `(${m.fullNameBn})` : ''}</td>
                                <td className="px-3 py-2 font-mono">{m.phone}</td>
                                <td className="px-3 py-2 font-mono">{m.admissionDate}</td>
                                <td className="px-3 py-2 font-semibold">{m.status}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Audit Trail */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="font-bold text-slate-900 mb-2">Audit History ({detailData.auditHistory.length})</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {detailData.auditHistory.map((log) => (
                        <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-blue-800">{log.action}</span>
                            <span className="text-slate-600 ml-2">by {log.username}</span>
                          </div>
                          <span className="font-mono text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
