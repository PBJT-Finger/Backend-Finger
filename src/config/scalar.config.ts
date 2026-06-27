// src/config/scalar.config.ts - Konfigurasi tampilan dokumentasi API Scalar interaktif
// Menyembunyikan bagian model database agar tampilan dokumentasi lebih bersih dan terfokus pada endpoint API.

/**
 * Menghasilkan halaman HTML lengkap yang memuat pustaka Scalar API Reference secara client-side.
 * @param _spec Objek spesifikasi OpenAPI (tidak dipakai langsung karena Scalar mengambil data secara dinamis dari URL)
 */
export function generateScalarHTML(_spec: any): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <title>Finger API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  
  <style>
    body { 
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body>

  <!-- Elemen mount untuk Scalar API Reference.
       - data-url: Mengambil spesifikasi OpenAPI JSON secara dinamis dari endpoint backend kita.
       - data-proxy-url: Proxy opsional untuk melakukan request HTTP "Try It Out" menghindari isu CORS -->
  <script 
    id="api-reference" 
    data-url="/finger-api/docs-json"
  ></script>
  
  <!-- Logika Klien untuk Mengatur Opsi Tampilan Dokumentasi -->
  <script>
    (function() {
        const scriptTag = document.getElementById('api-reference');
        
        // 1. Menggunakan tata letak modern (data-layout=modern)
        scriptTag.setAttribute('data-layout', 'modern');
        
        // 2. Menampilkan bilah sisi navigasi kiri (sidebar)
        scriptTag.setAttribute('data-show-sidebar', 'true');
        
        // 3. Menyembunyikan bagian Schema/Models database di bagian bawah dokumen agar tampilan lebih ringkas
        scriptTag.setAttribute('data-hide-models', 'true');
        
        // 4. Memblokir pengeditan dokumentasi secara langsung oleh pengguna umum
        scriptTag.setAttribute('data-is-editable', 'false');

        // 5. Mengaktifkan mode gelap (dark mode) secara bawaan untuk estetika visual yang premium
        scriptTag.setAttribute('data-dark-mode', 'true');
    })();
  </script>

  <!-- Memuat berkas JavaScript pustaka Scalar API Reference via CDN jsDelivr -->
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
