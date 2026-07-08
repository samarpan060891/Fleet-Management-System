import { Outlet } from 'react-router-dom';
import { AppBar, Avatar, Box, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n';

// Dedicated shell for the DRIVER role: no sidebar (a driver only ever has one
// screen), a compact top bar, and content locked to a phone-portrait width —
// always, regardless of the actual device, so the driver experience never
// renders as a scaled-down desktop layout.
export default function DriverLayout() {
  const { user, logout } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e3e8ee' }}>
        <Toolbar sx={{ gap: 1 }}>
          <LocalShippingIcon color="primary" />
          <Typography variant="h6" color="primary" sx={{ flexGrow: 1 }} noWrap>
            {t('app.title')}
          </Typography>
          <Tooltip title={user?.email ?? ''}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {user?.fullName?.[0] ?? '?'}
            </Avatar>
          </Tooltip>
          <Tooltip title={t('auth.logout')}>
            <IconButton onClick={logout} sx={{ ml: 0.5 }}><LogoutIcon /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 2, pb: 6 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
