import React, { useState } from 'react';
import { UserPlus, User, Lock, CreditCard, School, CheckCircle2, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, UserRole } from '../../services/api';

export const RegisterModal: React.FC = () => {
  const { isRegisterModalOpen, closeRegisterModal, openLoginModal } = useAuth();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [role, setRole] = useState<UserRole>('GURU');
  const [waliKelas, setWaliKelas] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isRegisterModalOpen) return null;

  const handleReset = () => {
    setUsername('');
    setFullName('');
    setNuptk('');
    setRole('GURU');
    setWaliKelas('');
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setIsSuccess(false);
  };

  const handleClose = () => {
    handleReset();
    closeRegisterModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!username.trim() || !fullName.trim() || !nuptk.trim() || !password) {
      setErrorMsg('Semua field wajib diisi (kecuali Wali Kelas jika bukan wali kelas).');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password minimal terdiri dari 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.registerUser({
        username: username.trim(),
        full_name: fullName.trim(),
        nuptk: nuptk.trim(),
        role,
        wali_kelas: waliKelas,
        password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mendaftar akun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const classOptions = [
    { value: '', label: 'Bukan Wali Kelas / Tidak Ada' },
    { value: 'Kelas 1 Autis', label: 'Kelas 1 Autis' },
    { value: 'Kelas 2 Tunarungu', label: 'Kelas 2 Tunarungu' },
    { value: 'Kelas 3 Tunagrahita', label: 'Kelas 3 Tunagrahita' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0e1424] border border-slate-800 rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Registrasi Akun Baru</h3>
              <p className="text-[11px] text-slate-400">Pendaftaran Admin & Guru SKH</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {isSuccess ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-300">Pendaftaran Berhasil Dikirim!</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Akun dengan username <strong className="text-white font-mono">{username}</strong> telah terdaftar dengan status <span className="inline-block px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">PENDING APPROVAL</span>.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Sesuai kebijakan keamanan, akun Anda belum bisa langsung digunakan untuk login sebelum disetujui (*di-approve*) oleh Kepala Sekolah. Silakan informasikan pendaftaran ini kepada Kepala Sekolah.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    openLoginModal();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition"
                >
                  Kembali ke Halaman Login
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Approval Notice Banner */}
              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/20 flex items-start gap-2.5 text-blue-300 text-xs">
                <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Akun yang didaftarkan akan berstatus <strong>Pending</strong> dan memerlukan persetujuan langsung dari Kepala Sekolah sebelum dapat masuk ke sistem.
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Peran Akun (Role)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('GURU')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center ${
                      role === 'GURU'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Guru Kelas / Mapel
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('ADMIN')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center ${
                      role === 'ADMIN'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Admin Presensi & Siswa
                  </button>
                </div>
              </div>

              {/* Username & Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))}
                      placeholder="contoh: guru_ani"
                      required
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nama Lengkap & Gelar <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="contoh: Ani Suryani, S.Pd"
                    required
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* NUPTK & Wali Kelas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    NUPTK / NIP <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={nuptk}
                      onChange={e => setNuptk(e.target.value)}
                      placeholder="16 digit angka NUPTK"
                      required
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Wali Kelas (Opsional)
                  </label>
                  <div className="relative">
                    <School className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
                      value={waliKelas}
                      onChange={e => setWaliKelas(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition appearance-none"
                    >
                      {classOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      required
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Konfirmasi Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      required
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    openLoginModal();
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  Sudah punya akun? Masuk
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Mendaftarkan...' : 'Ajukan Pendaftaran'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
