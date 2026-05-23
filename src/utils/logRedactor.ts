/**
 * Log Redactor Utility
 * Redacts sensitive information from log objects
 * Prevents PII, passwords, tokens from appearing in logs
 *
 * Phase 3 - P1 Enhancement for GDPR/PCI-DSS compliance
 */

/**
 * Redact sensitive fields from log objects
 * @param obj - Object to redact
 * @returns Redacted copy of object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Create shallow copy (array or object)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const redacted: any = Array.isArray(obj) ? [...obj] : { ...obj };

  // Sensitive key patterns to redact
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

      // Check if key matches sensitive pattern
      const isSensitive = sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive));

      if (isSensitive) {
        // Redact based on value type
        if (typeof redacted[key] === 'string') {
          const value = redacted[key] as string;
          // Show first 4 chars for debugging, rest redacted
          redacted[key] = value.length > 4 ? `${value.substring(0, 4)}...[REDACTED]` : '[REDACTED]';
        } else {
          redacted[key] = '[REDACTED]';
        }
      }
      // Recursively redact nested objects
      else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = redactSensitiveData(redacted[key]);
      }
    }
  }

  return redacted;
}

/**
 * Redact sensitive URL parameters
 * @param url - URL to redact
 * @returns Redacted URL
 */
export function redactUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;

  // Redact sensitive query parameters
  const sensitiveParams = ['token', 'key', 'password', 'secret'];
  let redactedUrl = url;

  sensitiveParams.forEach((param) => {
    const regex = new RegExp(`(${param}=)[^&]*`, 'gi');
    redactedUrl = redactedUrl.replace(regex, `$1[REDACTED]`);
  });

  return redactedUrl;
}
