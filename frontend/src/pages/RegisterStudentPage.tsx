import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  User,
  ShieldAlert,
  Scan,
  Check,
  Play,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import { faceApi, HeadPose } from '../services/faceApi';
import { audioFeedback } from '../components/kiosk/AudioFeedback';
import confetti from 'canvas-confetti';

interface RegisterStudentPageProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface PoseTarget {
  id: 'CENTER' | 'RIGHT' | 'LEFT' | 'UP';
  label: string;
  instruction: string;
  tip: string;
  icon: string;
}

// 4 Sudut Minimalis: Depan, Kanan, Kiri, dan Atas
const POSE_TARGETS: PoseTarget[] = [
  {
    id: 'CENTER',
    label: 'Depan',
    instruction: 'Tatap lurus ke arah kamera',
    tip: 'Posisikan wajah di tengah lingkaran',
    icon: '🎯',
  },
  {
    id: 'RIGHT',
    label: 'Kanan',
    instruction: 'Tolehkan kepala ke kanan perlahan',
    tip: 'Putar sedikit ke arah kanan',
    icon: '👉',
  },
  {
    id: 'LEFT',
    label: 'Kiri',
    instruction: 'Tolehkan kepala ke kiri perlahan',
    tip: 'Putar sedikit ke arah kiri',
    icon: '👈',
  },
  {
    id: 'UP',
    label: 'Atas',
    instruction: 'Dongakkan kepala sedikit ke atas',
    tip: 'Angkat dagu perlahan',
    icon: '👆',
  },
];

