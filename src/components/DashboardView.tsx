import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Users, Wallet, AlertTriangle, Calendar, ArrowUpRight } from 'lucide-react';
import { DashboardData, OfficeItem, BranchItem } from '../types/erp.ts';
import { apiRequest } from '../lib/api.ts';

interface DashboardViewProps {
  selectedOffice: OfficeItem | null;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

const fmtCurrency = (v: number) =>
  `৳ ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v))}`;

export function DashboardView({ selectedOffice, onNotify }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [officeId, setOfficeId] = useState<string>(selectedOffice ? String(selectedOffice.id) : '');
  const [branchId, setBranchId] = useState<string>('');
  const [fiscalYear, setFiscalYear] = useState<string>('ALL');
  const [month, setMonth] = useState<string>('2026-11');
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredPie, setHoveredPie] = useState<string | null>(null);
  const [hoveredBarFy, setHoveredBarFy] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOffice) {
      setOfficeId(String(selectedOffice.id));
    }
  }, [selectedOffice]);

  useEffect(() => {
    apiRequest<{ data: OfficeItem[] }>('/offices')
      .then((res) => setOffices(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = officeId ? `?officeId=${officeId}` : '';
    apiRequest<{ data: BranchItem[] }>(`/branches${q}`)
      .then((res) => {
        setBranches(res.data);
        if (branchId && !res.data.some((b) => String(b.id) === branchId)) {
          setBranchId('');
        }
      })
      .catch(() => {});
  }, [officeId]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (officeId) params.set('officeId', officeId);
      if (branchId) params.set('branchId', branchId);
      if (fiscalYear) params.set('fiscalYear', fiscalYear);
      if (month) params.set('month', month);

      const res = await apiRequest<DashboardData>(`/dashboard?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, [officeId, branchId, fiscalYear, month, onNotify]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Pie Chart Calculations
  const ratio = data?.memberRatio || { total: 0, borrowers: 0, dormant: 0, waiting: 0, borrowerPct: 0, dormantPct: 0 };
  const pieTotal = Math.max(1, ratio.borrowers + ratio.dormant + ratio.waiting);
  const borrowerAngle = (ratio.borrowers / pieTotal) * 360;
  const waitingAngle = (ratio.waiting / pieTotal) * 360;
  const dormantAngle = 360 - borrowerAngle - waitingAngle;

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    if (endAngle - startAngle >= 359.99) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
    }
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  }

  const maxChartVal = Math.max(
    1,
    ...(data?.yearlyPerformance || []).flatMap((y) => [y.disbursement, y.repayment, y.savings])
  );

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Executive Portfolio Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live database calculations · {selectedOffice ? `${selectedOffice.officeCode} ${selectedOffice.officeName}` : 'All Authorized Offices'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              aria-label="Filter by office"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            >
              <option value="">All Authorized Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.officeCode} — {o.officeName}
                </option>
              ))}
            </select>

            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              aria-label="Filter by branch"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchCode} — {b.branchName}
                </option>
              ))}
            </select>

            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              aria-label="Filter by financial year"
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Financial Years</option>
              <option value="2025-2026">FY 2025–2026</option>
              <option value="2024-2025">FY 2024–2025</option>
              <option value="2023-2024">FY 2023–2024</option>
            </select>

            <div className="flex items-center gap-1.5 border border-slate-300 rounded-md px-2.5 py-1.5 bg-white">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Filter month"
                className="text-xs text-slate-800 focus:outline-none tabular-nums"
              />
            </div>

            <button
              type="button"
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* A. Current Month Repayment Status */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Current Month Repayment Status</span>
            <Wallet className="w-4 h-4 text-blue-200" />
          </div>
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Recoverable</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {fmtCurrency(data?.repaymentStatus.recoverable || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Collections</span>
              <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                {fmtCurrency(data?.repaymentStatus.collections || 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Overdue</span>
              <span className="font-mono font-bold text-red-600 tabular-nums">
                {fmtCurrency(data?.repaymentStatus.overdue || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* B. Profit / Loss */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Profit / Loss</span>
            <TrendingUp className="w-4 h-4 text-blue-200" />
          </div>
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Income</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {fmtCurrency(data?.profitLoss.income || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Expenditure</span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {fmtCurrency(data?.profitLoss.expenditure || 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Net Surplus / (Loss)</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  (data?.profitLoss.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {fmtCurrency(data?.profitLoss.netProfit || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* C. Current Month Progress */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Current Month Progress</span>
            <ArrowUpRight className="w-4 h-4 text-blue-200" />
          </div>
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Admission ({month})</span>
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                {data?.monthProgress.admission || 0} members
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Disbursement ({month})</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {fmtCurrency(data?.monthProgress.disbursement || 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Dropout</span>
              <span className="font-mono font-bold text-amber-700 tabular-nums">
                {data?.monthProgress.dropout || 0} members
              </span>
            </div>
          </div>
        </div>

        {/* D. Member Statistics */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold">Member Statistics</span>
            <Users className="w-4 h-4 text-blue-200" />
          </div>
          <div className="p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Active Members</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {data?.memberStats.activeMembers || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Active Borrowers</span>
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                {data?.memberStats.borrowers || 0}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-slate-600 font-medium">Waiting for Loan</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {data?.memberStats.waitingForLoan || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Row 1: Realizable Till Today + Member/Borrower/Dormant Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. Realizable Till Today */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Realizable Till Today</h2>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled recoverable &amp; arrear position across active loan accounts</p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Realizable Amount</div>
                <div className="text-lg font-mono font-bold text-[#1E3A8A] mt-1 tabular-nums">
                  {fmtCurrency(data?.realizableToday.amount || 0)}
                </div>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500">Number of Accounts</div>
                <div className="text-lg font-mono font-bold text-slate-900 mt-1 tabular-nums">
                  {data?.realizableToday.accountCount || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Collection Recovery Ratio</span>
            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
              {data && data.repaymentStatus.recoverable > 0
                ? `${Math.round((data.repaymentStatus.collections / data.repaymentStatus.recoverable) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* 2. Member, Borrower & Dormant Ratio Interactive Pie Chart */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Member, Borrower &amp; Dormant Ratio</h2>
              <p className="text-xs text-slate-500">Hover any segment to inspect exact member counts and percentages</p>
            </div>
            <div className="text-xs text-slate-600 font-medium tabular-nums">
              Total Registered: <span className="font-mono font-bold text-slate-900">{ratio.total}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-6">
            <div className="sm:col-span-5 flex justify-center">
              <svg viewBox="0 0 220 220" className="w-44 h-44" role="img" aria-label="Member Borrower Dormant Ratio Pie Chart">
                {ratio.total === 0 ? (
                  <circle cx="110" cy="110" r="90" fill="#E2E8F0" />
                ) : (
                  <>
                    <path
                      d={arcPath(110, 110, 92, 0, borrowerAngle)}
                      fill="#1D4ED8"
                      className="transition-opacity cursor-pointer"
                      opacity={hoveredPie && hoveredPie !== 'borrowers' ? 0.45 : 1}
                      onMouseEnter={() => setHoveredPie('borrowers')}
                      onMouseLeave={() => setHoveredPie(null)}
                    />
                    <path
                      d={arcPath(110, 110, 92, borrowerAngle, borrowerAngle + waitingAngle)}
                      fill="#0EA5E9"
                      className="transition-opacity cursor-pointer"
                      opacity={hoveredPie && hoveredPie !== 'waiting' ? 0.45 : 1}
                      onMouseEnter={() => setHoveredPie('waiting')}
                      onMouseLeave={() => setHoveredPie(null)}
                    />
                    <path
                      d={arcPath(110, 110, 92, borrowerAngle + waitingAngle, 360)}
                      fill="#D97706"
                      className="transition-opacity cursor-pointer"
                      opacity={hoveredPie && hoveredPie !== 'dormant' ? 0.45 : 1}
                      onMouseEnter={() => setHoveredPie('dormant')}
                      onMouseLeave={() => setHoveredPie(null)}
                    />
                  </>
                )}
                <circle cx="110" cy="110" r="46" fill="#FFFFFF" />
                <text x="110" y="106" textAnchor="middle" className="fill-slate-900 font-mono font-bold text-base">
                  {hoveredPie === 'borrowers'
                    ? `${ratio.borrowerPct}%`
                    : hoveredPie === 'dormant'
                    ? `${ratio.dormantPct}%`
                    : `${ratio.borrowerPct}%`}
                </text>
                <text x="110" y="124" textAnchor="middle" className="fill-slate-500 text-[10px]">
                  {hoveredPie === 'dormant' ? 'Dormant' : hoveredPie === 'waiting' ? 'Waiting' : 'Borrowers'}
                </text>
              </svg>
            </div>

            <div className="sm:col-span-7 space-y-3">
              <div
                onMouseEnter={() => setHoveredPie('borrowers')}
                onMouseLeave={() => setHoveredPie(null)}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-[#1D4ED8] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">Active Borrowers</span>
                </div>
                <div className="text-xs font-mono tabular-nums">
                  <span className="font-bold text-slate-900">{ratio.borrowers}</span>
                  <span className="text-slate-500 ml-2">({ratio.borrowerPct}%)</span>
                </div>
              </div>

              <div
                onMouseEnter={() => setHoveredPie('waiting')}
                onMouseLeave={() => setHoveredPie(null)}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-[#0EA5E9] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">Savers / Waiting for Loan</span>
                </div>
                <div className="text-xs font-mono tabular-nums">
                  <span className="font-bold text-slate-900">{ratio.waiting}</span>
                  <span className="text-slate-500 ml-2">
                    ({ratio.total > 0 ? Math.round((ratio.waiting / ratio.total) * 1000) / 10 : 0}%)
                  </span>
                </div>
              </div>

              <div
                onMouseEnter={() => setHoveredPie('dormant')}
                onMouseLeave={() => setHoveredPie(null)}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm bg-[#D97706] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800">Dormant / Inactive / Dropout</span>
                </div>
                <div className="text-xs font-mono tabular-nums">
                  <span className="font-bold text-slate-900">{ratio.dormant}</span>
                  <span className="text-slate-500 ml-2">({ratio.dormantPct}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Row 2: Year-wise Bar Chart & Overdue Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 3. Year-wise Disbursement, Repayment & Savings */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Year-wise Disbursement, Repayment &amp; Savings</h2>
              <p className="text-xs text-slate-500">Comparative financial year performance across authorized offices</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#1D4ED8] rounded-xs" /> Disbursement
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#16A34A] rounded-xs" /> Repayment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#0EA5E9] rounded-xs" /> Savings
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {(data?.yearlyPerformance || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No financial year loan or savings records available.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {(data?.yearlyPerformance || []).map((row) => (
                  <div
                    key={row.fiscalYear}
                    onMouseEnter={() => setHoveredBarFy(row.fiscalYear)}
                    onMouseLeave={() => setHoveredBarFy(null)}
                    className={`p-3 rounded-lg border transition-colors ${
                      hoveredBarFy === row.fiscalYear ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-slate-900 font-mono">FY {row.fiscalYear}</span>
                      <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                        Disbursed {fmtCurrency(row.disbursement)} · Repaid {fmtCurrency(row.repayment)} · Savings{' '}
                        {fmtCurrency(row.savings)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1D4ED8] rounded-full"
                          style={{ width: `${Math.max(2, (row.disbursement / maxChartVal) * 100)}%` }}
                        />
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16A34A] rounded-full"
                          style={{ width: `${Math.max(2, (row.repayment / maxChartVal) * 100)}%` }}
                        />
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0EA5E9] rounded-full"
                          style={{ width: `${Math.max(2, (row.savings / maxChartVal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Overdue Classification (Arrear Aging) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Overdue Classification (Arrear Aging)</h2>
              <p className="text-xs text-slate-500">Portfolio at risk categorized by days past due</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#1E3A8A] text-white">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Overdue Range</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Borrowers</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Overdue</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(data?.overdueAging || []).map((row) => (
                  <tr key={row.range} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{row.range}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">{row.borrowerCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-red-600 font-semibold">
                      {fmtCurrency(row.overdueAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {fmtCurrency(row.outstandingAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
