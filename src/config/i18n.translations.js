// src/config/i18n.translations.js - Translation Module

/**
 * Translations for API Documentation
 * Supports: English (en), Indonesian (id)
 */

const translations = {
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
      'ADMS Devices': 'ADMS Devices',
      'Health & Monitoring': 'Health & Monitoring'
    }
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
      'ADMS Devices': 'Perangkat ADMS',
      'Health & Monitoring': 'Kesehatan & Monitoring'
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
      'System health checks and metrics': 'Pemeriksaan kesehatan sistem dan metrik'
    }
  }
};

/**
 * Get translation for a given key
 */
function getTranslation(lang, key, category = null) {
  if (!translations[lang]) return key;

  if (category) {
    return translations[lang][category]?.[key] || key;
  }

  return translations[lang][key] || key;
}

/**
 * Translate OpenAPI spec tags
 */
function translateTags(tags, lang) {
  if (lang === 'en') return tags;

  return tags.map(tag => {
    // Remove emoji from name
    const cleanName = tag.name.replace(/[^\w\s&-]/g, '').trim();
    const translatedName = getTranslation(lang, cleanName, 'tags');
    const translatedDesc = getTranslation(lang, tag.description, 'descriptions');

    return {
      ...tag,
      name: translatedName,
      description: translatedDesc
    };
  });
}

/**
 * Translate spec description
 */
function translateDescription(description, lang) {
  if (lang === 'en') return description;

  let translated = description;
  const descs = translations[lang].descriptions;

  for (const [key, value] of Object.entries(descs)) {
    translated = translated.replace(new RegExp(key, 'g'), value);
  }

  return translated;
}

module.exports = {
  translations,
  getTranslation,
  translateTags,
  translateDescription
};
