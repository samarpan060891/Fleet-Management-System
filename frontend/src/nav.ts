import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import BuildIcon from '@mui/icons-material/Build';
import GavelIcon from '@mui/icons-material/Gavel';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PaidIcon from '@mui/icons-material/Paid';
import AirportShuttleIcon from '@mui/icons-material/AirportShuttle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import StorefrontIcon from '@mui/icons-material/Storefront';
import StoreIcon from '@mui/icons-material/Store';
import BadgeIcon from '@mui/icons-material/Badge';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { SvgIconComponent } from '@mui/icons-material';

export interface NavItem {
  key: string;
  path: string;
  labelKey: string;
  icon: SvgIconComponent;
  // Show if the user holds this permission (or always if undefined).
  requires?: string;
  // Only visible to the Driver role (the mobile "My Vehicle" screen).
  driverOnly?: boolean;
}

// Nav is filtered client-side by permissions; the server still enforces RBAC.
export const NAV: NavItem[] = [
  { key: 'driver', path: '/my-vehicle', labelKey: 'nav.driver', icon: PhoneAndroidIcon, driverOnly: true },
  { key: 'dashboard', path: '/', labelKey: 'nav.dashboard', icon: DashboardIcon, requires: 'dashboard:read' },
  { key: 'availability', path: '/availability', labelKey: 'nav.availability', icon: EventAvailableIcon, requires: 'availability:read' },
  { key: 'vehicles', path: '/vehicles', labelKey: 'nav.vehicles', icon: DirectionsCarIcon, requires: 'vehicles:read' },
  { key: 'drivers', path: '/drivers', labelKey: 'nav.drivers', icon: PersonIcon, requires: 'drivers:read' },
  { key: 'fuel', path: '/fuel', labelKey: 'nav.fuel', icon: LocalGasStationIcon, requires: 'fuel:read' },
  { key: 'vendors', path: '/vendors', labelKey: 'nav.vendors', icon: StorefrontIcon, requires: 'vendors:read' },
  { key: 'stores', path: '/stores', labelKey: 'nav.stores', icon: StoreIcon, requires: 'stores:read' },
  { key: 'employees', path: '/employees', labelKey: 'nav.employees', icon: BadgeIcon, requires: 'employees:read' },
  { key: 'maintenance', path: '/maintenance', labelKey: 'nav.maintenance', icon: BuildIcon, requires: 'maintenance:read' },
  { key: 'compliance', path: '/compliance', labelKey: 'nav.compliance', icon: VerifiedUserIcon, requires: 'compliance:read' },
  { key: 'alerts', path: '/alerts', labelKey: 'nav.alerts', icon: NotificationsActiveIcon, requires: 'alerts:read' },
  { key: 'fines', path: '/fines', labelKey: 'nav.fines', icon: GavelIcon, requires: 'fines:read' },
  { key: 'incidents', path: '/incidents', labelKey: 'nav.incidents', icon: ReportProblemIcon, requires: 'incidents:read' },
  { key: 'costs', path: '/costs', labelKey: 'nav.costs', icon: PaidIcon, requires: 'costs:read' },
  { key: 'transport', path: '/transport', labelKey: 'nav.transport', icon: AirportShuttleIcon, requires: 'transport:read' },
  { key: 'reports', path: '/reports', labelKey: 'nav.reports', icon: AssessmentIcon, requires: 'reports:read' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit', icon: HistoryIcon, requires: 'audit:read' },
  { key: 'users', path: '/users', labelKey: 'nav.users', icon: ManageAccountsIcon, requires: 'users:read' },
  { key: 'settings', path: '/settings', labelKey: 'nav.settings', icon: SettingsIcon, requires: 'settings:read' },
];
