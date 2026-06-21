// src/config/i18n.translations.ts - Modul Penerjemah (Lokalisasi / Internationalization) untuk OpenAPI Docs

// Struktur data kontrak untuk objek terjemahan
interface Translations {
  title: string; // Judul API
  subtitle: string; // Subjudul
  tags: Record<string, string>; // Kamus terjemahan untuk kategori/tag API
  descriptions?: Record<string, string>; // Kamus terjemahan untuk deskripsi teks API
}

// Data kamus kata kunci terjemahan untuk bahasa Inggris ('en') dan bahasa Indonesia ('id')
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
    // Pemetaan frasa bahasa Inggris ke padanan bahasa Indonesia agar Scalar UI dapat menampilkan teks berbahasa lokal
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
 * Mengambil kata/frasa terjemahan berdasarkan parameter bahasa, kata kunci, dan kategori
 * @param lang Kode bahasa ('en' atau 'id')
 * @param key Kata kunci yang ingin diterjemahkan
 * @param category Kategori terjemahan ('tags' atau 'descriptions')
 */
export function getTranslation(
  lang: string,
  key: string,
  category: 'tags' | 'descriptions' | null = null
): string {
  const langData = translations[lang];
  if (!langData) return key; // Kembalikan kata kunci asli jika data bahasa tidak ditemukan

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

// Struktur data tag bawaan spesifikasi OpenAPI
interface OpenAPITag {
  name: string;
  description: string;
  [key: string]: unknown;
}

/**
 * Menerjemahkan seluruh daftar Kategori/Tag pada spesifikasi OpenAPI ke bahasa sasaran
 * @param tags Array objek tag OpenAPI
 * @param lang Bahasa tujuan ('en' / 'id')
 */
export function translateTags(tags: OpenAPITag[], lang: string): OpenAPITag[] {
  if (lang === 'en') return tags; // Tidak perlu menerjemahkan jika bahasa adalah Inggris

  return tags.map((tag) => {
    // Menghilangkan simbol emoji dari nama kategori agar proses pencocokan kamus berjalan lancar
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
 * Menerjemahkan paragraf deskripsi spesifikasi API dengan cara mencari dan mengganti frasa bahasa Inggris dengan bahasa Indonesia
 * @param description Teks deskripsi asli dalam bahasa Inggris
 * @param lang Bahasa tujuan ('en' / 'id')
 */
export function translateDescription(description: string, lang: string): string {
  if (lang === 'en') return description;

  let translated = description;
  const langData = translations[lang];
  const descs = langData ? langData.descriptions : null;

  // Melakukan iterasi untuk mengganti seluruh frasa yang cocok menggunakan regular expression global
  if (descs) {
    for (const [key, value] of Object.entries(descs)) {
      translated = translated.replace(new RegExp(key, 'g'), value);
    }
  }

  return translated;
}
