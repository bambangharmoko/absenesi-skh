import React, { useState, useEffect } from 'react';
import { Navbar, AppPage } from './components/layout/Navbar';
import { KioskPage } from './pages/KioskPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { RegisterStudentPage } from './pages/RegisterStudentPage';
import { ReportsPage } from './pages/ReportsPage';
import { KbmJournalPage } from './pages/KbmJournalPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';

const AppContent: React.FC = () => {
  const { currentUser, isAuthenticated, role, openLoginModal } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('kiosk');

  // Automatic RBAC Guard: If user logs out or role changes while on a forbidden page
  useEffect(() => {
    if (!isAuthenticated) {
      if (currentPage !== 'kiosk' && currentPage !== 'dashboard') {
        setCurrentPage('dashboard');
      }
    } else if (role === 'GURU') {
      if (
        currentPage === 'students' ||
        currentPage === 'register' ||
        currentPage === 'reports' ||
        currentPage === 'users'
      ) {
        setCurrentPage('dashboard');
      }
    } else if (role === 'ADMIN') {
      if (currentPage === 'jurnal-kbm' || currentPage === 'users') {
        setCurrentPage('dashboard');
      }
    }
  }, [isAuthenticated, role, currentPage]);

  const handleNavigate = (page: AppPage) => {
    // Guest Route Guard
    if (!isAuthenticated) {
      if (page !== 'kiosk' && page !== 'dashboard') {
        openLoginModal();
        setCurrentPage('dashboard');
        return;
      }
    }

    // Role-specific Route Guard
    if (role === 'GURU' && (page === 'students' || page === 'register' || page === 'reports' || page === 'users')) {
      alert('Halaman ini khusus untuk Role Admin atau Kepala Sekolah.');
      setCurrentPage('dashboard');
      return;
    }

    if (role === 'ADMIN' && (page === 'jurnal-kbm' || page === 'users')) {
      alert('Halaman ini khusus untuk Role Guru atau Kepala Sekolah.');
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

      {/* Authentication Modals */}
      <LoginModal />
      <RegisterModal />

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
