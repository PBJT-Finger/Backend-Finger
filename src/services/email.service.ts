/**
 * Email Service
 * Handles sending emails for authentication flows (password reset, welcome emails, etc.)
 * Uses nodemailer with SMTP configuration
 */

import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { env } from '../config/env';

// Email configuration from environment variables
const emailConfig = {
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: env.SMTP_PORT || 587,
  secure: env.SMTP_SECURE, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
};

const fromEmail = env.EMAIL_FROM || 'noreply@fingerattendance.com';
const fromName = env.EMAIL_FROM_NAME || 'Finger Attendance System';

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
const initializeTransporter = (): nodemailer.Transporter | null => {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
    logger.warn('SMTP credentials not configured. Email service will use console logging only.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    logger.info('Email transporter initialized successfully');
    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email transporter', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Send email
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - HTML email body
 * @param text - Plain text email body (optional)
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text = ''
): Promise<{ success: boolean; messageId: string }> => {
  // Initialize transporter if not already done
  if (!transporter) {
    transporter = initializeTransporter();
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
  };

  try {
    // If SMTP not configured, fall back to console logging
    if (!transporter) {
      logger.info('📧 EMAIL (Console Mode - SMTP not configured)', {
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

    // Send actual email in production
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Gagal mengirim email. Silakan coba lagi.');
  }
};

/**
 * Send password reset code email
 * @param email - Recipient email
 * @param code - 6-digit verification code
 * @param username - Admin username
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

If Anda tidak meminta reset password, abaikan email ini.

Terima kasih,
Tim Finger Attendance System
  `;

  return await sendEmail(email, subject, html, text);
};

/**
 * Send welcome email for new admin registration
 * @param email - Recipient email
 * @param username - Admin username
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
 * Send password reset confirmation email
 * @param email - Recipient email
 * @param username - Admin username
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
