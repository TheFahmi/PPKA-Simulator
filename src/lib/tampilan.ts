import type { FaseKereta, KeretaAktif } from './tipe';

/** Label fase perjalanan sebagaimana disebut dalam dinas. */
export const LABEL_FASE: Record<FaseKereta, string> = {
  BELUM_DINAS: 'Belum diwartakan',
  DIWARTAKAN: 'Di petak jalan',
  TERTAHAN_SINYAL: 'Tertahan sinyal masuk',
  MASUK: 'Berjalan masuk',
  BERHENTI: 'Berhenti di peron',
  SIAP_BERANGKAT: 'Siap berangkat',
  BERANGKAT: 'Berjalan keluar',
  SELESAI: 'Selesai',
  BATAL: 'Dibatalkan',
};

export const WARNA_FASE: Record<FaseKereta, string> = {
  BELUM_DINAS: '#4d6673',
  DIWARTAKAN: '#4aa8d8',
  TERTAHAN_SINYAL: '#e02b1d',
  MASUK: '#e9a51b',
  BERHENTI: '#1fb85a',
  SIAP_BERANGKAT: '#e9a51b',
  BERANGKAT: '#e9a51b',
  SELESAI: '#4d6673',
  BATAL: '#8f6bd6',
};

/**
 * Label fase untuk satu perjalanan tertentu.
 * KA yang berjalan langsung tidak pernah berhenti, jadi fase jalannya disebut
 * "berjalan langsung", bukan "berjalan masuk".
 */
export function labelFase(k: KeretaAktif): string {
  if (k.langsung && (k.fase === 'MASUK' || k.fase === 'BERANGKAT')) return 'Berjalan langsung';
  if (k.langsung && k.fase === 'DIWARTAKAN') return 'Di petak jalan (langsung)';
  return LABEL_FASE[k.fase];
}

/** Urutan tampil papan dinas: yang menuntut tindakan PPKA didahulukan. */
const BOBOT_FASE: Record<FaseKereta, number> = {
  TERTAHAN_SINYAL: 0,
  DIWARTAKAN: 1,
  SIAP_BERANGKAT: 2,
  MASUK: 3,
  BERANGKAT: 3,
  BERHENTI: 4,
  BELUM_DINAS: 5,
  SELESAI: 6,
  BATAL: 7,
};

export function urutkanPapanDinas(daftar: KeretaAktif[]): KeretaAktif[] {
  return [...daftar].sort((a, b) => {
    const d = BOBOT_FASE[a.fase] - BOBOT_FASE[b.fase];
    if (d !== 0) return d;
    return a.jadwalDatang - b.jadwalDatang;
  });
}

/** Kereta yang menuntut pelayanan rute dari PPKA saat ini. */
export function menuntutTindakan(k: KeretaAktif): boolean {
  return (
    k.fase === 'DIWARTAKAN' || k.fase === 'TERTAHAN_SINYAL' || k.fase === 'SIAP_BERANGKAT'
  );
}
