import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Search, Pencil, Trash2, ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { HolidayItem, OfficeItem, SamityItem } from '../types/erp.ts';
import { apiRequest } from '../lib/api.ts';

interface HolidayModuleProps {
  mode: 'list' | 'create';
  initialCreateType?: 'Specific' | 'Yearly';
  selectedOffice: OfficeItem | null;
  onNavigateCreate: (type: 'Specific' | 'Yearly') => void;
  onNavigateList: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

export function HolidayModule({
  mode,
  initialCreateType = 'Specific',
  selectedOffice,
  onNavigateCreate,
  onNavigateList,
  onNotify,
}: HolidayModuleProps) {
  // List filters
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [samities, setSamities] = useState<SamityItem[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterOfficeId, setFilterOfficeId] = useState(selectedOffice ? String(selectedOffice.id) : '');
  const [filterSamityId, setFilterSamityId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(false);

  // Edit modal
  const [editingHoliday, setEditingHoliday] = useState<HolidayItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('Specific');

  // Delete confirm
  const [deletingHoliday, setDeletingHoliday] = useState<HolidayItem | null>(null);

  // Create form state
  const [createOfficeId, setCreateOfficeId] = useState(selectedOffice ? String(selectedOffice.id) : '');
  const [selectAllSamities, setSelectAllSamities] = useState(false);
  const [selectedSamityIds, setSelectedSamityIds] = useState<number[]>([]);
  const [createHolidayType, setCreateHolidayType] = useState<string>(
    initialCreateType === 'Yearly' ? 'Yearly' : 'Government Holiday'
  );
  const [createDate, setCreateDate] = useState('2026-12-25');
  const [createDescription, setCreateDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCreateHolidayType(initialCreateType === 'Yearly' ? 'Yearly' : 'Government Holiday');
  }, [initialCreateType]);

  useEffect(() => {
    apiRequest<{ data: OfficeItem[] }>('/offices').then((res) => {
      setOffices(res.data);
      if (!createOfficeId && res.data.length > 0) {
        setCreateOfficeId(String(selectedOffice?.id || res.data[0].id));
      }
    });
    apiRequest<{ data: SamityItem[] }>('/samitys?limit=100').then((res) => setSamities(res.data));
  }, []);

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterDate) p.set('date', filterDate);
      if (filterOfficeId) p.set('officeId', filterOfficeId);
      if (filterSamityId) p.set('samityId', filterSamityId);
      if (filterType) p.set('holidayType', filterType);
      const res = await apiRequest<{ data: HolidayItem[] }>(`/holidays?${p.toString()}`);
      setHolidays(res.data);
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to load holidays.');
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterOfficeId, filterSamityId, filterType, onNotify]);

  useEffect(() => {
    if (mode === 'list') {
      fetchHolidays();
    }
  }, [mode, fetchHolidays]);

  const handleToggleSamity = (id: number) => {
    setSelectedSamityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDate || !createDescription.trim() || !createHolidayType) {
      onNotify('error', 'Holiday Type, Business Date, and Description are required.');
      return;
    }
    if (!selectAllSamities && selectedSamityIds.length === 0) {
      onNotify('error', 'Please select at least one Samity or check "Select All Samities".');
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/holidays', {
        method: 'POST',
        body: JSON.stringify({
          officeId: Number(createOfficeId),
          samityIds: selectedSamityIds,
          isAllSamities: selectAllSamities,
          holidayType: createHolidayType,
          holidayDate: createDate,
          description: createDescription.trim(),
        }),
      });
      onNotify('success', 'Holiday saved to database successfully.');
      setCreateDescription('');
      setSelectedSamityIds([]);
      setSelectAllSamities(false);
      onNavigateList();
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to save holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;
    try {
      await apiRequest(`/holidays/${editingHoliday.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          holidayDate: editDate,
          description: editDesc,
          holidayType: editType,
        }),
      });
      onNotify('success', 'Holiday record updated.');
      setEditingHoliday(null);
      fetchHolidays();
    } catch (err: any) {
      onNotify('error', err.message || 'Update failed.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingHoliday) return;
    try {
      await apiRequest(`/holidays/${deletingHoliday.id}`, { method: 'DELETE' });
      onNotify('success', 'Holiday record deleted.');
      setDeletingHoliday(null);
      fetchHolidays();
    } catch (err: any) {
      onNotify('error', err.message || 'Delete failed.');
    }
  };

  // ============================================================
  // MODULE 05: SPECIFIC / YEARLY HOLIDAY CREATE FORM
  // ============================================================
  if (mode === 'create') {
    const officeSamities = createOfficeId
      ? samities.filter((s) => String(s.officeId) === createOfficeId)
      : samities;
    const displayedSamities = officeSamities.length > 0 ? officeSamities : samities;

    return (
      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Home / Holiday / Create ({initialCreateType})</div>
            <h1 className="text-lg font-bold text-slate-900 mt-0.5">
              {initialCreateType === 'Yearly' ? 'Yearly Holiday Create' : 'Specific Holiday Create'}
            </h1>
          </div>
          <button
            type="button"
            onClick={onNavigateList}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to List</span>
          </button>
        </div>

        <form onSubmit={handleCreateSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Office</label>
              <select
                value={createOfficeId}
                onChange={(e) => {
                  setCreateOfficeId(e.target.value);
                  setSelectedSamityIds([]);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.officeCode} — {o.officeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Holiday Type *</label>
              <select
                value={createHolidayType}
                onChange={(e) => setCreateHolidayType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                <option value="Government Holiday">Government Holiday</option>
                <option value="Specific">Specific</option>
                <option value="Yearly">Yearly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Date *</label>
              <input
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
              <input
                type="text"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="e.g. Independence Day / Special Center Closure"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Samity Multi-Selection */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-700">
                Applicable Samities * ({selectAllSamities ? 'All Selected' : `${selectedSamityIds.length} selected`})
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllSamities}
                  onChange={(e) => {
                    setSelectAllSamities(e.target.checked);
                    if (e.target.checked) setSelectedSamityIds([]);
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Select All Samities</span>
              </label>
            </div>

            {!selectAllSamities && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {displayedSamities.map((s) => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                      selectedSamityIds.includes(s.id)
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSamityIds.includes(s.id)}
                      onChange={() => handleToggleSamity(s.id)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="font-mono text-[11px] text-slate-500">{s.samityCode}</span>
                    <span className="truncate">{s.samityName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onNavigateList}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Back to List
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Holiday'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ============================================================
  // MODULE 04: HOLIDAY LIST
  // ============================================================
  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Home / Holiday / Index</div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">Holiday List</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateCreate('Specific')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Specific Holiday</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateCreate('Yearly')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Calendar className="w-4 h-4 text-blue-700" />
            <span>Yearly Holiday</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Office</label>
            <select
              value={filterOfficeId}
              onChange={(e) => setFilterOfficeId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.officeCode} — {o.officeName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Samity</label>
            <select
              value={filterSamityId}
              onChange={(e) => setFilterSamityId(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Samities</option>
              {samities.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.samityCode} — {s.samityName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Holiday Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
            >
              <option value="">All Types</option>
              <option value="Weekly">Weekly</option>
              <option value="Specific">Specific</option>
              <option value="Yearly">Yearly</option>
              <option value="Government Holiday">Government Holiday</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={fetchHolidays}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-md"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterDate('');
                setFilterOfficeId('');
                setFilterSamityId('');
                setFilterType('');
              }}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Holiday Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#1E3A8A] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Center</th>
                <th className="px-4 py-3 font-semibold">Office</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold text-center">Edit</th>
                <th className="px-4 py-3 font-semibold text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading holidays...
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No holidays found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{h.centerName}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <span className="font-mono text-slate-500 mr-1">{h.officeCode}</span>
                      {h.officeName}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-800">{h.holidayDate}</td>
                    <td className="px-4 py-2.5 text-slate-800">{h.description}</td>
                    <td className="px-4 py-2.5 font-medium text-blue-800">{h.holidayType}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHoliday(h);
                          setEditDate(h.holidayDate);
                          setEditDesc(h.description);
                          setEditType(h.holidayType);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setDeletingHoliday(h)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Holiday Modal */}
      {editingHoliday && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateSubmit} className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Holiday Record</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday Type</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Weekly">Weekly</option>
                <option value="Specific">Specific</option>
                <option value="Yearly">Yearly</option>
                <option value="Government Holiday">Government Holiday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingHoliday(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg"
              >
                Update Holiday
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingHoliday && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Holiday Deletion</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Delete <span className="font-semibold text-slate-900">{deletingHoliday.description}</span> on{' '}
              <span className="font-mono">{deletingHoliday.holidayDate}</span>? This action will be recorded in the audit log.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingHoliday(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
