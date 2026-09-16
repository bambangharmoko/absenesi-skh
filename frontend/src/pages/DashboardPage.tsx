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
  FileSpreadsheet,
  ShieldAlert,
  BookOpen,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { LiveAttendanceFeed } from '../components/dashboard/LiveAttendanceFeed';
import { AttendanceTable } from '../components/dashboard/AttendanceTable';
import { ManualOverrideModal } from '../components/dashboard/ManualOverrideModal';
import { AttendanceDiscrepancyModal } from '../components/dashboard/AttendanceDiscrepancyModal';
import { ExportTeacherReportModal } from '../components/dashboard/ExportTeacherReportModal';
import {
  api,
  AttendanceRecord,
  AttendanceSummary,
  Student,
  ClassRoomCombination,
  DiscrepancyItem,
} from '../services/api';
import { getLocalDateString } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { AppPage } from '../components/layout/Navbar';

interface DashboardPageProps {
  onNavigate: (page: AppPage) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { currentUser, isAuthenticated, role, openLoginModal, openProfileModal } = useAuth();

  const todayStr = getLocalDateString();
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dual-Data & Audit Discrepancy State (Tugas 2 & 4)
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([]);
  const [kbmDataMap, setKbmDataMap] = useState<
    Map<string, { status: string; topic: string; time: string; notes?: string }>
  >(new Map());
  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState<boolean>(false);

  // Teacher Excel Export Modal State (Tugas 3)
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Manual Override Modal State
  const [selectedStudentForOverride, setSelectedStudentForOverride] = useState<Student | null>(null);
  const [overrideInitialStatus, setOverrideInitialStatus] = useState<string>('HADIR');
  const [isOverrideOpen, setIsOverrideOpen] = useState<boolean>(false);

  const isTeacher = isAuthenticated && role === 'GURU';
  const hasWaliKelas = Boolean(currentUser?.wali_kelas);
  const isWaliApproved = isTeacher ? currentUser?.wali_kelas_status === 'APPROVED' && hasWaliKelas : true;

  // For role Guru: scope strictly to their assigned wali_kelas
  const effectiveClass = isTeacher && hasWaliKelas ? currentUser!.wali_kelas! : selectedClass;

  const canEdit = isAuthenticated && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH' || role === 'GURU');
  const canRegister = isAuthenticated && (role === 'ADMIN' || role === 'KEPALA_SEKOLAH');

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

