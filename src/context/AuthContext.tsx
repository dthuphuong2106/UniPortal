import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AcademicSettingsBundle,
  LecturerProfile,
  StudentProfile,
} from '../../shared/academicLogic.ts';
import { api, AuthUser } from '../services/api.ts';

interface AuthContextValue {
  user: AuthUser | null;
  student: StudentProfile | null;
  lecturer: LecturerProfile | null;
  settings: AcademicSettingsBundle | null;
  loading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [lecturer, setLecturer] = useState<LecturerProfile | null>(null);
  const [settings, setSettings] = useState<AcademicSettingsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setStudent(data.student);
      setLecturer(data.lecturer);
      setSettings(data.settings);
    } catch {
      setUser(null);
      setStudent(null);
      setLecturer(null);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (identifier: string, password: string, rememberMe = true) => {
    const data = await api.login(identifier, password, rememberMe);
    setUser(data.user);
    setStudent(data.student);
    setLecturer(data.lecturer);
    setSettings(data.settings);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStudent(null);
      setLecturer(null);
      setSettings(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, student, lecturer, settings, loading, login, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
