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
} from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';

interface NavbarProps {
  currentPage: 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports';
  onNavigate: (page: 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports') => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
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

  const navItems = [
    { id: 'kiosk', label: 'Kiosk Absensi', icon: Camera },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Data Siswa', icon: Users },
    { id: 'reports', label: 'Laporan Excel', icon: FileSpreadsheet },
  ] as const;

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
                const isActive = currentPage === item.id || (item.id === 'students' && currentPage === 'register');
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

            {/* Right Status & Meta Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Supabase Realtime Status Badge */}
              <div
                title="Database Supabase Cloud Terhubung & Sinkron Real-time"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300 text-xs font-medium select-none"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline text-slate-300 font-medium text-[11px]">Realtime Cloud</span>
              </div>

              {/* Minimal Digital Clock */}
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 font-mono text-xs tabular-nums text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{timeStr}</span>
              </div>

              {/* Install PWA Button */}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Install PWA</span>
                </button>
              )}

              {/* Mobile Kiosk Switcher */}
              <button
                onClick={() => onNavigate(currentPage === 'kiosk' ? 'dashboard' : 'kiosk')}
                className="md:hidden p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
              >
                {currentPage === 'kiosk' ? <LayoutDashboard className="w-4 h-4" /> : <Camera className="w-4 h-4 text-blue-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden grid grid-cols-4 bg-[#0d1322] border-t border-slate-800 py-1.5 px-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id || (item.id === 'students' && currentPage === 'register');
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </header>
    </>
  );
};
