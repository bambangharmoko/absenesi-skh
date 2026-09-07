import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ShieldAlert, UserCheck, AlertTriangle, ShieldCheck, UserX } from 'lucide-react';
import { api, Student } from '../../services/api';

interface ManualOverrideModalProps {
  student: Student | null;
  currentStatus?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  student,
  currentStatus = 'HADIR',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<string>(currentStatus || 'HADIR');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.manualOverride({
        student_id: student.id,
        status: status,
        notes: notes || `Presensi manual oleh guru: ${status}`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan status presensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'HADIR', label: 'Hadir', icon: <UserCheck className="w-4 h-4 text-emerald-400" />, desc: 'Siswa hadir di sekolah' },
    { value: 'TERLAMBAT', label: 'Terlambat', icon: <AlertTriangle className="w-4 h-4 text-amber-400" />, desc: 'Hadir setelah 07:30' },
    { value: 'IZIN', label: 'Izin', icon: <ShieldCheck className="w-4 h-4 text-blue-400" />, desc: 'Ada surat keterangan wali' },
    { value: 'SAKIT', label: 'Sakit', icon: <AlertTriangle className="w-4 h-4 text-rose-400" />, desc: 'Keterangan sakit / istirahat' },
    { value: 'ALPHA', label: 'Alpha', icon: <UserX className="w-4 h-4 text-slate-400" />, desc: 'Tanpa keterangan' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Manual Override Presensi</h3>
              <p className="text-[11px] text-slate-400">Validasi langsung oleh guru pendamping</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Student Summary */}
          <div className="flex items-center gap-3 my-3.5 p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-base">
              {student.nickname.charAt(0)}
            </div>
            <div>
              <h4 className="font-semibold text-slate-100 text-xs">{student.full_name}</h4>
              <div className="text-[11px] text-slate-400 font-mono">
                {student.class_name} • NIS: {student.nis}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Status Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Pilih Status Kehadiran:
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {statusOptions.map(opt => (
                  <label
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                      status === opt.value
                        ? 'bg-blue-600/10 border-blue-500 text-blue-300'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {opt.icon}
                      <div>
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div className="text-[11px] text-slate-400">{opt.desc}</div>
                      </div>
                    </div>
                    {status === opt.value && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Catatan Guru Pendamping (Opsional):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contoh: Didampingi wali murid, ada terapi wicara..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Presensi'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
