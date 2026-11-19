import React, { useState, useEffect, useMemo } from 'react';
import { Building2, ChevronDown, ChevronRight, Search, CheckCircle2, X, FolderTree } from 'lucide-react';
import { OfficeItem } from '../types/erp.ts';
import { apiRequest } from '../lib/api.ts';

interface OfficeSelectionModalProps {
  isOpen: boolean;
  currentOfficeId: number | null;
  onSelect: (office: OfficeItem) => Promise<void>;
  onClose: () => void;
}

export function OfficeSelectionModal({
  isOpen,
  currentOfficeId,
  onSelect,
  onClose,
}: OfficeSelectionModalProps) {
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [pickedId, setPickedId] = useState<number | null>(currentOfficeId);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPickedId(currentOfficeId);
    setLoading(true);
    apiRequest<{ offices: OfficeItem[] }>('/offices/tree')
      .then((res) => {
        setOffices(res.offices);
        setExpandedIds(new Set(res.offices.map((o) => o.id)));
        if (!currentOfficeId && res.offices.length > 0) {
          setPickedId(res.offices[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, currentOfficeId]);

  const childrenMap = useMemo(() => {
    const map = new Map<number | null, OfficeItem[]>();
    for (const off of offices) {
      const parentKey = off.parentOfficeId && offices.some((p) => p.id === off.parentOfficeId) ? off.parentOfficeId : null;
      const list = map.get(parentKey) || [];
      list.push(off);
      map.set(parentKey, list);
    }
    return map;
  }, [offices]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offices;
    return offices.filter(
      (o) =>
        o.officeCode.toLowerCase().includes(q) ||
        o.officeName.toLowerCase().includes(q) ||
        o.officeType.toLowerCase().includes(q)
    );
  }, [offices, search]);

  const pickedOffice = useMemo(() => offices.find((o) => o.id === pickedId) || null, [offices, pickedId]);

  if (!isOpen) return null;

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTreeNodes = (parentId: number | null, depth = 0): React.ReactNode => {
    const nodes = childrenMap.get(parentId) || [];
    return nodes.map((node) => {
      const hasChildren = (childrenMap.get(node.id) || []).length > 0;
      const isExpanded = expandedIds.has(node.id);
      const isSelected = pickedId === node.id;

      return (
        <div key={node.id}>
          <div
            onClick={() => setPickedId(node.id)}
            style={{ paddingLeft: `${depth * 18 + 10}px` }}
            className={`flex items-center gap-2 py-2 pr-3 rounded-md cursor-pointer text-xs transition-colors ${
              isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className={`p-0.5 rounded ${isSelected ? 'hover:bg-blue-700 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
                aria-label="Toggle children"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className={`font-mono tabular-nums ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
              {node.officeCode}
            </span>
            <span className="truncate flex-1">{node.officeName}</span>
            <span className={`text-[11px] shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
              {node.officeType}
            </span>
          </div>
          {hasChildren && isExpanded && renderTreeNodes(node.id, depth + 1)}
        </div>
      );
    });
  };

  const handleConfirm = async () => {
    if (!pickedOffice) return;
    setSubmitting(true);
    try {
      await onSelect(pickedOffice);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1E3A8A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-base font-bold">Select Working Office</h2>
              <p className="text-xs text-blue-200">Choose an authorized Organization, Division, Zone, Area, Branch, or Unit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search office by code or name (e.g. 01111, Mirpur, Savar)..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExpandedIds(new Set(offices.map((o) => o.id)))}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setExpandedIds(new Set())}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Split Tree & Results Panel */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Office Tree / List */}
          <div className="md:col-span-7 p-4 overflow-y-auto max-h-[420px]">
            <div className="text-xs font-semibold text-slate-500 mb-2.5 flex items-center justify-between">
              <span>Office Hierarchy Tree</span>
              <span className="tabular-nums">{filteredList.length} authorized</span>
            </div>
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading office hierarchy...</div>
            ) : search.trim() ? (
              <div className="space-y-1">
                {filteredList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No matching authorized offices found.</div>
                ) : (
                  filteredList.map((node) => (
                    <div
                      key={node.id}
                      onClick={() => setPickedId(node.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer text-xs ${
                        pickedId === node.id ? 'bg-blue-600 text-white font-semibold' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono tabular-nums">{node.officeCode}</span>
                      <span className="flex-1 truncate">{node.officeName}</span>
                      <span className="opacity-80">{node.officeType}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-0.5">{renderTreeNodes(null, 0)}</div>
            )}
          </div>

          {/* Results / Selected Office Panel */}
          <div className="md:col-span-5 p-5 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-3">Selected Office Details</div>
              {pickedOffice ? (
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{pickedOffice.officeName}</div>
                      {pickedOffice.officeNameBn && (
                        <div className="text-xs text-slate-600">{pickedOffice.officeNameBn}</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Office Code</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">{pickedOffice.officeCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Office Type</span>
                      <span className="font-medium text-slate-900">{pickedOffice.officeType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {pickedOffice.status}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-500 block mb-0.5">Address</span>
                      <span className="text-slate-800 leading-relaxed">{pickedOffice.address}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-500">
                  Click any office in the hierarchy tree to preview its scope.
                </div>
              )}
            </div>

            <div className="mt-6 text-xs text-slate-500 leading-relaxed">
              Selecting a parent Division or Zone loads consolidated metrics across all child branches within your permission scope.
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!pickedOffice || submitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? 'Applying Office...' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
