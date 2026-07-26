import type { DetikHari } from './tipe';

/**
 * Konversi waktu dinas.
 *
 * Dalam dokumen dinas KAI jam ditulis dengan pemisah titik (05.42.30),
 * bukan titik dua. Seluruh papan mengikuti konvensi tersebut.
 */

export function keDetik(jam: string): DetikHari {
  const bagian = jam.trim().split(/[.:]/).map((n) => Number.parseInt(n, 10));
  const h = bagian[0] ?? 0;
  const m = bagian[1] ?? 0;
  const d = bagian[2] ?? 0;
  return h * 3600 + m * 60 + d;
}

export function keJam(detik: DetikHari, tampilkanDetik = true): string {
  const t = ((Math.floor(detik) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const d = t % 60;
  const p = (n: number) => n.toString().padStart(2, '0');
  return tampilkanDetik ? `${p(h)}.${p(m)}.${p(d)}` : `${p(h)}.${p(m)}`;
}

/** Format deviasi waktu ala kolom "andil keterlambatan" pada laporan dinas. */
export function keDeviasi(detik: number): string {
  if (Math.abs(detik) < 30) return 'TEPAT';
  const menit = Math.round(Math.abs(detik) / 60);
  return detik > 0 ? `+${menit}′` : `−${menit}′`;
}

/** Deviasi dalam bentuk panjang untuk laporan tertulis. */
export function keDeviasiPanjang(detik: number): string {
  if (Math.abs(detik) < 30) return 'tepat waktu';
  const menit = Math.floor(Math.abs(detik) / 60);
  const sisa = Math.abs(detik) % 60;
  const teks = sisa >= 30 ? `${menit + 1} menit` : `${menit} menit`;
  return detik > 0 ? `terlambat ${teks}` : `lebih awal ${teks}`;
}

/** Klasifikasi ketepatan waktu untuk pewarnaan papan. */
export function golonganDeviasi(
  detik: number,
): 'AWAL' | 'TEPAT' | 'LAMBAT' | 'LAMBAT_BERAT' {
  if (detik < -60) return 'AWAL';
  if (detik <= 180) return 'TEPAT';
  if (detik <= 600) return 'LAMBAT';
  return 'LAMBAT_BERAT';
}

export function selisihJam(a: string, b: string): number {
  return keDetik(b) - keDetik(a);
}

export const SEHARI = 86400;

/**
 * Rentang satu sesi dinas dalam detik.
 *
 * Dinas malam melewati tengah malam (mis. 21.00-05.00). Rentangnya dinyatakan
 * dengan detik akhir yang melampaui 86400, bukan dipotong di pergantian hari,
 * supaya seluruh perhitungan waktu tetap berjalan lurus.
 */
export function rentangDinas(mulai: string, selesai: string): {
  mulai: DetikHari;
  selesai: DetikHari;
  melewatiTengahMalam: boolean;
} {
  const a = keDetik(mulai);
  const b = keDetik(selesai);
  const melewatiTengahMalam = b <= a;
  return { mulai: a, selesai: melewatiTengahMalam ? b + SEHARI : b, melewatiTengahMalam };
}

/**
 * Geser jam hari ke dalam rentang dinas yang sedang berjalan.
 * Jam sebelum awal dinas dianggap milik hari berikutnya.
 */
export function keDetikDinas(jam: string, mulaiDinas: DetikHari): DetikHari {
  const d = keDetik(jam);
  return d < mulaiDinas ? d + SEHARI : d;
}
