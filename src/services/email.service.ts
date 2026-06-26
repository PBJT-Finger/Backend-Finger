/**
 * Email Service
 * Mengatur pengiriman email untuk alur autentikasi (seperti reset password, email sambutan admin baru, dll).
 * Menggunakan pustaka nodemailer dengan konfigurasi SMTP.
 */

import nodemailer from 'nodemailer'; // Modul Node.js untuk mengirim email
import logger from '../utils/logger'; // Logger internal aplikasi
import { env } from '../config/env'; // Pembaca variabel lingkungan (.env)

// Konfigurasi server SMTP yang dibaca dari file .env
const emailConfig = {
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: env.SMTP_PORT || 587,
  secure: env.SMTP_SECURE, // Bernilai true untuk port 465, false untuk port lainnya
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
};

const fromEmail = env.EMAIL_FROM || 'noreply@fingerattendance.com';
const fromName = env.EMAIL_FROM_NAME || 'Finger Attendance System';

// Membuat objek transporter nodemailer reusable
let transporter: nodemailer.Transporter | null = null;

/**
 * Menginisialisasi transporter SMTP email.
 */
const initializeTransporter = (): nodemailer.Transporter | null => {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    logger.warn('Kredensial SMTP tidak terkonfigurasi. Layanan email akan dialihkan ke mode log konsol saja.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    logger.info('Transporter email berhasil diinisialisasi');
    return transporter;
  } catch (error) {
    logger.error('Gagal menginisialisasi transporter email', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Mengirim email ke tujuan.
 * @param to - Alamat email penerima
 * @param subject - Subjek/judul email
 * @param html - Isi email dalam format HTML
 * @param text - Isi email dalam format teks polos (opsional)
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text = ''
): Promise<{ success: boolean; messageId: string }> => {
  // Inisialisasi transporter jika belum dibuat
  if (!transporter) {
    transporter = initializeTransporter();
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Konversi HTML ke teks polos jika parameter text kosong
  };

  try {
    // Jika SMTP belum dikonfigurasi, jalankan mode simulasi (log konsol)
    if (!transporter) {
      logger.info('📧 EMAIL (Mode Konsol - SMTP belum terkonfigurasi)', {
        to,
        subject,
        preview: html.substring(0, 200),
      });
      console.log('\n=== EMAIL PREVIEW (SMTP belum dikonfigurasi) ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text || html}`);
      console.log('===================\n');
      return { success: true, messageId: 'console-mode' };
    }

    // Mengirim email sungguhan via transporter
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email berhasil terkirim', {
      to,
      subject,
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Gagal mengirim email', {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Gagal mengirim email. Silakan coba lagi.');
  }
};

/**
 * Mengirim kode verifikasi reset password via email.
 * @param email - Email tujuan penerima
 * @param code - 6 digit kode OTP verifikasi
 * @param username - Nama user admin
 */
export const sendPasswordResetEmail = async (
  email: string,
  code: string,
  username: string
): Promise<{ success: boolean; messageId: string }> => {
  const subject = 'Reset Password - Finger Attendance System';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px dashed #8b5cf6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #8b5cf6; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Password</h1>
        </div>
        <div class="content">
          <p>Halo <strong>${username}</strong>,</p>
          <p>Kami menerima permintaan untuk mereset password akun Anda. Gunakan kode verifikasi berikut:</p>
          
          <div class="code-box">
            <div class="code">${code}</div>
            <p style="margin-top: 10px; color: #666;">Kode berlaku selama 15 menit</p>
          </div>

          <div class="warning">
            <strong>⚠️ Penting:</strong> Jika Anda tidak meminta reset password, abaikan email ini dan password Anda akan tetap aman.
          </div>

          <p>Terima kasih,<br><strong>Tim Finger Attendance System</strong></p>
        </div>
        <div class="footer">
          <p>Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Halo ${username},

Kami menerima permintaan untuk mereset password akun Anda.

Kode Verifikasi: ${code}
(Berlaku selama 15 menit)

Jika Anda tidak meminta reset password, abaikan email ini.

Terima kasih,
Tim Finger Attendance System
  `;

  return await sendEmail(email, subject, html, text);
};

/**
 * Mengirim email sambutan (welcome email) setelah pendaftaran admin sukses.
 * @param email - Email penerima
 * @param username - Nama user admin baru
 */
export const sendWelcomeEmail = async (
  email: string,
  username: string
): Promise<{ success: boolean; messageId: string }> => {
  const subject = 'Selamat Datang - Finger Attendance System';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Selamat Datang!</h1>
        </div>
        <div class="content">
          <p>Halo <strong>${username}</strong>,</p>
          <p>Terima kasih telah mendaftar sebagai admin di <strong>Finger Attendance System</strong>.</p>
          
          <p>Akun Anda telah berhasil dibuat dan siap digunakan. Anda sekarang dapat login menggunakan kredensial yang telah Anda daftarkan.</p>

          <p><strong>Username:</strong> ${username}<br>
          <strong>Email:</strong> ${email}</p>

          <p>Jika Anda memiliki pertanyaan atau membutuhkan bantuan, jangan ragu untuk menghubungi tim support kami.</p>

          <p>Terima kasih,<br><strong>Tim Finger Attendance System</strong></p>
        </div>
        <div class="footer">
          <p>Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Halo ${username},

Terima kasih telah mendaftar sebagai admin di Finger Attendance System.

Username: ${username}
Email: ${email}

Akun Anda telah berhasil dibuat dan siap digunakan.

Terima kasih,
Tim Finger Attendance System
  `;

  return await sendEmail(email, subject, html, text);
};

/**
 * Mengirim email konfirmasi setelah password admin berhasil diubah/direset.
 * @param email - Email penerima
 * @param username - Nama user admin
 */
export const sendPasswordResetConfirmation = async (
  email: string,
  username: string
): Promise<{ success: boolean; messageId: string }> => {
  const subject = 'Password Berhasil Direset - Finger Attendance System';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Password Berhasil Direset</h1>
        </div>
        <div class="content">
          <p>Halo <strong>${username}</strong>,</p>
          <p>Password Anda telah berhasil direset. Anda sekarang dapat login menggunakan password baru Anda.</p>

          <div class="warning">
            <strong>⚠️ Keamanan:</strong> Jika Anda tidak melakukan perubahan ini, segera hubungi tim support kami.
          </div>

          <p>Terima kasih,<br><strong>Tim Finger Attendance System</strong></p>
        </div>
        <div class="footer">
          <p>Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Halo ${username},

Password Anda telah berhasil direset. Anda sekarang dapat login menggunakan password baru Anda.

Jika Anda tidak melakukan perubahan ini, segera hubungi tim support kami.

Terima kasih,
Tim Finger Attendance System
  `;

  return await sendEmail(email, subject, html, text);
};
