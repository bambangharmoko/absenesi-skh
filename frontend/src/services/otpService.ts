import { supabase, isSupabaseConfigured } from './supabase';

export const TARGET_KEPSEK_EMAIL = 'bambanghrmko@gmail.com';

interface StoredOtpState {
  email: string;
  code: string;
  expiresAt: number;
}

const OTP_SESSION_KEY = 'skh_otp_pending_session';

export const otpService = {
  getTargetEmail(): string {
    return TARGET_KEPSEK_EMAIL;
  },

  /**
   * Mengirim kode OTP 6-digit ke email bambanghrmko@gmail.com
   * Menggunakan endpoint API Vercel (/api/send-otp) dan/atau Supabase Auth
   */
  async sendOtp(
    email: string = TARGET_KEPSEK_EMAIL,
    fullName?: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // Generate 6-digit OTP code acak (100000 - 999999), berlaku 10 menit
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const otpState: StoredOtpState = {
      email: cleanEmail,
      code: generatedCode,
      expiresAt,
    };

    try {
      sessionStorage.setItem(OTP_SESSION_KEY, JSON.stringify(otpState));
    } catch {}

    let apiDelivered = false;
    let apiErrorMsg = '';

    // 1. Prioritas Utama: Kirim via Serverless API Vercel (/api/send-otp)
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: generatedCode,
          fullName: fullName || 'Kepala Sekolah',
        }),
      });

      const resData = await response.json().catch(() => null);

      if (response.ok && resData?.success) {
        apiDelivered = true;
        console.log(`[OTP Service] ✅ Email OTP berhasil dikirim via /api/send-otp ke ${cleanEmail}`);
        return {
          success: true,
          message: `Kode OTP 6-digit telah dikirim ke alamat email ${cleanEmail}. Silakan periksa Kotak Masuk atau folder Spam Gmail Anda.`,
        };
      } else {
        apiErrorMsg = resData?.error || `HTTP ${response.status}: Layanan email belum merespons.`;
        console.warn('[OTP Service] /api/send-otp response:', apiErrorMsg);
      }
    } catch (apiErr: any) {
      apiErrorMsg = apiErr.message || 'Gagal menghubungi server pengirim email.';
      console.warn('[OTP Service] fetch /api/send-otp error:', apiErr);
    }

    // 2. Jalur Sekunder: Supabase Auth OTP (berfungsi penuh jika Custom SMTP Gmail diaktifkan di Supabase Dashboard)
    let supabaseDelivered = false;
    if (isSupabaseConfigured()) {
      try {
        const { error: sbError } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
          },
        });

        if (!sbError) {
          supabaseDelivered = true;
          console.log(`[OTP Service] ✅ Email OTP berhasil dikirim via Supabase Auth ke ${cleanEmail}`);
          return {
            success: true,
            message: `Kode OTP 6-digit telah dikirim ke alamat email ${cleanEmail}. Silakan periksa Kotak Masuk Gmail atau folder Spam Anda.`,
          };
        } else {
          console.warn('[OTP Service] Supabase Auth OTP notice:', sbError.message);
        }
      } catch (sbEx: any) {
        console.warn('[OTP Service] Supabase send exception:', sbEx);
      }
    }

    // 3. Jika kedua jalur belum dapat mengirimkan email nyata karena ketiadaan konfigurasi API Key / SMTP
    if (!apiDelivered && !supabaseDelivered) {
      const helpfulMsg = apiErrorMsg.includes('RESEND_API_KEY')
        ? 'Layanan email pengirim (RESEND_API_KEY) belum dikonfigurasi pada Environment Variables Vercel atau Custom SMTP di Supabase.'
        : apiErrorMsg || 'Gagal mengirim email OTP.';

      return {
        success: false,
        message: helpfulMsg,
        error: helpfulMsg,
      };
    }

    return {
      success: true,
      message: `Kode OTP 6-digit telah dikirim ke ${cleanEmail}. Silakan periksa Gmail Anda.`,
    };
  },

  /**
   * Memverifikasi kode OTP 6-digit yang dimasukkan pengguna
   */
  async verifyOtp(email: string, token: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (!cleanToken || cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
      return { success: false, error: 'Kode OTP harus berupa 6 digit angka numerik.' };
    }

    // 1. Verifikasi dengan Supabase Auth jika email dikirim via Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'email',
        });

        if (!error && data?.user) {
          console.log('[OTP Service] ✅ Verifikasi OTP Supabase Auth berhasil untuk:', cleanEmail);
          try {
            sessionStorage.removeItem(OTP_SESSION_KEY);
          } catch {}
          return { success: true };
        }
      } catch (err) {
        console.warn('[OTP Service] Supabase verifyOtp error:', err);
      }
    }

    // 2. Verifikasi dengan kode sesi aktif yang dikirimkan ke Gmail pengguna
    try {
      const raw = sessionStorage.getItem(OTP_SESSION_KEY);
      if (raw) {
        const state: StoredOtpState = JSON.parse(raw);
        if (state.email === cleanEmail) {
          if (Date.now() > state.expiresAt) {
            return {
              success: false,
              error: 'Kode OTP telah kedaluwarsa (batas waktu 10 menit). Silakan minta kode OTP baru.',
            };
          }

          if (state.code === cleanToken) {
            console.log('[OTP Service] ✅ Verifikasi OTP valid sesuai kode yang dikirim ke Gmail!');
            sessionStorage.removeItem(OTP_SESSION_KEY);
            return { success: true };
          }
        }
      }
    } catch {}

    return {
      success: false,
      error: 'Kode OTP yang Anda masukkan salah atau sudah kedaluwarsa. Silakan periksa kembali email Anda atau klik Kirim Ulang OTP.',
    };
  },
};
