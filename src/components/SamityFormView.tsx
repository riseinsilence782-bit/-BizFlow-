import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, RotateCcw, PlusCircle } from 'lucide-react';
import { SamityItem, OfficeItem, BranchItem, EmployeeItem } from '../types/erp.ts';
import { apiRequest } from '../lib/api.ts';

interface SamityFormViewProps {
  editingSamity: SamityItem | null;
  selectedOffice: OfficeItem | null;
  onSaved: () => void;
  onCancel: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

interface GeoOption {
  id: number;
  divisionName?: string;
  districtName?: string;
  upazilaName?: string;
  unionCode?: string;
  unionName?: string;
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function SamityFormView({
  editingSamity,
  selectedOffice,
  onSaved,
  onCancel,
  onNotify,
}: SamityFormViewProps) {
  const isEdit = Boolean(editingSamity);

  // Reference lists
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);

  // Cascading Bangladesh locations
  const [divisions, setDivisions] = useState<GeoOption[]>([]);
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [upazilas, setUpazilas] = useState<GeoOption[]>([]);
  const [unions, setUnions] = useState<GeoOption[]>([]);

  // Section A — Basic Information
  const [officeId, setOfficeId] = useState<string>(
    editingSamity ? String(editingSamity.officeId) : selectedOffice ? String(selectedOffice.id) : ''
  );
  const [branchId, setBranchId] = useState<string>(editingSamity ? String(editingSamity.branchId) : '');
  const [samityCode, setSamityCode] = useState(editingSamity?.samityCode || '');
  const [samityName, setSamityName] = useState(editingSamity?.samityName || '');
  const [samityNameBn, setSamityNameBn] = useState(editingSamity?.samityNameBn || '');
  const [location, setLocation] = useState(editingSamity?.location || '');
  const [samityType, setSamityType] = useState(editingSamity?.samityType || 'Female');
  const [collectionType, setCollectionType] = useState(editingSamity?.collectionType || 'Regular');
  const [employeeId, setEmployeeId] = useState<string>(editingSamity ? String(editingSamity.employeeId) : '');
  const [collectionDay, setCollectionDay] = useState(editingSamity?.collectionDay || 'Sunday');
  const [collectionDate, setCollectionDate] = useState(editingSamity?.collectionDate || '2026-11-22');
  const [openingDate, setOpeningDate] = useState(editingSamity?.openingDate || new Date().toISOString().slice(0, 10));
  const [centerTime, setCenterTime] = useState(editingSamity?.centerTime || '09:30');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(editingSamity?.status || 'Active');

  // Section B — Address Information
  const [country, setCountry] = useState(editingSamity?.country || 'Bangladesh');
  const [divisionId, setDivisionId] = useState<string>(editingSamity?.divisionId ? String(editingSamity.divisionId) : '');
  const [districtId, setDistrictId] = useState<string>(editingSamity?.districtId ? String(editingSamity.districtId) : '');
  const [upazilaId, setUpazilaId] = useState<string>(editingSamity?.upazilaId ? String(editingSamity.upazilaId) : '');
  const [unionId, setUnionId] = useState<string>(editingSamity?.unionId ? String(editingSamity.unionId) : '');
  const [villageStreet, setVillageStreet] = useState(editingSamity?.villageStreet || '');
  const [zipCode, setZipCode] = useState(editingSamity?.zipCode || '');
  const [samityAddress, setSamityAddress] = useState(editingSamity?.samityAddress || '');
  const [remarks, setRemarks] = useState(editingSamity?.remarks || '');

  const [submitting, setSubmitting] = useState(false);

  // Load offices & divisions on mount
  useEffect(() => {
    apiRequest<{ data: OfficeItem[] }>('/offices').then((res) => {
      setOffices(res.data);
      if (!officeId && res.data.length > 0) {
        const branchOff = res.data.find((o) => o.officeType === 'Branch') || res.data[0];
        setOfficeId(String(branchOff.id));
      }
    });
    apiRequest<{ data: GeoOption[] }>('/locations/divisions').then((res) => setDivisions(res.data));
  }, []);

