import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Plus,
  Save,
  Trash2,
  Eye,
  Filter,
  Users,
  Search,
  School,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, Student, KbmJournalRecord, KbmAttendanceItem } from '../services/api';

export const KbmJournalPage: React.FC = () => {
  const { currentUser } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

  // Metadata KBM State
  const [selectedClass, setSelectedClass] = useState<string>(currentUser?.wali_kelas || 'Kelas 1 Autis');
  const [subject, setSubject] = useState<string>('Bina Diri & Kemandirian');
  const [customSubject, setCustomSubject] = useState<string>('');
  const [timeSlot, setTimeSlot] = useState<string>('Jam Ke-1 s/d 2 (07:30 - 09:00)');
  const [meetingTopic, setMeetingTopic] = useState<string>('');
  const [journalDate, setJournalDate] = useState<string>(todayStr);

  // Student Attendance State
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA'; notes: string }>>({});
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Journal History State
  const [historyJournals, setHistoryJournals] = useState<KbmJournalRecord[]>([]);
  const [selectedJournalDetail, setSelectedJournalDetail] = useState<KbmJournalRecord | null>(null);

  const predefinedSubjects = [
    'Bina Diri & Kemandirian',
    'Bahasa Indonesia',
    'Matematika Dasar',
    'Pendidikan Agama & Budi Pekerti',
    'Pendidikan Pancasila',
    'Seni Budaya & Keterampilan',
    'Pendidikan Jasmani (PJOK)',
    'Lainnya (Tulis Sendiri)',
  ];

  const timeSlots = [
    'Jam Ke-1 s/d 2 (07:30 - 09:00)',
    'Jam Ke-3 s/d 4 (09:15 - 10:45)',
    'Jam Ke-5 s/d 6 (11:00 - 12:30)',
    'Jam Ke-7 s/d 8 (13:00 - 14:30)',
  ];

  const classList = ['Kelas 1 Autis', 'Kelas 2 Tunarungu', 'Kelas 3 Tunagrahita'];

  // Load students when selectedClass changes
  useEffect(() => {
    setIsLoadingStudents(true);
    api.getStudents(selectedClass).then(list => {
      setClassStudents(list);
      // Initialize attendance map with HADIR default
      const initialMap: Record<string, { status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA'; notes: string }> = {};
      list.forEach(s => {
        initialMap[s.id] = { status: 'HADIR', notes: '' };
      });
      setAttendanceMap(initialMap);
      setIsLoadingStudents(false);
    });
  }, [selectedClass]);

  // Load journal history
  const fetchJournals = () => {
    const list = api.getKbmJournals();
    setHistoryJournals(list);
  };

  useEffect(() => {
    fetchJournals();
    const handleUpdate = () => fetchJournals();
    window.addEventListener('skh_kbm_updated', handleUpdate);
    return () => window.removeEventListener('skh_kbm_updated', handleUpdate);
  }, []);

  const handleStatusChange = (studentId: string, status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA') => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  const markAllStatus = (status: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA') => {
    setAttendanceMap(prev => {
      const updated: typeof prev = {};
      classStudents.forEach(s => {
        updated[s.id] = {
          status,
          notes: prev[s.id]?.notes || '',
        };
      });
      return updated;
    });
  };

  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTopic.trim()) {
      alert('Harap isi Catatan Topik / Pembahasan Pertemuan KBM.');
      return;
    }

    const finalSubject = subject === 'Lainnya (Tulis Sendiri)' ? customSubject.trim() : subject;
    if (!finalSubject) {
      alert('Harap tentukan Mata Pelajaran.');
      return;
    }

    setIsSaving(true);
    try {
      const attendances: KbmAttendanceItem[] = classStudents.map(s => ({
        student_id: s.id,
        student_name: s.full_name,
        nis: s.nis,
        status: attendanceMap[s.id]?.status || 'HADIR',
        notes: attendanceMap[s.id]?.notes || '',
      }));

      await api.saveKbmJournal({
        date: journalDate,
        time_slot: timeSlot,
        subject: finalSubject,
        class_name: selectedClass,
        teacher_id: currentUser?.id || 'guru-anon',
        teacher_name: currentUser?.full_name || 'Guru Pengampu',
        meeting_topic: meetingTopic.trim(),
        attendances,
      });

      setSaveSuccessMsg(`Jurnal KBM untuk kelas ${selectedClass} (${finalSubject}) berhasil disimpan!`);
      setMeetingTopic('');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      fetchJournals();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan jurnal KBM.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJournal = async (id: string) => {
    if (confirm('Hapus arsip jurnal KBM ini?')) {
      await api.deleteKbmJournal(id);
      fetchJournals();
      if (selectedJournalDetail?.id === id) {
        setSelectedJournalDetail(null);
      }
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Absensi Kelas & Jurnal KBM
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Guru / Kepsek
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pencatatan kegiatan belajar mengajar dan verifikasi status presensi siswa per pertemuan
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Guru Aktif:</span>
            <span className="font-semibold text-slate-200">{currentUser.full_name}</span>
          </div>
        )}
      </div>

      {saveSuccessMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Journal Form Section */}
      <form onSubmit={handleSubmitJournal} className="p-5 sm:p-6 rounded-lg bg-slate-900/60 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>Formulir Pengisian Jurnal Pertemuan</span>
          </div>
          <span className="text-xs text-slate-400">Semua data otomatis tersinkronisasi ke presensi harian</span>
        </div>

        {/* Metadata Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kelas</label>
            <select
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              {classList.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Mata Pelajaran */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mata Pelajaran</label>
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              {predefinedSubjects.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {subject === 'Lainnya (Tulis Sendiri)' && (
              <input
                type="text"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="Ketik nama mata pelajaran..."
                className="w-full mt-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          {/* Jam Pelajaran */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Jam Ke- / Waktu</label>
            <select
              value={timeSlot}
              onChange={e => setTimeSlot(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              {timeSlots.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tanggal Pelaksanaan</label>
            <input
              type="date"
              value={journalDate}
              onChange={e => setJournalDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Catatan Topik / Pembahasan */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Materi / Topik Pembahasan & Catatan Pertemuan <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={3}
            value={meetingTopic}
            onChange={e => setMeetingTopic(e.target.value)}
            placeholder="Contoh: Pembelajaran bina diri cara menggosok gigi mandiri dan mencuci tangan dengan sabun. Siswa merespons instruksi visual dengan baik."
            required
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Student Checklist Area */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Presensi Siswa ({selectedClass}) • {classStudents.length} Siswa Terdaftar
              </h4>
              <p className="text-[11px] text-slate-400">Verifikasi status kehadiran masing-masing siswa pada jam pelajaran ini</p>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Tandai Cepat:</span>
              <button
                type="button"
                onClick={() => markAllStatus('HADIR')}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition"
              >
                Semua Hadir
              </button>
              <button
                type="button"
                onClick={() => markAllStatus('IZIN')}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
              >
                Semua Izin
              </button>
            </div>
          </div>

          {isLoadingStudents ? (
            <div className="p-8 text-center text-xs text-slate-400">Memuat daftar siswa...</div>
          ) : classStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 rounded-lg bg-slate-950/40 border border-slate-800">
              Belum ada siswa terdaftar pada {selectedClass}. Daftarkan siswa melalui menu Admin.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3.5">Nama Siswa</th>
                    <th className="py-2.5 px-3.5">Kebutuhan Khusus</th>
                    <th className="py-2.5 px-3.5 text-center">Status Kehadiran</th>
                    <th className="py-2.5 px-3.5">Catatan Khusus (Opsional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {classStudents.map(student => {
                    const current = attendanceMap[student.id] || { status: 'HADIR', notes: '' };
                    return (
                      <tr key={student.id} className="hover:bg-slate-800/30 transition">
                        {/* Student Name */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
                              {student.nickname?.charAt(0) || student.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-100">{student.full_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">NIS: {student.nis}</div>
                            </div>
                          </div>
                        </td>

                        {/* Special Needs Category */}
                        <td className="py-3 px-3.5">
                          <span className="text-slate-300">{student.category}</span>
                        </td>

                        {/* Status Radio Buttons */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center justify-center gap-1">
                            {(['HADIR', 'IZIN', 'SAKIT', 'ALPHA'] as const).map(st => {
                              const isSelected = current.status === st;
                              let activeClass = '';
                              if (isSelected) {
                                if (st === 'HADIR') activeClass = 'bg-emerald-600 text-white font-semibold shadow-xs';
                                if (st === 'IZIN') activeClass = 'bg-blue-600 text-white font-semibold shadow-xs';
                                if (st === 'SAKIT') activeClass = 'bg-amber-600 text-white font-semibold shadow-xs';
                                if (st === 'ALPHA') activeClass = 'bg-rose-600 text-white font-semibold shadow-xs';
                              } else {
                                activeClass = 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800';
                              }

                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleStatusChange(student.id, st)}
                                  className={`px-2.5 py-1 rounded text-[11px] transition ${activeClass}`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-3.5">
                          <input
                            type="text"
                            value={current.notes}
                            onChange={e => handleNotesChange(student.id, e.target.value)}
                            placeholder="Catatan keaktifan siswa..."
                            className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSaving || classStudents.length === 0}
            className="py-2.5 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan Jurnal...' : 'Simpan & Rekap Jurnal KBM'}</span>
          </button>
        </div>
      </form>

      {/* History of KBM Journals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Arsip & Riwayat Jurnal KBM</h3>
            <p className="text-xs text-slate-400">Daftar jurnal kegiatan belajar mengajar yang telah diarsipkan</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{historyJournals.length} Catatan Tersimpan</span>
        </div>

        {historyJournals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 rounded-lg bg-slate-900/40 border border-slate-800">
            Belum ada arsip jurnal KBM. Catat pertemuan pertama menggunakan formulir di atas.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Tanggal & Waktu</th>
                  <th className="py-2.5 px-3.5">Kelas & Mapel</th>
                  <th className="py-2.5 px-3.5">Guru Pengampu</th>
                  <th className="py-2.5 px-3.5">Materi / Topik</th>
                  <th className="py-2.5 px-3.5 text-center">Rekap Kehadiran</th>
                  <th className="py-2.5 px-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {historyJournals.map(j => {
                  const hadir = j.attendances.filter(a => a.status === 'HADIR').length;
                  const izin = j.attendances.filter(a => a.status === 'IZIN').length;
                  const sakit = j.attendances.filter(a => a.status === 'SAKIT').length;
                  const alpha = j.attendances.filter(a => a.status === 'ALPHA').length;

                  return (
                    <tr key={j.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-200">{j.date}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{j.time_slot}</div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-blue-400">{j.subject}</div>
                        <div className="text-[11px] text-slate-400">{j.class_name}</div>
                      </td>

                      <td className="py-3 px-3.5 text-slate-300">{j.teacher_name}</td>

                      <td className="py-3 px-3.5 max-w-xs">
                        <p className="text-slate-300 truncate" title={j.meeting_topic}>
                          {j.meeting_topic}
                        </p>
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold">
                            H: {hadir}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                            I: {izin}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            S: {sakit}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">
                            A: {alpha}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedJournalDetail(j)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 inline-flex items-center gap-1 transition"
                          >
                            <Eye className="w-3 h-3 text-blue-400" />
                            <span>Rincian</span>
                          </button>
                          <button
                            onClick={() => handleDeleteJournal(j.id)}
                            className="p-1 rounded bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-900/50 transition"
                            title="Hapus jurnal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Journal Detail Modal */}
      {selectedJournalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0e1424] border border-slate-800 rounded-lg shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Rincian Jurnal KBM: {selectedJournalDetail.subject}
                </h4>
                <p className="text-xs text-slate-400">
                  {selectedJournalDetail.class_name} • {selectedJournalDetail.date} ({selectedJournalDetail.time_slot})
                </p>
              </div>
              <button
                onClick={() => setSelectedJournalDetail(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 block mb-1">Materi & Topik Pembahasan:</span>
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedJournalDetail.meeting_topic}</p>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase">
                    <th className="py-2 px-3">Nama Siswa</th>
                    <th className="py-2 px-3">NIS</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedJournalDetail.attendances.map(a => (
                    <tr key={a.student_id} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-semibold text-slate-200">{a.student_name}</td>
                      <td className="py-2 px-3 font-mono text-slate-400">{a.nis}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'HADIR'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : a.status === 'IZIN'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : a.status === 'SAKIT'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{a.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedJournalDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
