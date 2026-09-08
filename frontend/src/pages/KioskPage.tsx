import React, { useState, useEffect } from 'react';
import { CameraScanner } from '../components/kiosk/CameraScanner';
import { CelebrationModal } from '../components/kiosk/CelebrationModal';
import { VerifyFrameResponse, api, AttendanceSummary, ClassRoomCombination } from '../services/api';
import { Maximize2, Minimize2, Info, Volume2, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface KioskPageProps {
  onGoToDashboard: () => void;
}

export const KioskPage: React.FC<KioskPageProps> = ({ onGoToDashboard }) => {
  const [celebrationData, setCelebrationData] = useState<VerifyFrameResponse | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [classRooms, setClassRooms] = useState<ClassRoomCombination[]>(() =>
    api.getClassRooms(true)
  );

  useEffect(() => {
    const handleClassUpdate = () => {
      setClassRooms(api.getClassRooms(true));
    };
    window.addEventListener('skh_class_rooms_updated', handleClassUpdate);
    return () => window.removeEventListener('skh_class_rooms_updated', handleClassUpdate);
  }, []);

  const loadSummary = () => {
    api.getAttendanceSummary(selectedClass).then(setSummary).catch(() => {});
  };

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 8000);
    return () => clearInterval(interval);
  }, [selectedClass]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleVerified = (response: VerifyFrameResponse) => {
    setCelebrationData(response);
    loadSummary();
  };

  return (
    <div className="flex flex-col flex-1 h-full max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Kiosk Presensi Wajah</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600/10 text-blue-400 border border-blue-500/20">
              Live Scanner
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Posisikan wajah di depan kamera untuk verifikasi kehadiran otomatis secara langsung.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">Semua Kelas SKH</option>
            {classRooms.map(c => (
              <option key={c.id} value={c.display_name}>
                {c.display_name}
              </option>
            ))}
          </select>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
            title="Layar Penuh (Fullscreen Kiosk)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Left: Camera Scanner HUD (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-[500px] sm:h-[580px]">
          <CameraScanner
            onVerified={handleVerified}
            selectedClass={selectedClass}
            isPaused={celebrationData !== null}
          />
        </div>

        {/* Right: Live Counter & Instruction Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Attendance Stats Widget */}
          <div className="enterprise-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Ringkasan Presensi Hari Ini</span>
              <span className="text-[11px] font-mono text-slate-400 lowercase">realtime</span>
            </h2>

            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                  {summary ? summary.total_present : 0}
                </div>
                <div className="text-[11px] font-medium text-slate-300 mt-0.5">Tepat Waktu</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
                  {summary ? summary.total_late : 0}
                </div>
                <div className="text-[11px] font-medium text-slate-300 mt-0.5">Terlambat</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-2xl font-bold text-sky-400 font-mono tabular-nums">
                  {summary ? summary.total_permission + summary.total_sick : 0}
                </div>
                <div className="text-[11px] font-medium text-slate-300 mt-0.5">Izin / Sakit</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-2xl font-bold text-slate-200 font-mono tabular-nums">
                  {summary ? summary.total_students : 0}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Total Siswa</div>
              </div>
            </div>

            {/* Attendance Progress Bar */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs font-medium text-slate-400 mb-1.5">
                <span>Rasio Kehadiran</span>
                <span className="text-slate-200 font-mono font-semibold">{summary?.attendance_rate || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${summary?.attendance_rate || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Professional Guidance Card */}
          <div className="enterprise-card p-4 flex flex-col justify-between flex-1 gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold mb-2">
                <Info className="w-4 h-4" />
                <span>Petunjuk Penggunaan Kiosk</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">1</span>
                  <span>Berdiri di depan kamera dalam jarak ideal 0.5 – 1.2 meter.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">2</span>
                  <span>Tatap kamera dengan tenang hingga kotak verifikasi mendeteksi wajah.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">3</span>
                  <span>Nama siswa, status masuk/pulang, dan suara sambutan otomatis diputar.</span>
                </li>
              </ul>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Audio Feedback Bahasa Indonesia Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <CelebrationModal
        data={celebrationData}
        onClose={() => setCelebrationData(null)}
      />
    </div>
  );
};
