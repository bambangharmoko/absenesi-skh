import React from 'react';
import {
  AlertTriangle,
  X,
  UserCheck,
  UserX,
  Clock,
  BookOpen,
  Camera,
  ArrowRight,
  ShieldAlert,
  Edit3,
} from 'lucide-react';
import { DiscrepancyItem } from '../../services/api';

interface AttendanceDiscrepancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  discrepancies: DiscrepancyItem[];
  className: string;
  date: string;
  onOpenOverride?: (studentId: string, currentStatus?: string) => void;
}

export const AttendanceDiscrepancyModal: React.FC<AttendanceDiscrepancyModalProps> = ({
  isOpen,
  onClose,
  discrepancies,
  className,
  date,
  onOpenOverride,
}) => {
  if (!isOpen) return null;

  const getTypeBadge = (type: DiscrepancyItem['discrepancy_type']) => {
    switch (type) {
      case 'BOLOS_KBM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <UserX className="w-3 h-3" />
            Wajah Hadir, Alpha di KBM
          </span>
        );
      case 'TANPA_SCAN_WAJAH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Camera className="w-3 h-3" />
            Hadir di KBM, Belum Scan Gerbang
          </span>
        );
      case 'KONFLIK_STATUS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <AlertTriangle className="w-3 h-3" />
            Konflik Status (Izin / Sakit)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-4xl bg-[#0e1424] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Audit Diskrepansi Presensi Wajah vs KBM
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                  {discrepancies.length} Kasus
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pemeriksaan silang kehadiran Gerbang Sekolah (Face Recognition) dengan Jurnal Kelas (KBM) •{' '}
                <span className="text-blue-400 font-semibold">{className}</span> • Tanggal:{' '}
                <span className="text-slate-200 font-mono">{date}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {discrepancies.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                <UserCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Seluruh Data Presensi Sesuai & Valid
              </p>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Tidak ditemukan perbedaan antara catatan presensi wajah gerbang dan jurnal KBM untuk kelas ini.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {discrepancies.map((item, index) => (
                <div
                  key={`${item.student_id}-${index}`}
                  className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  {/* Top row: Student & Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs flex-shrink-0">
                        {item.student_nickname.charAt(0) || 'S'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {item.student_name}
                          <span className="text-[11px] font-normal text-slate-400 font-mono">
                            (NIS: {item.nis})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Kelas: <span className="text-slate-300 font-medium">{item.class_name}</span>
                        </div>
                      </div>
                    </div>
                    <div>{getTypeBadge(item.discrepancy_type)}</div>
                  </div>

                  {/* Dual Comparison Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Presensi Wajah Gerbang */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                          <Camera className="w-3.5 h-3.5 text-blue-400" />
                          Presensi Wajah (Gerbang)
                        </span>
                        <span className="font-mono text-[11px]">
                          {item.face_time_in ? `Masuk: ${item.face_time_in}` : 'Belum Scan'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Status Gerbang:</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            item.face_time_in
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {item.face_status}
                        </span>
                      </div>
                    </div>

                    {/* Presensi Jurnal KBM */}
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          Jurnal KBM (Sesi Kelas)
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {item.kbm_time || 'Sesi KBM'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Status di Kelas:</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            item.kbm_status === 'ALPHA'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : item.kbm_status === 'HADIR'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.kbm_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Audit Description & Quick Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
                    <p className="text-xs text-amber-300/90 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{item.discrepancy_description}</span>
                    </p>

                    {onOpenOverride && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenOverride(item.student_id, item.face_status);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition flex-shrink-0 self-end sm:self-auto cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3 text-blue-400" />
                        <span>Koreksi Presensi</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Audit dijalankan otomatis berdasarkan sinkronisasi Kiosk Gerbang & Jurnal Guru.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition"
          >
            Tutup Audit
          </button>
        </div>
      </div>
    </div>
  );
};
