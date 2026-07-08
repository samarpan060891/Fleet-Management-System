import { GridColDef } from '@mui/x-data-grid';
import CrudListPage from '../components/CrudListPage';
import { FieldDef } from '../components/FormDialog';
import { fmtDate } from '../i18n';
import { useLookups } from '../hooks/useLookups';

const columns: GridColDef[] = [
  { field: 'fullName', headerName: 'Name', width: 180 },
  { field: 'staffId', headerName: 'Staff ID', width: 120 },
  { field: 'phone', headerName: 'Phone', width: 140 },
  { field: 'nationality', headerName: 'Nationality', width: 120 },
  { field: 'licenceNumber', headerName: 'Licence', width: 120 },
  { field: 'licenceExpiry', headerName: 'Licence Expiry', width: 140, valueFormatter: (v) => fmtDate(v as string) },
  { field: 'visaExpiry', headerName: 'Visa Expiry', width: 130, valueFormatter: (v) => fmtDate(v as string) },
  { field: 'status', headerName: 'Status', width: 100 },
];

export default function Drivers() {
  const { vehicleOptions } = useLookups();

  const fields: FieldDef[] = [
    { name: 'fullName', label: 'Full name', required: true, half: true },
    { name: 'staffId', label: 'Staff ID', required: true, half: true },
    { name: 'phone', label: 'Phone', half: true },
    { name: 'nationality', label: 'Nationality', half: true },
    { name: 'dob', label: 'Date of birth', type: 'date', half: true },
    { name: 'bloodGroup', label: 'Blood group', half: true },
    { name: 'joiningDate', label: 'Joining date', type: 'date', half: true },
    { name: 'emergencyContact', label: 'Emergency contact', half: true },
    { name: 'defaultVehicleId', label: 'Default vehicle', type: 'select', half: true, options: vehicleOptions },
    { name: 'licenceNumber', label: 'Licence number', half: true },
    { name: 'licenceClass', label: 'Licence class', half: true },
    { name: 'licenceExpiry', label: 'Licence expiry', type: 'date', half: true },
    { name: 'emiratesId', label: 'Emirates ID', half: true },
    { name: 'emiratesIdExpiry', label: 'Emirates ID expiry', type: 'date', half: true },
    { name: 'visaExpiry', label: 'Visa expiry', type: 'date', half: true },
    { name: 'passportNumber', label: 'Passport number', half: true },
    { name: 'passportExpiry', label: 'Passport expiry', type: 'date', half: true },
  ];

  return (
    <CrudListPage
      title="Drivers" subtitle="Driver master — identity, licence and document expiries"
      resource="drivers" queryKey="drivers" permission="drivers"
      columns={columns} fields={fields} importable
    />
  );
}
