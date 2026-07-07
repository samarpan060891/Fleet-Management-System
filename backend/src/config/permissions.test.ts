import { roleCan, effectivePermissions } from './permissions';

describe('RBAC permissions matrix', () => {
  it('Fleet Manager can do everything', () => {
    expect(roleCan('FLEET_MANAGER', 'fuel', 'approve')).toBe(true);
    expect(roleCan('FLEET_MANAGER', 'settings', 'update')).toBe(true);
    expect(roleCan('FLEET_MANAGER', 'users', 'create')).toBe(true);
  });

  it('Ops/Delivery is read-only on availability and cannot edit fuel', () => {
    expect(roleCan('OPS_DELIVERY', 'availability', 'read')).toBe(true);
    expect(roleCan('OPS_DELIVERY', 'fuel', 'create')).toBe(false);
    expect(roleCan('OPS_DELIVERY', 'fuel', 'read')).toBe(false);
  });

  it('Finance can read costs and export but cannot make ops edits', () => {
    expect(roleCan('FINANCE', 'costs', 'read')).toBe(true);
    expect(roleCan('FINANCE', 'costs', 'export')).toBe(true);
    expect(roleCan('FINANCE', 'fuel', 'create')).toBe(false);
    expect(roleCan('FINANCE', 'vehicles', 'update')).toBe(false);
  });

  it('Workshop can manage maintenance and tyres but not compliance', () => {
    expect(roleCan('WORKSHOP', 'maintenance', 'create')).toBe(true);
    expect(roleCan('WORKSHOP', 'tyres', 'update')).toBe(true);
    expect(roleCan('WORKSHOP', 'compliance', 'update')).toBe(false);
  });

  it('Transport Coordinator manages transport and attendance', () => {
    expect(roleCan('TRANSPORT_COORDINATOR', 'transport', 'create')).toBe(true);
    expect(roleCan('TRANSPORT_COORDINATOR', 'attendance', 'create')).toBe(true);
    expect(roleCan('TRANSPORT_COORDINATOR', 'settings', 'update')).toBe(false);
  });

  it('Driver can mark attendance and log fuel only', () => {
    expect(roleCan('DRIVER', 'attendance', 'create')).toBe(true);
    expect(roleCan('DRIVER', 'fuel', 'create')).toBe(true);
    expect(roleCan('DRIVER', 'vehicles', 'update')).toBe(false);
    expect(roleCan('DRIVER', 'fines', 'read')).toBe(false);
  });

  it('Compliance can update alert-window settings', () => {
    expect(roleCan('COMPLIANCE', 'settings', 'update')).toBe(true);
    expect(roleCan('COMPLIANCE', 'compliance', 'create')).toBe(true);
  });

  it('effectivePermissions expands manage into concrete actions', () => {
    const perms = effectivePermissions('FLEET_MANAGER');
    expect(perms).toContain('fuel:approve');
    expect(perms).toContain('vehicles:delete');
  });
});
