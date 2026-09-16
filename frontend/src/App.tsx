import React, { useState, useEffect, useRef } from 'react';
import { Navbar, AppPage } from './components/layout/Navbar';
import { KioskPage } from './pages/KioskPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { RegisterStudentPage } from './pages/RegisterStudentPage';
import { ReportsPage } from './pages/ReportsPage';
import { KbmJournalPage } from './pages/KbmJournalPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ManageClassesPage } from './pages/ManageClassesPage';
import { ManageOperationalHoursPage } from './pages/ManageOperationalHoursPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { ProfileModal } from './components/auth/ProfileModal';
import { UserRole } from './services/api';

/**
 * TUGAS 1: Aturan Default Route Berdasarkan Role
 * - Role Guest (unauthenticated / publik) dan Admin: Default landing page -> "Kiosk Absensi" (kiosk)
 * - Role Guru dan Kepala Sekolah: Default landing page -> "Dashboard" (dashboard)
 */
export const getDefaultLandingPage = (role: UserRole | 'GUEST', isAuthenticated: boolean): AppPage => {
  if (!isAuthenticated || role === 'GUEST' || role === 'ADMIN') {
    return 'kiosk';
  }
  if (role === 'GURU' || role === 'KEPALA_SEKOLAH') {
    return 'dashboard';
  }
  return 'kiosk';
};

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, role, openLoginModal } = useAuth();

  // Initial landing page based on role (Tugas 1)
  const [currentPage, setCurrentPage] = useState<AppPage>(() =>
    getDefaultLandingPage(role, isAuthenticated)
  );

  const prevAuthRef = useRef<{ isAuthenticated: boolean; role: string; userId?: string }>({
    isAuthenticated,
    role,
    userId: currentUser?.id,
  });

  // Automatic redirect upon login, logout, or role switch
  useEffect(() => {
    const prev = prevAuthRef.current;
    const authChanged = prev.isAuthenticated !== isAuthenticated;
    const roleChanged = prev.role !== role;
    const userChanged = prev.userId !== currentUser?.id;

    if (authChanged || roleChanged || userChanged) {
      prevAuthRef.current = {
        isAuthenticated,
        role,
        userId: currentUser?.id,
      };

      // Automatically redirect to role's default landing page (Tugas 1)
      const targetDefault = getDefaultLandingPage(role, isAuthenticated);
      setCurrentPage(targetDefault);
    }
  }, [isAuthenticated, role, currentUser]);

  // Automatic RBAC Guard: If user logs out or role changes while on a forbidden page
  useEffect(() => {
    if (!isAuthenticated) {
      if (currentPage !== 'kiosk' && currentPage !== 'dashboard') {
        setCurrentPage('kiosk');
      }
    } else if (role === 'GURU') {
      if (
        currentPage === 'students' ||
        currentPage === 'register' ||
        currentPage === 'reports' ||
        currentPage === 'users' ||
        currentPage === 'manage-classes' ||
        currentPage === 'operational-hours'
      ) {
        setCurrentPage('dashboard');
      }
    } else if (role === 'ADMIN') {
      if (
        currentPage === 'jurnal-kbm' ||
        currentPage === 'users' ||
        currentPage === 'manage-classes' ||
        currentPage === 'operational-hours'
      ) {
        setCurrentPage('kiosk');
      }
    }
  }, [isAuthenticated, role, currentPage]);

  const handleNavigate = (page: AppPage) => {
    // Guest Route Guard
    if (!isAuthenticated) {
      if (page !== 'kiosk' && page !== 'dashboard') {
        openLoginModal();
        setCurrentPage('kiosk');
        return;
      }
    }

    // Role-specific Route Guard
    if (
      role === 'GURU' &&
      (page === 'students' ||
        page === 'register' ||
        page === 'reports' ||
        page === 'users' ||
        page === 'manage-classes' ||
        page === 'operational-hours')
    ) {
      alert('Halaman ini khusus untuk Role Admin atau Kepala Sekolah.');
      setCurrentPage('dashboard');
      return;
    }

    if (
      role === 'ADMIN' &&
      (page === 'jurnal-kbm' || page === 'users' || page === 'manage-classes' || page === 'operational-hours')
    ) {
      alert('Halaman ini khusus untuk Role Guru atau Kepala Sekolah.');
      setCurrentPage('kiosk');
      return;
    }

    if (page === 'operational-hours' && role !== 'KEPALA_SEKOLAH') {
      alert('Halaman Jam Operasional khusus untuk Role Kepala Sekolah.');
      setCurrentPage('dashboard');
      return;
    }

    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      {/* Main Workspace Area with RBAC Route Rendering */}
      <main className="flex-1 flex flex-col">
        {currentPage === 'kiosk' && (
          <KioskPage onGoToDashboard={() => handleNavigate('dashboard')} />
        )}
        {currentPage === 'dashboard' && (
          <DashboardPage onNavigate={handleNavigate} />
        )}
        {currentPage === 'manage-classes' && role === 'KEPALA_SEKOLAH' && (
          <ManageClassesPage />
        )}
        {currentPage === 'operational-hours' && role === 'KEPALA_SEKOLAH' && (
          <ManageOperationalHoursPage />
        )}
        {currentPage === 'students' && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH') && (
          <StudentsPage onNavigate={handleNavigate} />
        )}
        {currentPage === 'register' && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH') && (
          <RegisterStudentPage
            onSuccess={() => handleNavigate('students')}
            onCancel={() => handleNavigate('students')}
          />
        )}
        {currentPage === 'reports' && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH') && (
          <ReportsPage />
        )}
        {currentPage === 'jurnal-kbm' && (role === 'GURU' || role === 'KEPALA_SEKOLAH') && (
          <KbmJournalPage />
        )}
        {currentPage === 'users' && role === 'KEPALA_SEKOLAH' && (
          <UserManagementPage />
        )}
      </main>

      {/* Authentication & Profile Modals */}
      <LoginModal />
      <RegisterModal />
      <ProfileModal />

      {/* Minimal Enterprise Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-3.5 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistem Presensi Siswa Face Recognition • SKH Santo Fransiskus Asisi</span>
          <span className="text-[11px] text-slate-400 font-mono">
            {isAuthenticated ? `Mode Terautentikasi [${role}]` : 'Akses Publik • Tamu'}
          </span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
