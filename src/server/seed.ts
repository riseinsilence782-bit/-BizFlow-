import { count } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  organizations,
  offices,
  divisions,
  districts,
  upazilas,
  unions,
  zones,
  branches,
  employees,
  samities,
  samityCollectionSchedules,
  holidays,
  holidaySamities,
  roles,
  permissions,
  users,
  userOfficePermissions,
  members,
  loans,
  savings,
  transactions,
  accounts,
  auditLogs,
} from '../db/schema.ts';
import { hashPassword } from './crypto.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeedIfEmpty().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  const existing = await db.select({ cnt: count() }).from(organizations);
  if (Number(existing[0]?.cnt || 0) > 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const doubleCheck = await tx.select({ cnt: count() }).from(organizations);
    if (Number(doubleCheck[0]?.cnt || 0) > 0) {
      return;
    }

    // 1. Organization
    const [org] = await tx
      .insert(organizations)
      .values({
        orgCode: 'ORG-001',
        orgName: 'PalliFin Microfinance & Rural Development Foundation',
        shortName: 'PalliFin ERP',
        registrationNo: 'MRA-00482-2014',
        address: 'Plot 18, Sher-e-Bangla Nagar, Agargaon, Dhaka-1207',
        phone: '+880-2-55012340',
        email: 'central@pallifin.org.bd',
        status: 'Active',
      })
      .returning();

    // 2. Hierarchical Offices (Organization -> Division -> Zone -> Area -> Branch -> Unit)
    const [hqOffice] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: null,
        officeCode: '00001',
        officeName: 'Head Office (Agargaon)',
        officeNameBn: 'প্রধান কার্যালয় (আগারগাঁও)',
        officeType: 'Organization',
        address: 'Plot 18, Agargaon, Dhaka-1207',
        phone: '02-55012340',
        status: 'Active',
      })
      .returning();

    const [dhakaDivOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: hqOffice.id,
        officeCode: '01000',
        officeName: 'Dhaka Division Office',
        officeNameBn: 'ঢাকা বিভাগীয় কার্যালয়',
        officeType: 'Division',
        address: 'House 42, Road 11, Dhanmondi, Dhaka-1209',
        phone: '02-58612301',
        status: 'Active',
      })
      .returning();

    const [dhakaZoneOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: dhakaDivOff.id,
        officeCode: '01100',
        officeName: 'Dhaka North Zone',
        officeNameBn: 'ঢাকা উত্তর জোন',
        officeType: 'Zone',
        address: 'Sector 4, Uttara, Dhaka-1230',
        phone: '02-58954321',
        status: 'Active',
      })
      .returning();

    const [mirpurAreaOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: dhakaZoneOff.id,
        officeCode: '01110',
        officeName: 'Mirpur Area Office',
        officeNameBn: 'মিরপুর এরিয়া অফিস',
        officeType: 'Area',
        address: 'Block C, Mirpur-10, Dhaka-1216',
        phone: '02-58051120',
        status: 'Active',
      })
      .returning();

    const [mirpurBranchOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: mirpurAreaOff.id,
        officeCode: '01111',
        officeName: 'Mirpur-10 Branch',
        officeNameBn: 'মিরপুর-১০ শাখা',
        officeType: 'Branch',
        address: 'Plot 22, Block C, Mirpur-10, Dhaka-1216',
        phone: '01711-011110',
        status: 'Active',
      })
      .returning();

    const [savarBranchOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: mirpurAreaOff.id,
        officeCode: '01112',
        officeName: 'Savar Sadar Branch',
        officeNameBn: 'সাভার সদর শাখা',
        officeType: 'Branch',
        address: 'Thana Stand, Savar, Dhaka-1340',
        phone: '01711-011120',
        status: 'Active',
      })
      .returning();

    const [uttaraUnitOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: mirpurBranchOff.id,
        officeCode: '01113',
        officeName: 'Pallabi Field Unit',
        officeNameBn: 'পল্লবী ফিল্ড ইউনিট',
        officeType: 'Unit',
        address: 'Road 7, Pallabi, Mirpur-12, Dhaka-1216',
        phone: '01711-011130',
        status: 'Active',
      })
      .returning();

    const [ctgDivOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: hqOffice.id,
        officeCode: '02000',
        officeName: 'Chattogram Division Office',
        officeNameBn: 'চট্টগ্রাম বিভাগীয় কার্যালয়',
        officeType: 'Division',
        address: '48 Agrabad Commercial Area, Chattogram-4100',
        phone: '031-723410',
        status: 'Active',
      })
      .returning();

    const [ctgZoneOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: ctgDivOff.id,
        officeCode: '02100',
        officeName: 'Chattogram Metro Zone',
        officeNameBn: 'চট্টগ্রাম মেট্রো জোন',
        officeType: 'Zone',
        address: 'GEC Circle, Chattogram-4000',
        phone: '031-654321',
        status: 'Active',
      })
      .returning();

    const [ctgAreaOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: ctgZoneOff.id,
        officeCode: '02110',
        officeName: 'Agrabad Area Office',
        officeNameBn: 'আগ্রাবাদ এরিয়া অফিস',
        officeType: 'Area',
        address: 'CDA Avenue, Agrabad, Chattogram',
        phone: '031-712233',
        status: 'Active',
      })
      .returning();

    const [halishaharBranchOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: ctgAreaOff.id,
        officeCode: '02111',
        officeName: 'Halishahar Branch',
        officeNameBn: 'হালিশহর শাখা',
        officeType: 'Branch',
        address: 'Block K, Halishahar Housing Estate, Chattogram',
        phone: '01812-021110',
        status: 'Active',
      })
      .returning();

    const [rajDivOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: hqOffice.id,
        officeCode: '03000',
        officeName: 'Rajshahi Division Office',
        officeNameBn: 'রাজশাহী বিভাগীয় কার্যালয়',
        officeType: 'Division',
        address: 'Shaheb Bazar, Rajshahi-6100',
        phone: '0721-775410',
        status: 'Active',
      })
      .returning();

    const [boguraBranchOff] = await tx
      .insert(offices)
      .values({
        organizationId: org.id,
        parentOfficeId: rajDivOff.id,
        officeCode: '03111',
        officeName: 'Bogura Sadar Branch',
        officeNameBn: 'বগুড়া সদর শাখা',
        officeType: 'Branch',
        address: 'Satmatha Sherpur Road, Bogura-5800',
        phone: '01715-031110',
        status: 'Active',
      })
      .returning();

    // 3. Zones & Branches
    const [z1] = await tx.insert(zones).values({ officeId: dhakaZoneOff.id, zoneCode: 'ZN-DHN', zoneName: 'Dhaka North Zone' }).returning();
    const [z2] = await tx.insert(zones).values({ officeId: ctgZoneOff.id, zoneCode: 'ZN-CTG', zoneName: 'Chattogram Metro Zone' }).returning();
    const [z3] = await tx.insert(zones).values({ officeId: rajDivOff.id, zoneCode: 'ZN-RAJ', zoneName: 'Rajshahi & Bogura Zone' }).returning();

    const [brMirpur] = await tx
      .insert(branches)
      .values({
        officeId: mirpurBranchOff.id,
        zoneId: z1.id,
        branchCode: 'BR-01111',
        branchName: 'Mirpur-10 Branch',
        branchNameBn: 'মিরপুর-১০ শাখা',
        address: 'Plot 22, Block C, Mirpur-10, Dhaka-1216',
        openingDate: '2018-03-01',
        status: 'Active',
      })
      .returning();

    const [brSavar] = await tx
      .insert(branches)
      .values({
        officeId: savarBranchOff.id,
        zoneId: z1.id,
        branchCode: 'BR-01112',
        branchName: 'Savar Sadar Branch',
        branchNameBn: 'সাভার সদর শাখা',
        address: 'Thana Stand, Savar, Dhaka-1340',
        openingDate: '2019-07-15',
        status: 'Active',
      })
      .returning();

    const [brHalishahar] = await tx
      .insert(branches)
      .values({
        officeId: halishaharBranchOff.id,
        zoneId: z2.id,
        branchCode: 'BR-02111',
        branchName: 'Halishahar Branch',
        branchNameBn: 'হালিশহর শাখা',
        address: 'Block K, Halishahar Housing Estate, Chattogram',
        openingDate: '2020-01-10',
        status: 'Active',
      })
      .returning();

    const [brBogura] = await tx
      .insert(branches)
      .values({
        officeId: boguraBranchOff.id,
        zoneId: z3.id,
        branchCode: 'BR-03111',
        branchName: 'Bogura Sadar Branch',
        branchNameBn: 'বগুড়া সদর শাখা',
        address: 'Satmatha Sherpur Road, Bogura-5800',
        openingDate: '2021-04-12',
        status: 'Active',
      })
      .returning();

    // 4. Bangladesh Geography (Divisions -> Districts -> Upazilas -> Unions)
    const [divDhaka] = await tx.insert(divisions).values({ divisionCode: '30', divisionName: 'Dhaka', divisionNameBn: 'ঢাকা' }).returning();
    const [divCtg] = await tx.insert(divisions).values({ divisionCode: '20', divisionName: 'Chattogram', divisionNameBn: 'চট্টগ্রাম' }).returning();
    const [divRaj] = await tx.insert(divisions).values({ divisionCode: '50', divisionName: 'Rajshahi', divisionNameBn: 'রাজশাহী' }).returning();

    const [distDhaka] = await tx.insert(districts).values({ divisionId: divDhaka.id, districtCode: '26', districtName: 'Dhaka', districtNameBn: 'ঢাকা' }).returning();
    const [distGazipur] = await tx.insert(districts).values({ divisionId: divDhaka.id, districtCode: '33', districtName: 'Gazipur', districtNameBn: 'গাজীপুর' }).returning();
    const [distCtg] = await tx.insert(districts).values({ divisionId: divCtg.id, districtCode: '15', districtName: 'Chattogram', districtNameBn: 'চট্টগ্রাম' }).returning();
    const [distBogura] = await tx.insert(districts).values({ divisionId: divRaj.id, districtCode: '10', districtName: 'Bogura', districtNameBn: 'বগুড়া' }).returning();

    const [upMirpur] = await tx.insert(upazilas).values({ districtId: distDhaka.id, upazilaCode: '2648', upazilaName: 'Mirpur', upazilaNameBn: 'মিরপুর' }).returning();
    const [upSavar] = await tx.insert(upazilas).values({ districtId: distDhaka.id, upazilaCode: '2672', upazilaName: 'Savar', upazilaNameBn: 'সাভার' }).returning();
    const [upGazipur] = await tx.insert(upazilas).values({ districtId: distGazipur.id, upazilaCode: '3330', upazilaName: 'Gazipur Sadar', upazilaNameBn: 'গাজীপুর সদর' }).returning();
    const [upHalishahar] = await tx.insert(upazilas).values({ districtId: distCtg.id, upazilaCode: '1537', upazilaName: 'Halishahar', upazilaNameBn: 'হালিশহর' }).returning();
    const [upPatiya] = await tx.insert(upazilas).values({ districtId: distCtg.id, upazilaCode: '1561', upazilaName: 'Patiya', upazilaNameBn: 'পটিয়া' }).returning();
    const [upBogura] = await tx.insert(upazilas).values({ districtId: distBogura.id, upazilaCode: '1020', upazilaName: 'Bogura Sadar', upazilaNameBn: 'বগুড়া সদর' }).returning();

    const [unMirpur10] = await tx.insert(unions).values({ upazilaId: upMirpur.id, unionCode: 'UN-264801', unionName: 'Ward 03 - Mirpur Section 10', unionNameBn: 'ওয়ার্ড ০৩ - মিরপুর ১০' }).returning();
    const [unPallabi] = await tx.insert(unions).values({ upazilaId: upMirpur.id, unionCode: 'UN-264802', unionName: 'Ward 06 - Pallabi & Senpara', unionNameBn: 'ওয়ার্ড ০৬ - পল্লবী' }).returning();
    const [unSavar] = await tx.insert(unions).values({ upazilaId: upSavar.id, unionCode: 'UN-267201', unionName: 'Savar Pourashava', unionNameBn: 'সাভার পৌরসভা' }).returning();
    const [unHemayetpur] = await tx.insert(unions).values({ upazilaId: upSavar.id, unionCode: 'UN-267202', unionName: 'Tetuljhora (Hemayetpur)', unionNameBn: 'তেঁতুলঝোড়া (হেমায়েতপুর)' }).returning();
    await tx.insert(unions).values({ upazilaId: upGazipur.id, unionCode: 'UN-333001', unionName: 'Tongi East Ward 46', unionNameBn: 'টঙ্গী পূর্ব' });
    const [unHalishahar] = await tx.insert(unions).values({ upazilaId: upHalishahar.id, unionCode: 'UN-153701', unionName: 'Ward 26 - North Halishahar', unionNameBn: 'উত্তর হালিশহর' }).returning();
    const [unPatiya] = await tx.insert(unions).values({ upazilaId: upPatiya.id, unionCode: 'UN-156101', unionName: 'Chandanpur Union', unionNameBn: 'চন্দনপুর ইউনিয়ন' }).returning();
    const [unBogura] = await tx.insert(unions).values({ upazilaId: upBogura.id, unionCode: 'UN-102001', unionName: 'Nishindara Pourashava', unionNameBn: 'নিশিন্দারা' }).returning();

    // 5. Employees
    const [emp1] = await tx.insert(employees).values({ employeeCode: 'EMP-1001', fullName: 'Md. Rafiqul Islam', fullNameBn: 'মোঃ রফিকুল ইসলাম', designation: 'Senior Field Officer', phone: '01711-234501', email: 'rafiq@pallifin.org.bd', joiningDate: '2020-03-15', officeId: mirpurBranchOff.id, branchId: brMirpur.id, salary: '32000', status: 'Active' }).returning();
    const [emp2] = await tx.insert(employees).values({ employeeCode: 'EMP-1002', fullName: 'Nasrin Akter Banu', fullNameBn: 'নাসরিন আক্তার বানু', designation: 'Credit Officer', phone: '01711-234502', email: 'nasrin@pallifin.org.bd', joiningDate: '2021-07-01', officeId: mirpurBranchOff.id, branchId: brMirpur.id, salary: '28500', status: 'Active' }).returning();
    const [emp3] = await tx.insert(employees).values({ employeeCode: 'EMP-1003', fullName: 'Kamrul Hasan', fullNameBn: 'কামরুল হাসান', designation: 'Field Organizer', phone: '01711-234503', email: 'kamrul@pallifin.org.bd', joiningDate: '2019-11-10', officeId: mirpurBranchOff.id, branchId: brMirpur.id, salary: '25000', status: 'Inactive' }).returning();
    const [emp4] = await tx.insert(employees).values({ employeeCode: 'EMP-1004', fullName: 'Farhana Yasmin', fullNameBn: 'ফারহানা ইয়াসমিন', designation: 'Senior Credit Officer', phone: '01812-345601', email: 'farhana@pallifin.org.bd', joiningDate: '2020-05-18', officeId: savarBranchOff.id, branchId: brSavar.id, salary: '31000', status: 'Active' }).returning();
    const [emp5] = await tx.insert(employees).values({ employeeCode: 'EMP-1005', fullName: 'Tariqul Alam', fullNameBn: 'তারিকুল আলম', designation: 'Field Officer', phone: '01812-345602', email: 'tariqul@pallifin.org.bd', joiningDate: '2023-01-12', officeId: savarBranchOff.id, branchId: brSavar.id, salary: '24000', status: 'Active' }).returning();
    const [emp6] = await tx.insert(employees).values({ employeeCode: 'EMP-1006', fullName: 'Shafiqul Chowdhury', fullNameBn: 'শফিকুল চৌধুরী', designation: 'Senior Field Officer', phone: '01913-456701', email: 'shafiq@pallifin.org.bd', joiningDate: '2020-09-05', officeId: halishaharBranchOff.id, branchId: brHalishahar.id, salary: '33000', status: 'Active' }).returning();
    const [emp7] = await tx.insert(employees).values({ employeeCode: 'EMP-1007', fullName: 'Mizanur Rahman', fullNameBn: 'মিজানুর রহমান', designation: 'Field Officer', phone: '01715-567801', email: 'mizan@pallifin.org.bd', joiningDate: '2021-08-11', officeId: boguraBranchOff.id, branchId: brBogura.id, salary: '26500', status: 'Active' }).returning();

    // 6. Roles & Permissions
    const [roleSuper] = await tx.insert(roles).values({ roleCode: 'SUPER_ADMIN', roleName: 'Super Administrator', description: 'Unrestricted enterprise access across all divisions, zones, and branches' }).returning();
    const [roleHO] = await tx.insert(roles).values({ roleCode: 'HEAD_OFFICE_ADMIN', roleName: 'Head Office Administrator', description: 'Central administration, reporting, and branch oversight' }).returning();
    const [roleZonal] = await tx.insert(roles).values({ roleCode: 'ZONAL_MANAGER', roleName: 'Zonal Manager', description: 'Regional zone management and branch approvals' }).returning();
    const [roleBM] = await tx.insert(roles).values({ roleCode: 'BRANCH_MANAGER', roleName: 'Branch Manager', description: 'Full branch operations, Samity, Holiday, and Member management' }).returning();
    const [roleFO] = await tx.insert(roles).values({ roleCode: 'FIELD_OFFICER', roleName: 'Field Officer', description: 'Samity viewing, member admission, and field collection entry' }).returning();
    await tx.insert(roles).values([
      { roleCode: 'UNIT_MANAGER', roleName: 'Unit Manager', description: 'Unit-level center supervision' },
      { roleCode: 'ACCOUNTANT', roleName: 'Accountant', description: 'General ledger, vouchers, and financial reporting' },
      { roleCode: 'AUDITOR', roleName: 'Auditor', description: 'Read-only audit log and compliance inspection' },
    ]);

    await tx.insert(permissions).values([
      { permCode: 'View', moduleName: 'Global', description: 'View records and reports within authorized offices' },
      { permCode: 'Create', moduleName: 'Global', description: 'Create new Samities, Holidays, Employees, Members' },
      { permCode: 'Edit', moduleName: 'Global', description: 'Modify existing operational records' },
      { permCode: 'Delete', moduleName: 'Global', description: 'Delete or deactivate records' },
      { permCode: 'Approve', moduleName: 'Operations', description: 'Approve loans, transfers, and adjustments' },
      { permCode: 'Export', moduleName: 'Reports', description: 'Export Excel and printable reports' },
      { permCode: 'Manage Office', moduleName: 'Administration', description: 'Configure offices, branches, and user scopes' },
    ]);

    const allPerms = JSON.stringify(['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export', 'Manage Office']);
    const bmPerms = JSON.stringify(['View', 'Create', 'Edit', 'Delete', 'Approve', 'Export']);
    const foPerms = JSON.stringify(['View', 'Create', 'Export']);

    const { salt: s1, hash: h1 } = hashPassword('Admin@2026');
    const { salt: s2, hash: h2 } = hashPassword('Branch@2026');
    const { salt: s3, hash: h3 } = hashPassword('Field@2026');

    const [adminUser] = await tx
      .insert(users)
      .values({
        username: 'admin',
        passwordHash: h1,
        passwordSalt: s1,
        fullName: 'Mahmudul Haque',
        email: 'mahmudul@pallifin.org.bd',
        roleId: roleSuper.id,
        roleCode: roleSuper.roleCode,
        roleName: roleSuper.roleName,
        permissionsList: allPerms,
        status: 'Active',
      })
      .returning();

    const [bmUser] = await tx
      .insert(users)
      .values({
        username: 'bm.mirpur',
        passwordHash: h2,
        passwordSalt: s2,
        fullName: 'Sadia Afrin',
        email: 'sadia.bm@pallifin.org.bd',
        roleId: roleBM.id,
        roleCode: roleBM.roleCode,
        roleName: roleBM.roleName,
        permissionsList: bmPerms,
        status: 'Active',
      })
      .returning();

    const [foUser] = await tx
      .insert(users)
      .values({
        username: 'fo.mirpur',
        passwordHash: h3,
        passwordSalt: s3,
        fullName: 'Md. Rafiqul Islam',
        email: 'rafiq@pallifin.org.bd',
        roleId: roleFO.id,
        roleCode: roleFO.roleCode,
        roleName: roleFO.roleName,
        permissionsList: foPerms,
        status: 'Active',
      })
      .returning();

    const [zonalUser] = await tx
      .insert(users)
      .values({
        username: 'zonal.dhaka',
        passwordHash: h2,
        passwordSalt: s2,
        fullName: 'Tahmidul Karim',
        email: 'tahmid@pallifin.org.bd',
        roleId: roleZonal.id,
        roleCode: roleZonal.roleCode,
        roleName: roleZonal.roleName,
        permissionsList: bmPerms,
        status: 'Active',
      })
      .returning();

    // Grant office permissions for scoped users
    await tx.insert(userOfficePermissions).values([
      { userId: bmUser.id, officeId: mirpurBranchOff.id, canManage: true },
      { userId: bmUser.id, officeId: uttaraUnitOff.id, canManage: true },
      { userId: foUser.id, officeId: mirpurBranchOff.id, canManage: false },
      { userId: zonalUser.id, officeId: dhakaDivOff.id, canManage: true },
      { userId: zonalUser.id, officeId: dhakaZoneOff.id, canManage: true },
      { userId: zonalUser.id, officeId: mirpurAreaOff.id, canManage: true },
      { userId: zonalUser.id, officeId: mirpurBranchOff.id, canManage: true },
      { userId: zonalUser.id, officeId: savarBranchOff.id, canManage: true },
      { userId: zonalUser.id, officeId: uttaraUnitOff.id, canManage: true },
    ]);

    // 7. Samities
    const samitySeedRows = [
      {
        samityCode: 'SM-01111-001',
        samityName: 'Shapla Mohila Samity',
        samityNameBn: 'শাপলা মহিলা সমিতি',
        officeId: mirpurBranchOff.id,
        branchId: brMirpur.id,
        employeeId: emp1.id,
        location: 'Mirpur Section-10, Block C',
        samityType: 'Female',
        collectionType: 'Regular',
        collectionDay: 'Sunday',
        collectionDate: '2026-11-22',
        openingDate: '2022-01-10',
        centerTime: '09:00',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upMirpur.id,
        unionId: unMirpur10.id,
        villageStreet: 'Lane 4, Block C, Section 10',
        zipCode: '1216',
        samityAddress: 'House 12, Lane 4, Block C, Mirpur-10, Dhaka-1216',
        status: 'Active',
        remarks: '100% on-time repayment record in FY 2025-2026',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-01111-002',
        samityName: 'Padma Khudro Byabsha Samity',
        samityNameBn: 'পদ্মা ক্ষুদ্র ব্যবসা সমিতি',
        officeId: mirpurBranchOff.id,
        branchId: brMirpur.id,
        employeeId: emp2.id,
        location: 'Benarashi Palli Gate-2',
        samityType: 'SME',
        collectionType: 'Weekly',
        collectionDay: 'Monday',
        collectionDate: '2026-11-23',
        openingDate: '2022-04-18',
        centerTime: '10:30',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upMirpur.id,
        unionId: unMirpur10.id,
        villageStreet: 'Benarashi Palli Gate 2',
        zipCode: '1216',
        samityAddress: 'Shop 14, Benarashi Palli, Mirpur-10, Dhaka-1216',
        status: 'Active',
        remarks: 'Micro-enterprise weaving & retail cluster',
        createdBy: 'admin',
        updatedBy: 'bm.mirpur',
      },
      {
        samityCode: 'SM-01111-003',
        samityName: 'Surjomukhi Unnayan Samity',
        samityNameBn: 'সূর্যমুখী উন্নয়ন সমিতি',
        officeId: mirpurBranchOff.id,
        branchId: brMirpur.id,
        employeeId: emp1.id,
        location: 'Senpara Parbata',
        samityType: 'Female',
        collectionType: 'Regular',
        collectionDay: 'Tuesday',
        collectionDate: '2026-11-24',
        openingDate: '2023-02-05',
        centerTime: '08:30',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upMirpur.id,
        unionId: unPallabi.id,
        villageStreet: 'Senpara Parbata Main Lane',
        zipCode: '1216',
        samityAddress: '45 Senpara Parbata, Mirpur-10, Dhaka-1216',
        status: 'Active',
        remarks: 'High DPS savings participation',
        createdBy: 'bm.mirpur',
        updatedBy: 'bm.mirpur',
      },
      {
        samityCode: 'SM-01111-004',
        samityName: 'Bikash Purush Samity',
        samityNameBn: 'বিকাশ পুরুষ সমিতি',
        officeId: mirpurBranchOff.id,
        branchId: brMirpur.id,
        employeeId: emp2.id,
        location: 'Kazipara East',
        samityType: 'Male',
        collectionType: 'Monthly',
        collectionDay: 'Wednesday',
        collectionDate: '2026-11-25',
        openingDate: '2021-08-22',
        centerTime: '15:00',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upMirpur.id,
        unionId: unMirpur10.id,
        villageStreet: 'Kazipara Bus Stand Lane',
        zipCode: '1216',
        samityAddress: '118 Kazipara Main Road, Mirpur, Dhaka-1216',
        status: 'Inactive',
        remarks: 'Temporarily suspended pending cycle renewal',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-01112-001',
        samityName: 'Bongshi Krishi Samity',
        samityNameBn: 'বংশী কৃষি সমিতি',
        officeId: savarBranchOff.id,
        branchId: brSavar.id,
        employeeId: emp4.id,
        location: 'Bank Town Ward-3',
        samityType: 'Agriculture',
        collectionType: 'Fortnightly',
        collectionDay: 'Saturday',
        collectionDate: '2026-11-21',
        openingDate: '2022-06-14',
        centerTime: '09:30',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upSavar.id,
        unionId: unSavar.id,
        villageStreet: 'Bank Town Road 3',
        zipCode: '1340',
        samityAddress: 'Bank Town Ward 3, Savar, Dhaka-1340',
        status: 'Active',
        remarks: 'Dairy and seasonal vegetable cultivation group',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-01112-002',
        samityName: 'Meghna Garment Workers Samity',
        samityNameBn: 'মেঘনা গার্মেন্টস শ্রমিক সমিতি',
        officeId: savarBranchOff.id,
        branchId: brSavar.id,
        employeeId: emp5.id,
        location: 'Hemayetpur Bazar',
        samityType: 'Mixed',
        collectionType: 'Monthly',
        collectionDay: 'Thursday',
        collectionDate: '2026-11-26',
        openingDate: '2023-09-01',
        centerTime: '17:30',
        divisionId: divDhaka.id,
        districtId: distDhaka.id,
        upazilaId: upSavar.id,
        unionId: unHemayetpur.id,
        villageStreet: 'Hemayetpur Bus Stand',
        zipCode: '1340',
        samityAddress: 'Hemayetpur Bazar Road, Savar, Dhaka-1340',
        status: 'Active',
        remarks: 'Evening collection post factory shift',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-02111-001',
        samityName: 'Karnaphuli Matsho Samity',
        samityNameBn: 'কর্ণফুলী মৎস্য সমিতি',
        officeId: halishaharBranchOff.id,
        branchId: brHalishahar.id,
        employeeId: emp6.id,
        location: 'Halishahar Block G',
        samityType: 'Male',
        collectionType: 'Regular',
        collectionDay: 'Monday',
        collectionDate: '2026-11-23',
        openingDate: '2021-11-04',
        centerTime: '08:00',
        divisionId: divCtg.id,
        districtId: distCtg.id,
        upazilaId: upHalishahar.id,
        unionId: unHalishahar.id,
        villageStreet: 'Block G, Lane 2',
        zipCode: '4216',
        samityAddress: 'Block G, Halishahar Housing Estate, Chattogram-4216',
        status: 'Active',
        remarks: 'Coastal fisheries & net trading group',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-02111-002',
        samityName: 'Sagarika Mohila Samity',
        samityNameBn: 'সাগরিকা মহিলা সমিতি',
        officeId: halishaharBranchOff.id,
        branchId: brHalishahar.id,
        employeeId: emp6.id,
        location: 'Rampur Eidgah',
        samityType: 'Female',
        collectionType: 'Weekly',
        collectionDay: 'Wednesday',
        collectionDate: '2026-11-25',
        openingDate: '2022-10-09',
        centerTime: '10:00',
        divisionId: divCtg.id,
        districtId: distCtg.id,
        upazilaId: upPatiya.id,
        unionId: unPatiya.id,
        villageStreet: 'Rampur Eidgah Lane',
        zipCode: '4216',
        samityAddress: 'Rampur Eidgah Lane, Halishahar, Chattogram-4216',
        status: 'Active',
        remarks: 'Tailoring & handicrafts cluster',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
      {
        samityCode: 'SM-03111-001',
        samityName: 'Karatoya Handicraft Samity',
        samityNameBn: 'করতোয়া হস্তশিল্প সমিতি',
        officeId: boguraBranchOff.id,
        branchId: brBogura.id,
        employeeId: emp7.id,
        location: 'Nishindara Housing',
        samityType: 'Female',
        collectionType: 'Regular',
        collectionDay: 'Thursday',
        collectionDate: '2026-11-26',
        openingDate: '2022-03-12',
        centerTime: '09:00',
        divisionId: divRaj.id,
        districtId: distBogura.id,
        upazilaId: upBogura.id,
        unionId: unBogura.id,
        villageStreet: 'Nishindara Main Road',
        zipCode: '5800',
        samityAddress: 'Nishindara Housing, Bogura Sadar, Bogura-5800',
        status: 'Active',
        remarks: 'Nakshi kantha artisan enterprise',
        createdBy: 'admin',
        updatedBy: 'admin',
      },
    ];

    const insertedSamities = await tx.insert(samities).values(samitySeedRows).returning();

    for (const s of insertedSamities) {
      await tx.insert(samityCollectionSchedules).values({
        samityId: s.id,
        collectionType: s.collectionType,
        collectionDay: s.collectionDay,
        centerTime: s.centerTime,
        effectiveFrom: s.openingDate,
        isActive: s.status === 'Active',
        notes: 'Initial collection schedule',
      });
    }

    // 8. Holidays
    const [hWeekly] = await tx
      .insert(holidays)
      .values({
        officeId: mirpurBranchOff.id,
        centerName: 'All Centers',
        holidayDate: '2026-11-20',
        description: 'Weekly Friday Holiday',
        holidayType: 'Weekly',
        isAllSamities: true,
        createdBy: 'admin',
      })
      .returning();

    const [hVictory] = await tx
      .insert(holidays)
      .values({
        officeId: mirpurBranchOff.id,
        centerName: 'All Centers',
        holidayDate: '2026-12-16',
        description: 'Victory Day (Bijoy Dibosh)',
        holidayType: 'Government Holiday',
        isAllSamities: true,
        createdBy: 'admin',
      })
      .returning();

    const [hSpecific] = await tx
      .insert(holidays)
      .values({
        officeId: mirpurBranchOff.id,
        centerName: 'Shapla Mohila Samity',
        holidayDate: '2026-11-29',
        description: 'Center House Renovation Break',
        holidayType: 'Specific',
        isAllSamities: false,
        createdBy: 'bm.mirpur',
      })
      .returning();

    const [hYearly] = await tx
      .insert(holidays)
      .values({
        officeId: savarBranchOff.id,
        centerName: 'All Centers',
        holidayDate: '2026-12-31',
        description: 'Annual Bank Closing Day',
        holidayType: 'Yearly',
        isAllSamities: true,
        createdBy: 'admin',
      })
      .returning();

    await tx.insert(holidaySamities).values([
      { holidayId: hSpecific.id, samityId: insertedSamities[0].id },
      { holidayId: hWeekly.id, samityId: insertedSamities[0].id },
      { holidayId: hVictory.id, samityId: insertedSamities[0].id },
      { holidayId: hYearly.id, samityId: insertedSamities[4].id },
    ]);

    // 9. Members, Loans, Savings, Transactions, Accounts
    const memberInputs = [
      { code: 'MEM-1001', name: 'Amena Begum', bn: 'আমেনা বেগম', samity: insertedSamities[0], phone: '01721-110001', nid: '1988456123001', date: '2022-01-12', status: 'Active' },
      { code: 'MEM-1002', name: 'Roksana Parvin', bn: 'রোকসানা পারভীন', samity: insertedSamities[0], phone: '01721-110002', nid: '1990456123002', date: '2022-01-12', status: 'Active' },
      { code: 'MEM-1003', name: 'Kulsum Akter', bn: 'কুলসুম আক্তার', samity: insertedSamities[0], phone: '01721-110003', nid: '1985456123003', date: '2026-11-04', status: 'Active' },
      { code: 'MEM-1004', name: 'Salma Khatun', bn: 'সালমা খাতুন', samity: insertedSamities[0], phone: '01721-110004', nid: '1992456123004', date: '2022-05-04', status: 'Dropout' },
      { code: 'MEM-1005', name: 'Naznin Sultana', bn: 'নাজনীন সুলতানা', samity: insertedSamities[0], phone: '01721-110005', nid: '1994456123005', date: '2026-11-10', status: 'Waiting' },
      { code: 'MEM-1006', name: 'Jahangir Alam', bn: 'জাহাঙ্গীর আলম', samity: insertedSamities[1], phone: '01822-220001', nid: '1983456123006', date: '2022-04-20', status: 'Active' },
      { code: 'MEM-1007', name: 'Monirul Islam', bn: 'মনিরুল ইসলাম', samity: insertedSamities[1], phone: '01822-220002', nid: '1987456123007', date: '2023-02-11', status: 'Active' },
      { code: 'MEM-1008', name: 'Sharmin Akter', bn: 'শারমিন আক্তার', samity: insertedSamities[2], phone: '01822-220003', nid: '1991456123008', date: '2026-11-08', status: 'Waiting' },
      { code: 'MEM-1009', name: 'Hosneara Begum', bn: 'হোসনেয়ারা বেগম', samity: insertedSamities[2], phone: '01733-330001', nid: '1989456123009', date: '2023-02-10', status: 'Active' },
      { code: 'MEM-1010', name: 'Abdul Kader', bn: 'আব্দুল কাদের', samity: insertedSamities[3], phone: '01744-440001', nid: '1981456123011', date: '2021-08-25', status: 'Inactive' },
      { code: 'MEM-1011', name: 'Abul Kashem', bn: 'আবুল কাশেম', samity: insertedSamities[4], phone: '01855-550001', nid: '1986456123012', date: '2022-06-18', status: 'Active' },
      { code: 'MEM-1012', name: 'Firoza Begum', bn: 'ফিরোজা বেগম', samity: insertedSamities[4], phone: '01855-550002', nid: '1990456123013', date: '2026-11-02', status: 'Active' },
      { code: 'MEM-1013', name: 'Rubel Mia', bn: 'রুবেল মিয়া', samity: insertedSamities[5], phone: '01966-660001', nid: '1995456123014', date: '2023-09-05', status: 'Active' },
      { code: 'MEM-1014', name: 'Nurul Absar', bn: 'নুরুল আবছার', samity: insertedSamities[6], phone: '01888-880001', nid: '1984456123016', date: '2021-11-08', status: 'Active' },
      { code: 'MEM-1015', name: 'Khaleda Yasmin', bn: 'খালেদা ইয়াসমিন', samity: insertedSamities[7], phone: '01999-990001', nid: '1992456123017', date: '2022-10-12', status: 'Active' },
      { code: 'MEM-1016', name: 'Laily Begum', bn: 'লাইলি বেগম', samity: insertedSamities[8], phone: '01712-120001', nid: '1989456123019', date: '2022-03-15', status: 'Active' },
    ];

    const insertedMembers = await tx
      .insert(members)
      .values(
        memberInputs.map((m) => ({
          memberCode: m.code,
          fullName: m.name,
          fullNameBn: m.bn,
          samityId: m.samity.id,
          officeId: m.samity.officeId,
          branchId: m.samity.branchId,
          phone: m.phone,
          nid: m.nid,
          admissionDate: m.date,
          status: m.status,
        }))
      )
      .returning();

    // Loans across fiscal years + arrear aging ranges
    const loanSeed = [
      { no: 'LN-24-0001', m: insertedMembers[0], prod: 'Jagoron Microcredit', prin: '50000', out: '12000', rec: '12000', col: '12000', ov: '0', ovDays: 0, dt: '2024-02-10', fy: '2023-2024', st: 'Closed' },
      { no: 'LN-25-0002', m: insertedMembers[1], prod: 'Jagoron Microcredit', prin: '65000', out: '28000', rec: '32000', col: '32000', ov: '0', ovDays: 0, dt: '2025-01-18', fy: '2024-2025', st: 'Active' },
      { no: 'LN-26-0003', m: insertedMembers[0], prod: 'Agrosor SME', prin: '80000', out: '52000', rec: '18000', col: '18000', ov: '0', ovDays: 0, dt: '2026-11-02', fy: '2025-2026', st: 'Active' },
      { no: 'LN-26-0004', m: insertedMembers[2], prod: 'Jagoron Microcredit', prin: '45000', out: '38000', rec: '9000', col: '6500', ov: '2500', ovDays: 18, dt: '2026-08-15', fy: '2025-2026', st: 'Overdue' },
      { no: 'LN-26-0005', m: insertedMembers[5], prod: 'Agrosor SME', prin: '150000', out: '98000', rec: '30000', col: '30000', ov: '0', ovDays: 0, dt: '2026-06-10', fy: '2025-2026', st: 'Active' },
      { no: 'LN-26-0006', m: insertedMembers[6], prod: 'Agrosor SME', prin: '110000', out: '74000', rec: '22000', col: '15000', ov: '7000', ovDays: 45, dt: '2026-04-12', fy: '2025-2026', st: 'Overdue' },
      { no: 'LN-26-0007', m: insertedMembers[8], prod: 'Jagoron Microcredit', prin: '55000', out: '41000', rec: '11000', col: '11000', ov: '0', ovDays: 0, dt: '2026-09-01', fy: '2025-2026', st: 'Active' },
      { no: 'LN-25-0008', m: insertedMembers[10], prod: 'Sufolon Agri', prin: '90000', out: '42000', rec: '18000', col: '9000', ov: '9000', ovDays: 112, dt: '2025-05-14', fy: '2024-2025', st: 'Overdue' },
      { no: 'LN-26-0009', m: insertedMembers[11], prod: 'Sufolon Agri', prin: '70000', out: '62000', rec: '14000', col: '14000', ov: '0', ovDays: 0, dt: '2026-11-05', fy: '2025-2026', st: 'Active' },
      { no: 'LN-26-0010', m: insertedMembers[12], prod: 'Jagoron Microcredit', prin: '40000', out: '29500', rec: '8000', col: '3500', ov: '4500', ovDays: 215, dt: '2026-01-20', fy: '2025-2026', st: 'Overdue' },
      { no: 'LN-26-0011', m: insertedMembers[13], prod: 'Agrosor SME', prin: '125000', out: '86000', rec: '25000', col: '25000', ov: '0', ovDays: 0, dt: '2026-07-08', fy: '2025-2026', st: 'Active' },
      { no: 'LN-26-0012', m: insertedMembers[14], prod: 'Jagoron Microcredit', prin: '60000', out: '44000', rec: '12000', col: '12000', ov: '0', ovDays: 0, dt: '2026-08-22', fy: '2025-2026', st: 'Active' },
      { no: 'LN-26-0013', m: insertedMembers[15], prod: 'Buniad Artisan', prin: '55000', out: '39000', rec: '11000', col: '11000', ov: '0', ovDays: 0, dt: '2026-09-10', fy: '2025-2026', st: 'Active' },
    ];

    const insertedLoans = await tx
      .insert(loans)
      .values(
        loanSeed.map((l) => ({
          loanAccountNo: l.no,
          memberId: l.m.id,
          samityId: l.m.samityId,
          officeId: l.m.officeId,
          productName: l.prod,
          principalAmount: l.prin,
          outstandingBalance: l.out,
          recoverableAmount: l.rec,
          collectedAmount: l.col,
          overdueAmount: l.ov,
          overdueDays: l.ovDays,
          disbursementDate: l.dt,
          fiscalYear: l.fy,
          status: l.st,
        }))
      )
      .returning();

    // Savings
    const insertedSavings = await tx
      .insert(savings)
      .values(
        insertedMembers.map((m, idx) => ({
          accountNo: `SAV-2026-${String(idx + 1).padStart(4, '0')}`,
          memberId: m.id,
          samityId: m.samityId,
          officeId: m.officeId,
          productType: idx % 3 === 0 ? 'DPS' : idx % 2 === 0 ? 'Voluntary' : 'General Savings',
          balance: String(8500 + idx * 2400),
          openedDate: m.admissionDate,
          fiscalYear: idx < 4 ? '2023-2024' : idx < 9 ? '2024-2025' : '2025-2026',
          status: m.status === 'Dropout' ? 'Closed' : 'Active',
        }))
      )
      .returning();

    // Transactions
    await tx.insert(transactions).values([
      {
        txCode: 'TX-2026-0001',
        officeId: mirpurBranchOff.id,
        samityId: insertedSamities[0].id,
        memberId: insertedMembers[0].id,
        loanId: insertedLoans[2].id,
        txType: 'Loan Disbursement',
        amount: '80000',
        txDate: '2026-11-02',
        fiscalYear: '2025-2026',
        description: 'Agrosor SME Cycle-2 Disbursement',
        createdBy: 'bm.mirpur',
      },
      {
        txCode: 'TX-2026-0002',
        officeId: mirpurBranchOff.id,
        samityId: insertedSamities[0].id,
        memberId: insertedMembers[0].id,
        loanId: insertedLoans[2].id,
        txType: 'Loan Repayment',
        amount: '18000',
        txDate: '2026-11-15',
        fiscalYear: '2025-2026',
        description: 'Weekly installment collection',
        createdBy: 'fo.mirpur',
      },
      {
        txCode: 'TX-2026-0003',
        officeId: savarBranchOff.id,
        samityId: insertedSamities[4].id,
        memberId: insertedMembers[11].id,
        loanId: insertedLoans[8].id,
        txType: 'Loan Disbursement',
        amount: '70000',
        txDate: '2026-11-05',
        fiscalYear: '2025-2026',
        description: 'Sufolon Agri loan disbursement',
        createdBy: 'admin',
      },
      {
        txCode: 'TX-2026-0004',
        officeId: mirpurBranchOff.id,
        samityId: insertedSamities[0].id,
        memberId: insertedMembers[1].id,
        savingsId: insertedSavings[1].id,
        txType: 'Savings Deposit',
        amount: '5500',
        txDate: '2026-11-14',
        fiscalYear: '2025-2026',
        description: 'Regular weekly savings deposit',
        createdBy: 'fo.mirpur',
      },
    ]);

    // Accounts (Income & Expenditure)
    await tx.insert(accounts).values([
      { accountCode: '4001', accountName: 'Service Charge Income (Mirpur-10)', accountType: 'Income', officeId: mirpurBranchOff.id, balance: '342500', fiscalYear: '2025-2026' },
      { accountCode: '4002', accountName: 'Admission & Passbook Fees', accountType: 'Income', officeId: mirpurBranchOff.id, balance: '48200', fiscalYear: '2025-2026' },
      { accountCode: '4003', accountName: 'Service Charge Income (Savar)', accountType: 'Income', officeId: savarBranchOff.id, balance: '215000', fiscalYear: '2025-2026' },
      { accountCode: '4004', accountName: 'Service Charge Income (Halishahar)', accountType: 'Income', officeId: halishaharBranchOff.id, balance: '198000', fiscalYear: '2025-2026' },
      { accountCode: '4005', accountName: 'Service Charge Income (Bogura)', accountType: 'Income', officeId: boguraBranchOff.id, balance: '164000', fiscalYear: '2025-2026' },
      { accountCode: '5001', accountName: 'Staff Salary & Allowances (Mirpur-10)', accountType: 'Expenditure', officeId: mirpurBranchOff.id, balance: '185000', fiscalYear: '2025-2026' },
      { accountCode: '5002', accountName: 'Branch Rent & Utilities (Mirpur-10)', accountType: 'Expenditure', officeId: mirpurBranchOff.id, balance: '42000', fiscalYear: '2025-2026' },
      { accountCode: '5003', accountName: 'Staff Salary & Operations (Savar)', accountType: 'Expenditure', officeId: savarBranchOff.id, balance: '118000', fiscalYear: '2025-2026' },
      { accountCode: '5004', accountName: 'Staff Salary & Operations (Halishahar)', accountType: 'Expenditure', officeId: halishaharBranchOff.id, balance: '105000', fiscalYear: '2025-2026' },
      { accountCode: '5005', accountName: 'Staff Salary & Operations (Bogura)', accountType: 'Expenditure', officeId: boguraBranchOff.id, balance: '92000', fiscalYear: '2025-2026' },
    ]);

    // Audit Logs
    await tx.insert(auditLogs).values([
      {
        userId: adminUser.id,
        username: 'admin',
        module: 'Samity',
        action: 'CREATE',
        recordId: insertedSamities[0].id,
        recordCode: insertedSamities[0].samityCode,
        previousValues: null,
        newValues: JSON.stringify({ samityCode: insertedSamities[0].samityCode, samityName: insertedSamities[0].samityName, status: 'Active' }),
      },
      {
        userId: bmUser.id,
        username: 'bm.mirpur',
        module: 'Holiday',
        action: 'CREATE',
        recordId: hSpecific.id,
        recordCode: '2026-11-29',
        previousValues: null,
        newValues: JSON.stringify({ centerName: 'Shapla Mohila Samity', holidayType: 'Specific', description: 'Center House Renovation Break' }),
      },
      {
        userId: adminUser.id,
        username: 'admin',
        module: 'Security',
        action: 'INIT_SYSTEM',
        recordId: org.id,
        recordCode: org.orgCode,
        previousValues: null,
        newValues: JSON.stringify({ message: 'Initialized PalliFin Microfinance ERP core organizational hierarchy' }),
      },
    ]);
  });
}
