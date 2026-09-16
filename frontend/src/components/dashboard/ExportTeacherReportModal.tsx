import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  X,
  Download,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { getLocalDateString } from '../../services/db';

interface ExportTeacherReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

export const ExportTeacherReportModal: React.FC<ExportTeacherReportModalProps> = ({
  isOpen,
  onClose,
  className,
}) => {
  const today = getLocalDateString();
  const [periodType, setPeriodType] = useState<PeriodType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(today);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);

    let start = today;
    let end = today;
    let label = today;

    if (periodType === 'daily') {
      start = selectedDate;
      end = selectedDate;
      label = `Harian_${selectedDate}`;
    } else if (periodType === 'weekly') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      start = d.toISOString().split('T')[0];
      end = today;
      label = `7HariTerakhir_${start}_sd_${end}`;
    } else if (periodType === 'monthly') {
      const d = new Date(today);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      start = `${year}-${month}-01`;
      // last day of month
      const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
      end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      label = `Bulan_${year}_${month}`;
    } else if (periodType === 'custom') {
      start = startDate || today;
      end = endDate || today;
      label = `Periode_${start}_sd_${end}`;
    }

    try {
      api.exportTeacherClassAttendanceExcel(className, {
        startDate: start,
        endDate: end,
        label,
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to export excel:', err);
      alert('Gagal mengekspor laporan Excel. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0e1424] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Ekspor Laporan Presensi Excel
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Format Komparasi Dual-Data (Wajah & KBM) Khusus Wali Kelas
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

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Target Class Info */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Kelas Perwalian:</span>
            </div>
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {className}
            </span>
          </div>

          {/* Period Selector Options */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Pilih Rentang Periode Laporan:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'daily', label: 'Harian' },
                { id: 'weekly', label: '7 Hari Terakhir' },
                { id: 'monthly', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriodType(opt.id as PeriodType)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer text-center ${
                    periodType === opt.id
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Period Inputs */}
          {periodType === 'daily' && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <label className="text-[11px] font-medium text-slate-400">Pilih Tanggal Presensi:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {periodType === 'weekly' && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              Mengekspor data 7 hari terakhir hingga hari ini (<span className="text-blue-400 font-mono">{today}</span>).
            </div>
          )}

          {periodType === 'monthly' && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              Mengekspor seluruh arsip kehadiran bulan berjalan secara komprehensif.
            </div>
          )}

          {periodType === 'custom' && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Tanggal Mulai:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Tanggal Selesai:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mt-1"
                />
              </div>
            </div>
          )}

          {/* Excel Structure Preview */}
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-xs text-slate-300 space-y-1.5">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Struktur Lembar Kerja (Sheets):</span>
            </div>
            <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5">
              <li>
                <b className="text-slate-200">Sheet 1 (Rekap Dual-Presensi)</b>: NIS, Nama Siswa, Tanggal, Jam Masuk/Pulang Wajah, Status Wajah, Status KBM, Sesi, dan Status Kesesuaian.
              </li>
              <li>
                <b className="text-slate-200">Sheet 2 (Temuan Diskrepansi)</b>: Lembar khusus jika terdapat ketidaksesuaian data (misal: scan wajah tapi Alpha di KBM).
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Berhasil Diunduh!</span>
              </>
            ) : isExporting ? (
              <span>Mengekspor...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
