import { GridColDef } from '@mui/x-data-grid';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', width: 200 },
  { field: 'staffId', headerName: 'Staff ID', width: 130 },
  { field: 'pickupPoint', headerName: 'Pickup point', width: 180 },
  { field: 'homeCamp', headerName: 'Home / camp', width: 180 },
  { field: 'phone', headerName: 'Phone', width: 150 },
];

const fields: FieldDef[] = [
  { name: 'name', label: 'Name', required: true, half: true },
  { name: 'staffId', label: 'Staff ID', required: true, half: true },
  { name: 'pickupPoint', label: 'Pickup point', half: true },
  { name: 'homeCamp', label: 'Home / camp', half: true },
  { name: 'phone', label: 'Phone', half: true },
];

export default function Employees() {
  return <CrudListPage title="Employees" subtitle="Staff-transport passengers (mapped to routes)" resource="employees" queryKey="employees" permission="employees" columns={columns} fields={fields} />;
}
