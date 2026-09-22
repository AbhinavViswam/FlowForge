import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import type { LoginInput, RegisterInput } from '@flowforge/shared/src/schemas/auth';
import { API_V1 } from '../config';

// Configure axios to always send cookies
const api = axios.create({
  baseURL: `${API_V1}`,
  withCredentials: true,
});

interface User {
  id: string;
  email: string;
  name?: string;
  dob?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string, dob?: string }) => Promise<void>;
  updatePassword: (data: { currentPassword?: string, newPassword?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      // /auth/me returns { user: {...} } — unwrap it, otherwise user.email/name are undefined.
      setUser(response.data.user);
      
      // If we are on login/signup or root, and we are authenticated, redirect to dashboard
      const path = window.location.pathname;
      if (path === '/login' || path === '/signup') {
        navigate('/dashboard');
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginInput) => {
    await api.post('/auth/login', data);
    await checkAuth();
    navigate('/dashboard');
  };

  const register = async (data: RegisterInput) => {
    await api.post('/auth/register', data);
    await checkAuth();
    navigate('/dashboard');
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/login');
  };

  const updateProfile = async (data: { name?: string, dob?: string }) => {
    const res = await api.put('/auth/me', data);
    setUser(res.data.user);
  };

  const updatePassword = async (data: { currentPassword?: string, newPassword?: string }) => {
    await api.put('/auth/password', data);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

