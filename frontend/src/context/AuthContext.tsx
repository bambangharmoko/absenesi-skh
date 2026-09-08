import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, UserAccount, UserRole } from '../services/api';

interface AuthContextType {
  currentUser: UserAccount | null;
  isAuthenticated: boolean;
  role: UserRole | 'GUEST';
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isRegisterModalOpen: boolean;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'skh_auth_current_user_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Sync state if user list updates (e.g. status toggled or approved)
  const refreshUser = () => {
    if (!currentUser) return;
    const all = api.getUsers();
    const updated = all.find(u => u.id === currentUser.id);
    if (updated) {
      if (updated.status !== 'APPROVED' || !updated.is_active) {
        // Automatically logout if account is deactivated or no longer approved
        logout();
      } else {
        setCurrentUser(updated);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    } else {
      logout();
    }
  };

  useEffect(() => {
    const handleUsersUpdate = () => refreshUser();
    window.addEventListener('skh_users_updated', handleUsersUpdate);
    return () => window.removeEventListener('skh_users_updated', handleUsersUpdate);
  }, [currentUser]);

  const login = (username: string, password: string): { success: boolean; error?: string } => {
    const result = api.login(username, password);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
      setIsLoginModalOpen(false);
      return { success: true };
    }
    return { success: false, error: result.error || 'Gagal login.' };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    role: currentUser ? currentUser.role : 'GUEST',
    login,
    logout,
    isLoginModalOpen,
    openLoginModal: () => setIsLoginModalOpen(true),
    closeLoginModal: () => setIsLoginModalOpen(false),
    isRegisterModalOpen,
    openRegisterModal: () => setIsRegisterModalOpen(true),
    closeRegisterModal: () => setIsRegisterModalOpen(false),
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
