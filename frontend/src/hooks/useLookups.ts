import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export interface Option { value: string; label: string }

// Fetches master lists once and exposes them as {value,label} options for
// foreign-key selects in forms. Cached by react-query.
export function useLookups() {
  const vehicles = useQuery({
    queryKey: ['lookup-vehicles'],
    queryFn: async () => (await api.get('/vehicles', { params: { pageSize: 200 } })).data.data,
    staleTime: 60000,
  });
  const drivers = useQuery({
    queryKey: ['lookup-drivers'],
    queryFn: async () => (await api.get('/drivers', { params: { pageSize: 200 } })).data.data,
    staleTime: 60000,
  });
  const vendors = useQuery({
    queryKey: ['lookup-vendors'],
    queryFn: async () => (await api.get('/vendors', { params: { pageSize: 200 } })).data.data,
    staleTime: 60000,
  });
  const stores = useQuery({
    queryKey: ['lookup-stores'],
    queryFn: async () => (await api.get('/stores', { params: { pageSize: 200 } })).data.data,
    staleTime: 60000,
  });
  const employees = useQuery({
    queryKey: ['lookup-employees'],
    queryFn: async () => (await api.get('/employees', { params: { pageSize: 500 } })).data.data,
    staleTime: 60000,
  });

  // Disposed vehicles are excluded from pickers — they shouldn't receive new
  // activity (allocations, fuel, job cards, fines, incidents, compliance docs).
  const vehicleOptions: Option[] = (vehicles.data ?? [])
    .filter((v: any) => v.status !== 'disposed')
    .map((v: any) => ({ value: v.id, label: `${v.plateNumber} (${v.plateEmirate})` }));
  const driverOptions: Option[] = (drivers.data ?? []).map((d: any) => ({ value: d.id, label: `${d.fullName} · ${d.staffId}` }));
  const vendorOptions: Option[] = (vendors.data ?? []).map((v: any) => ({ value: v.id, label: `${v.name} (${v.type})` }));
  const storeOptions: Option[] = (stores.data ?? []).map((s: any) => ({ value: s.id, label: `${s.code} · ${s.name}` }));
  const employeeOptions: Option[] = (employees.data ?? []).map((e: any) => ({ value: e.id, label: `${e.name} · ${e.staffId}` }));

  return { vehicleOptions, driverOptions, vendorOptions, storeOptions, employeeOptions };
}

// Extract a friendly API error message.
export function apiError(err: any): string {
  return err?.response?.data?.error?.message || err?.message || 'Something went wrong';
}
