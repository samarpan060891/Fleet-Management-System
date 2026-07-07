import { GridColDef } from '@mui/x-data-grid';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';

const TYPES = ['workshop', 'tyre_supplier', 'insurance', 'fuel_supplier', 'spare_parts', 'lessor', 'other'];

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', width: 220 },
  { field: 'type', headerName: 'Type', width: 150, valueFormatter: (v) => String(v).replace(/_/g, ' ') },
  { field: 'contactPerson', headerName: 'Contact', width: 160 },
  { field: 'phone', headerName: 'Phone', width: 150 },
  { field: 'email', headerName: 'Email', width: 200 },
  { field: 'trn', headerName: 'TRN', width: 140 },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', required: true, half: true },
  { name: 'type', label: 'Type', type: 'select', required: true, half: true, options: TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })) },
  { name: 'contactPerson', label: 'Contact person', half: true },
  { name: 'phone', label: 'Phone', half: true },
  { name: 'email', label: 'Email', half: true },
  { name: 'trn', label: 'TRN', half: true },
  { name: 'address', label: 'Address' },
  { name: 'notes', label: 'Notes', type: 'multiline' },
];

export default function Vendors() {
  return <CrudListPage title="Vendors" subtitle="Workshops, tyre & fuel suppliers, insurers, lessors" resource="vendors" queryKey="vendors" permission="vendors" columns={columns} fields={fields} />;
}
