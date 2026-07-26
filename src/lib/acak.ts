/**
 * Pembangkit bilangan acak deterministik (mulberry32).
 *
 * Simulasi memakai benih tetap per sesi dinas supaya satu sesi dapat diulang
 * persis untuk keperluan pemeriksaan laporan — bukan Math.random().
 */
export class Acak {
  private keadaan: number;

  constructor(benih: number) {
    this.keadaan = benih >>> 0;
  }

  /** Bilangan pecahan 0 <= x < 1. */
  pecahan(): number {
    this.keadaan = (this.keadaan + 0x6d2b79f5) >>> 0;
    let t = this.keadaan;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Bilangan bulat pada rentang [min, maks]. */
  bulat(min: number, maks: number): number {
    return min + Math.floor(this.pecahan() * (maks - min + 1));
  }

  /** Benar dengan peluang p. */
  peluang(p: number): boolean {
    return this.pecahan() < p;
  }

  pilih<T>(daftar: readonly T[]): T | null {
    if (daftar.length === 0) return null;
    return daftar[Math.floor(this.pecahan() * daftar.length)] ?? null;
  }

  /** Sebaran normal terpotong — untuk sebaran keterlambatan datang. */
  normal(rerata: number, simpangan: number, min: number, maks: number): number {
    const u1 = Math.max(this.pecahan(), 1e-9);
    const u2 = this.pecahan();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.min(maks, Math.max(min, rerata + z * simpangan));
  }

  salin(): Acak {
    return new Acak(this.keadaan);
  }
}

/** Benih dari teks (untuk id dinas). */
export function benihDariTeks(teks: string): number {
  let h = 2166136261;
  for (let i = 0; i < teks.length; i += 1) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
