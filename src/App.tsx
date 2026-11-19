import React, { useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { Menu, Building2, LogOut, UserCircle2 } from 'lucide-react';
import { auth } from './lib/firebase.ts';
import { apiRequest, setAuthToken, setSelectedOfficeMemory, getAuthToken } from './lib/api.ts';
import { ActiveNavKey, ErpUser, OfficeItem, SamityItem } from './types/erp.ts';
import { ToastStack, ToastMessage } from './components/Toast.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { OfficeSelectionModal } from './components/OfficeSelectionModal.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { HolidayModule } from './components/HolidayModule.tsx';
import { SamityListView } from './components/SamityListView.tsx';
import { SamityFormView } from './components/SamityFormView.tsx';
import {
  SamitysBranchView,
  EmployeesView,
  MembersView,
  FinancialOpsView,
} from './components/OperationsModules.tsx';
import {
  ReportsView,
  SecurityView,
  AuditLogView,
  EnterpriseUtilityView,
} from './components/ReportsAndAdminModules.tsx';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<ErpUser | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<OfficeItem | null>(null);
  const [officeModalOpen, setOfficeModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [activeNav, setActiveNav] = useState<ActiveNavKey>('home');
  const [holidayCreateType, setHolidayCreateType] = useState<'Specific' | 'Yearly'>('Specific');
  const [editingSamity, setEditingSamity] = useState<SamityItem | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((type: 'success' | 'error', text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const loadSessionProfile = useCallback(async (openOfficePickerOnLogin = false) => {
    try {
      const res = await apiRequest<{
        user: ErpUser;
        authorizedOffices: OfficeItem[];
        selectedOffice: OfficeItem | null;
      }>('/auth/me');
      setCurrentUser(res.user);
      setSelectedOffice(res.selectedOffice);
      setSelectedOfficeMemory(res.selectedOffice?.id || null);
      if (openOfficePickerOnLogin) {
        setOfficeModalOpen(true);
      }
    } catch {
      setCurrentUser(null);
      setSelectedOffice(null);
    }
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser && !getAuthToken()?.startsWith('erp_')) {
        const token = await fbUser.getIdToken();
        setAuthToken(token);
        await loadSessionProfile(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [loadSessionProfile]);

  const handleLoginSuccess = async () => {
    await loadSessionProfile(true);
  };

  const handleSelectOffice = async (office: OfficeItem) => {
    try {
      const res = await apiRequest<{ selectedOffice: OfficeItem }>('/auth/select-office', {
        method: 'POST',
        body: JSON.stringify({ officeId: office.id }),
      });
      setSelectedOffice(res.selectedOffice);
      setSelectedOfficeMemory(res.selectedOffice.id);
      notify('success', `Working office switched to ${res.selectedOffice.officeCode} — ${res.selectedOffice.officeName}.`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to switch working office.');
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // continue logout
    }
    if (auth.currentUser) {
      await signOut(auth);
    }
    setAuthToken(null);
    setSelectedOfficeMemory(null);
    setCurrentUser(null);
    setSelectedOffice(null);
    setActiveNav('home');
  };

  const breadcrumbLabel = (() => {
    switch (activeNav) {
      case 'home':
        return 'Home / Executive Dashboard';
      case 'setup-holidays':
        return 'Setup / Holidays / Holiday List';
      case 'setup-holiday-create':
        return 'Setup / Holidays / Create Holiday';
      case 'offices-samitys':
        return 'Offices / Samitys / Samity List';
      case 'offices-samity-form':
        return editingSamity ? 'Offices / Samitys / Edit Samity' : 'Offices / Samitys / Add New';
      case 'offices-samitys-branch':
        return 'Offices / Samitys (Branch)';
      case 'offices-employees':
        return 'Offices / Employees';
      case 'members':
        return 'Members / Member Directory';
      case 'opening-entries':
        return 'Opening Entries / Loan Portfolio';
      case 'transactions':
        return 'Transactions / Collections & Savings';
      case 'transfers':
        return 'Transfers / Samity Branch Transfer';
      case 'reports':
        return 'Reports / MIS Portfolio';
      case 'accounts':
        return 'Accounts / General Ledger';
      case 'process':
        return 'Process / Day-End Settlement';
      case 'security':
        return 'Security / Roles & Permissions';
      case 'help':
        return 'Help / Operational Manual';
      case 'audit-log':
        return 'Audit Log / Compliance Trail';
      case 'payroll':
        return 'Payroll / Staff Salary Register';
      case 'provident-fund':
        return 'Provident Fund / Contributions';
      case 'branch-reports':
        return 'Branch Reports / Summary';
      case 'head-office-reports':
        return 'Head Office Reports / Consolidated';
      case 'fixed-asset':
        return 'Fixed Asset / Office Register';
      case 'sms':
        return 'SMS / Member Notice Dispatch';
      default:
        return 'Home';
    }
  })();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600">
        Initializing PalliFin Core ERP...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      <Sidebar
        activeNav={activeNav}
        onNavigate={(key) => {
          if (key === 'offices-samity-form') setEditingSamity(null);
          setActiveNav(key);
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-md"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-slate-600 truncate">{breadcrumbLabel}</div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setOfficeModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-700" />
              <span className="max-w-[180px] truncate">
                {selectedOffice ? `${selectedOffice.officeCode} · ${selectedOffice.officeName}` : 'Select Office'}
              </span>
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs text-slate-700 pl-2 border-l border-slate-200">
              <UserCircle2 className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-900 whitespace-nowrap">{currentUser.fullName}</span>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="text-slate-500 whitespace-nowrap">{currentUser.roleName}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {activeNav === 'home' && (
            <DashboardView selectedOffice={selectedOffice} onNotify={notify} />
          )}

          {(activeNav === 'setup-holidays' || activeNav === 'setup-holiday-create') && (
            <HolidayModule
              mode={activeNav === 'setup-holiday-create' ? 'create' : 'list'}
              initialCreateType={holidayCreateType}
              selectedOffice={selectedOffice}
              onNavigateCreate={(type) => {
                setHolidayCreateType(type);
                setActiveNav('setup-holiday-create');
              }}
              onNavigateList={() => setActiveNav('setup-holidays')}
              onNotify={notify}
            />
          )}

          {activeNav === 'offices-samitys' && (
            <SamityListView
              currentUser={currentUser}
              selectedOffice={selectedOffice}
              onAddNew={() => {
                setEditingSamity(null);
                setActiveNav('offices-samity-form');
              }}
              onEdit={(samity) => {
                setEditingSamity(samity);
                setActiveNav('offices-samity-form');
              }}
              onNotify={notify}
            />
          )}

          {activeNav === 'offices-samity-form' && (
            <SamityFormView
              editingSamity={editingSamity}
              selectedOffice={selectedOffice}
              onSaved={() => {
                setEditingSamity(null);
                setActiveNav('offices-samitys');
              }}
              onCancel={() => {
                setEditingSamity(null);
                setActiveNav('offices-samitys');
              }}
              onNotify={notify}
            />
          )}

          {(activeNav === 'offices-samitys-branch' || activeNav === 'transfers') && (
            <SamitysBranchView currentUser={currentUser} onNotify={notify} />
          )}

          {activeNav === 'offices-employees' && (
            <EmployeesView currentUser={currentUser} onNotify={notify} />
          )}

          {activeNav === 'members' && <MembersView onNotify={notify} />}

          {(activeNav === 'transactions' ||
            activeNav === 'opening-entries' ||
            activeNav === 'accounts' ||
            activeNav === 'process') && (
            <FinancialOpsView section={activeNav} onNotify={notify} />
          )}

          {(activeNav === 'reports' ||
            activeNav === 'branch-reports' ||
            activeNav === 'head-office-reports') && (
            <ReportsView mode={activeNav} onNotify={notify} />
          )}

          {activeNav === 'security' && <SecurityView />}

          {activeNav === 'audit-log' && <AuditLogView />}

          {(activeNav === 'payroll' ||
            activeNav === 'provident-fund' ||
            activeNav === 'fixed-asset' ||
            activeNav === 'sms' ||
            activeNav === 'help') && (
            <EnterpriseUtilityView section={activeNav} onNotify={notify} />
          )}
        </main>
      </div>

      {/* Module 02: Office Selection Modal */}
      <OfficeSelectionModal
        isOpen={officeModalOpen}
        currentOfficeId={selectedOffice?.id || null}
        onSelect={handleSelectOffice}
        onClose={() => setOfficeModalOpen(false)}
      />
    </div>
  );
}
