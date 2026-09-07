import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, Camera, UserCheck, Edit3, X, Check, AlertCircle } from 'lucide-react';
import { api, Student } from '../services/api';
import { db } from '../services/db';

interface StudentsPageProps {
  onNavigate: (page: 'kiosk' | 'dashboard' | 'students' | 'register' | 'reports') => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({ onNavigate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit Student Modal States
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState({
    nis: '',
    full_name: '',
    nickname: '',
    class_name: '',
    category: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      const data = await api.getStudents(selectedClass, searchTerm);
      setStudents(data);
    } catch (err) {
      console.warn('Fetch students error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    // Event listener saat ada perubahan lokal / realtime dari Supabase
    const handleDbUpdate = () => {
      fetchStudents();
    };
    window.addEventListener('skh_db_updated', handleDbUpdate);

    // Heartbeat auto-sync setiap 4 detik: memastikan jika ada data dihapus/diubah di laptop,
    // tampilan di HP otomatis ter-update seketika tanpa perlu refresh manual
    const interval = setInterval(async () => {
      await db.syncFromSupabase();
      fetchStudents();
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('skh_db_updated', handleDbUpdate);
    };
  }, [selectedClass, searchTerm]);

  const handleDelete = async (studentId: string) => {
    try {
      await api.deleteStudent(studentId);
      setDeleteConfirmId(null);
      fetchStudents();
    } catch (err: unknown) {
      alert((err as Error).message || 'Gagal menghapus siswa');
    }
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      nis: student.nis,
      full_name: student.full_name,
      nickname: student.nickname,
      class_name: student.class_name,
      category: student.category || 'Umum',
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      await api.updateStudent(editingStudent.id, editFormData);
      setEditingStudent(null);
      fetchStudents();
    } catch (err: unknown) {
      setEditError((err as Error).message || 'Gagal menyimpan perubahan profil siswa.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Data Siswa & Pendaftaran Wajah
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Kelola profil siswa SKH dan vektor embedding pengenalan wajah
          </p>
        </div>

        <button
          onClick={() => onNavigate('register')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Daftar Siswa Baru (Pose Wajah AI)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Cari nama, panggilan, NIS..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 transition"
        >
          <option value="all">Semua Kelas SKH</option>
          <option value="Kelas 1 Autis">Kelas 1 Autis</option>
          <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
          <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
        </select>
      </div>

      {/* Student Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Memuat data siswa...</div>
      ) : students.length === 0 ? (
        <div className="py-16 text-center rounded-3xl glass-panel border border-slate-800 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-base font-semibold text-slate-300">Belum ada siswa terdaftar</p>
          <p className="text-xs text-slate-500 mt-1">
            Klik tombol "Daftar Siswa Baru" untuk mendaftarkan siswa dengan pemindaian wajah.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {students.map(student => (
            <div
              key={student.id}
              className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-slate-700 flex flex-col justify-between transition group"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3.5">
                    {/* Face Photo */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center font-black text-emerald-400 text-xl shadow-md">
                      {student.latest_photo ? (
                        <img
                          src={student.latest_photo}
                          alt={student.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        student.nickname.charAt(0)
                      )}
                    </div>

                    <div>
                      <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                        {student.full_name}
                      </h4>
                      <div className="text-xs font-semibold text-emerald-400">
                        Nama Panggilan: "{student.nickname}"
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">NIS: {student.nis}</div>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(student)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                      title="Ubah Data Siswa"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(student.id)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Hapus Siswa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 py-3 border-y border-slate-800/80 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kelas:</span>
                    <span className="font-semibold text-slate-200">{student.class_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kebutuhan Khusus:</span>
                    <span className="font-semibold text-slate-200">{student.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vektor Wajah Terdaftar:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      {student.photo_count || 1} Sampel Embedding
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between pt-4 mt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-3 h-3" />
                  Aktif Presensi
                </span>
                <span className="text-[10px] text-slate-500">
                  Terdaftar {new Date(student.created_at).toLocaleDateString('id-ID')}
                </span>
              </div>

              {/* Delete Modal Confirmation */}
              {deleteConfirmId === student.id && (
                <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 animate-fadeIn">
                  <div className="font-bold mb-1">Konfirmasi Hapus Siswa?</div>
                  <p className="text-[11px] text-rose-300/80 mb-3">
                    Seluruh riwayat presensi dan data vektor wajah siswa ini akan dihapus permanen dari Supabase Cloud.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleDelete(student.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                    >
                      Ya, Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Ubah Data Siswa</h3>
                  <p className="text-xs text-slate-400">Perubahan akan langsung tersimpan di Supabase Cloud</p>
                </div>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nomor Induk Siswa (NIS) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.nis}
                  onChange={e => setEditFormData({ ...editFormData, nis: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Lengkap <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Panggilan <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.nickname}
                    onChange={e => setEditFormData({ ...editFormData, nickname: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kelas SKH
                  </label>
                  <select
                    value={editFormData.class_name}
                    onChange={e => setEditFormData({ ...editFormData, class_name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="Kelas 1 Autis">Kelas 1 Autis</option>
                    <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
                    <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kategori Kebutuhan Khusus
                  </label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                    placeholder="Contoh: Autis, Tunarungu, Umum"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
