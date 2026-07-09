import { GridColDef } from '@mui/x-data-grid';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';

const columns: GridColDef[] = [
  { field: 'code', headerName: 'Code', width: 110 },
  { field: 'name', headerName: 'Name', width: 220 },
  { field: 'description', headerName: 'Description', width: 220 },
  { field: 'emirate', headerName: 'Emirate', width: 150 },
  { field: 'contact', headerName: 'Contact', width: 160 },
  { field: 'deliveryWindow', headerName: 'Delivery window', width: 160 },
];

const fields: FieldDef[] = [
  { name: 'code', label: 'Code', required: true, half: true },
  { name: 'name', label: 'Name', required: true, half: true },
  { name: 'description', label: 'Description', type: 'multiline' },
  { name: 'emirate', label: 'Emirate', required: true, half: true },
  { name: 'contact', label: 'Contact', half: true },
  { name: 'address', label: 'Address' },
  { name: 'deliveryWindow', label: 'Delivery window (informational)', half: true },
];

export default function Stores() {
  return <CrudListPage title="Stores & Depots" subtitle="13 stores + depots used for assignment and the availability board" resource="stores" queryKey="stores" permission="stores" columns={columns} fields={fields} importable />;
}
