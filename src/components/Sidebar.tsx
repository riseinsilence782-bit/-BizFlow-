import React, { useState } from 'react';
import {
  Home,
  Settings,
  Building2,
  Users,
  BookOpen,
  ArrowLeftRight,
  Repeat,
  FileBarChart2,
  Calculator,
  Cpu,
  Shield,
  HelpCircle,
  History,
  Wallet,
  PiggyBank,
  FileSpreadsheet,
  Landmark,
  MonitorCheck,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { ActiveNavKey } from '../types/erp.ts';

interface SidebarProps {
  activeNav: ActiveNavKey;
  onNavigate: (key: ActiveNavKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ activeNav, onNavigate, mobileOpen, onCloseMobile }: SidebarProps) {
  const [setupOpen, setSetupOpen] = useState(true);
  const [officesOpen, setOfficesOpen] = useState(true);

  const handleNav = (key: ActiveNavKey) => {
    onNavigate(key);
    onCloseMobile();
  };

  const navBtnClass = (isActive: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left whitespace-nowrap ${
      isActive
        ? 'bg-blue-600 text-white font-semibold'
        : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
    }`;

  const subBtnClass = (isActive: boolean) =>
    `w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-xs rounded-md transition-colors text-left whitespace-nowrap ${
      isActive
        ? 'bg-blue-500/40 text-white font-semibold'
        : 'text-blue-200/85 hover:bg-white/10 hover:text-white'
    }`;

  const content = (
    <div className="h-full flex flex-col bg-[#0F2942] text-white select-none">
      {/* Brand Wordmark */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-white truncate">
            PalliFin ERP
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden text-blue-200 hover:text-white p-1 rounded"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 19-Item Complete ERP Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {/* 1. Home */}
        <button type="button" onClick={() => handleNav('home')} className={navBtnClass(activeNav === 'home')}>
          <Home className="w-4 h-4 shrink-0" />
          <span>Home</span>
        </button>

        {/* 2. Setup -> Holidays */}
        <div>
          <button
            type="button"
            onClick={() => setSetupOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-blue-100/90 hover:bg-white/10 hover:text-white rounded-md transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 shrink-0" />
              <span>Setup</span>
            </span>
            {setupOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {setupOpen && (
            <div className="mt-0.5 space-y-0.5">
              <button
                type="button"
                onClick={() => handleNav('setup-holidays')}
                className={subBtnClass(activeNav === 'setup-holidays' || activeNav === 'setup-holiday-create')}
              >
                <span>Holidays</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Offices -> Samitys, Samitys (Branch), Employees */}
        <div>
          <button
            type="button"
            onClick={() => setOfficesOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-blue-100/90 hover:bg-white/10 hover:text-white rounded-md transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Offices</span>
            </span>
            {officesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {officesOpen && (
            <div className="mt-0.5 space-y-0.5">
              <button
                type="button"
                onClick={() => handleNav('offices-samitys')}
                className={subBtnClass(activeNav === 'offices-samitys' || activeNav === 'offices-samity-form')}
              >
                <span>Samitys</span>
              </button>
              <button
                type="button"
                onClick={() => handleNav('offices-samitys-branch')}
                className={subBtnClass(activeNav === 'offices-samitys-branch')}
              >
                <span>Samitys (Branch)</span>
              </button>
              <button
                type="button"
                onClick={() => handleNav('offices-employees')}
                className={subBtnClass(activeNav === 'offices-employees')}
              >
                <span>Employees</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. Members */}
        <button type="button" onClick={() => handleNav('members')} className={navBtnClass(activeNav === 'members')}>
          <Users className="w-4 h-4 shrink-0" />
          <span>Members</span>
        </button>

        {/* 5. Opening Entries */}
        <button type="button" onClick={() => handleNav('opening-entries')} className={navBtnClass(activeNav === 'opening-entries')}>
          <BookOpen className="w-4 h-4 shrink-0" />
          <span>Opening Entries</span>
        </button>

        {/* 6. Transactions */}
        <button type="button" onClick={() => handleNav('transactions')} className={navBtnClass(activeNav === 'transactions')}>
          <ArrowLeftRight className="w-4 h-4 shrink-0" />
          <span>Transactions</span>
        </button>

        {/* 7. Transfers */}
        <button type="button" onClick={() => handleNav('transfers')} className={navBtnClass(activeNav === 'transfers')}>
          <Repeat className="w-4 h-4 shrink-0" />
          <span>Transfers</span>
        </button>

        {/* 8. Reports */}
        <button type="button" onClick={() => handleNav('reports')} className={navBtnClass(activeNav === 'reports')}>
          <FileBarChart2 className="w-4 h-4 shrink-0" />
          <span>Reports</span>
        </button>

        {/* 9. Accounts */}
        <button type="button" onClick={() => handleNav('accounts')} className={navBtnClass(activeNav === 'accounts')}>
          <Calculator className="w-4 h-4 shrink-0" />
          <span>Accounts</span>
        </button>

        {/* 10. Process */}
        <button type="button" onClick={() => handleNav('process')} className={navBtnClass(activeNav === 'process')}>
          <Cpu className="w-4 h-4 shrink-0" />
          <span>Process</span>
        </button>

        {/* 11. Security */}
        <button type="button" onClick={() => handleNav('security')} className={navBtnClass(activeNav === 'security')}>
          <Shield className="w-4 h-4 shrink-0" />
          <span>Security</span>
        </button>

        {/* 12. Help */}
        <button type="button" onClick={() => handleNav('help')} className={navBtnClass(activeNav === 'help')}>
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>Help</span>
        </button>

        {/* 13. Audit Log */}
        <button type="button" onClick={() => handleNav('audit-log')} className={navBtnClass(activeNav === 'audit-log')}>
          <History className="w-4 h-4 shrink-0" />
          <span>Audit Log</span>
        </button>

        {/* 14. Payroll */}
        <button type="button" onClick={() => handleNav('payroll')} className={navBtnClass(activeNav === 'payroll')}>
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Payroll</span>
        </button>

        {/* 15. Provident Fund */}
        <button type="button" onClick={() => handleNav('provident-fund')} className={navBtnClass(activeNav === 'provident-fund')}>
          <PiggyBank className="w-4 h-4 shrink-0" />
          <span>Provident Fund</span>
        </button>

        {/* 16. Branch Reports */}
        <button type="button" onClick={() => handleNav('branch-reports')} className={navBtnClass(activeNav === 'branch-reports')}>
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Branch Reports</span>
        </button>

        {/* 17. Head Office Reports */}
        <button type="button" onClick={() => handleNav('head-office-reports')} className={navBtnClass(activeNav === 'head-office-reports')}>
          <Landmark className="w-4 h-4 shrink-0" />
          <span>Head Office Reports</span>
        </button>

        {/* 18. Fixed Asset */}
        <button type="button" onClick={() => handleNav('fixed-asset')} className={navBtnClass(activeNav === 'fixed-asset')}>
          <MonitorCheck className="w-4 h-4 shrink-0" />
          <span>Fixed Asset</span>
        </button>

        {/* 19. SMS */}
        <button type="button" onClick={() => handleNav('sms')} className={navBtnClass(activeNav === 'sms')}>
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>SMS</span>
        </button>
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0 border-r border-slate-200 no-print">
        {content}
      </aside>

      {/* Mobile Collapsible Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/50" onClick={onCloseMobile} />
          <aside className="relative w-64 max-w-[80vw] h-full shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}
