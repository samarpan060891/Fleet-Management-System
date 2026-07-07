import { useState } from 'react';
import { Box, Button, Card, CardContent, TextField, Typography, Alert, Stack, Divider, IconButton, InputAdornment } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n';

const DEMO = [
  ['Fleet Manager', 'admin@fleet.local', 'Admin@123'],
  ['Compliance', 'compliance@fleet.local', 'Passw0rd!'],
  ['Transport Coord.', 'coordinator@fleet.local', 'Passw0rd!'],
  ['Driver (mobile)', 'driver@fleet.local', 'Passw0rd!'],
  ['Delivery Exec', 'ops@fleet.local', 'Passw0rd!'],
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@fleet.local');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: 420, maxWidth: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <LocalShippingIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5">{t('app.title')}</Typography>
            <Typography variant="body2" color="text.secondary">Sign in to continue</Typography>
          </Stack>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
              <TextField
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? '…' : t('auth.login')}
              </Button>
            </Stack>
          </form>
          <Divider sx={{ my: 2 }}><Typography variant="caption" color="text.secondary">Demo logins</Typography></Divider>
          <Stack spacing={0.5}>
            {DEMO.map(([label, em, pw]) => (
              <Button key={em} size="small" variant="text" sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                onClick={() => { setEmail(em); setPassword(pw); }}>
                <span>{label}</span>
                <Typography variant="caption" color="text.secondary">{em}</Typography>
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
