// Vercel Serverless Function: api/send-otp.js
// Endpoint untuk mengirimkan kode OTP 6-digit asli ke email Kepala Sekolah (bambanghrmko@gmail.com)

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Gunakan POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, code, fullName } = body || {};

    const targetEmail = (email || 'bambanghrmko@gmail.com').trim().toLowerCase();
    const otpCode = (code || '').toString().trim();

    if (!otpCode || otpCode.length !== 6) {
      return res.status(400).json({ success: false, error: 'Kode OTP 6-digit tidak valid.' });
    }

    const emailSubject = `[SKH Santo Fransiskus Asisi] Kode OTP Verifikasi Kepala Sekolah: ${otpCode}`;
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kode OTP SKH</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0f19;padding:40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" style="max-width:520px;background-color:#111827;border:1px solid #1f2937;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.5);" cellpadding="0" cellspacing="0">
                <!-- Header -->
                <tr>
                  <td style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-bottom:1px solid #1f2937;text-align:center;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#60a5fa;text-transform:uppercase;margin-bottom:6px;">Sistem Presensi SKH</div>
                    <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">SKH SANTO FRANSISKUS ASISI</h1>
                    <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Verifikasi Keamanan Akun Kepala Sekolah</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;">
                      Halo <strong>${fullName || 'Bapak/Ibu Kepala Sekolah'}</strong>,
                    </p>
                    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#94a3b8;">
                      Permintaan pendaftaran akun Kepala Sekolah telah diajukan untuk alamat email ini. Gunakan kode verifikasi (OTP) berikut untuk menyelesaikan aktivasi akun Anda:
                    </p>

                    <!-- OTP Code Badge -->
                    <div style="background-color:#030712;border:1px solid #2563eb;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">
                      <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#38bdf8;display:inline-block;padding-left:10px;">
                        ${otpCode}
                      </span>
                      <div style="font-size:11px;color:#64748b;margin-top:8px;">
                        Berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.
                      </div>
                    </div>

                    <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#94a3b8;">
                      Setelah memasukkan kode di atas, akun Anda akan <strong>otomatis disetujui (Approved)</strong> dan Anda dapat langsung masuk ke dashboard sistem.
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                      Jika Anda tidak merasa melakukan pendaftaran ini, abaikan pesan ini. Akun tidak akan dapat diaktifkan tanpa kode verifikasi di atas.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:20px 32px;background-color:#0b0f19;border-top:1px solid #1f2937;text-align:center;">
                    <p style="margin:0;font-size:11px;color:#475569;">
                      © ${new Date().getFullYear()} SKH Santo Fransiskus Asisi. Keamanan Presensi Berbasis Wajah Real-time.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 1. Cobalah kirim via Resend API jika RESEND_API_KEY atau VITE_RESEND_API_KEY tersedia
    const rawResendKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
    const resendApiKey = rawResendKey ? rawResendKey.trim().replace(/^["']|["']$/g, '') : '';

    if (resendApiKey) {
      console.log(`[API /send-otp] Mengirim email via Resend API ke ${targetEmail}...`);
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'SKH Presensi <onboarding@resend.dev>',
          to: [targetEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      const resendData = await resendRes.json().catch(() => ({}));
      if (resendRes.ok && resendData?.id) {
        console.log(`[API /send-otp] ✅ Email berhasil dikirim via Resend! ID:`, resendData.id);
        return res.status(200).json({
          success: true,
          provider: 'resend',
          id: resendData.id,
          message: `Kode OTP 6-digit telah berhasil dikirim ke ${targetEmail}. Silakan periksa Kotak Masuk Gmail Anda.`,
        });
      } else {
        console.error('[API /send-otp] Resend API error response:', resendData);
        const detailError = resendData?.message || resendData?.error || `Resend HTTP error ${resendRes.status}`;
        return res.status(resendRes.status || 500).json({
          success: false,
          provider: 'resend',
          error: `Gagal mengirim email via Resend: ${detailError}`,
        });
      }
    }

    // 2. Cobalah kirim via Brevo API jika BREVO_API_KEY tersedia
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (brevoApiKey) {
      console.log(`[API /send-otp] Mengirim email via Brevo API ke ${targetEmail}...`);
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SKH Santo Fransiskus Asisi', email: process.env.BREVO_SENDER || 'admin@skhasisi.sch.id' },
          to: [{ email: targetEmail, name: fullName || 'Kepala Sekolah' }],
          subject: emailSubject,
          htmlContent: emailHtml,
        }),
      });

      const brevoData = await brevoRes.json();
      if (brevoRes.ok) {
        return res.status(200).json({
          success: true,
          provider: 'brevo',
          message: `Kode OTP 6-digit telah berhasil dikirim ke ${targetEmail}.`,
        });
      }
    }

    // 3. Jika belum ada API key yang dipasang di Vercel:
    console.warn('[API /send-otp] Belum ada RESEND_API_KEY atau BREVO_API_KEY pada Environment Variables.');
    return res.status(503).json({
      success: false,
      needs_config: true,
      error: 'Layanan email pengirim (RESEND_API_KEY) belum dikonfigurasi pada Environment Variables Vercel. Harap tambahkan RESEND_API_KEY agar email dapat terkirim 100% ke Gmail.',
    });
  } catch (err) {
    console.error('[API /send-otp] Error fatal handler:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Terjadi kesalahan pada server saat memproses pengiriman email.',
    });
  }
}
