import { Role } from '@prisma/client';

// Central permissions matrix. Permissions are `resource:action` strings.
// Server-side RBAC is enforced from this matrix (never trust the client).
//
// Actions: read | create | update | delete | approve | export | manage
// `manage` implies all actions on that resource.

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage';

export type Permission = `${string}:${Action}`;

// Resources across the modules.
export const RESOURCES = [
  'vehicles',
  'drivers',
  'vendors',
  'stores',
  'employees',
  'assignments',
  'fuel',
  'maintenance',
  'tyres',
  'compliance',
  'fines',
  'salik',
  'incidents',
  'costs',
  'transport', // routes, mapping
  'attendance',
  'availability',
  'alerts',
  'reports',
  'inventory',
  'settings',
  'users',
  'audit',
  'dashboard',
] as const;

export type Resource = (typeof RESOURCES)[number];

// Helper builders
const all = (r: Resource): Permission[] => [`${r}:manage`];
const read = (r: Resource): Permission[] => [`${r}:read`];
const crud = (r: Resource): Permission[] => [
  `${r}:read`,
  `${r}:create`,
  `${r}:update`,
  `${r}:delete`,
];

// Every role can read its dashboard.
const base: Permission[] = ['dashboard:read'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full access to everything.
  FLEET_MANAGER: [
    ...base,
    ...RESOURCES.flatMap((r) => all(r)),
  ],

  // Job cards, PM schedules, invoices, warranty flags, tyres.
  WORKSHOP: [
    ...base,
    ...read('vehicles'),
    ...read('drivers'),
    ...read('vendors'),
    ...crud('maintenance'),
    ...crud('tyres'),
    ...read('alerts'),
    ...read('availability'),
    ...read('reports'),
  ],

  // All document/expiry records, renewals, alert-window settings.
  COMPLIANCE: [
    ...base,
    ...read('vehicles'),
    ...read('drivers'),
    ...crud('compliance'),
    ...read('alerts'),
    ...read('reports'),
    // Alert-window settings only.
    'settings:read',
    'settings:update',
  ],

  // Read costs/TCO/fines/vendors; export financial reports. No ops edits.
  FINANCE: [
    ...base,
    ...read('vehicles'),
    ...read('costs'),
    'costs:export',
    ...read('fines'),
    ...read('vendors'),
    ...read('reports'),
    'reports:export',
    ...read('salik'),
  ],

  // Routes, vehicle/driver assignment, employee mapping, attendance.
  TRANSPORT_COORDINATOR: [
    ...base,
    ...read('vehicles'),
    ...read('drivers'),
    ...read('employees'),
    'employees:create',
    'employees:update',
    ...crud('transport'),
    ...crud('attendance'),
    ...read('assignments'),
    ...read('alerts'),
    ...read('availability'),
  ],

  // Read-only fleet-availability board.
  OPS_DELIVERY: [...base, ...read('availability'), ...read('vehicles')],

  // Availability board + high-level availability KPIs.
  DELIVERY_MANAGER: [
    ...base,
    ...read('availability'),
    ...read('vehicles'),
    ...read('reports'),
  ],

  // Read-only fleet-availability board.
  WAREHOUSE_MANAGER: [...base, ...read('availability'), ...read('vehicles')],

  // Mobile screen: own vehicle, own docs, mapped staff, mark attendance.
  // Ownership is enforced at the route/service layer (self-scoping).
  DRIVER: [
    ...base,
    'vehicles:read',
    'compliance:read',
    'transport:read',
    'attendance:read',
    'attendance:create',
    'attendance:update',
    'fuel:create',
  ],

  // Read-only high-level KPIs, cost trends, availability.
  MANAGEMENT: [
    ...base,
    ...read('vehicles'),
    ...read('costs'),
    ...read('availability'),
    ...read('reports'),
    ...read('alerts'),
    ...read('audit'),
  ],
};

// Does a role have a given `resource:action`?
export function roleCan(role: Role, resource: Resource, action: Action): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(`${resource}:manage`) || perms.includes(`${resource}:${action}`);
}

// Flatten a role's effective permissions (expanding `manage`) for the client.
export function effectivePermissions(role: Role): Permission[] {
  const perms = new Set<Permission>();
  for (const p of ROLE_PERMISSIONS[role] || []) {
    const [resource, action] = p.split(':') as [Resource, Action];
    if (action === 'manage') {
      (['read', 'create', 'update', 'delete', 'approve', 'export'] as Action[]).forEach(
        (a) => perms.add(`${resource}:${a}`)
      );
      perms.add(p);
    } else {
      perms.add(p);
    }
  }
  return [...perms];
}
