import React, { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { KioskPage } from './pages/KioskPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { RegisterStudentPage } from './pages/RegisterStudentPage';
import { ReportsPage } from './pages/ReportsPage';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'kiosk' | 'dashboard' | 'students' | 'register' | 'reports'>('kiosk');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={page => setCurrentPage(page)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col">
        {currentPage === 'kiosk' && (
          <KioskPage onGoToDashboard={() => setCurrentPage('dashboard')} />
        )}
        {currentPage === 'dashboard' && (
          <DashboardPage onNavigate={page => setCurrentPage(page)} />
        )}
        {currentPage === 'students' && (
          <StudentsPage onNavigate={page => setCurrentPage(page)} />
        )}
        {currentPage === 'register' && (
          <RegisterStudentPage
            onSuccess={() => setCurrentPage('students')}
            onCancel={() => setCurrentPage('students')}
          />
        )}
        {currentPage === 'reports' && (
          <ReportsPage />
        )}
      </main>

      {/* Minimal Enterprise Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-3.5 px-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistem Presensi Siswa Face Recognition • SKH Santo Fransiskus Asisi</span>
          <span className="text-[11px] text-slate-400">PWA Offline-First & Realtime Supabase Database</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
