import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Printer,
  CheckCircle2,
  Filter,
  Camera,
  BookOpen,
  Clock,
  Award,
  Users,
  Search,
  FileText,
} from 'lucide-react';
import {
  api,
  AttendanceRecord,
  KbmJournalRecord,
  ClassRoomCombination,
  AttendanceSummary,
} from '../services/api';

export const ReportsPage: React.FC = () => {
  const currentDate = new Date();
  const [activeTab, setActiveTab] = useState<'BIOMETRIC' | 'KBM'>('BIOMETRIC');

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [classRooms, setClassRooms] = useState<ClassRoomCombination[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [kbmJournals, setKbmJournals] = useState<KbmJournalRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const loadData = () => {
    const cr = api.getClassRooms(true);
    setClassRooms(cr);

    // Tab 1: Biometric face attendances
    const attList = api.getAttendances(monthStr, selectedClass);
    setAttendances(attList);

    // Tab 2: KBM journals
    const kbmList = api.getKbmJournals(selectedClass, monthStr);
    setKbmJournals(kbmList);

    api.getAttendanceSummary(selectedClass).then(setSummary).catch(() => {});
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('skh_db_updated', handleUpdate);
    window.addEventListener('skh_class_rooms_updated', handleUpdate);
    return () => {
      window.removeEventListener('skh_db_updated', handleUpdate);
      window.removeEventListener('skh_class_rooms_updated', handleUpdate);
    };
  }, [selectedMonth, selectedYear, selectedClass]);

  // Filtered attendances for Biometric Tab
  const filteredAttendances = useMemo(() => {
    if (!searchQuery.trim()) return attendances;
    const q = searchQuery.toLowerCase();
    return attendances.filter(
      a =>
        a.student_name.toLowerCase().includes(q) ||
        a.student_nickname.toLowerCase().includes(q) ||
        a.student_nis.toLowerCase().includes(q) ||
        a.class_name.toLowerCase().includes(q)
    );
  }, [attendances, searchQuery]);

  // Filtered KBM journals
  const filteredKbmJournals = useMemo(() => {
    if (!searchQuery.trim()) return kbmJournals;
    const q = searchQuery.toLowerCase();
    return kbmJournals.filter(
      j =>
        j.teacher_name.toLowerCase().includes(q) ||
        j.meeting_topic.toLowerCase().includes(q) ||
        j.class_name.toLowerCase().includes(q)
    );
  }, [kbmJournals, searchQuery]);

  // Export handlers
  const handleDownloadBiometricExcel = () => {
    api.exportAttendanceExcel(monthStr, selectedClass);
  };

  const handleDownloadKbmExcel = () => {
    api.exportKbmJournalExcel(monthStr, selectedClass);
  };

  const handlePrint = () => {
    window.print();
  };

  // KBM stats calculation
  const kbmStats = useMemo(() => {
    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpha = 0;

    filteredKbmJournals.forEach(j => {
      j.attendances?.forEach(a => {
        if (a.status === 'HADIR') totalHadir++;
        else if (a.status === 'IZIN') totalIzin++;
        else if (a.status === 'SAKIT') totalSakit++;
        else if (a.status === 'ALPHA') totalAlpha++;
      });
    });

    return {
      totalJournals: filteredKbmJournals.length,
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpha,
    };
  }, [filteredKbmJournals]);

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Laporan & Rekapitulasi Presensi Sekolah
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data terpisah murni antara Presensi Biometrik Wajah Gerbang dan Jurnal Pembelajaran KBM di Kelas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>

          {activeTab === 'BIOMETRIC' ? (
            <button
              onClick={handleDownloadBiometricExcel}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel Biometrik (.xlsx)</span>
            </button>
          ) : (
            <button
              onClick={handleDownloadKbmExcel}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel Jurnal KBM (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveTab('BIOMETRIC')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'BIOMETRIC'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Laporan Presensi Biometrik Wajah (Gerbang)</span>
          <span className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px]">
            {filteredAttendances.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('KBM')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === 'KBM'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Laporan Jurnal KBM & Presensi Kelas (Guru)</span>
          <span className="px-1.5 py-0.5 rounded bg-black/30 font-mono text-[10px]">
            {filteredKbmJournals.length}
          </span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl bg-slate-900/70 p-4 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Bulan */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Bulan Presensi:
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tahun */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Tahun:
          </label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Kelas */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            Filter Kelas:
          </label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">Semua Kelas</option>
            {classRooms.map(c => (
              <option key={c.id} value={c.display_name}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-400" />
            Pencarian Cepat:
          </label>
          <input
            type="text"
            placeholder={activeTab === 'BIOMETRIC' ? 'Cari nama / NIS siswa...' : 'Cari materi / guru...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* TAB 1: PRESENSI BIOMETRIK WAJAH GERBANG */}
      {activeTab === 'BIOMETRIC' && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">
                {filteredAttendances.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total Record Masuk</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {filteredAttendances.filter(a => a.status === 'HADIR').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Tepat Waktu</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                {filteredAttendances.filter(a => a.status === 'TERLAMBAT').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Terlambat</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-sky-400 font-mono">
                {filteredAttendances.filter(a => a.time_out).length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Sudah Presensi Pulang</div>
            </div>
          </div>

          {/* Table of Biometric Attendances */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Daftar Presensi Biometrik Wajah Gerbang ({monthStr})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Tabel database: <code className="text-blue-400">public.attendances</code>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4 text-center">Jam Masuk</th>
                    <th className="py-3 px-4 text-center">Jam Pulang</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Verifikasi Wajah</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                        Tidak ada catatan presensi biometrik untuk periode dan filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map(a => (
                      <tr key={a.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-300">{a.date}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{a.student_nis}</td>
                        <td className="py-3 px-4 font-medium text-white">{a.student_name}</td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] border border-slate-700">
                            {a.class_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-400">
                          {a.time_in || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold text-amber-400">
                          {a.time_out || (
                            <span className="text-slate-500 font-normal">Belum Pulang</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              a.status === 'HADIR'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-300">
                          <div className="inline-flex items-center gap-1">
                            <Award className="w-3 h-3 text-blue-400" />
                            <span>{Math.round(a.confidence_score * 100)}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                          {a.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JURNAL KBM & PRESENSI KELAS */}
      {activeTab === 'KBM' && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">
                {kbmStats.totalJournals}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total Agenda KBM</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {kbmStats.totalHadir}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Siswa Hadir KBM</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-sky-400 font-mono">
                {kbmStats.totalIzin}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Izin KBM</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                {kbmStats.totalSakit}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Sakit KBM</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xl sm:text-2xl font-bold text-rose-400 font-mono">
                {kbmStats.totalAlpha}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Alpha KBM</div>
            </div>
          </div>

          {/* Table of KBM Journals */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Daftar Jurnal Pembelajaran KBM di Kelas ({monthStr})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Tabel database: <code className="text-blue-400">public.kbm_journals</code>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Guru Pengajar</th>
                    <th className="py-3 px-4 text-center">Waktu Belajar</th>
                    <th className="py-3 px-4">Materi / Topik Pembelajaran</th>
                    <th className="py-3 px-4 text-center">Rekap Presensi KBM</th>
                    <th className="py-3 px-4">Catatan Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
                  {filteredKbmJournals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                        Tidak ada agenda pembelajaran KBM untuk periode dan filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredKbmJournals.map(j => {
                      const hadir = j.attendances?.filter(a => a.status === 'HADIR').length || 0;
                      const total = j.attendances?.length || 0;

                      return (
                        <tr key={j.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-mono text-slate-300">{j.date}</td>
                          <td className="py-3 px-4 text-slate-200 font-medium">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] border border-slate-700">
                              {j.class_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-white">{j.teacher_name}</td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-blue-400">
                            {j.start_time} - {j.end_time}
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-medium max-w-sm">
                            <div className="font-semibold text-white">{j.meeting_topic}</div>
                            {j.subject && (
                              <span className="text-[10px] text-slate-400">Mapel: {j.subject}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                              {hadir} / {total} Siswa
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                            {j.notes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
