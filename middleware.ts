// File: middleware.ts
export { default } from "next-auth/middleware";

export const config = { 
  /*
   * Cocokkan semua path request KECUALI yang dimulai dengan:
   * - api (rute API)
   * - _next/static (file statis)
   * - _next/image (file optimasi gambar)
   * - favicon.ico (file ikon)
   *
   * Dan kita perlu menambahkan pengecualian untuk halaman login kita sendiri.
   * Sayangnya, matcher tidak mendukung negative lookahead yang kompleks dengan mudah.
   *
   * Jadi, kita akan menggunakan pendekatan yang sedikit berbeda.
   * Kita akan membiarkan matcher-nya luas, tapi kita akan mengatur ulang
   * halaman login ke luar dari folder /admin.
   *
   * TIDAK, ada cara yang lebih baik. Mari kita atur ulang `signIn` page di authOptions
   * dan middleware-nya.
   */

  // --- SOLUSI FINAL DAN TERBAIK ---

  // Matcher ini akan melindungi SEMUA rute di bawah /admin.
  matcher: ["/admin/:path*"], 
};