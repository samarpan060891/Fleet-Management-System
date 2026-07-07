import { createTheme } from '@mui/material/styles';

// Clean, professional theme. UAE-friendly palette (deep teal + sand accents).
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f6e6e', dark: '#0a4f4f', light: '#3a9a9a' },
    secondary: { main: '#b5893a' },
    success: { main: '#2e7d32' },
    warning: { main: '#ed9c28' },
    error: { main: '#c62828' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #e3e8ee' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
