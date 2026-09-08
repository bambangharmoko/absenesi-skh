import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  User,
  Lock,
  CreditCard,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  KeyRound,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api, UserRole } from '../../services/api';
import { otpService, TARGET_KEPSEK_EMAIL } from '../../services/otpService';

export const RegisterModal: React.FC = () => {
  const { isRegisterModalOpen, closeRegisterModal, openLoginModal, setCurrentUserDirectly } = useAuth();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [nuptk, setNuptk] = useState('');
  const [role, setRole] = useState<UserRole>('GURU');
  const [email, setEmail] = useState(TARGET_KEPSEK_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP Verification state for Kepala Sekolah
  const [step, setStep] = useState<'FORM' | 'OTP_VERIFY'>('FORM');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer countdown for resending OTP
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  if (!isRegisterModalOpen) return null;

  const handleReset = () => {
    setUsername('');
    setFullName('');
    setNuptk('');
    setRole('GURU');
    setEmail(TARGET_KEPSEK_EMAIL);
    setPassword('');
    setConfirmPassword('');
    setStep('FORM');
    setOtpCode('');
    setErrorMsg(null);
    setIsSuccess(false);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setOtpCountdown(0);
  };

  const handleClose = () => {
    handleReset();
    closeRegisterModal();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Common validations
    if (!username.trim() || !fullName.trim() || !nuptk.trim() || !password) {
      setErrorMsg('Semua field wajib diisi.');
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

    // Role: KEPALA_SEKOLAH requires OTP verification
    if (role === 'KEPALA_SEKOLAH') {
      const targetEmail = email.trim() || TARGET_KEPSEK_EMAIL;
      setIsSendingOtp(true);
      try {
        const res = await otpService.sendOtp(targetEmail, fullName.trim());
        if (!res.success) {
          setErrorMsg(res.error || res.message || 'Gagal mengirimkan kode OTP ke email.');
          return;
        }
        setStep('OTP_VERIFY');
        setOtpCountdown(60);
      } catch (err: any) {
        setErrorMsg(err.message || 'Gagal mengirimkan kode OTP ke email.');
      } finally {
        setIsSendingOtp(false);
      }
      return;
    }

    // Role: GURU or ADMIN (Registered with PENDING status)
    setIsSubmitting(true);
    try {
      await api.registerUser({
        username: username.trim(),
        full_name: fullName.trim(),
        nuptk: nuptk.trim(),
        role,
        password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mendaftar akun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCountdown > 0) return;
    setErrorMsg(null);
    setIsSendingOtp(true);
    try {
      const res = await otpService.sendOtp(email.trim() || TARGET_KEPSEK_EMAIL, fullName.trim());
      if (!res.success) {
        setErrorMsg(res.error || res.message || 'Gagal mengirim ulang OTP.');
        return;
      }
      setOtpCountdown(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim ulang OTP.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (otpCode.trim().length !== 6) {
      setErrorMsg('Masukkan 6 digit kode OTP yang diterima di email.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const targetEmail = email.trim() || TARGET_KEPSEK_EMAIL;
      const verifyRes = await otpService.verifyOtp(targetEmail, otpCode.trim());

      if (!verifyRes.success) {
        setErrorMsg(verifyRes.error || 'Kode OTP salah atau telah kedaluwarsa.');
        setIsVerifyingOtp(false);
        return;
      }

      // Auto-verified & Auto-approved registration for Kepala Sekolah
      const newAccount = await api.registerUser({
        username: username.trim(),
        full_name: fullName.trim(),
        nuptk: nuptk.trim(),
        role: 'KEPALA_SEKOLAH',
        email: targetEmail,
        password,
        is_verified_otp: true,
      });

      // Automatically log the Kepala Sekolah in directly!
      setCurrentUserDirectly(newAccount);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memverifikasi kode OTP.');
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0e1424] border border-slate-800 rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header - EXACT SPEC: ONLY "Admin, Guru, dan Kepala Sekolah" */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">Admin, Guru, dan Kepala Sekolah</h3>
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
            /* Success View for Admin / Guru */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-300">Pendaftaran Berhasil Dikirim!</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Akun dengan username <strong className="text-white font-mono">{username}</strong> telah terdaftar dengan status <span className="inline-block px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">PENDING APPROVAL</span>.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Sesuai kebijakan keamanan, akun Anda menunggu persetujuan (approval) oleh Kepala Sekolah sebelum dapat masuk ke sistem.
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
          ) : step === 'OTP_VERIFY' ? (
            /* STEP 2: OTP VERIFICATION VIEW FOR KEPALA SEKOLAH */
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4 py-1">
              <div className="p-4 rounded-lg bg-blue-950/40 border border-blue-500/25 text-left space-y-2">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                  <KeyRound className="w-4 h-4" />
                  <span>Verifikasi OTP Gmail Kepala Sekolah</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Kami telah mengirimkan 6-digit kode OTP ke alamat email:{' '}
                  <strong className="text-white font-mono">{email}</strong>.
                </p>
                <p className="text-[11px] text-slate-400">
                  Periksa kotak masuk (inbox) atau folder spam email Anda.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  Masukkan 6 Digit Kode OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  required
                  className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Tidak menerima kode?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={otpCountdown > 0 || isSendingOtp}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1 font-medium transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isSendingOtp ? 'animate-spin' : ''}`} />
                  <span>{otpCountdown > 0 ? `Kirim ulang (${otpCountdown}s)` : 'Kirim Ulang OTP'}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep('FORM')}
                  className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
                >
                  Kembali ke Form
                </button>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="py-2 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isVerifyingOtp ? 'Memverifikasi...' : 'Verifikasi & Masuk Langsung'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 1: INITIAL REGISTRATION FORM */
            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              {role === 'KEPALA_SEKOLAH' ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-300 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Pendaftaran Kepala Sekolah diverifikasi secara otomatis melalui kode OTP Gmail ke{' '}
                    <strong>{TARGET_KEPSEK_EMAIL}</strong> dan akan <strong>langsung aktif (APPROVED)</strong>.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/20 flex items-start gap-2.5 text-blue-300 text-xs">
                  <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Akun Guru dan Admin yang didaftarkan berstatus <strong>Pending</strong> dan memerlukan persetujuan Kepala Sekolah.
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>{errorMsg}</div>
                </div>
              )}

              {/* Role Selection - 3 Options: Guru, Admin, Kepala Sekolah */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Peran Akun (Role)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('GURU')}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition text-center ${
                      role === 'GURU'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Guru
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('ADMIN')}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition text-center ${
                      role === 'ADMIN'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('KEPALA_SEKOLAH')}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition text-center ${
                      role === 'KEPALA_SEKOLAH'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Kepala Sekolah
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
                      placeholder={role === 'KEPALA_SEKOLAH' ? 'contoh: kepsek_bambang' : 'contoh: guru_ani'}
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
                    placeholder={role === 'KEPALA_SEKOLAH' ? 'Bambang Harmoko, M.Pd' : 'Ani Suryani, S.Pd'}
                    required
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* NUPTK & (Email for Kepsek) */}
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

                {role === 'KEPALA_SEKOLAH' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Tujuan OTP <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 transition"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden sm:block">
                    {/* Placeholder space for clean grid alignment when email is not needed */}
                    <div className="h-full flex items-end pb-2">
                      <span className="text-[11px] text-slate-500 italic">
                        Penugasan Wali Kelas dapat diatur setelah akun aktif melalui Pengaturan Akun.
                      </span>
                    </div>
                  </div>
                )}
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
                  disabled={isSubmitting || isSendingOtp}
                  className={`py-2 px-5 rounded-lg text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 ${
                    role === 'KEPALA_SEKOLAH'
                      ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
                  }`}
                >
                  {role === 'KEPALA_SEKOLAH' ? (
                    <>
                      <span>{isSendingOtp ? 'Mengirim OTP...' : 'Lanjut Verifikasi OTP'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <span>{isSubmitting ? 'Mendaftarkan...' : 'Ajukan Pendaftaran'}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