  // Dependent Branches & Active Employees
  useEffect(() => {
    if (!officeId) return;
    apiRequest<{ data: BranchItem[] }>(`/branches?officeId=${officeId}`).then((res) => {
      setBranches(res.data);
      if (res.data.length > 0 && (!branchId || !res.data.some((b) => String(b.id) === branchId))) {
        setBranchId(String(res.data[0].id));
        if (!editingSamity && res.data[0].officeId !== Number(officeId)) {
          setOfficeId(String(res.data[0].officeId));
        }
      }
    });

    apiRequest<{ data: EmployeeItem[] }>(`/employees?officeId=${officeId}&status=Active`).then((res) => {
      setEmployees(res.data);
      if (res.data.length > 0 && (!employeeId || !res.data.some((e) => String(e.id) === employeeId))) {
        setEmployeeId(String(res.data[0].id));
      }
    });

    if (!isEdit) {
      apiRequest<{ nextCode: string }>(`/samitys/next-code?officeId=${officeId}`).then((res) => {
        setSamityCode(res.nextCode);
      });
    }
  }, [officeId, isEdit]);

  // Cascading Division -> District -> Upazila -> UnionCode
  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    apiRequest<{ data: GeoOption[] }>(`/locations/districts?divisionId=${divisionId}`).then((res) => {
      setDistricts(res.data);
    });
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    apiRequest<{ data: GeoOption[] }>(`/locations/upazilas?districtId=${districtId}`).then((res) => {
      setUpazilas(res.data);
    });
  }, [districtId]);

  useEffect(() => {
    if (!upazilaId) {
      setUnions([]);
      return;
    }
    apiRequest<{ data: GeoOption[] }>(`/locations/unions?upazilaId=${upazilaId}`).then((res) => {
      setUnions(res.data);
    });
  }, [upazilaId]);

  const handleReset = () => {
    if (editingSamity) return;
    setSamityName('');
    setSamityNameBn('');
    setLocation('');
    setVillageStreet('');
    setZipCode('');
    setSamityAddress('');
    setRemarks('');
    if (officeId) {
      apiRequest<{ nextCode: string }>(`/samitys/next-code?officeId=${officeId}`).then((r) => setSamityCode(r.nextCode));
    }
  };

  const submitForm = async (saveAndNew = false) => {
    if (!samityCode.trim() || !samityName.trim() || !officeId || !branchId || !employeeId || !samityAddress.trim()) {
      onNotify('error', 'Please fill all required Basic and Address fields.');
      return;
    }

    const selectedBranch = branches.find((b) => String(b.id) === branchId);
    const effectiveOfficeId = selectedBranch ? selectedBranch.officeId : Number(officeId);

    setSubmitting(true);
    try {
      const payload = {
        samityCode: samityCode.trim(),
        samityName: samityName.trim(),
        samityNameBn: samityNameBn.trim() || null,
        officeId: effectiveOfficeId,
        branchId: Number(branchId),
        employeeId: Number(employeeId),
        location: location.trim() || villageStreet.trim() || samityAddress.trim(),
        samityType,
        collectionType,
        collectionDay,
        collectionDate,
        openingDate,
        centerTime,
        country,
        divisionId: divisionId ? Number(divisionId) : null,
        districtId: districtId ? Number(districtId) : null,
        upazilaId: upazilaId ? Number(upazilaId) : null,
        unionId: unionId ? Number(unionId) : null,
        villageStreet: villageStreet.trim() || null,
        zipCode: zipCode.trim() || null,
        samityAddress: samityAddress.trim(),
        status,
        remarks: remarks.trim() || null,
      };

      if (isEdit && editingSamity) {
        await apiRequest(`/samitys/${editingSamity.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Samity ${samityCode} updated successfully.`);
        onSaved();
      } else {
        await apiRequest('/samitys', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Samity ${samityCode} created successfully.`);
        if (saveAndNew) {
          handleReset();
        } else {
          onSaved();
        }
      }
    } catch (err: any) {
      onNotify('error', err.message || 'Failed to save Samity.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOfficeObj = offices.find((o) => String(o.id) === officeId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">
            Offices / Samitys / {isEdit ? `Edit (${editingSamity?.samityCode})` : 'Add New'}
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-0.5">
            {isEdit ? 'Edit Samity Record' : 'Add New Samity'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Samity List</span>
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitForm(false);
        }}
        className="space-y-5"
      >
        {/* SECTION A — BASIC INFORMATION (3-column layout) */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-5 py-2.5 text-xs font-semibold">
            Section A — Basic Information &amp; Collection Schedule
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Office *</label>
              <select
                value={officeId}
                disabled={isEdit}
                onChange={(e) => setOfficeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.officeCode} — {o.officeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch *</label>
              <select
                value={branchId}
                disabled={isEdit}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
              >
                {branches.length === 0 && <option value="">No active branch in selected office</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branchCode} — {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Office Code / Name</label>
              <input
                type="text"
                readOnly
                value={selectedOfficeObj ? `${selectedOfficeObj.officeCode} · ${selectedOfficeObj.officeName}` : ''}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Code (Unique) *</label>
              <input
                type="text"
                value={samityCode}
                onChange={(e) => setSamityCode(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono font-semibold text-blue-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Name (English) *</label>
              <input
                type="text"
                value={samityName}
                onChange={(e) => setSamityName(e.target.value)}
                placeholder="e.g. Padma Mohila Samity"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Name (Bangla)</label>
              <input
                type="text"
                value={samityNameBn}
                onChange={(e) => setSamityNameBn(e.target.value)}
                placeholder="যেমন: পদ্মা মহিলা সমিতি"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Center Area *</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Mirpur Section-10, Block C"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Type *</label>
              <select
                value={samityType}
                onChange={(e) => setSamityType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Mixed">Mixed</option>
                <option value="SME">SME</option>
                <option value="Agriculture">Agriculture</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Collection Type *</label>
              <select
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="Regular">Regular</option>
                <option value="Weekly">Weekly</option>
                <option value="Fortnightly">Fortnightly</option>
                <option value="Monthly">Monthly</option>
                <option value="Special">Special</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsible Employee (Active Only) *</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                {employees.length === 0 && <option value="">No active employees found</option>}
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeCode} — {emp.fullName} ({emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Day *</label>
              <select
                value={collectionDay}
                onChange={(e) => setCollectionDay(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Date *</label>
              <input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Date *</label>
              <input
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Center Time *</label>
              <input
                type="time"
                value={centerTime}
                onChange={(e) => setCenterTime(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION B — ADDRESS INFORMATION (Cascading Bangladesh Locations) */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#1E3A8A] text-white px-5 py-2.5 text-xs font-semibold">
            Section B — Address Information (Bangladesh Administrative Hierarchy)
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Division</label>
              <select
                value={divisionId}
                onChange={(e) => {
                  setDivisionId(e.target.value);
                  setDistrictId('');
                  setUpazilaId('');
                  setUnionId('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="">Select Division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.divisionName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
              <select
                value={districtId}
                disabled={!divisionId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setUpazilaId('');
                  setUnionId('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
              >
                <option value="">Select District</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.districtName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Upazila</label>
              <select
                value={upazilaId}
                disabled={!districtId}
                onChange={(e) => {
                  setUpazilaId(e.target.value);
                  setUnionId('');
                }}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
              >
                <option value="">Select Upazila</option>
                {upazilas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.upazilaName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">UnionCode</label>
              <select
                value={unionId}
                disabled={!upazilaId}
                onChange={(e) => setUnionId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100"
              >
                <option value="">Select UnionCode</option>
                {unions.map((un) => (
                  <option key={un.id} value={un.id}>
                    {un.unionCode} — {un.unionName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Village / Street</label>
              <input
                type="text"
                value={villageStreet}
                onChange={(e) => setVillageStreet(e.target.value)}
                placeholder="House, Road, Village or Moholla"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Zip Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 1216"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Samity Address (Complete) *</label>
              <input
                type="text"
                value={samityAddress}
                onChange={(e) => setSamityAddress(e.target.value)}
                placeholder="Full meeting center address"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Operational notes or special schedule remarks"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
          {!isEdit && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Save &amp; New</span>
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#1D4ED8] hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Saving...' : isEdit ? 'Update Samity' : 'Save Samity'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
