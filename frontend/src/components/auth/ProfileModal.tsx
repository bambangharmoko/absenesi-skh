import React, { useState, useEffect } from 'react';
import { User, CreditCard, School, Lock, X, Check, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, ClassRoomCombination } from '../../services/api';

export const ProfileModal: React.FC = () => {
  const { currentUser, isProfileModalOpen, closeProfileModal, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [waliKelas, setWaliKelas] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [availableClasses, setAvailableClasses] = useState<ClassRoomCombination[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setNuptk(currentUser.nuptk || '');
      setWaliKelas(currentUser.wali_kelas || '');
      setNewPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);

      const fetchClasses = () => {
        const list = api.getClassRooms(true);
        setAvailableClasses(list);
      };
      fetchClasses();

      const handleClassUpdate = () => fetchClasses();
      window.addEventListener('skh_class_rooms_updated', handleClassUpdate);
      return () => window.removeEventListener('skh_class_rooms_updated', handleClassUpdate);
    }
  }, [currentUser, isProfileModalOpen]);

  if (!isProfileModalOpen || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Nama lengkap tidak boleh kosong.');
      return;
    }

    setIsSaving(true);
    try {
      await api.updateUserProfile(currentUser.id, {
        full_name: fullName.trim(),
        nuptk: nuptk.trim(),
        wali_kelas: waliKelas,
        password: newPassword.trim() ? newPassword.trim() : undefined,
      });

      refreshUser();
      setSuccessMsg('Profil & penugasan Wali Kelas berhasil diperbarui!');
      setTimeout(() => {
        setSuccessMsg(null);
        closeProfileModal();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-[#0e1424] border border-slate-800 rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Pengaturan Profil & Akun</h3>
              <p className="text-[11px] text-slate-400 font-mono">@{currentUser.username}</p>
            </div>
          </div>
          <button
            onClick={closeProfileModal}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Role Badge */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-xs">
            <span className="text-slate-400">Peran Sistem:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                currentUser.role === 'KEPALA_SEKOLAH'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : currentUser.role === 'ADMIN'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {currentUser.role}
            </span>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap & Gelar</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* NUPTK */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">NUPTK / NIP</label>
            <div className="relative">
              <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nuptk}
                onChange={e => setNuptk(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Wali Kelas Selection - ONLY FOR GURU & KEPALA SEKOLAH */}
          {currentUser.role === 'GURU' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Penugasan Wali Kelas
                </label>
                <span className="text-[10px] text-blue-400 font-medium">Kombinasi Kelas + Ruangan</span>
              </div>
              <div className="relative">
                <School className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={waliKelas}
                  onChange={e => setWaliKelas(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition appearance-none"
                >
                  <option value="">Bukan Wali Kelas (Hanya Guru Pengajar Mapel)</option>
                  {availableClasses.map(cr => (
                    <option key={cr.id} value={cr.display_name}>
                      {cr.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Pilih kombinasi Tingkat Kelas dan Nama Ruangan yang telah ditetapkan oleh Kepala Sekolah.
              </p>
            </div>
          )}

          {/* Optional Password Update */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ganti Password (Kosongkan jika tidak ingin diubah)
            </label>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-8 pr-9 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition" tabIndex={-1}>
                {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeProfileModal}
              className="py-2 px-4 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="py-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
