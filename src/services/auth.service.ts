import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { AdminRepository } from '../repositories/admin.repository';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { addToBlacklist, isBlacklisted } from '../utils/tokenBlacklist';
import logger from '../utils/logger';
import { sendPasswordResetEmail, sendPasswordResetConfirmation } from './email.service';

export class AuthService {
  public async login(email: string, password: string, ip: string, userAgent?: string) {
    const admin = await AuthRepository.findActiveAdminByEmail(email);

    if (!admin) {
      logger.warn('Login gagal: Pengguna tidak ditemukan', { email, ip });
      throw new Error('UNAUTHORIZED: Email atau password salah');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      logger.warn('Login gagal: Password salah', { email, ip });
      throw new Error('UNAUTHORIZED: Email atau password salah');
    }

    const { accessToken, refreshToken } = generateTokens(admin);

    await AdminRepository.updateLastLogin(admin.id);

    logger.audit('LOGIN_SUCCESS', admin.id, {
      username: admin.username,
      ip,
      userAgent,
    });

    return { admin, accessToken, refreshToken };
  }

  public async forgotPassword(email: string, ip: string) {
    const admin = await AuthRepository.findActiveAdminByEmail(email);
    if (!admin) {
      logger.warn('Reset password diminta untuk email yang tidak terdaftar', { email, ip });
      return; // Simulate success to prevent email enumeration
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await AuthRepository.deleteUnusedPasswordResets(admin.id);

    await AuthRepository.createPasswordReset({
      admins: { connect: { id: admin.id } },
      email: admin.email,
      code,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    try {
      await sendPasswordResetEmail(email, code, admin.username);
    } catch (emailError) {
      logger.warn('Gagal mengirim email reset password', {
        email,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
      logger.info('KODE RESET PASSWORD (Development)', { email, code });
    }

    logger.audit('PASSWORD_RESET_REQUESTED', admin.id, { email, ip });
  }

  public async verifyCode(email: string, code: string, ip: string) {
    const resetEntry = await AuthRepository.findValidResetCode(email, code);

    if (!resetEntry || !resetEntry.admins?.is_active) {
      logger.warn('Percobaan verifikasi kode tidak valid', { email, ip });
      throw new Error('BAD_REQUEST: Kode verifikasi tidak valid');
    }

    if (new Date() > new Date(resetEntry.expires_at)) {
      logger.warn('Percobaan verifikasi kode yang sudah kadaluarsa', { email, ip });
      throw new Error('BAD_REQUEST: Kode verifikasi sudah kadaluarsa');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await AuthRepository.saveResetToken(resetEntry.id, resetToken);

    logger.audit('RESET_CODE_VERIFIED', resetEntry.admin_id, { email, ip });

    return resetToken;
  }

  public async resetPassword(resetToken: string, newPassword: string, ip: string) {
    const resetEntry = await AuthRepository.findValidResetToken(resetToken);

    if (!resetEntry || !resetEntry.admins?.is_active) {
      logger.warn('Percobaan reset dengan token tidak valid', { ip });
      throw new Error('BAD_REQUEST: Token reset tidak valid atau sudah digunakan');
    }

    if (new Date() > new Date(resetEntry.expires_at)) {
      logger.warn('Percobaan reset dengan token yang sudah kadaluarsa', { ip });
      throw new Error('BAD_REQUEST: Token reset sudah kadaluarsa');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await AuthRepository.executePasswordReset(resetEntry.admin_id, resetEntry.id, hashedPassword);

    try {
      await sendPasswordResetConfirmation(resetEntry.email, resetEntry.admins.username);
    } catch (emailError) {
      logger.warn('Gagal mengirim email konfirmasi reset password', {
        email: resetEntry.email,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    logger.audit('PASSWORD_RESET_COMPLETED', resetEntry.admin_id, {
      email: resetEntry.email,
      ip,
    });
  }

  public async refreshToken(refresh_token: string, ip: string) {
    const blacklisted = await isBlacklisted(refresh_token);
    if (blacklisted) {
      logger.warn('Refresh token ditolak: token sudah di-blacklist', { ip });
      throw new Error('UNAUTHORIZED: Refresh token sudah dicabut. Silakan login kembali.');
    }

    const decoded = verifyRefreshToken(refresh_token);
    const admin = await AdminRepository.findById(decoded.id as number);

    if (!admin || !admin.is_active) {
      logger.warn('Refresh token ditolak: pengguna tidak ditemukan atau tidak aktif', { userId: decoded.id });
      throw new Error('UNAUTHORIZED: Refresh token tidak valid');
    }

    await addToBlacklist(refresh_token, 7 * 24 * 60 * 60);
    logger.info('Refresh token lama dimasukkan blacklist saat rotasi', { userId: admin.id });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin);

    logger.audit('TOKEN_REFRESH_ROTATED', admin.id, { ip });

    return { accessToken, newRefreshToken };
  }

  public async logout(accessToken: string | undefined, refresh_token: string | undefined, userId: number, username: string, ip: string) {
    let tokensBlacklisted = 0;

    if (accessToken) {
      await addToBlacklist(accessToken, 15 * 60);
      tokensBlacklisted++;
    }

    if (refresh_token) {
      await addToBlacklist(refresh_token, 7 * 24 * 60 * 60);
      tokensBlacklisted++;
    }

    logger.audit('LOGOUT', userId, {
      username,
      ip,
      tokensBlacklisted,
    });

    return tokensBlacklisted;
  }
}
