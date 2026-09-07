import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles, Clock, Heart, Award } from 'lucide-react';
import { VerifyFrameResponse } from '../../services/api';

interface CelebrationModalProps {
  data: VerifyFrameResponse | null;
  onClose: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ data, onClose }) => {
  useEffect(() => {
    if (data && (data.attendance_status === 'RECORDED_SUCCESS' || data.status === 'MATCHED')) {
      // Trigger colorful celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });

      // Auto close after 3.2 seconds to serve next student in line
      const timer = setTimeout(() => {
        onClose();
      }, 3200);

      return () => clearTimeout(timer);
    }
  }, [data, onClose]);

  if (!data || !data.student) return null;

  const isSuccess = data.attendance_status === 'RECORDED_SUCCESS';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-xl bg-slate-900 p-5 sm:p-6 text-white shadow-2xl border border-slate-700"
        >
          {/* Top Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold tracking-wide bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSuccess ? 'PRESENSI BERHASIL' : 'SUDAH TERCATAT HARI INI'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700 font-mono">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{data.time || '07:15'}</span>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="flex items-center gap-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800 mb-4">
            {/* Student Photo */}
            <div className="relative">
              <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 flex items-center justify-center flex-shrink-0">
                {data.student.photo_url ? (
                  <img
                    src={data.student.photo_url}
                    alt={data.student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xl font-bold text-blue-400">
                    {data.student.nickname.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Student Details */}
            <div className="flex-1 overflow-hidden">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Halo, {data.student.nickname}
              </div>
              <h3 className="text-base font-bold text-white truncate">
                {data.student.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                  {data.student.class_name}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  NIS: {data.student.nis}
                </span>
              </div>
            </div>
          </div>

          {/* Greeting Message */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
            <p className="text-xs sm:text-sm font-medium text-slate-200">
              {data.message}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-1.5 text-[11px] text-slate-400 font-mono">
              <Award className="w-3.5 h-3.5 text-blue-400" />
              <span>Kecocokan Wajah: {Math.round(data.confidence * 100)}%</span>
            </div>
          </div>

          {/* Auto-Dismiss Countdown Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Siap untuk siswa berikutnya</span>
              <span className="text-slate-400">Otomatis kembali</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.2, ease: 'linear' }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
