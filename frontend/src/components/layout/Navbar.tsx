import React, { useState, useEffect } from 'react';
import {
  Camera,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Download,
  Clock,
  Cloud,
  Database,
} from 'lucide-react';
import { isSupabaseConfigured } from '../../services/supabase';

interface NavbarProps {
  currentPage: 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports';
  onNavigate: (page: 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports') => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, onRefreshData }) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }));
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

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo & School Name */}
            <div
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-white tracking-tight">
                    SKH ST. FRANSISKUS ASISI
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    FACE AI PWA
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Sistem Presensi Siswa Cerdas & Ramah Anak
                </p>
              </div>
            </div>

            {/* Center Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => onNavigate('kiosk')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  currentPage === 'kiosk'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kiosk Absensi</span>
              </button>

              <button
                onClick={() => onNavigate('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  currentPage === 'dashboard'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => onNavigate('students')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  currentPage === 'students' || currentPage === 'register'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Data Siswa</span>
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  currentPage === 'reports'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Laporan Excel</span>
              </button>
            </nav>

            {/* Right Buttons: Supabase Cloud Button, Clock, PWA Install */}
            <div className="flex items-center gap-2.5">
              {/* Supabase Cloud Status Indicator (Read-only, Realtime) */}
              <div
                title="Sinkronisasi Supabase Cloud Real-time Aktif"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm select-none"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Supabase Realtime</span>
                <span className="sm:hidden">Cloud</span>
              </div>

              {/* Live Clock Widget */}
              <div className="hidden lg:flex flex-col items-end px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 tracking-wider">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeStr}</span>
                </div>
                <div className="text-[10px] text-slate-400">{dateStr}</div>
              </div>

              {/* PWA Install Button */}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Install PWA</span>
                </button>
              )}

              {/* Mobile Kiosk Quick Button */}
              <button
                onClick={() => onNavigate(currentPage === 'kiosk' ? 'dashboard' : 'kiosk')}
                className="md:hidden p-2 rounded-xl bg-emerald-600 text-white shadow-md"
              >
                {currentPage === 'kiosk' ? <LayoutDashboard className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden flex items-center justify-around bg-slate-950 border-t border-slate-800 py-2.5 px-2">
          <button
            onClick={() => onNavigate('kiosk')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
              currentPage === 'kiosk' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kiosk</span>
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
              currentPage === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onNavigate('students')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
              currentPage === 'students' || currentPage === 'register' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Siswa</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
              currentPage === 'reports' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Laporan</span>
          </button>
        </div>
      </header>


    </>
  );
};