  const fetchData = useCallback(async () => {
    try {
      const queryClass = isTeacher && hasWaliKelas ? currentUser!.wali_kelas! : (selectedClass === 'all' ? undefined : selectedClass);

      const [sumRes, attRes, stdRes, kbmJournals] = await Promise.all([
        api.getAttendanceSummary(queryClass, selectedDate),
        api.getTodayAttendance(queryClass, undefined, selectedDate),
        api.getStudents(queryClass),
        api.getKbmJournals(queryClass, selectedDate),
      ]);

      setSummary(sumRes);
      setTodayRecords(attRes);
      setStudents(stdRes);

      // Build Map for KBM attendance of students on selectedDate
      const kbmMap = new Map<string, { status: string; topic: string; time: string; notes?: string }>();
      (kbmJournals || []).forEach(j => {
        (j.attendances || []).forEach(item => {
          kbmMap.set(item.student_id, {
            status: item.status,
            topic: j.meeting_topic,
            time: `${j.start_time} - ${j.end_time}`,
            notes: item.notes,
          });
        });
      });
      setKbmDataMap(kbmMap);

      // Fetch Discrepancies between Face Scan vs KBM Attendance (Tugas 4)
      let discList: DiscrepancyItem[] = [];
      if (queryClass) {
        discList = api.getAttendanceDiscrepancies(queryClass, selectedDate);
      } else {
        // When 'all' is selected (Admin/Kepsek), aggregate across active classes
        const classes = api.getClassRooms(true);
        classes.forEach(c => {
          const items = api.getAttendanceDiscrepancies(c.display_name, selectedDate);
          discList.push(...items);
        });
      }
      setDiscrepancies(discList);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isTeacher, hasWaliKelas, currentUser, selectedClass, selectedDate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000); // 6s auto refresh

    const handleDbUpdate = () => {
      fetchData();
    };
    window.addEventListener('skh_db_updated', handleDbUpdate);
    window.addEventListener('skh_kbm_updated', handleDbUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('skh_db_updated', handleDbUpdate);
      window.removeEventListener('skh_kbm_updated', handleDbUpdate);
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
    ...classRooms.map(c => ({ id: c.display_name, label: c.display_name })),
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
            ) : isTeacher ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Wali Kelas: {currentUser?.wali_kelas || 'Belum Dipilih'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Mode Petugas ({role})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isTeacher && hasWaliKelas
              ? `Pemantauan presensi khusus ruang kelas binaan ${currentUser?.wali_kelas} secara terintegrasi`
              : 'Monitoring kehadiran siswa SKH Santo Fransiskus Asisi secara real-time'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Export to Excel Button (Tugas 3) */}
          {(isTeacher || role === 'KEPALA_SEKOLAH' || role === 'ADMIN') && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export ke Excel</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('kiosk')}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Kiosk Absensi</span>
          </button>

          {canRegister && (
            <button
              onClick={() => onNavigate('register')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              <span>Daftar Siswa</span>
            </button>
          )}

          {!isAuthenticated && (
            <button
              onClick={openLoginModal}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-2 border border-slate-800 transition cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Teacher Pending Wali Kelas Alert */}
      {isTeacher && !isWaliApproved && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Status Wali Kelas Belum Disetujui
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentUser?.requested_wali_kelas
                  ? `Permohonan penugasan kelas ${currentUser.requested_wali_kelas} sedang menunggu verifikasi Kepala Sekolah.`
                  : 'Anda belum memilih kelas perwalian. Silakan atur kelas binaan Anda melalui menu profil.'}
              </p>
            </div>
          </div>
          <button
            onClick={openProfileModal}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer self-end sm:self-auto"
          >
            <span>Buka Profil Guru</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Prominent Discrepancy Alert Banner (Tugas 2 & 4) */}
      {discrepancies.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-amber-950/20 to-slate-900 border border-rose-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0 animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Perhatian: Ditemukan {discrepancies.length} Siswa Tidak Sesuai!
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                  Audit Presensi
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Terdapat ketidakcocokan antara presensi wajah gerbang vs absensi jurnal KBM kelas pada tanggal{' '}
                <span className="text-amber-400 font-mono font-semibold">{selectedDate}</span>.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDiscrepancyModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer flex-shrink-0 self-end sm:self-auto"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Lihat Detail ({discrepancies.length})</span>
          </button>
        </div>
      )}

      {/* Filter Toolbar: Class Scope and Date */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Class Selection or Locked Wali Kelas Badge */}
        {isTeacher && hasWaliKelas ? (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400 font-medium">Kelas Perwalian:</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              {currentUser?.wali_kelas}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto scrollbar-none">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mr-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Kelas:
            </span>
            {classTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedClass(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedClass === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
              className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
            >
              Hari Ini
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Students */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
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
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">Tepat Waktu</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono tabular-nums">
            {summary ? summary.total_present : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Presensi gerbang</div>
        </div>

        {/* Terlambat */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono tabular-nums">
            {summary ? summary.total_late : 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Lewat batas jam masuk</div>
        </div>

        {/* Sudah Pulang */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
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
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
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

        {/* Attendance Detail Table with Dual-Data View & Discrepancies */}
        <div className="lg:col-span-8">
          <AttendanceTable
            records={todayRecords}
            allStudents={students}
            onOpenOverride={handleOpenOverride}
            onDeleteAttendance={handleDeleteAttendance}
            canEdit={canEdit}
            onRequireLogin={openLoginModal}
            kbmDataMap={kbmDataMap}
            discrepancies={discrepancies}
            onOpenDiscrepancyModal={() => setIsDiscrepancyModalOpen(true)}
          />
        </div>
      </div>

      {/* Attendance Discrepancy Modal (Tugas 4) */}
      <AttendanceDiscrepancyModal
        isOpen={isDiscrepancyModalOpen}
        onClose={() => setIsDiscrepancyModalOpen(false)}
        discrepancies={discrepancies}
        className={effectiveClass === 'all' ? 'Semua Kelas' : effectiveClass}
        date={selectedDate}
        onOpenOverride={handleOpenOverride}
      />

      {/* Teacher Excel Export Modal (Tugas 3) */}
      <ExportTeacherReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        className={effectiveClass === 'all' ? (classRooms[0]?.display_name || 'Semua_Kelas') : effectiveClass}
      />

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
