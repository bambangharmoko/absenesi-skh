import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  UserX,
  Plus,
  RefreshCw,
  Camera,
  Filter,
  Calendar,
  Lock,
} from 'lucide-react';
import { LiveAttendanceFeed } from '../components/dashboard/LiveAttendanceFeed';
import { AttendanceTable } from '../components/dashboard/AttendanceTable';
import { ManualOverrideModal } from '../components/dashboard/ManualOverrideModal';
import { api, AttendanceRecord, AttendanceSummary, Student } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppPage } from '../components/layout/Navbar';

interface DashboardPageProps {
  onNavigate: (page: AppPage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { isAuthenticated, role, openLoginModal } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Manual Override Modal State
  const [selectedStudentForOverride, setSelectedStudentForOverride] = useState<Student | null>(null);
  const [overrideInitialStatus, setOverrideInitialStatus] = useState<string>('HADIR');
  const [isOverrideOpen, setIsOverrideOpen] = useState<boolean>(false);

  const canEdit = isAuthenticated && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH' || role === 'GURU');
  const canRegister = isAuthenticated && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH');

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, attRes, stdRes] = await Promise.all([
        api.getAttendanceSummary(selectedClass, selectedDate),
        api.getTodayAttendance(selectedClass, undefined, selectedDate),
        api.getStudents(selectedClass),
      ]);
      setSummary(sumRes);
      setTodayRecords(attRes);
      setStudents(stdRes);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClass, selectedDate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000); // 6s auto refresh

    const handleDbUpdate = () => {
      fetchData();
    };
    window.addEventListener('skh_db_updated', handleDbUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('skh_db_updated', handleDbUpdate);
    };
  }, [fetchData]);

  const handleOpenOverride = (studentId: string, currentStatus?: string) => {
    if (!canEdit) {
      openLoginModal();
      return;
    }
    const s = students.find(item => item.id === studentId);
    if (s) {
      setSelectedStudentForOverride(s);
      setOverrideInitialStatus(currentStatus || 'HADIR');
      setIsOverrideOpen(true);
    }
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!canEdit) {
      openLoginModal();
      return;
    }
    try {
      await api.deleteAttendance(attendanceId);
      await fetchData();
    } catch (err) {
      console.warn('Failed to delete attendance record:', err);
    }
  };

  const classTabs = [
    { id: 'all', label: 'Semua Kelas' },
    { id: 'Kelas 1 Autis', label: 'Kelas 1 Autis' },
    { id: 'Kelas 2 Tunarungu', label: 'Kelas 2 Tunarungu' },
    { id: 'Kelas 3 Tunagrahita', label: 'Kelas 3 Tunagrahita' },
  ];

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Dashboard Pemantauan Presensi
            </h2>
            {!isAuthenticated ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                Akses Publik
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Mode Petugas ({role})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitoring kehadiran siswa SKH Santo Fransiskus Asisi secara real-time
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('kiosk')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition"
          >
            <Camera className="w-4 h-4" />
            <span>Buka Kiosk Absensi</span>
          </button>

          {canRegister && (
            <button
              onClick={() => onNavigate('register')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              <span>Daftar Siswa Baru</span>
            </button>
          )}

          {!isAuthenticated && (
            <button
              onClick={openLoginModal}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-2 border border-slate-800 transition"
            >
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Login untuk Mengubah</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar: Class and Date Range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
        {/* Class Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Kelas:
          </span>
          {classTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedClass(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                selectedClass === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Tanggal:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
          />
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Students */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Siswa</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
            {summary ? summary.total_students : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Terdaftar di sistem</div>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Tepat Waktu</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono tabular-nums">
            {summary ? summary.total_present : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Sebelum 07:30 WIB</div>
        </div>

        {/* Terlambat */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono tabular-nums">
            {summary ? summary.total_late : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Lewat 07:30 WIB</div>
        </div>

        {/* Sudah Pulang */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">Sudah Pulang</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-400 font-mono tabular-nums">
            {summary ? summary.checkout_count : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Presensi kepulangan</div>
        </div>

        {/* Kehadiran Rate */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tingkat Kehadiran</span>
            <span className="text-xs font-bold text-blue-400 font-mono">{summary?.attendance_rate || 0}%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tabular-nums">
            {summary ? summary.total_absent : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Belum hadir pada tanggal ini</div>
        </div>
      </div>

      {/* Main Content Grid: Live Feed (4 cols) + Table (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Attendance Feed */}
        <div className="lg:col-span-4">
          <LiveAttendanceFeed records={todayRecords} />
        </div>

        {/* Attendance Detail Table */}
        <div className="lg:col-span-8">
          <AttendanceTable
            records={todayRecords}
            allStudents={students}
            onOpenOverride={handleOpenOverride}
            onDeleteAttendance={handleDeleteAttendance}
            canEdit={canEdit}
            onRequireLogin={openLoginModal}
          />
        </div>
      </div>

      {/* Manual Override Modal */}
      <ManualOverrideModal
        student={selectedStudentForOverride}
        currentStatus={overrideInitialStatus}
        isOpen={isOverrideOpen}
        onClose={() => setIsOverrideOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};
