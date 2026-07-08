import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  driverId?: string | null;
  employeeId?: string | null;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginStaff: (staffId: string, pin: string) => Promise<void>;
  logout: () => void;
  can: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fleet_token');
    if (!token) { setLoading(false); return; }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('fleet_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('fleet_token', res.data.token);
    setUser(res.data.user);
  };

  const loginStaff = async (staffId: string, pin: string) => {
    const res = await api.post('/auth/staff-login', { staffId, pin });
    localStorage.setItem('fleet_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('fleet_token');
    setUser(null);
    window.location.href = '/login';
  };

  const can = (perm: string) => !!user?.permissions.includes(perm);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginStaff, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
