import React, { useState } from 'react';
import { Search, UserCheck, AlertTriangle, ShieldCheck, UserX, Edit3, User, Trash2, X, AlertCircle } from 'lucide-react';
import { AttendanceRecord, Student } from '../../services/api';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  allStudents: Student[];
  onOpenOverride: (studentId: string, currentStatus?: string) => void;
  onDeleteAttendance?: (attendanceId: string, studentName: string) => Promise<void> | void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  records,
  allStudents,
  onOpenOverride,
  onDeleteAttendance,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<{ attendanceId: string; studentName: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Combine student list with today's attendance to show all students (including absent/not yet checked in)
  const combinedList = allStudents.map(student => {
    const att = records.find(r => r.student_id === student.id);
    return {
      student,
      attendance: att || null,
      status: att ? att.status : 'BELUM_HADIR',
    };
  });

  const filtered = combinedList.filter(item => {
    const matchSearch =
      item.student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.nis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.student.class_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      statusFilter === 'all' ||
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
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <UserCheck className="w-3 h-3" />
            Hadir
          </span>
        );
      case 'TERLAMBAT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            Terlambat
          </span>
        );
      case 'IZIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-3 h-3" />
            Izin
          </span>
        );
      case 'SAKIT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            Sakit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700">
            <UserX className="w-3 h-3" />
            Belum Hadir
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col rounded-lg bg-slate-900/60 border border-slate-800 p-4 overflow-hidden relative">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari siswa / NIS..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'BELUM_HADIR'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {st === 'all' ? 'Semua Status' : st === 'BELUM_HADIR' ? 'Belum Hadir' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-800/80 rounded-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3.5">Siswa</th>
              <th className="py-2.5 px-3.5">Kelas & Spesifikasi</th>
              <th className="py-2.5 px-3.5">Jam Masuk</th>
              <th className="py-2.5 px-3.5">Jam Pulang</th>
              <th className="py-2.5 px-3.5">Status</th>
              <th className="py-2.5 px-3.5">Metode</th>
              <th className="py-2.5 px-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                  Tidak ada data siswa yang cocok dengan kriteria pencarian.
                </td>
              </tr>
            ) : (
              filtered.map(({ student, attendance, status }) => (
                <tr key={student.id} className="hover:bg-slate-800/30 transition">
                  {/* Student */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs flex-shrink-0">
                        {student.nickname.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">{student.full_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">NIS: {student.nis}</div>
                      </div>
                    </div>
                  </td>

                  {/* Class & Needs */}
                  <td className="py-3 px-3.5">
                    <div className="font-medium text-slate-300">{student.class_name}</div>
                    <div className="text-[11px] text-slate-500">{student.category}</div>
                  </td>

                  {/* Time In */}
                  <td className="py-3 px-3.5 font-mono tabular-nums">
                    {attendance && attendance.time_in ? (
                      <span className="text-emerald-400 font-medium">{attendance.time_in}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  {/* Time Out */}
                  <td className="py-3 px-3.5 font-mono tabular-nums">
                    {attendance && attendance.time_out ? (
                      <span className="text-amber-400 font-medium">{attendance.time_out}</span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3.5">{renderStatusBadge(status)}</td>

                  {/* Method */}
                  <td className="py-3 px-3.5">
                    {attendance ? (
                      <div>
                        <span className="text-slate-300 font-medium">
                          {attendance.verification_method === 'FACE_RECOGNITION'
                            ? 'Face AI'
                            : 'Manual Guru'}
                        </span>
                        {attendance.notes && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                            {attendance.notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenOverride(student.id, attendance?.status)}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 inline-flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3 h-3 text-blue-400" />
                        <span>Ubah</span>
                      </button>

                      {attendance && (
                        <button
                          onClick={() => setConfirmDelete({ attendanceId: attendance.id, studentName: student.full_name })}
                          title="Hapus data presensi hari ini"
                          className="px-2 py-1 rounded-md bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 text-xs font-medium border border-rose-900/50 inline-flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
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
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Hapus Data Presensi?</h4>
                  <p className="text-[11px] text-slate-400">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed">
              Apakah Anda yakin ingin menghapus catatan presensi hari ini untuk <b className="text-white">{confirmDelete.studentName}</b>? Siswa akan berstatus <i>Belum Hadir</i>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Batal
              </button>

              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
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
