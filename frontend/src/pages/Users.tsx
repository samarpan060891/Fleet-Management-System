import { GridColDef } from '@mui/x-data-grid';
import { titleCase } from '../lib/text';
import { Chip } from '@mui/material';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';

const ROLES = [
  'FLEET_MANAGER', 'WORKSHOP', 'COMPLIANCE', 'FINANCE', 'TRANSPORT_COORDINATOR',
  'OPS_DELIVERY', 'DELIVERY_MANAGER', 'WAREHOUSE_MANAGER', 'DRIVER', 'MANAGEMENT',
];

const columns: GridColDef[] = [
  { field: 'fullName', headerName: 'Name', width: 200 },
  { field: 'email', headerName: 'Email', width: 240 },
  { field: 'role', headerName: 'Role', width: 200, renderCell: (p) => <Chip size="small" label={titleCase(String(p.value))} variant="outlined" /> },
  { field: 'isActive', headerName: 'Active', width: 90, valueFormatter: (v) => (v ? 'Yes' : 'No') },
];

const fields: FieldDef[] = [
  { name: 'fullName', label: 'Full name', required: true, half: true },
  { name: 'email', label: 'Email', required: true, half: true },
  { name: 'role', label: 'Role', type: 'select', required: true, half: true, options: ROLES.map((r) => ({ value: r, label: titleCase(r) })) },
  { name: 'password', label: 'Password (required for new users; min 8)', half: true },
  { name: 'isActive', label: 'Active', type: 'checkbox' },
];

export default function Users() {
  return (
    <CrudListPage
      title="Users" subtitle="Application logins and their roles"
      resource="users" queryKey="users" permission="users"
      columns={columns} fields={fields} hideDelete
    />
  );
}
