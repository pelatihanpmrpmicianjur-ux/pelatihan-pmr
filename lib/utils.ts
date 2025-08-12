// File: lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fungsi untuk menstandarkan nama sekolah berdasarkan aturan spesifik.
 * Contoh: "smk negeri 1 cipanas" -> "SMKN 1 CIPANAS"
 * @param name Nama sekolah dari input user.
 * @returns Nama sekolah yang sudah dinormalisasi dan distandarkan.
 */
export function normalizeSchoolName(name: string): string {
  if (!name) return '';
  let normalized = name.toUpperCase().trim();
  
  // Aturan harus dijalankan secara berurutan dan hati-hati agar tidak tumpang tindih
  // Prioritaskan yang lebih spesifik dulu (misal: SMA IT sebelum SMA N)
  normalized = normalized.replace(/\s+NEGERI\s+/g, ' N '); // Standarkan 'NEGERI' menjadi 'N'
  normalized = normalized.replace(/SMK ISLAM TERPADU|SMK IT/g, 'SMKIT');
  normalized = normalized.replace(/SMA ISLAM TERPADU|SMA IT/g, 'SMAIT');
  normalized = normalized.replace(/SMP ISLAM TERPADU|SMP IT/g, 'SMPIT');

  normalized = normalized.replace(/SMK N /g, 'SMKN ');
  normalized = normalized.replace(/SMA N /g, 'SMAN ');
  normalized = normalized.replace(/MA N /g, 'MAN ');
  normalized = normalized.replace(/SMP N /g, 'SMPN ');
  normalized = normalized.replace(/MTS N /g, 'MTSN ');

  // Hapus spasi ganda yang mungkin muncul
  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Fungsi untuk mengubah string apapun menjadi format slug yang aman untuk URL/path.
 * Contoh: "SMKN 1 CIPANAS" -> "smkn-1-cipanas"
 * @param text Teks yang akan diubah menjadi slug.
 * @returns String dalam format kebab-case.
 */
export function slugify(text: string): string {
    if (!text) return '';
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
}