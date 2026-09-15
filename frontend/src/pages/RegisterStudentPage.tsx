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
import { api, ClassRoomCombination } from '../services/api';
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
    instruction: 'Tatap lurus ke arah kamera ya.',
    tip: 'Posisikan wajah di tengah lingkaran',
    icon: '🎯',
  },
  {
    id: 'RIGHT',
    label: 'Kanan',
    instruction: 'Bagus, sekarang tolehkan kepala ke kanan perlahan ya.',
    tip: 'Putar sedikit ke arah kanan',
    icon: '👉',
  },
  {
    id: 'LEFT',
    label: 'Kiri',
    instruction: 'Pintar, sekarang tolehkan kepala ke kiri perlahan ya.',
    tip: 'Putar sedikit ke arah kiri',
    icon: '👈',
  },
  {
    id: 'UP',
    label: 'Atas',
    instruction: 'Sedikit lagi, angkat dagu dan dongakkan kepala sedikit ke atas ya.',
    tip: 'Angkat dagu perlahan',
    icon: '👆',
  },
];

export const RegisterStudentPage: React.FC<RegisterStudentPageProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<number>(1);
  const [classRooms, setClassRooms] = useState<ClassRoomCombination[]>(() =>
    api.getClassRooms(true)
  );

  const [formData, setFormData] = useState({
    nis: '',
    full_name: '',
    nickname: '',
    class_name: api.getClassRooms(true)[0]?.display_name || 'Kelas 1 Autis',
    category: 'Autism Spectrum',
  });

  useEffect(() => {
    const handleClassUpdate = () => {
      const active = api.getClassRooms(true);
      setClassRooms(active);
      if (active.length > 0 && !active.some(c => c.display_name === formData.class_name)) {
        setFormData(prev => ({ ...prev, class_name: active[0].display_name }));
      }
    };
    window.addEventListener('skh_class_rooms_updated', handleClassUpdate);
    return () => window.removeEventListener('skh_class_rooms_updated', handleClassUpdate);
  }, [formData.class_name]);

  // Face ID Minimalist States
  const [isFaceIdMode, setIsFaceIdMode] = useState<boolean>(true);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number>(0);
  const [capturedSamples, setCapturedSamples] = useState<
    Record<string, { photo: string; descriptor: Float32Array; pose: string }>
  >({});
  const [liveHeadPose, setLiveHeadPose] = useState<HeadPose | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  // Manual fallback photos (4 angles)
  const [manualPhotos, setManualPhotos] = useState<(string | null)[]>([null, null, null, null]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Webcam references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseStabilityRef = useRef<number>(0);
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
    poseStabilityRef.current = 0;
    if (meshCanvasRef.current) {
      const ctx = meshCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, meshCanvasRef.current.width, meshCanvasRef.current.height);
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
    poseStabilityRef.current = 0;
    if (meshCanvasRef.current) {
      const ctx = meshCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, meshCanvasRef.current.width, meshCanvasRef.current.height);
    }
    setCapturedSamples({});
    setScanProgress(0);
    setCurrentPromptIndex(0);
    setIsScanningActive(false);
    setLiveHeadPose(null);
    setQualityWarning(null);
  };

  // 3D Holographic Face ID Mesh & Infrared Landmark Constellation
  const draw3dFaceMesh = useCallback((landmarks: { positions: Array<{ x: number; y: number }> } | null, isMatched: boolean) => {
    const canvas = meshCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || !isScanningActive) return;

    const pts = landmarks.positions;
    const nodeColor = isMatched ? '#10b981' : '#38bdf8';
    const lineColor = isMatched ? 'rgba(16, 185, 129, 0.45)' : 'rgba(56, 189, 248, 0.22)';

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = lineColor;

    const drawPath = (indices: number[], close = false) => {
      if (indices.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[indices[0]].x, pts[indices[0]].y);
      for (let i = 1; i < indices.length; i++) {
        ctx.lineTo(pts[indices[i]].x, pts[indices[i]].y);
      }
      if (close) ctx.closePath();
      ctx.stroke();
    };

    // 1. Jawline contour (0 to 16)
    drawPath(Array.from({ length: 17 }, (_, i) => i));

    // 2. Eyebrows
    drawPath([17, 18, 19, 20, 21]);
    drawPath([22, 23, 24, 25, 26]);

    // 3. Nose Bridge & Base
    drawPath([27, 28, 29, 30]);
    drawPath([31, 32, 33, 34, 35, 30]);

    // 4. Eyes (Outer contours)
    drawPath([36, 37, 38, 39, 40, 41], true);
    drawPath([42, 43, 44, 45, 46, 47], true);

    // 5. Lips (Outer & Inner)
    drawPath([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59], true);
    drawPath([60, 61, 62, 63, 64, 65, 66, 67], true);

    // 6. 3D Depth Triangulation Cross-Links
    ctx.beginPath();
    ctx.moveTo(pts[27].x, pts[27].y);
    ctx.lineTo(pts[36].x, pts[36].y);
    ctx.moveTo(pts[27].x, pts[27].y);
    ctx.lineTo(pts[45].x, pts[45].y);
    ctx.moveTo(pts[30].x, pts[30].y);
    ctx.lineTo(pts[48].x, pts[48].y);
    ctx.moveTo(pts[30].x, pts[30].y);
    ctx.lineTo(pts[54].x, pts[54].y);
    ctx.stroke();

    // 7. Glowing Holographic 3D Mesh Nodes (Face ID Infrared Dot Projector Effect)
    ctx.fillStyle = nodeColor;
    for (let i = 0; i < pts.length; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [isScanningActive]);

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
          const { headPose, descriptor, landmarks } = detection;
          setLiveHeadPose(headPose);

          // Check if current target pose matches
          const currentTarget = POSE_TARGETS[currentPromptIndex];
          let isPoseMatched = false;

          if (currentTarget) {
            if (currentTarget.id === 'CENTER' && headPose.poseCategory === 'CENTER') {
              isPoseMatched = true;
            } else if (currentTarget.id === 'RIGHT' && (headPose.poseCategory === 'RIGHT' || headPose.yaw > 12)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'LEFT' && (headPose.poseCategory === 'LEFT' || headPose.yaw < -12)) {
              isPoseMatched = true;
            } else if (currentTarget.id === 'UP' && headPose.poseCategory === 'UP') {
              // Strictly require genuine upward pitch from anatomical ratio!
              isPoseMatched = true;
            }
          }

          // Draw real-time 3D landmark mesh
          draw3dFaceMesh(landmarks, isPoseMatched);

          if (isPoseMatched && currentTarget && !capturedSamples[currentTarget.id]) {
            // Temporal Stability Guard: Require student to hold pose steadily for 3 cycles (~350ms)
            poseStabilityRef.current++;
            if (poseStabilityRef.current < 3) {
              return;
            }

            // Quality Check: Reject blurry, dim, or small face frame before capturing
            if (detection.quality && !detection.quality.isValid) {
              setQualityWarning(detection.quality.reason || 'Kualitas gambar kurang tajam. Harap diam sejenak.');
              return;
            }
            setQualityWarning(null);
            poseStabilityRef.current = 0;

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
          } else if (!isPoseMatched) {
            // Reset stability counter if pose is lost
            poseStabilityRef.current = 0;
          }
        } else {
          poseStabilityRef.current = 0;
          draw3dFaceMesh(null, false);
        }
      } catch (err) {
        console.warn('Scan frame error:', err);
      } finally {
        isProcessingFrame = false;
      }
    }, 120);

    return () => clearInterval(interval);
  }, [step, isScanningActive, isCameraActive, currentPromptIndex, capturedSamples, formData.nickname, draw3dFaceMesh]);

  // Fallback Single Manual Capture
  const handleManualCapture = async (idx: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    const det = await faceApi.detectFace(canvas, true);
    if (!det) {
      setErrorMsg('Wajah tidak terdeteksi. Posisikan wajah di depan kamera.');
      return;
    }
    if (det.quality && !det.quality.isValid) {
      setErrorMsg(`Foto ditolak: ${det.quality.reason}`);
      return;
    }

    setErrorMsg(null);
    const updated = [...manualPhotos];
    updated[idx] = dataUrl;
    setManualPhotos(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const extracted = await faceApi.extractDescriptorFromDataUrl(dataUrl, { checkQuality: true });
      if (!extracted) {
        setErrorMsg('Wajah tidak terdeteksi pada file gambar.');
        return;
      }
      if (extracted.quality && !extracted.quality.isValid) {
        setErrorMsg(`Foto ditolak: ${extracted.quality.reason}`);
        return;
      }
      setErrorMsg(null);
      const updated = [...manualPhotos];
      updated[idx] = dataUrl;
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
      if (isFaceIdMode) {
        const samples = Object.values(capturedSamples)
          .filter(s => s.photo)
          .map(s => ({
            pose_label: s.pose,
            photo_data: s.photo,
            descriptor: s.descriptor,
          }));

        if (samples.length < 3) {
          setErrorMsg('Pendaftaran biometrik memerlukan minimal 3 pose wajah (Depan, Kiri, Kanan) untuk akurasi tinggi.');
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
        if (validPhotos.length < 3) {
          setErrorMsg('Harap sediakan minimal 3 foto wajah dari sudut berbeda.');
          setStep(2);
          setIsSubmitting(false);
          return;
        }

        const samples = validPhotos.map((photo, idx) => ({
          pose_label: POSE_TARGETS[idx]?.label || `Foto ${idx + 1}`,
          photo_data: photo!,
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
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Pendaftaran Wajah Siswa</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Face ID
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Perekaman wajah 4 arah (Depan, Kanan, Kiri, Atas) untuk identifikasi presensi
          </p>
        </div>

        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
        >
          Batal
        </button>
      </div>

      {/* Step Stepper Progress */}
      <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
            }`}
          >
            1
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Biodata</div>
            <div className="text-[10px] text-slate-400">Identitas Siswa</div>
          </div>
        </div>

        <div className="h-px flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
            }`}
          >
            2
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Pemindaian</div>
            <div className="text-[10px] text-slate-400">Sampel Wajah</div>
          </div>
        </div>

        <div className="h-px flex-1 mx-4 bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === 3 ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
            }`}
          >
            3
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Konfirmasi</div>
            <div className="text-[10px] text-slate-400">Simpan ke Cloud</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: BIODATA FORM */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-4 animate-fadeIn">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>Informasi Identitas Siswa</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nomor Induk Siswa (NIS) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nis}
                onChange={e => setFormData({ ...formData, nis: e.target.value })}
                placeholder="Contoh: SKH-2026-001"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Panggilan / Sapaan <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Contoh: Jonathan / Jo"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Nama ini yang akan disapa ramah oleh suara sistem</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nama Lengkap Siswa <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nama lengkap sesuai dokumen resmi"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Kelas SKH
              </label>
              <select
                value={formData.class_name}
                onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              >
                {classRooms.map(c => (
                  <option key={c.id} value={c.display_name}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Kebutuhan Khusus / Kategori
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="Contoh: Autism Spectrum / Tunarungu"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                if (!formData.nis.trim() || !formData.full_name.trim() || !formData.nickname.trim()) {
                  setErrorMsg('Harap lengkapi NIS, Nama Lengkap, dan Nama Panggilan terlebih dahulu.');
                  return;
                }
                setErrorMsg(null);
                setStep(2);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <span>Lanjut ke Pemindaian Wajah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: CLEAN MINIMALIST FACE SCANNER */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-5 animate-fadeIn">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Scan className="w-4 h-4 text-blue-400" />
                <span>Pemindaian Wajah Otomatis (Face ID)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Klik <b>Mulai Pemindaian</b> lalu ikuti arahan posisi wajah
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFaceIdMode(!isFaceIdMode)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" />
                <span>{isFaceIdMode ? 'Foto Manual' : 'Otomatis Face ID'}</span>
              </button>
            </div>
          </div>

          {/* ======================= */}
          {/* MINIMALIST FACE ID SCANNER */}
          {/* ======================= */}
          {isFaceIdMode ? (
            <div className="flex flex-col items-center justify-center space-y-5 py-2">
              {/* Minimalist Circular Viewport with Clean Progress Ring */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                {/* SVG Smooth Progress Ring */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                  {/* Track Circle */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={circleRadius}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="4"
                  />
                  {/* Progress Arc */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={circleRadius}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>

                {/* Circular Camera Container */}
                <div
                  className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden border bg-slate-950 flex items-center justify-center transition-all duration-300 ${
                    isScanningActive ? 'border-blue-500' : 'border-slate-800'
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                  />

                  {/* 3D Holographic Face ID Mesh Overlay Canvas */}
                  <canvas
                    ref={meshCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1]"
                  />

                  {/* Face Guide Oval */}
                  <div
                    className={`w-28 h-36 rounded-[50%] border border-dashed pointer-events-none transition-all duration-300 ${
                      isScanningActive ? 'border-blue-400/80 scale-105' : 'border-slate-600/40'
                    }`}
                  />
                </div>
              </div>

              {/* Direction Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg">
                {POSE_TARGETS.map((t, idx) => {
                  const isDone = Boolean(capturedSamples[t.id]);
                  const isCurrent = isScanningActive && currentPromptIndex === idx;
                  return (
                    <div
                      key={t.id}
                      className={`p-2.5 rounded-lg border transition-all duration-300 flex flex-col items-center justify-center gap-1 text-center ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                          : isCurrent
                          ? 'bg-blue-950/40 border-blue-500 text-blue-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold">{t.label}</span>
                      </div>
                      <span className="text-[10px]">
                        {isDone ? 'Selesai ✓' : isCurrent ? 'Pindai...' : 'Menunggu'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Instructions & Controls */}
              <div className="w-full max-w-md text-center space-y-3.5">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-0.5">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Instruksi:</div>
                  <div className="text-xs sm:text-sm font-semibold text-white">
                    {isScanningActive && currentTarget
                      ? currentTarget.instruction
                      : scanProgress === 100
                      ? 'Wajah berhasil dipindai lengkap'
                      : 'Klik tombol Mulai Pemindaian di bawah'}
                  </div>
                  <div className="text-[11px] text-blue-400">
                    {isScanningActive && currentTarget ? currentTarget.tip : 'Tatap kamera dengan wajar dan santai'}
                  </div>
                </div>

                {qualityWarning && (
                  <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-center gap-2 animate-pulse">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400" />
                    <span className="font-medium">{qualityWarning}</span>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2.5">
                  {!isScanningActive ? (
                    <button
                      onClick={handleStart3dScan}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>{scanProgress > 0 ? 'Ulangi Pemindaian' : 'Mulai Pemindaian'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleResetScan}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Hentikan</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ======================= */
            /* MANUAL PHOTO FALLBACK */
            /* ======================= */
            <div className="space-y-3.5">
              <div className="relative w-full h-64 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {POSE_TARGETS.map((t, idx) => (
                  <div key={t.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-700">
                      {manualPhotos[idx] ? (
                        <img src={manualPhotos[idx]!} alt={t.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{t.icon}</span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-300 text-center truncate w-full">{t.label}</span>
                    <div className="flex items-center gap-1.5 w-full">
                      <button
                        onClick={() => handleManualCapture(idx)}
                        className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium"
                      >
                        Foto
                      </button>
                      <label className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
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
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              onClick={() => {
                stopCamera();
                setStep(1);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>

            <button
              onClick={() => {
                const sampleCount = isFaceIdMode
                  ? Object.keys(capturedSamples).length
                  : manualPhotos.filter(Boolean).length;
                if (sampleCount < 3) {
                  setErrorMsg('Harap lakukan pemindaian wajah atau ambil foto minimal 3 pose berbeda (Depan, Kiri, Kanan).');
                  return;
                }
                setErrorMsg(null);
                setStep(3);
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
            >
              <span>Lanjut ke Konfirmasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW & FINAL ENROLLMENT SUBMISSION */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-5 animate-fadeIn">
          <div className="text-center space-y-1">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Konfirmasi Data & Sampel Wajah</h3>
            <p className="text-xs text-slate-400">Pastikan biodata dan foto wajah siswa sudah benar</p>
          </div>

          {/* Student Info Card */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-400">NIS Siswa</div>
              <div className="font-semibold text-white mt-0.5 font-mono">{formData.nis}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Nama Panggilan</div>
              <div className="font-semibold text-blue-400 mt-0.5">{formData.nickname}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Nama Lengkap</div>
              <div className="font-semibold text-white mt-0.5">{formData.full_name}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Kelas & Kategori</div>
              <div className="font-semibold text-slate-300 mt-0.5">
                {formData.class_name} • <span className="text-slate-400">{formData.category}</span>
              </div>
            </div>
          </div>

          {/* Captured 4 Angle Thumbnails */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Sampel Foto Wajah:
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {isFaceIdMode
                ? POSE_TARGETS.map(t => {
                    const sample = capturedSamples[t.id];
                    return (
                      <div key={t.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                          {sample ? (
                            <img src={sample.photo} alt={t.label} className="w-full h-full object-cover transform scale-x-[-1]" />
                          ) : (
                            <span className="text-slate-500 text-xs">Kosong</span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-300">{t.label}</span>
                      </div>
                    );
                  })
                : manualPhotos.map((p, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center gap-1.5">
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                        {p ? <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" /> : null}
                      </div>
                      <span className="text-[11px] font-medium text-slate-300">Sampel {idx + 1}</span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Pindai Ulang</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Mendaftarkan...' : 'Simpan Siswa'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
