import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import DriverLayout from './components/DriverLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Fuel from './pages/Fuel';
import Compliance from './pages/Compliance';
import AlertCentre from './pages/AlertCentre';
import Availability from './pages/Availability';
import Maintenance from './pages/Maintenance';
import Fines from './pages/Fines';
import Incidents from './pages/Incidents';
import Costs from './pages/Costs';
import Transport from './pages/Transport';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';
import DriverScreen from './pages/DriverScreen';
import StaffScreen from './pages/StaffScreen';
import Vendors from './pages/Vendors';
import Stores from './pages/Stores';
import Employees from './pages/Employees';
import Users from './pages/Users';
import Odometer from './pages/Odometer';
import Allocation from './pages/Allocation';
import Payments from './pages/Payments';
import Placeholder from './pages/Placeholder';

function Loader() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Drivers and staff land on their own single mobile screen by default.
  const home = user.role === 'DRIVER' ? '/my-vehicle' : user.role === 'STAFF' ? '/my-roster' : '/';

  // Drivers and staff get a completely separate, single-screen shell: no
  // fleet-wide pages are even routable for them, so there's no way to reach
  // another driver's/employee's or the whole fleet's data by navigating
  // directly to a URL.
  if (user.role === 'DRIVER' || user.role === 'STAFF') {
    return (
      <Routes>
        <Route path="/login" element={<Navigate to={home} replace />} />
        <Route element={<DriverLayout />}>
          <Route path="/" element={<Navigate to={home} replace />} />
          {user.role === 'DRIVER' && <Route path="/my-vehicle" element={<DriverScreen />} />}
          {user.role === 'STAFF' && <Route path="/my-roster" element={<StaffScreen />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to={home} replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/allocation" element={<Allocation />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/fuel" element={<Fuel />} />
        <Route path="/odometer" element={<Odometer />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/users" element={<Users />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/alerts" element={<AlertCentre />} />
        <Route path="/fines" element={<Fines />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/costs" element={<Costs />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/transport" element={<Transport />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
