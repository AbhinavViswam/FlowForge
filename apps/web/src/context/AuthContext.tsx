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
  // Starts sign-up and emails a 6-digit code; the account exists only after verifyEmail.
  register: (data: RegisterInput) => Promise<{ email: string; cooldownSeconds: number }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<{ cooldownSeconds: number }>;
  // Forgot password: emails a 6-digit code, then resetPassword sets the new password and signs in.
  forgotPassword: (email: string) => Promise<{ email: string; cooldownSeconds: number }>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
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
      if (path === '/login' || path === '/signup' || path === '/forgot-password') {
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
    const res = await api.post('/auth/register', data);
    return { email: res.data.email as string, cooldownSeconds: Number(res.data.cooldownSeconds) || 60 };
  };

  const verifyEmail = async (email: string, code: string) => {
    await api.post('/auth/verify-email', { email, code });
    await checkAuth();
    navigate('/dashboard');
  };

  const resendCode = async (email: string) => {
    const res = await api.post('/auth/resend-code', { email });
    return { cooldownSeconds: Number(res.data.cooldownSeconds) || 60 };
  };

  const forgotPassword = async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return { email: (res.data.email as string) || email, cooldownSeconds: Number(res.data.cooldownSeconds) || 60 };
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    await api.post('/auth/reset-password', { email, code, password });
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
    <AuthContext.Provider value={{ user, isLoading, login, register, verifyEmail, resendCode, forgotPassword, resetPassword, logout, updateProfile, updatePassword }}>
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

