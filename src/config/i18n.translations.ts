// src/config/i18n.translations.ts - Translation Module

interface Translations {
  title: string;
  subtitle: string;
  tags: Record<string, string>;
  descriptions?: Record<string, string>;
}

export const translations: Record<string, Translations> = {
  en: {
    title: 'Finger API',
    subtitle: 'Enterprise Attendance Management System',
    tags: {
      Authentication: 'Authentication',
      'User Profile': 'User Profile',
      Attendance: 'Attendance',
      Report: 'Report',
      Dashboard: 'Dashboard',
      Export: 'Export',
      'Admin Management': 'Admin Management',
      'User Management': 'User Management',
      'Report Profiles': 'Report Profiles',
      'ZK Devices': 'ZK Devices',
      'Health & Monitoring': 'Health & Monitoring',
    },
  },
  id: {
    title: 'API Finger',
    subtitle: 'Sistem Manajemen Absensi Enterprise',
    tags: {
      Authentication: 'Autentikasi',
      'User Profile': 'Profil Pengguna',
      Attendance: 'Absensi',
      Report: 'Laporan',
      Dashboard: 'Dashboard',
      Export: 'Ekspor Data',
      'Admin Management': 'Manajemen Admin',
      'User Management': 'Manajemen Pengguna',
      'Report Profiles': 'Profil Laporan',
      'ZK Devices': 'Perangkat ZK',
      'Health & Monitoring': 'Kesehatan & Monitoring',
    },
    descriptions: {
      'Enterprise Attendance Management System': 'Sistem Manajemen Absensi Enterprise',
      'Finger API': 'API Finger',
      'fingerprint-based': 'berbasis sidik jari',
      'designed for campus and institutional use': 'dirancang untuk kampus dan institusi',
      'enterprise-grade features': 'fitur tingkat enterprise',
      'Login, refresh tokens, and logout endpoints': 'Endpoint login, refresh token, dan logout',
      'Get and update user profile information': 'Lihat dan update informasi profil pengguna',
      'CRUD operations for attendance records': 'Operasi CRUD untuk data absensi',
      'Analytics and attendance summary reports': 'Analitik dan laporan ringkasan absensi',
      'Real-time statistics and metrics': 'Statistik dan metrik',
      'Export data to Excel, CSV, and PDF formats': 'Ekspor data ke format Excel, CSV, dan PDF',
      'Manage admin users and permissions': 'Kelola pengguna admin dan hak akses',
      'CRUD operations for regular users': 'Operasi CRUD untuk pengguna biasa',
      'Manage reporting profiles and configurations': 'Kelola profil laporan dan konfigurasi',
      'Fingerprint device integration (internal use)':
        'Integrasi perangkat sidik jari (penggunaan internal)',
      'System health checks and metrics': 'Pemeriksaan kesehatan sistem dan metrik',
    },
  },
};

/**
 * Get translation for a given key
 */
export function getTranslation(
  lang: string,
  key: string,
  category: 'tags' | 'descriptions' | null = null
): string {
  const langData = translations[lang];
  if (!langData) return key;

  if (category) {
    if (category === 'tags') {
      return langData.tags[key] || key;
    }
    if (category === 'descriptions' && langData.descriptions) {
      return langData.descriptions[key] || key;
    }
    return key;
  }

  if (key === 'title') return langData.title;
  if (key === 'subtitle') return langData.subtitle;

  return key;
}

interface OpenAPITag {
  name: string;
  description: string;
  [key: string]: unknown;
}

/**
 * Translate OpenAPI spec tags
 */
export function translateTags(tags: OpenAPITag[], lang: string): OpenAPITag[] {
  if (lang === 'en') return tags;

  return tags.map((tag) => {
    // Remove emoji from name
    const cleanName = tag.name.replace(/[^\w\s&-]/g, '').trim();
    const translatedName = getTranslation(lang, cleanName, 'tags');
    const translatedDesc = getTranslation(lang, tag.description, 'descriptions');

    return {
      ...tag,
      name: translatedName,
      description: translatedDesc,
    };
  });
}

/**
 * Translate spec description
 */
export function translateDescription(description: string, lang: string): string {
  if (lang === 'en') return description;

  let translated = description;
  const langData = translations[lang];
  const descs = langData ? langData.descriptions : null;

  if (descs) {
    for (const [key, value] of Object.entries(descs)) {
      translated = translated.replace(new RegExp(key, 'g'), value);
    }
  }

  return translated;
}
