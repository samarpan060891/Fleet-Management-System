import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Chip, Avatar, Tooltip, useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';
import { NAV } from '../nav';
import { t } from '../i18n';

const DRAWER_WIDTH = 248;
const ROLE_LABELS: Record<string, string> = {
  FLEET_MANAGER: 'Fleet Manager', WORKSHOP: 'Workshop', COMPLIANCE: 'Compliance',
  FINANCE: 'Finance', TRANSPORT_COORDINATOR: 'Transport Coordinator', OPS_DELIVERY: 'Delivery Exec',
  DELIVERY_MANAGER: 'Delivery Manager', WAREHOUSE_MANAGER: 'Warehouse Manager', DRIVER: 'Driver',
  MANAGEMENT: 'Management',
};

export default function Layout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => {
    if (i.driverOnly) return user?.role === 'DRIVER';
    return !i.requires || can(i.requires);
  });

  const drawer = (
    <Box>
      <Toolbar sx={{ gap: 1 }}>
        <LocalShippingIcon color="primary" />
        <Typography variant="h6" color="primary" noWrap>Fleet MS</Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {items.map((item) => {
          const selected = loc.pathname === item.path;
          const Icon = item.icon;
          return (
            <ListItemButton
              key={item.key}
              selected={selected}
              onClick={() => { nav(item.path); if (isMobile) setOpen(false); }}
              sx={{ borderRadius: 2, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><Icon fontSize="small" /></ListItemIcon>
              <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #e3e8ee', zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }}><MenuIcon /></IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, color: 'text.primary' }}>
            {t('app.title')}
          </Typography>
          <Chip size="small" label={ROLE_LABELS[user?.role ?? ''] ?? user?.role} color="primary" variant="outlined" sx={{ mr: 1 }} />
          <Tooltip title={user?.email ?? ''}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {user?.fullName?.[0] ?? '?'}
            </Avatar>
          </Tooltip>
          <Tooltip title={t('auth.logout')}>
            <IconButton onClick={logout} sx={{ ml: 1 }}><LogoutIcon /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? open : true}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: '1px solid #e3e8ee' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
