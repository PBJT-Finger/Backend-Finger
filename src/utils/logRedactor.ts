/**
 * Log Redactor Utility
 * Menyensor (redact) informasi sensitif dari objek log aplikasi.
 * Mencegah data pribadi (PII), password, dan token JWT bocor ke dalam file log/konsol.
 *
 * Sesuai kepatuhan regulasi perlindungan data pribadi (GDPR / UU PDP).
 */

/**
 * Menyensor field sensitif dari objek data log secara rekursif.
 * @param obj - Objek yang akan disensor
 * @returns Salinan objek yang telah disensor
 */
export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Buat salinan dangkal (shallow copy) untuk array atau objek
  const redacted: any = Array.isArray(obj) ? [...obj] : { ...obj };

  // Daftar pola kata kunci sensitif yang wajib disensor
  const sensitiveKeys = [
    'password',
    'password_hash',
    'passwordHash',
    'token',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'authorization',
    'api_key',
    'apiKey',
    'secret',
    'credential',
    'apiSecret',
    'jwt',
    'bearer',
    'key',
    'hash',
  ];

  for (const key in redacted) {
    if (Object.prototype.hasOwnProperty.call(redacted, key)) {
      const lowerKey = key.toLowerCase();

      // Periksa apakah nama properti kunci mengandung salah satu pola sensitif
      const isSensitive = sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));

      if (isSensitive) {
        // Sensor berdasarkan tipe nilainya
        if (typeof redacted[key] === 'string') {
          const value = redacted[key] as string;
          // Tampilkan 4 karakter pertama untuk memudahkan debugging, sisanya disensor
          redacted[key] = value.length > 4 ? `${value.substring(0, 4)}...[REDACTED]` : '[REDACTED]';
        } else {
          redacted[key] = '[REDACTED]';
        }
      }
      // Lakukan rekursi jika properti berupa objek bersarang (nested object)
      else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = redactSensitiveData(redacted[key]);
      }
    }
  }

  return redacted;
}

/**
 * Menyensor parameter URL sensitif (seperti token/password di query string).
 * @param url - Alamat URL input
 * @returns URL yang sudah disensor query string sensitifnya
 */
export function redactUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  // Nama parameter query string yang wajib disensor
  const sensitiveParams = ['token', 'key', 'password', 'secret'];
  let redactedUrl = url;

  sensitiveParams.forEach((param) => {
    // Regex pencocokan parameter query string case-insensitive
    const regex = new RegExp(`(${param}=)[^&]*`, 'gi');
    redactedUrl = redactedUrl.replace(regex, `$1[REDACTED]`);
  });

  return redactedUrl;
}
