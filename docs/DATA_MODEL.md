# Data Model

The authoritative schema is [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).
Every table has `id` (uuid), `created_at`, `updated_at`, `created_by`,
`updated_by`, and a soft-delete `is_active` flag where deletion must be
reversible.

## Masters (shared reference data)
- **Vehicle** — plate (+ emirate/category), make/model/year, VIN, engine, colour,
  type (light/sedan/pickup/truck_3_7t/bus/van), body type, seating/payload,
  ownership (owned/leased/rented) with lease dates + monthly cost + lessor,
  GPS/fuel-kit ids, `current_odometer`, depot/store, status
  (active/in_workshop/vor/idle/disposed), warranty (date + km), depreciation
  params (useful life, residual).
- **Driver** — identity, licence (number/class/expiry), Emirates ID + expiry,
  visa expiry, passport (number + expiry), default vehicle, status, document scans.
- **Vendor** — typed (workshop, tyre, insurance, fuel supplier, spare parts,
  lessor, other) with contact/TRN/address.
- **Store/Location** — 13 stores + depots (code, name, emirate, delivery window).
- **Employee** — staff-transport passengers only (name, staff id, pickup, camp).

## Assignment history (shared, important)
- **VehicleDriverAssignment** — effective-dated (`effective_from`/`effective_to`,
  null = current). Never overwritten; always versioned. Powers fine attribution,
  "who was driving when," and the availability board.

## Compliance
- **ComplianceDocument** — one register for both vehicle and driver documents
  (mulkiya, insurance, tasjeel, lease, warranty · licence, emirates_id, visa,
  passport) with reference, issue/expiry dates, uploaded scan, renewal flag.

## Fuel
- **FuelTransaction** — vehicle, timestamp, odometer, litres, amount, rate,
  channel (`vip_kit`/`fuel_buddy`/`cash`), driver, computed `km_since_last` +
  `km_per_litre`, cash approval fields, import batch id.

## Maintenance
- **JobCard** (+ **JobCardPart**) — outsourced work orders with odometer/date
  in-out, downtime days, type, vendor + invoice, costs, `is_warranty_claim`, status.
- **PmSchedule** — km + time interval defaults per vehicle type (editable).
- **PmState** — per-vehicle last + computed next PM (km + date).
- **Tyre** (+ **TyreTreadCheck**) — position-wise fitment, tread log, rotation,
  scrap, vendor/cost.

## Incidents, Fines, Salik
- **Incident** (+ **IncidentPhoto**) — accident/claim register with lifecycle
  (reported→under_review→approved/rejected→settled), amounts, photos.
- **Fine** — reference, offence time, vehicle, type, amount, authority, emirate,
  status, auto-attributed driver (+ override flag).
- **SalikTag** — per-vehicle tag, balance, low-balance threshold.

## Asset lifecycle
- **VehiclePurchase** — purchase date, supplier, price, financing, life/residual.
- **VehicleDisposal** — disposal date, method (sold/scrapped/returned), price,
  gain/loss; setting it moves the vehicle to `disposed`.

## Staff transport
- **Route** (+ **RouteAssignment** history) — code/name/direction/time, assigned
  vehicle + driver (assignment can change over time).
- **RouteEmployee** — effective-dated roster mapping with per-route pickup override.
- **Attendance** — unique per (route, employee, date); `marked_by`
  (coordinator|driver); coordinator marks take precedence.

## Inventory (feature-flagged)
- **Part** (+ **PartMovement**) — code/name/category/unit, stock, reorder level,
  supplier, in/out movements. Disabled behind `FEATURE_INVENTORY`.

## Cross-cutting
- **Alert** — category, severity (green/amber/red), dedupe key, linked entity,
  message, due date, resolution + notify tracking.
- **Setting** — key/value (JSON) admin-configurable thresholds & windows.
- **AuditLog** — entity, entityId, action, user, before/after, ip, timestamp.
- **User** — email, password hash, role, optional link to a Driver record.

## Relationship highlights
```
Vehicle 1─* FuelTransaction, JobCard, Tyre, Incident, Fine, ComplianceDocument
Vehicle 1─1 PmState, SalikTag, VehiclePurchase, VehicleDisposal
Vehicle *─* Driver  (via VehicleDriverAssignment, effective-dated)
Route   1─* RouteEmployee *─1 Employee ;  Route 1─* Attendance
Vehicle/Driver 1─* ComplianceDocument  → drives the Alert engine
```