export const RegisterStudentPage: React.FC<RegisterStudentPageProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<number>(1);
  const [formData, setFormData] = useState({
    nis: '',
    full_name: '',
    nickname: '',
    class_name: 'Kelas 1 Autis',
    category: 'Autism Spectrum',
  });

  // Face ID Minimalist States
  const [isFaceIdMode, setIsFaceIdMode] = useState<boolean>(true);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0);
  const [capturedSamples, setCapturedSamples] = useState<
    Record<string, { photo: string; descriptor: Float32Array; pose: string }>
  >({});
  const [liveHeadPose, setLiveHeadPose] = useState<HeadPose | null>(null);

  // Manual fallback photos (4 angles)
  const [manualPhotos, setManualPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Webcam references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          try {
            track.stop();
            track.enabled = false;
          } catch (e) {}
        });
        videoRef.current.srcObject = null;
      }
      try {
        videoRef.current.pause();
      } catch (e) {}
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.log('Video play:', playErr);
        }
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera error in registration:', err);
      setIsCameraActive(false);
      setErrorMsg('Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan atau gunakan tombol Upload File.');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (step === 2) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, startCamera, stopCamera]);

  // =========================================================================
  // MINIMALIST AUTOMATIC FACE SCANNING LOOP (4 ANGLES)
  // =========================================================================

  const handleStart3dScan = () => {
    setCapturedSamples({});
    setScanProgress(0);
    setCurrentPromptIndex(0);
    setIsScanningActive(true);
    audioFeedback.speakText(
      `Halo ${formData.nickname || 'Siswa'}, mari kita mulai pemindaian wajah. Tatap lurus ke arah lingkaran kamera ya.`
    );
  };

  const handleResetScan = () => {
    setCapturedSamples({});
    setScanProgress(0);
    setCurrentPromptIndex(0);
    setIsScanningActive(false);
    setLiveHeadPose(null);
  };

  useEffect(() => {
    if (step !== 2 || !isScanningActive || !isCameraActive) return;

    let isProcessingFrame = false;

    const interval = setInterval(async () => {
      if (isProcessingFrame) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

      isProcessingFrame = true;

      try {
        const detection = await faceApi.detectFaceWithPose(video);

        if (detection) {
          const { headPose, descriptor } = detection;
          setLiveHeadPose(headPose);

          // Check if current target pose matches
          const currentTarget = POSE_TARGETS[currentPromptIndex];
          if (currentTarget) {
            let isPoseMatched = false;

            if (currentTarget.id === 'CENTER' && headPose.poseCategory === 'CENTER') {
              isPoseMatched = true;
            } else if (currentTarget.id === 'RIGHT' && (headPose.poseCategory === 'RIGHT' || headPose.yaw > 10)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'LEFT' && (headPose.poseCategory === 'LEFT' || headPose.yaw < -10)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'UP' && (headPose.poseCategory === 'UP' || headPose.pitch > 8)) {
              isPoseMatched = true;
            }

            if (isPoseMatched && !capturedSamples[currentTarget.id]) {
              // Capture high-res snapshot
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const cctx = canvas.getContext('2d');
              let photoData = '';
              if (cctx) {
                cctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                photoData = canvas.toDataURL('image/jpeg', 0.9);
              }

              const newSamples = {
                ...capturedSamples,
                [currentTarget.id]: {
                  photo: photoData,
                  descriptor: descriptor,
                  pose: currentTarget.label,
                },
              };

              setCapturedSamples(newSamples);
              audioFeedback.playCelebrationChime();

              const completedCount = Object.keys(newSamples).length;
              const newProgress = Math.round((completedCount / POSE_TARGETS.length) * 100);
              setScanProgress(newProgress);

              if (completedCount < POSE_TARGETS.length) {
                const nextIdx = currentPromptIndex + 1;
                setCurrentPromptIndex(nextIdx);
                const nextTarget = POSE_TARGETS[nextIdx];
                audioFeedback.speakText(nextTarget.instruction);
              } else {
                // All 4 poses captured!
                setIsScanningActive(false);
                confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
                audioFeedback.speakText(
                  `Hebat sekali! Pemindaian wajah telah selesai. Data wajah ${formData.nickname || 'siswa'} siap didaftarkan.`
                );
                // Auto proceed to review after 1.2s
                setTimeout(() => setStep(3), 1200);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Scan frame error:', err);
      } finally {
        isProcessingFrame = false;
      }
    }, 140);

    return () => clearInterval(interval);
  }, [step, isScanningActive, isCameraActive, currentPromptIndex, capturedSamples, formData.nickname]);

  // Fallback Single Manual Capture
  const handleManualCapture = (idx: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const updated = [...manualPhotos];
    updated[idx] = dataUrl;
    setManualPhotos(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const updated = [...manualPhotos];
      updated[idx] = reader.result as string;
      setManualPhotos(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    if (!formData.nis.trim() || !formData.full_name.trim() || !formData.nickname.trim()) {
      setErrorMsg('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan pada Langkah 1.');
      setStep(1);
      setIsSubmitting(false);
      return;
    }

    try {
      const data = new FormData();
      data.append('nis', formData.nis.trim());
      data.append('full_name', formData.full_name.trim());
      data.append('nickname', formData.nickname.trim());
      data.append('class_name', formData.class_name);
      data.append('category', formData.category.trim() || 'Umum');

      if (isFaceIdMode) {
        const samples = Object.values(capturedSamples)
          .filter(s => s.photo)
          .map(s => ({
            pose_label: s.pose,
            photo_data: s.photo,
            descriptor: s.descriptor,
          }));

        if (samples.length === 0) {
          setErrorMsg('Harap selesaikan pemindaian wajah minimal 1 sampel.');
          setStep(2);
          setIsSubmitting(false);
          return;
        }

        await api.enrollStudentDirect({
          nis: formData.nis.trim(),
          full_name: formData.full_name.trim(),
          nickname: formData.nickname.trim(),
          class_name: formData.class_name,
          category: formData.category.trim() || 'Umum',
          samples,
        });
      } else {
        const validPhotos = manualPhotos.filter(Boolean);
        if (validPhotos.length === 0) {
          setErrorMsg('Harap ambil foto minimal 1 sampel.');
          setStep(2);
          setIsSubmitting(false);
          return;
        }

        const samples = validPhotos.map((photo, idx) => ({
          pose_label: `Foto ${idx + 1}`,
          photo_data: photo,
        }));

        await api.enrollStudentDirect({
          nis: formData.nis.trim(),
          full_name: formData.full_name.trim(),
          nickname: formData.nickname.trim(),
          class_name: formData.class_name,
          category: formData.category.trim() || 'Umum',
          samples,
        });
      }

      onSuccess();
    } catch (err: unknown) {
      console.error('Submit enrollment error:', err);
      const message = err instanceof Error ? err.message : 'Gagal mendaftarkan siswa ke Supabase Cloud. Silakan periksa koneksi internet.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTarget = POSE_TARGETS[currentPromptIndex];

  // SVG Circular progress values
  const circleRadius = 130;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (scanProgress / 100) * circumference;

  return (
    <div className="flex flex-col flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Pendaftaran Wajah Siswa</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              Face ID Scanner
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Perekaman wajah otomatis 4 arah (Depan, Kanan, Kiri, Atas) yang bersih dan cepat
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
        >
          Batal
        </button>
      </div>

      {/* Step Stepper Progress */}
      <div className="flex items-center justify-between p-4 rounded-2xl glass-panel border border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 1 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            1
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 1</div>
            <div className="text-[11px] text-slate-400">Biodata Siswa</div>
          </div>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            2
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 2</div>
            <div className="text-[11px] text-slate-400">Pemindaian Wajah</div>
          </div>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 3 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}
          >
            3
          </div>
          <div>
            <div className="text-xs font-bold text-white">Langkah 3</div>
            <div className="text-[11px] text-slate-400">Konfirmasi & Simpan</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-3 animate-fadeIn">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: BIODATA FORM */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5 animate-fadeIn">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Informasi Pribadi & Identitas Siswa</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nomor Induk Siswa (NIS) <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nis}
                onChange={e => setFormData({ ...formData, nis: e.target.value })}
                placeholder="Contoh: SKH-2026-001"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nama Panggilan / Sapaan <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Contoh: Jonathan / Jo"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Nama ini yang akan disapa ramah oleh suara sistem</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nama Lengkap Siswa <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nama lengkap sesuai dokumen pendaftaran"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Kelas SKH
              </label>
              <select
                value={formData.class_name}
                onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="Kelas 1 Autis">Kelas 1 Autis</option>
                <option value="Kelas 2 Tunarungu">Kelas 2 Tunarungu</option>
                <option value="Kelas 3 Tunagrahita">Kelas 3 Tunagrahita</option>
                <option value="Kelas Transisi">Kelas Transisi</option>
                <option value="Kelas Khusus">Kelas Khusus</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Kebutuhan Khusus / Kategori
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="Contoh: Autism Spectrum / Tunarungu"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                if (!formData.nis.trim() || !formData.full_name.trim() || !formData.nickname.trim()) {
                  setErrorMsg('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan terlebih dahulu.');
                  return;
                }
                setErrorMsg(null);
                setStep(2);
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
            >
              <span>Lanjut ke Pemindaian Wajah</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CLEAN MINIMALIST FACE SCANNER */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-6 animate-fadeIn">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Scan className="w-5 h-5 text-emerald-400" />
                <span>Pemindaian Wajah Otomatis (Face ID)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cukup klik <b>Mulai Pemindaian</b> lalu ikuti panduan arah wajah
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFaceIdMode(!isFaceIdMode)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isFaceIdMode ? 'Beralih ke Foto Manual' : 'Gunakan Pemindaian Otomatis'}</span>
              </button>
            </div>
          </div>

          {/* ======================= */}
          {/* MINIMALIST FACE ID SCANNER */}
          {/* ======================= */}
          {isFaceIdMode ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-2">
              {/* Minimalist Circular Viewport with Clean Progress Ring */}
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                {/* SVG Smooth Progress Ring */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                  {/* Track Circle */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={circleRadius}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="6"
                  />
                  {/* Progress Arc */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={circleRadius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>

                {/* Circular Camera Container */}
                <div
                  className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden border-2 bg-slate-950 shadow-2xl flex items-center justify-center transition-all duration-300 ${
                    isScanningActive ? 'border-emerald-500/80 shadow-emerald-500/20' : 'border-slate-700'
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                  />

                  {/* Clean Face Guide Oval */}
                  <div
                    className={`w-32 h-44 rounded-[50%] border-2 border-dashed pointer-events-none transition-all duration-300 ${
                      isScanningActive ? 'border-emerald-400/70 scale-105' : 'border-slate-500/40'
                    }`}
                  />
                </div>
              </div>

              {/* Clean Direction Badges (Depan, Kanan, Kiri, Atas) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                {POSE_TARGETS.map((t, idx) => {
                  const isDone = Boolean(capturedSamples[t.id]);
                  const isCurrent = isScanningActive && currentPromptIndex === idx;
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-1 text-center ${
                        isDone
                          ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
                          : isCurrent
                          ? 'bg-amber-950/40 border-amber-400 text-amber-200 animate-pulse'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{t.icon}</span>
                        <span className="text-xs font-bold">{t.label}</span>
                      </div>
                      <span className="text-[10px] font-semibold">
                        {isDone ? 'Selesai ✓' : isCurrent ? 'Sekarang' : 'Menunggu'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Instructions & Controls */}
              <div className="w-full max-w-md text-center space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400">Instruksi:</div>
                  <div className="text-base font-bold text-white">
                    {isScanningActive && currentTarget
                      ? currentTarget.instruction
                      : scanProgress === 100
                      ? '✅ Wajah berhasil dipindai dengan lengkap!'
                      : 'Klik tombol Mulai Pemindaian di bawah'}
                  </div>
                  <div className="text-[11px] text-emerald-400">
                    {isScanningActive && currentTarget ? currentTarget.tip : 'Siswa cukup menatap kamera dengan santai'}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  {!isScanningActive ? (
                    <button
                      onClick={handleStart3dScan}
                      className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm sm:text-base flex items-center gap-2.5 shadow-xl shadow-emerald-600/40 transition transform active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>{scanProgress > 0 ? 'Ulangi Pemindaian' : 'Mulai Pemindaian Wajah'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetScan}
                      className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-2 transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Hentikan / Ulangi</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ======================= */
            /* MANUAL PHOTO FALLBACK */
            /* ======================= */
            <div className="space-y-4">
              <div className="relative w-full h-72 rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {POSE_TARGETS.map((t, idx) => (
                  <div key={t.id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
                      {manualPhotos[idx] ? (
                        <img src={manualPhotos[idx]!} alt={t.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{t.icon}</span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-300 text-center truncate w-full">{t.label}</span>
                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        onClick={() => handleManualCapture(idx)}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                      >
                        Foto
                      </button>
                      <label className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleFileUpload(e, idx)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => {
                stopCamera();
                setStep(1);
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Biodata</span>
            </button>

            <button
              onClick={() => {
                const sampleCount = isFaceIdMode
                  ? Object.keys(capturedSamples).length
                  : manualPhotos.filter(Boolean).length;
                if (sampleCount === 0) {
                  setErrorMsg('Harap lakukan pemindaian wajah atau ambil foto minimal 1 pose.');
                  return;
                }
                setErrorMsg(null);
                setStep(3);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <span>Lanjut ke Konfirmasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW & FINAL ENROLLMENT SUBMISSION */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-6 animate-fadeIn">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-white">Konfirmasi Data Siswa & Sampel Wajah</h3>
            <p className="text-xs text-slate-400">Pastikan biodata dan 4 sampel foto wajah sudah sesuai</p>
          </div>

          {/* Student Info Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400">NIS Siswa</div>
              <div className="font-bold text-white mt-0.5">{formData.nis}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Nama Panggilan</div>
              <div className="font-bold text-emerald-400 mt-0.5">{formData.nickname}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Nama Lengkap</div>
              <div className="font-bold text-white mt-0.5">{formData.full_name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Kelas & Kategori</div>
              <div className="font-bold text-slate-300 mt-0.5">
                {formData.class_name} • <span className="text-slate-400">{formData.category}</span>
              </div>
            </div>
          </div>

          {/* Captured 4 Angle Thumbnails */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Sampel Foto Wajah yang Direkam (4 Arah):
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {isFaceIdMode
                ? POSE_TARGETS.map(t => {
                    const sample = capturedSamples[t.id];
                    return (
                      <div key={t.id} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                          {sample ? (
                            <img src={sample.photo} alt={t.label} className="w-full h-full object-cover transform scale-x-[-1]" />
                          ) : (
                            <span className="text-slate-500 text-xs">Kosong</span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400">{t.label}</span>
                      </div>
                    );
                  })
                : manualPhotos.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-2">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                        {p ? <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" /> : null}
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">Sampel {idx + 1}</span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ubah Foto / Pindai Ulang</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/40 transition transform active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Mendaftarkan Wajah...' : 'Simpan & Daftarkan Siswa'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
