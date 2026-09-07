import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldCheck, UserCheck, AlertTriangle, UserX, Award } from 'lucide-react';
import { AttendanceRecord } from '../../services/api';

interface LiveAttendanceFeedProps {
  records: AttendanceRecord[];
}

export const LiveAttendanceFeed: React.FC<LiveAttendanceFeedProps> = ({ records }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HADIR':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <UserCheck className="w-3 h-3" />,
          label: 'Hadir',
        };
      case 'TERLAMBAT':
        return {
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Terlambat',
        };
      case 'IZIN':
        return {
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          icon: <ShieldCheck className="w-3 h-3" />,
          label: 'Izin',
        };
      case 'SAKIT':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          icon: <AlertTriangle className="w-3 h-3" />,
          label: 'Sakit',
        };
      default:
        return {
          bg: 'bg-slate-800/80 text-slate-400 border-slate-700',
          icon: <UserX className="w-3 h-3" />,
          label: status,
        };
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg bg-slate-900/60 border border-slate-800 p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Aktivitas Real-time</h3>
        </div>
        <span className="text-[11px] text-slate-500 font-mono">Live Stream</span>
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
          <Clock className="w-7 h-7 mb-2 text-slate-600" />
          <p className="text-xs text-slate-400">Belum ada aktivitas presensi hari ini.</p>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1 max-h-[460px]">
          {records.slice(0, 10).map((item, idx) => {
            const badge = getStatusBadge(item.status);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs flex-shrink-0">
                    {item.student_nickname?.charAt(0) || item.student_name?.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{item.student_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                      <span>{item.class_name}</span>
                      {item.time_in && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-emerald-400 font-mono tabular-nums">
                            {item.time_in}
                          </span>
                        </>
                      )}
                      {item.time_out && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-amber-400 font-mono tabular-nums">
                            Pulang {item.time_out}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${badge.bg}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  {item.verification_method === 'FACE_RECOGNITION' ? (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Face AI: {Math.round(item.confidence_score * 100)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Manual</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
