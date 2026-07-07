import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';

// API integration tests for auth + RBAC. Requires a seeded database
// (npm run db:seed) so the standard demo logins exist.
const app = createApp();

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

describe('auth + RBAC (API)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@fleet.local', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in the Fleet Manager and returns permissions', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@fleet.local', password: 'Admin@123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('FLEET_MANAGER');
    expect(res.body.user.permissions).toContain('fuel:approve');
  });

  it('blocks unauthenticated access to protected routes', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('lets Fleet Manager read vehicles', async () => {
    const token = await login('admin@fleet.local', 'Admin@123');
    const res = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('forbids Ops user from creating fuel (read-only role)', async () => {
    const token = await login('ops@fleet.local', 'Passw0rd!');
    const res = await request(app).post('/api/fuel').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  it('lets Ops user read the availability board', async () => {
    const token = await login('ops@fleet.local', 'Passw0rd!');
    const res = await request(app).get('/api/availability').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis).toBeDefined();
  });

  it('hides the inventory module behind the feature flag (404)', async () => {
    const token = await login('admin@fleet.local', 'Admin@123');
    const res = await request(app).get('/api/inventory/parts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('greys out at least one compliance-blocked vehicle on the board', async () => {
    const token = await login('admin@fleet.local', 'Admin@123');
    const res = await request(app).get('/api/availability').set('Authorization', `Bearer ${token}`);
    const blocked = res.body.vehicles.filter((v: { complianceBlocked: boolean }) => v.complianceBlocked);
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((v: { canPlan: boolean }) => v.canPlan === false)).toBe(true);
  });
});
