import React, { useState, useEffect } from 'react';
import {
  Camera,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Download,
  Clock,
  Cloud,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type AppPage = 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports' | 'jurnal-kbm' | 'users';

interface NavbarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const { currentUser, isAuthenticated, role, logout, openLoginModal } = useAuth();

  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('Aplikasi siap diinstal via menu browser Anda.');
      return;
    }
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  // Dynamic Navigation Items based on RBAC
  let navItems: Array<{ id: AppPage; label: string; icon: React.ComponentType<{ className?: string }> }> = [];

  if (!isAuthenticated) {
    // Guest layout: Only 2 main public pages
    navItems = [
      { id: 'kiosk', label: 'Absen Wajah', icon: Camera },
      { id: 'dashboard', label: 'Dashboard Publik', icon: LayoutDashboard },
    ];
  } else if (role === 'GURU') {
    navItems = [
      { id: 'kiosk', label: 'Kiosk Absen', icon: Camera },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'jurnal-kbm', label: 'Jurnal KBM', icon: BookOpen },
    ];
  } else if (role === 'ADMIN') {
    navItems = [
      { id: 'kiosk', label: 'Kiosk Absen', icon: Camera },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Data Siswa', icon: Users },
      { id: 'reports', label: 'Laporan Excel', icon: FileSpreadsheet },
    ];
  } else if (role === 'KEPALA_SEKOLAH') {
    navItems = [
      { id: 'kiosk', label: 'Kiosk Absen', icon: Camera },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Data Siswa', icon: Users },
      { id: 'reports', label: 'Laporan Excel', icon: FileSpreadsheet },
      { id: 'jurnal-kbm', label: 'Jurnal KBM', icon: BookOpen },
      { id: 'users', label: 'Manajemen User', icon: ShieldCheck },
    ];
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#0d1322]/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* School Logo & System Title */}
            <div
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/25 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-white tracking-tight">
                    SKH St. Fransiskus Asisi
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    Kiosk Enterprise
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Sistem Presensi Siswa Face Recognition
                </p>
              </div>
            </div>

            {/* Center Segmented Navigation Control */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive =
                  currentPage === item.id || (item.id === 'students' && currentPage === 'register');
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Status & Auth Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Minimal Digital Clock */}
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 font-mono text-xs tabular-nums text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{timeStr}</span>
              </div>

              {/* Install PWA Button */}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Install PWA</span>
                </button>
              )}

              {/* Auth Button or User Profile Chip */}
              {!isAuthenticated ? (
                <button
                  onClick={openLoginModal}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login Petugas</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex flex-col text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-xs font-semibold text-slate-100 max-w-[130px] truncate">
                        {currentUser?.full_name}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          role === 'KEPALA_SEKOLAH'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : role === 'ADMIN'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {role === 'KEPALA_SEKOLAH' ? 'Kepsek' : role}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">@{currentUser?.username}</span>
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      onNavigate('dashboard');
                    }}
                    title="Keluar dari sistem"
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-md bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/50 text-slate-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Keluar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div
          className={`md:hidden grid ${
            navItems.length <= 2
              ? 'grid-cols-2'
              : navItems.length === 3
              ? 'grid-cols-3'
              : navItems.length === 4
              ? 'grid-cols-4'
              : 'grid-cols-5'
          } bg-[#0d1322] border-t border-slate-800 py-1.5 px-2`}
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive =
              currentPage === item.id || (item.id === 'students' && currentPage === 'register');
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-[70px]">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
};
