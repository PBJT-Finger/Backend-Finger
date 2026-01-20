/**
 * Email Service
 * Handles sending emails for authentication flows (password reset, welcome emails, etc.)
 * Uses nodemailer with SMTP configuration
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
};

const fromEmail = process.env.EMAIL_FROM || 'noreply@fingerattendance.com';
const fromName = process.env.EMAIL_FROM_NAME || 'Finger Attendance System';

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter
 */
const initializeTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.warn('SMTP credentials not configured. Email service will use console logging only.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport(emailConfig);
    logger.info('Email transporter initialized successfully');
    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email transporter', { error: error.message });
    return null;
  }
};

/**
 * Send email
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} html - HTML email body
 * @param {String} text - Plain text email body (optional)
 */
const sendEmail = async (to, subject, html, text = '') => {
  // Initialize transporter if not already done
  if (!transporter) {
    transporter = initializeTransporter();
  }

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '') // Strip HTML tags for text version
  };

  try {
    // If in development mode or SMTP not configured, just log to console
    if (process.env.NODE_ENV === 'development' || !transporter) {
      logger.info('📧 EMAIL (Development Mode)', {
        to,
        subject,
        preview: html.substring(0, 200)
      });
      console.log('\n=== EMAIL PREVIEW ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text || html}`);
      console.log('===================\n');
      return { success: true, messageId: 'dev-mode' };
    }

    // Send actual email in production
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: info.messageId
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error.message
    });
    throw new Error('Gagal mengirim email. Silakan coba lagi.');
  }
};

/**
 * Send password reset code email
 * @param {String} email - Recipient email
 * @param {String} code - 6-digit verification code
 * @param {String} username - Admin username
 */
const sendPasswordResetEmail = async (email, code, username) => {
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
 * Send welcome email for new admin registration
 * @param {String} email - Recipient email
 * @param {String} username - Admin username
 */
const sendWelcomeEmail = async (email, username) => {
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
 * @param {String} email - Recipient email
 * @param {String} username - Admin username
 */
const sendPasswordResetConfirmation = async (email, username) => {
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

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordResetConfirmation
};
