import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, UserAccount, UserRole } from '../services/api';
import { supabase } from '../services/supabase';

interface AuthContextType {
  currentUser: UserAccount | null;
  isAuthenticated: boolean;
  role: UserRole | 'GUEST';
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setCurrentUserDirectly: (user: UserAccount) => void;
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isRegisterModalOpen: boolean;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sync state if user list updates (e.g. status toggled or approved)
  const refreshUser = () => {
    if (!currentUser) return;
    const all = api.getUsers();
    const updated = all.find(
      u => u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase()
    );
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

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const result = await api.login(username, password);
    if (result.success && result.user) {
      setCurrentUser(result.user);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
      setIsLoginModalOpen(false);
      return { success: true };
    }
    return { success: false, error: result.error || 'Gagal login.' };
  };

  const setCurrentUserDirectly = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // Terminate Supabase Auth session
    supabase.auth.signOut().catch(() => {});
  };

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: !!currentUser,
    role: currentUser ? currentUser.role : 'GUEST',
    login,
    setCurrentUserDirectly,
    logout,
    isLoginModalOpen,
    openLoginModal: () => setIsLoginModalOpen(true),
    closeLoginModal: () => setIsLoginModalOpen(false),
    isRegisterModalOpen,
    openRegisterModal: () => setIsRegisterModalOpen(true),
    closeRegisterModal: () => setIsRegisterModalOpen(false),
    isProfileModalOpen,
    openProfileModal: () => setIsProfileModalOpen(true),
    closeProfileModal: () => setIsProfileModalOpen(false),
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
