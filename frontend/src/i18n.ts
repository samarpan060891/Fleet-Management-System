// Minimal i18n layer. All UI strings resolve through t() so Arabic (or any
// locale) can be added later by supplying another dictionary — no refactor.
type Dict = Record<string, string>;

const en: Dict = {
  'app.title': 'FMS - Fleet Management System',
  'nav.dashboard': 'Dashboard',
  'nav.vehicles': 'Vehicles',
  'nav.drivers': 'Drivers',
  'nav.fuel': 'Fuel',
  'nav.vendors': 'Vendors',
  'nav.stores': 'Stores & Depots',
  'nav.employees': 'Employees',
  'nav.users': 'Users',
  'nav.odometer': 'Odometer',
  'nav.compliance': 'Compliance',
  'nav.alerts': 'Alert Centre',
  'nav.maintenance': 'Maintenance',
  'nav.fines': 'Fines & Salik',
  'nav.incidents': 'Incidents',
  'nav.costs': 'Costs & TCO',
  'nav.transport': 'Staff Transport',
  'nav.availability': 'Availability',
  'nav.allocation': 'Fleet Allocation',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.audit': 'Audit Log',
  'nav.driver': 'My Vehicle',
  'auth.login': 'Sign in',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.logout': 'Sign out',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
};

const dictionaries: Record<string, Dict> = { en, ar: {} };

let currentLocale = 'en';
export const setLocale = (l: string) => { currentLocale = l; };
export const getLocale = () => currentLocale;

export function t(key: string, fallback?: string): string {
  const dict = dictionaries[currentLocale] || en;
  return dict[key] ?? en[key] ?? fallback ?? key;
}

// Locale-aware formatting defaults (AED, km, DD/MM/YYYY, Monday week start).
export const fmtCurrency = (n: number | null | undefined) =>
  n == null ? '—' : `AED ${Number(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
export const fmtKm = (n: number | null | undefined) => (n == null ? '—' : `${Number(n).toLocaleString()} km`);
