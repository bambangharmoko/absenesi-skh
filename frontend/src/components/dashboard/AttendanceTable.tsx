import React, { useState } from 'react';
import {
  Search,
  UserCheck,
  AlertTriangle,
  ShieldCheck,
  UserX,
  Edit3,
  Trash2,
  X,
  ShieldAlert,
  CheckCircle2,
  Camera,
  BookOpen,
  Info,
} from 'lucide-react';
import { AttendanceRecord, Student, DiscrepancyItem } from '../../services/api';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  allStudents: Student[];
  onOpenOverride: (studentId: string, currentStatus?: string) => void;
  onDeleteAttendance?: (attendanceId: string, studentName: string) => Promise<void> | void;
  canEdit?: boolean;
  onRequireLogin?: () => void;
  kbmDataMap?: Map<string, { status: string; topic: string; time: string; notes?: string }>;
  discrepancies?: DiscrepancyItem[];
  onOpenDiscrepancyModal?: () => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  records,
  allStudents,
  onOpenOverride,
  onDeleteAttendance,
  canEdit = true,
  onRequireLogin,
  kbmDataMap,
  discrepancies = [],
  onOpenDiscrepancyModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<{ attendanceId: string; studentName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Combine student list with today's face attendance & KBM attendance for complete dual view
  const combinedList = allStudents.map(student => {
    const att = records.find(r => r.student_id === student.id);
    const kbm = kbmDataMap ? kbmDataMap.get(student.id) : undefined;
    const discrepancy = discrepancies.find(d => d.student_id === student.id);

    return {
      student,
      attendance: att || null,
      status: att ? att.status : 'BELUM_HADIR',
      kbm: kbm || null,
      discrepancy: discrepancy || null,
    };
  });

  const filtered = combinedList.filter(item => {
    const matchSearch =
      item.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.class_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'DISCREPANCY' && Boolean(item.discrepancy)) ||
      (statusFilter === 'BELUM_HADIR' && !item.attendance) ||
      (item.attendance && item.attendance.status === statusFilter);

    return matchSearch && matchStatus;
  });

  const handleDeleteConfirm = async () => {
    if (!confirmDelete || !onDeleteAttendance) return;
    setIsDeleting(true);
    try {
      await onDeleteAttendance(confirmDelete.attendanceId, confirmDelete.studentName);
      setConfirmDelete(null);
    } catch (err) {
      console.warn('Delete attendance error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'HADIR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-3 h-3" />
            Hadir
          </span>
        );
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            Terlambat
          </span>
        );
      case 'IZIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-3 h-3" />
            Izin
          </span>
        );
      case 'SAKIT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            Sakit
          </span>
        );
      case 'ALPHA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <UserX className="w-3 h-3" />
            Alpha
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700">
            <UserX className="w-3 h-3" />
            Belum Hadir
          </span>
        );
    }
  };

  const renderKbmBadge = (kbm: { status: string; topic: string; time: string; notes?: string } | null) => {
    if (!kbm) {
      return (
        <span className="text-[11px] text-slate-500 italic">
          Belum ada sesi
        </span>
      );
    }

    let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
    if (kbm.status === 'HADIR') badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    else if (kbm.status === 'ALPHA') badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    else if (kbm.status === 'IZIN') badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    else if (kbm.status === 'SAKIT') badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

    return (
      <div className="space-y-0.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}>
          {kbm.status}
        </span>
        <div className="text-[10px] text-slate-400 truncate max-w-[130px]" title={kbm.topic}>
          {kbm.topic || 'KBM'}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col rounded-xl bg-slate-900/60 border border-slate-800 p-4 overflow-hidden relative space-y-4">
      {/* Search and Filter Tabs Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama siswa / NIS..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            Semua Status
          </button>

          {/* Discrepancy Tab */}
          <button
            onClick={() => setStatusFilter('DISCREPANCY')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'DISCREPANCY'
                ? 'bg-rose-600 text-white shadow-xs'
                : discrepancies.length > 0
                ? 'bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Diskrepansi Data</span>
            {discrepancies.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white font-mono">
                {discrepancies.length}
              </span>
            )}
          </button>

          {['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'BELUM_HADIR'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {st === 'BELUM_HADIR' ? 'Belum Hadir' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Dual Attendance Data Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3.5">Siswa</th>
              <th className="py-2.5 px-3.5">Kelas</th>
              <th className="py-2.5 px-3.5">
                <span className="flex items-center gap-1">
                  <Camera className="w-3 h-3 text-blue-400" />
                  Presensi Wajah
                </span>
              </th>
              <th className="py-2.5 px-3.5">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-400" />
                  Presensi KBM
                </span>
              </th>
              <th className="py-2.5 px-3.5">Audit Kesesuaian</th>
              <th className="py-2.5 px-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                  {statusFilter === 'DISCREPANCY'
                    ? 'Tidak ditemukan diskrepansi pada filter ini. Data presensi sinkron!'
                    : 'Tidak ada data siswa yang cocok dengan kriteria pencarian.'}
                </td>
              </tr>
            ) : (
              filtered.map(({ student, attendance, status, kbm, discrepancy }) => (
                <tr
                  key={student.id}
                  className={`transition ${
                    discrepancy
                      ? 'bg-rose-950/15 hover:bg-rose-950/25'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* Student */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs flex-shrink-0">
                        {student.nickname.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>{student.full_name}</span>
                          {discrepancy && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Terdapat diskrepansi data" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          NIS: {student.nis}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Class */}
                  <td className="py-3 px-3.5">
                    <div className="font-medium text-slate-300">{student.class_name}</div>
                    <div className="text-[10px] text-slate-500">{student.category}</div>
                  </td>

                  {/* Face Attendance (Gerbang) */}
                  <td className="py-3 px-3.5">
                    <div className="space-y-1">
                      <div>{renderStatusBadge(status)}</div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-2">
                        <span>Masuk: <b className="text-slate-200">{attendance?.time_in || '-'}</b></span>
                        <span>Pulang: <b className="text-slate-200">{attendance?.time_out || '-'}</b></span>
                      </div>
                    </div>
                  </td>

                  {/* KBM Attendance (Kelas) */}
                  <td className="py-3 px-3.5">
                    {renderKbmBadge(kbm)}
                  </td>

                  {/* Audit Kesesuaian */}
                  <td className="py-3 px-3.5">
                    {discrepancy ? (
                      <button
                        onClick={onOpenDiscrepancyModal}
                        title={discrepancy.discrepancy_title}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                        <span>
                          {discrepancy.discrepancy_type === 'BOLOS_KBM'
                            ? 'Bolos KBM ⚠️'
                            : discrepancy.discrepancy_type === 'TANPA_SCAN_WAJAH'
                            ? 'Tanpa Wajah ⚠️'
                            : 'Konflik Status ⚠️'}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Sesuai
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3.5 text-right">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenOverride(student.id, attendance?.status)}
                          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-blue-400" />
                          <span>Ubah</span>
                        </button>

                        {attendance && (
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                attendanceId: attendance.id,
                                studentName: student.full_name,
                              })
                            }
                            title="Hapus data presensi wajah hari ini"
                            className="px-2 py-1 rounded-md bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-xs font-medium border border-rose-900/50 inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={onRequireLogin}
                        className="text-[11px] text-slate-500 hover:text-slate-300 font-medium"
                      >
                        Publik
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0e1424] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Hapus Catatan Presensi?</h4>
                  <p className="text-[11px] text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">
              Apakah Anda yakin ingin menghapus catatan presensi wajah untuk{' '}
              <b className="text-white">{confirmDelete.studentName}</b>? Status siswa akan kembali menjadi <i>Belum Hadir</i>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                Batal
              </button>

              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
