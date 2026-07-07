"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dayjs_1 = __importDefault(require("dayjs"));
const settings_defaults_1 = require("../src/modules/settings/settings.defaults");
const settings_service_1 = require("../src/modules/settings/settings.service");
const prisma = new client_1.PrismaClient();
const hash = (p) => bcryptjs_1.default.hash(p, 10);
const daysFromNow = (n) => (0, dayjs_1.default)().add(n, 'day').toDate();
const daysAgo = (n) => (0, dayjs_1.default)().subtract(n, 'day').toDate();
async function main() {
    console.log('Seeding database…');
    // --- Settings + PM schedules ---
    await (0, settings_service_1.ensureSettingsSeeded)();
    for (const [vt, cfg] of Object.entries(settings_defaults_1.DEFAULT_PM_SCHEDULES)) {
        await prisma.pmSchedule.upsert({
            where: { vehicleType: vt },
            create: { vehicleType: vt, kmInterval: cfg.km, timeIntervalDays: cfg.days },
            update: { kmInterval: cfg.km, timeIntervalDays: cfg.days },
        });
    }
    // --- Users (one per role) ---
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@fleet.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
    const users = [
        { email: adminEmail, role: 'FLEET_MANAGER', name: 'Fleet Manager', password: adminPassword },
        { email: 'workshop@fleet.local', role: 'WORKSHOP', name: 'Workshop Lead', password: 'Passw0rd!' },
        { email: 'compliance@fleet.local', role: 'COMPLIANCE', name: 'Compliance Admin', password: 'Passw0rd!' },
        { email: 'finance@fleet.local', role: 'FINANCE', name: 'Finance Analyst', password: 'Passw0rd!' },
        { email: 'coordinator@fleet.local', role: 'TRANSPORT_COORDINATOR', name: 'Transport Coordinator', password: 'Passw0rd!' },
        { email: 'ops@fleet.local', role: 'OPS_DELIVERY', name: 'Delivery Executive', password: 'Passw0rd!' },
        { email: 'deliverymgr@fleet.local', role: 'DELIVERY_MANAGER', name: 'Delivery Manager', password: 'Passw0rd!' },
        { email: 'warehouse@fleet.local', role: 'WAREHOUSE_MANAGER', name: 'Warehouse Manager', password: 'Passw0rd!' },
        { email: 'management@fleet.local', role: 'MANAGEMENT', name: 'General Manager', password: 'Passw0rd!' },
    ];
    for (const u of users) {
        await prisma.user.upsert({
            where: { email: u.email },
            create: { email: u.email, fullName: u.name, role: u.role, passwordHash: await hash(u.password) },
            update: {},
        });
    }
    // --- Vendors ---
    const vendorData = [
        { type: 'workshop', name: 'Al Habtoor Motors Workshop', phone: '+97143334444' },
        { type: 'tyre_supplier', name: 'ZAFCO Tyres', phone: '+97148889999' },
        { type: 'insurance', name: 'Oman Insurance Company', phone: '+97142330000' },
        { type: 'fuel_supplier', name: 'FuelBuddy UAE', phone: '+97145556666' },
        { type: 'lessor', name: 'Diamond Lease', phone: '+97143001000' },
    ];
    const vendors = [];
    for (const v of vendorData) {
        vendors.push(await prisma.vendor.create({ data: v }));
    }
    const lessor = vendors.find((v) => v.type === 'lessor');
    const insurer = vendors.find((v) => v.type === 'insurance');
    const workshop = vendors.find((v) => v.type === 'workshop');
    // --- Stores (subset of the 13) ---
    const storeData = [
        { code: 'DXB01', name: 'Dubai Festival City', emirate: 'Dubai' },
        { code: 'DXB02', name: 'Dubai Deira', emirate: 'Dubai' },
        { code: 'AUH01', name: 'Abu Dhabi Mussafah', emirate: 'Abu Dhabi' },
        { code: 'SHJ01', name: 'Sharjah Industrial', emirate: 'Sharjah' },
        { code: 'AJM01', name: 'Ajman City', emirate: 'Ajman' },
    ];
    const stores = [];
    for (const s of storeData)
        stores.push(await prisma.store.create({ data: s }));
    // --- Vehicles (~10) ---
    const makes = [
        ['Toyota', 'Hiace', 'van', 'panel van'],
        ['Isuzu', 'NPR', 'truck_3_7t', 'box'],
        ['Toyota', 'Camry', 'sedan', 'passenger'],
        ['Mitsubishi', 'L200', 'pickup', 'pickup'],
        ['Toyota', 'Coaster', 'bus', 'passenger'],
        ['Nissan', 'Urvan', 'van', 'panel van'],
        ['Ford', 'Transit', 'van', 'panel van'],
        ['Hino', '300', 'truck_3_7t', 'curtain-side'],
        ['Toyota', 'Corolla', 'sedan', 'passenger'],
        ['Nissan', 'Navara', 'pickup', 'pickup'],
    ];
    const emirates = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'];
    const vehicles = [];
    for (let i = 0; i < makes.length; i++) {
        const [make, model, type, body] = makes[i];
        const owned = i % 3 !== 0;
        const v = await prisma.vehicle.create({
            data: {
                plateNumber: `${String.fromCharCode(65 + (i % 5))}-${10000 + i * 137}`,
                plateEmirate: emirates[i % emirates.length],
                plateCategory: 'Private',
                make, model, year: 2019 + (i % 5), vin: `VIN${100000 + i}`,
                vehicleType: type, bodyType: body,
                seatingCapacity: type === 'bus' ? 22 : type === 'sedan' ? 5 : 3,
                payloadKg: type === 'truck_3_7t' ? 5000 : type === 'pickup' ? 1000 : 1200,
                ownership: owned ? 'owned' : 'leased',
                leaseEnd: owned ? null : daysFromNow(40 + i * 5),
                monthlyCost: owned ? null : 2500,
                lessorId: owned ? null : lessor.id,
                currentOdometer: 40000 + i * 5300,
                storeId: stores[i % stores.length].id,
                status: i === 4 ? 'in_workshop' : i === 7 ? 'vor' : 'active',
                warrantyEndDate: daysFromNow(i === 2 ? 20 : 300 + i * 10),
                warrantyEndKm: 100000 + i * 1000,
                usefulLifeYears: 5,
                residualValue: 15000,
            },
        });
        vehicles.push(v);
        // Purchase record for owned vehicles.
        if (owned) {
            await prisma.vehiclePurchase.create({
                data: { vehicleId: v.id, purchaseDate: daysAgo(400 + i * 30), purchasePrice: 90000 + i * 5000, usefulLifeYears: 5, residualValue: 15000 },
            });
        }
        // Salik tag.
        await prisma.salikTag.create({ data: { vehicleId: v.id, tagNumber: `SALIK${1000 + i}`, balance: i === 3 ? 8 : 60 + i, lowThreshold: 20 } });
        // PM state (some due/overdue).
        const lastKm = v.currentOdometer - (i === 1 ? 9800 : 3000);
        const cfg = settings_defaults_1.DEFAULT_PM_SCHEDULES[type];
        await prisma.pmState.create({
            data: {
                vehicleId: v.id,
                lastPmKm: lastKm,
                lastPmDate: daysAgo(i === 1 ? 175 : 60),
                nextPmKm: lastKm + cfg.km,
                nextPmDate: daysFromNow(i === 1 ? 5 : 120),
            },
        });
    }
    // --- Drivers (~10) + one login for driver[0] ---
    const driverNames = ['Rahul Sharma', 'Mohammed Ali', 'Suresh Kumar', 'Abdul Rahman', 'Vijay Nair', 'Imran Khan', 'Prakash Rao', 'Salim Ahmed', 'Ganesh Iyer', 'Yusuf Hassan'];
    const drivers = [];
    for (let i = 0; i < driverNames.length; i++) {
        const d = await prisma.driver.create({
            data: {
                fullName: driverNames[i],
                staffId: `EMP${2000 + i}`,
                nationality: ['Indian', 'Pakistani', 'Egyptian'][i % 3],
                joiningDate: daysAgo(500 + i * 20),
                licenceNumber: `DL${50000 + i}`,
                licenceClass: '3',
                licenceExpiry: daysFromNow(i === 0 ? 10 : 200 + i * 5),
                emiratesId: `784-${1980 + i}-1234567-${i}`,
                emiratesIdExpiry: daysFromNow(i === 1 ? -3 : 180),
                visaExpiry: daysFromNow(i === 2 ? 25 : 300),
                passportNumber: `P${9000000 + i}`,
                passportExpiry: daysFromNow(365 + i * 30),
                defaultVehicleId: vehicles[i]?.id,
            },
        });
        drivers.push(d);
        // Compliance documents for the driver (mirror licence/EID/visa/passport).
        await prisma.complianceDocument.createMany({
            data: [
                { entityType: 'driver', driverId: d.id, docType: 'licence', reference: d.licenceNumber, expiryDate: d.licenceExpiry },
                { entityType: 'driver', driverId: d.id, docType: 'emirates_id', reference: d.emiratesId, expiryDate: d.emiratesIdExpiry },
                { entityType: 'driver', driverId: d.id, docType: 'visa', expiryDate: d.visaExpiry },
                { entityType: 'driver', driverId: d.id, docType: 'passport', reference: d.passportNumber, expiryDate: d.passportExpiry },
            ],
        });
        // Assign driver to vehicle.
        if (vehicles[i]) {
            await prisma.vehicleDriverAssignment.create({
                data: { vehicleId: vehicles[i].id, driverId: d.id, effectiveFrom: daysAgo(120) },
            });
        }
    }
    // Link a User login to the first driver (mobile screen demo).
    await prisma.user.upsert({
        where: { email: 'driver@fleet.local' },
        create: { email: 'driver@fleet.local', fullName: drivers[0].fullName, role: 'DRIVER', passwordHash: await hash('Passw0rd!'), driverId: drivers[0].id },
        update: { driverId: drivers[0].id },
    });
    // --- Vehicle compliance documents (mulkiya, insurance, tasjeel) ---
    for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        await prisma.complianceDocument.createMany({
            data: [
                { entityType: 'vehicle', vehicleId: v.id, docType: 'mulkiya', reference: `MLK${i}`, expiryDate: daysFromNow(i === 0 ? -5 : 90 + i * 3) },
                { entityType: 'vehicle', vehicleId: v.id, docType: 'insurance', reference: `INS${i}`, expiryDate: daysFromNow(i === 6 ? 12 : 200) },
                { entityType: 'vehicle', vehicleId: v.id, docType: 'tasjeel', reference: `TSJ${i}`, expiryDate: daysFromNow(i === 3 ? 8 : 150) },
            ],
        });
    }
    // --- Fuel transactions (build history for efficiency) ---
    for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        let odo = v.currentOdometer - 2400;
        for (let f = 0; f < 6; f++) {
            odo += 380 + Math.round(Math.random() * 60);
            const litres = 45 + Math.round(Math.random() * 10);
            const channel = f % 3 === 0 ? 'cash' : f % 3 === 1 ? 'vip_kit' : 'fuel_buddy';
            const amount = +(litres * 3.1).toFixed(2);
            await prisma.fuelTransaction.create({
                data: {
                    vehicleId: v.id, filledAt: daysAgo(60 - f * 10),
                    odometer: odo, litres, amount, rate: 3.1, channel,
                    driverId: drivers[i]?.id,
                    kmSinceLast: 380, kmPerLitre: +(380 / litres).toFixed(3),
                    approvalStatus: channel === 'cash' ? (f === 0 ? 'approved' : 'pending') : null,
                },
            });
        }
    }
    // One anomalous unapproved cash fill over threshold.
    await prisma.fuelTransaction.create({
        data: { vehicleId: vehicles[0].id, filledAt: daysAgo(1), odometer: vehicles[0].currentOdometer, litres: 70, amount: 450, rate: 3.1, channel: 'cash', approvalStatus: 'pending', driverId: drivers[0].id },
    });
    // --- Job cards (one open, one closed with warranty) ---
    await prisma.jobCard.create({
        data: {
            jobNumber: 'JC-DEMO-0001', vehicleId: vehicles[4].id, dateIn: daysAgo(6), odometerIn: vehicles[4].currentOdometer,
            type: 'breakdown', description: 'Gearbox noise', vendorId: workshop.id, invoiceNumber: 'INV-1001',
            labourCharges: 800, otherCharges: 100, totalCost: 1500, status: 'open',
            parts: { create: [{ partName: 'Gear oil', qty: 4, unitCost: 100 }, { partName: 'Seal kit', qty: 1, unitCost: 200 }] },
        },
    });
    await prisma.jobCard.create({
        data: {
            jobNumber: 'JC-DEMO-0002', vehicleId: vehicles[2].id, dateIn: daysAgo(30), dateOut: daysAgo(28), downtimeDays: 2,
            odometerIn: vehicles[2].currentOdometer - 200, odometerOut: vehicles[2].currentOdometer,
            type: 'scheduled', description: 'Routine service', vendorId: workshop.id, invoiceNumber: 'INV-1002',
            labourCharges: 300, totalCost: 650, status: 'closed', isWarrantyClaim: true,
        },
    });
    // --- Tyres ---
    await prisma.tyre.create({
        data: { serial: 'TY-0001', brand: 'Bridgestone', vehicleId: vehicles[1].id, position: 'FL', fitmentDate: daysAgo(200), fitmentOdometer: vehicles[1].currentOdometer - 12000, treadDepthMm: 5.5, cost: 420, vendorId: vendors[1].id },
    });
    // --- Fines (auto-attributed via assignment) ---
    await prisma.fine.create({
        data: { reference: 'FINE-778812', offenceAt: daysAgo(45), vehicleId: vehicles[3].id, type: 'speeding', amount: 600, authority: 'Dubai Police', emirate: 'Dubai', status: 'unpaid', driverId: drivers[3].id },
    });
    await prisma.fine.create({
        data: { reference: 'FINE-778813', offenceAt: daysAgo(10), vehicleId: vehicles[5].id, type: 'parking', amount: 150, authority: 'RTA', emirate: 'Dubai', status: 'unpaid', driverId: drivers[5].id },
    });
    // --- Incidents ---
    await prisma.incident.create({
        data: { vehicleId: vehicles[6].id, driverId: drivers[6].id, occurredAt: daysAgo(20), emirate: 'Sharjah', area: 'Industrial 5', description: 'Minor rear collision', policeReportNo: 'PR-2024-556', insuranceVendorId: insurer.id, claimStatus: 'under_review', claimAmount: 3500 },
    });
    // --- Employees + routes + mapping + attendance ---
    const employees = [];
    for (let i = 0; i < 12; i++) {
        employees.push(await prisma.employee.create({
            data: { name: `Worker ${i + 1}`, staffId: `LAB${3000 + i}`, pickupPoint: `Camp Gate ${1 + (i % 3)}`, homeCamp: ['Al Quoz Camp', 'Mussafah Camp', 'Sonapur Camp'][i % 3], phone: `+9715${5000000 + i}` },
        }));
    }
    const routeA = await prisma.route.create({ data: { code: 'R-A1', name: 'Al Quoz → DFC Warehouse', direction: 'Camp → Warehouse', scheduledTime: '06:30', vehicleId: vehicles[0].id, driverId: drivers[0].id } });
    const routeB = await prisma.route.create({ data: { code: 'R-B1', name: 'Mussafah → AUH Store', direction: 'Camp → Store', scheduledTime: '06:00', vehicleId: vehicles[5].id, driverId: drivers[5].id } });
    const routeC = await prisma.route.create({ data: { code: 'R-C1', name: 'Sonapur → Deira', direction: 'Camp → Store', scheduledTime: '07:00' } }); // unassigned → alert
    for (let i = 0; i < 5; i++)
        await prisma.routeEmployee.create({ data: { routeId: routeA.id, employeeId: employees[i].id, effectiveFrom: daysAgo(90) } });
    for (let i = 5; i < 9; i++)
        await prisma.routeEmployee.create({ data: { routeId: routeB.id, employeeId: employees[i].id, effectiveFrom: daysAgo(90) } });
    // Attendance for last 5 days on route A.
    for (let d = 1; d <= 5; d++) {
        const date = (0, dayjs_1.default)().subtract(d, 'day').startOf('day').toDate();
        for (let i = 0; i < 5; i++) {
            await prisma.attendance.create({
                data: { routeId: routeA.id, employeeId: employees[i].id, date, status: i === 4 && d % 2 === 0 ? 'absent' : 'present', markedBy: 'coordinator' },
            });
        }
    }
    console.log('Seed complete.');
    console.log(`\nLogins (password unless noted):`);
    console.log(`  Fleet Manager: ${adminEmail} / ${adminPassword}`);
    console.log(`  Others: <role>@fleet.local / Passw0rd!  (workshop, compliance, finance, coordinator, ops, deliverymgr, warehouse, management, driver)`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map