import type { AspekSinyal, KodeLin } from './tipe';

/**
 * Istilah dinas yang dipakai papan.
 *
 * Rujukan semboyan: Peraturan Dinas 3 PT KAI dan PM Perhubungan No. 10 Tahun
 * 2011, sebagaimana dirangkum pada laman "Persinyalan dan semboyan kereta api
 * di Indonesia". Rujukan tata cara warta dan pelayanan blok: Peraturan Dinas 19
 * Jilid I "Urusan Perjalanan Kereta Api dan Urusan Langsir" Pasal 36-38, serta
 * kutipan Peraturan Dinas Pengamanan Setempat (PDPS) di dalam Laporan Akhir
 * KNKT.24.01.01.02.
 */

export interface KeteranganAspek {
  semboyan: string;
  arti: string;
  /** Kelas warna papan. */
  token: string;
}

export const ASPEK_SINYAL: Record<AspekSinyal, KeteranganAspek> = {
  HIJAU: {
    semboyan: 'Semboyan 5',
    arti: 'Berjalan. Jalur yang akan dilewati aman.',
    token: 'signal-aspect-green',
  },
  KUNING: {
    semboyan: 'Semboyan 6',
    arti: 'Berjalan hati-hati, kecepatan terbatas. Berhenti di sinyal berikutnya.',
    token: 'signal-aspect-yellow',
  },
  MERAH: {
    semboyan: 'Semboyan 7',
    arti: 'Berhenti. Jalur yang akan dilewati tidak aman.',
    token: 'signal-aspect-red',
  },
  PUTIH: {
    semboyan: 'Semboyan 45',
    arti: 'Langsir boleh berjalan.',
    token: 'signal-aspect-white',
  },
  PADAM: {
    semboyan: '—',
    arti: 'Sinyal padam, tidak berdinas. Perjalanan dilayani dengan perintah tertulis.',
    token: 'signal-aspect-dark',
  },
};

/**
 * Kalimat warta kereta api sesuai PD 19 Jilid I Pasal 37.
 * Dipakai apa adanya pada log kejadian supaya bahasa papan sama dengan
 * bahasa buku WK.
 */
export const WARTA = {
  /** W1 — permintaan aman ke stasiun sebelah. */
  minta: (stasiun: string, nomorKA: string) =>
    `Ppka ${stasiun}, petak jalan untuk KA ${nomorKA} aman?`,
  /** W2 — jawaban aman. */
  aman: (stasiun: string, nomorKA: string, jam: string) =>
    `Ppka ${stasiun}, petak jalan untuk KA ${nomorKA} aman pukul ${jam}.`,
  /** W7 — belum aman. */
  belumAman: (nomorKA: string) =>
    `Tidak, petak jalan untuk KA ${nomorKA} belum aman, tunggu kabar.`,
  /** W9 — warta berangkat. */
  berangkat: (stasiun: string, nomorKA: string, jam: string) =>
    `Ppka ${stasiun}, KA ${nomorKA} berangkat pukul ${jam}.`,
  /** W10 — warta masuk. */
  masuk: (stasiun: string, nomorKA: string, jam: string) =>
    `Ppka ${stasiun}, KA ${nomorKA} sudah masuk di Manggarai pukul ${jam}.`,
  mengerti: (jam: string) => `Mengerti. Pukul ${jam}.`,
} as const;

/**
 * Indikator arah panah blok pada VDU persinyalan elektrik, mengikuti
 * keterangan PDPS yang dikutip laporan KNKT.
 */
export const ARTI_PANAH_BLOK = {
  PADAM: 'Kedudukan biasa — tidak ada KA di petak blok.',
  KUNING_KEDIP: 'Stasiun ini sedang meminta aman blok.',
  KUNING: 'Rute berangkat sudah dilayani / stasiun sebelah memberi aman blok.',
  MERAH: 'Kereta api berada di petak blok.',
} as const;

export const NAMA_LIN: Record<KodeLin, string> = {
  LIN_BOGOR: 'Lin Bogor',
  LIN_CIKARANG: 'Lin Cikarang',
  LIN_LINGKAR: 'Lin Lingkar',
  LIN_RANGKASBITUNG: 'Lin Rangkasbitung',
  LIN_TANGERANG: 'Lin Tangerang',
  KAJJ: 'KA Antarkota',
  BANDARA: 'Basoetta',
  KLB: 'KLB',
  LANGSIR: 'Langsiran',
};

export const WARNA_LIN: Record<KodeLin, string> = {
  LIN_BOGOR: '#d43b2f',
  LIN_CIKARANG: '#1b7fc4',
  LIN_LINGKAR: '#12a89a',
  LIN_RANGKASBITUNG: '#12a89a',
  LIN_TANGERANG: '#12a89a',
  KAJJ: '#c9a227',
  BANDARA: '#c9a227',
  KLB: '#a97bff',
  LANGSIR: '#6f8794',
};

export const KETERANGAN_JENIS_SEPUR = {
  RAYA: 'Sepur lurus — dilalui KA yang berjalan langsung.',
  BELOK: 'Sepur belok — untuk persilangan dan penyusulan.',
  SIMPAN: 'Sepur simpan — untuk rangkaian yang tidak berdinas.',
  BADUG: 'Sepur buntu, berakhir dengan penghalang.',
} as const;

/** Golongan kejadian pada log dinas, dengan kode pendek untuk kolom papan. */
export const KODE_KEJADIAN = {
  WARTA_MASUK: 'WK-MSK',
  WARTA_BERANGKAT: 'WK-BRT',
  WARTA_AMAN: 'WK-AMN',
  RUTE_BENTUK: 'RT-BTK',
  RUTE_KUNCI: 'RT-KNC',
  RUTE_BATAL: 'RT-BTL',
  RUTE_BEBAS: 'RT-BBS',
  RUTE_TOLAK: 'RT-TLK',
  SINYAL_AMAN: 'SN-AMN',
  SINYAL_MERAH: 'SN-MRH',
  KERETA_DATANG: 'KA-DTG',
  KERETA_BERANGKAT: 'KA-BRT',
  KERETA_TAHAN: 'KA-THN',
  GANGGUAN: 'GG-RNJ',
  GANGGUAN_PULIH: 'GG-PLH',
  PELANGGARAN: 'PL-KNF',
  DINAS: 'DN-INF',
} as const;

/**
 * Bentuk kalimat perintah/pemberitahuan gaya dokumen dinas.
 * Tidak memakai gaya percakapan aplikasi konsumen.
 */
export const KALIMAT = {
  ruteTerbentuk: (nomorKA: string, sepur: string, sinyal: string) =>
    `Rute masuk KA ${nomorKA} ke ${sepur} terbentuk dan terkunci. Sinyal ${sinyal} dilayani aman.`,
  ruteKeluarTerbentuk: (nomorKA: string, arah: string, sinyal: string) =>
    `Rute keluar KA ${nomorKA} ${arah} terbentuk dan terkunci. Sinyal ${sinyal} dilayani aman.`,
  ruteDitolak: (nomorKA: string, sebab: string) =>
    `Pembentukan rute KA ${nomorKA} ditolak: ${sebab}`,
  tertahan: (nomorKA: string, sinyal: string) =>
    `KA ${nomorKA} berhenti di muka sinyal ${sinyal} — Semboyan 7. Rute belum terbentuk.`,
  weselMacet: (nomor: string) =>
    `Wesel ${nomor} tidak dapat dibalik dari panel. Laporkan ke petugas Sintelis; pembentukan rute yang melalui wesel ini ditangguhkan.`,
  sinyalPadam: (nama: string) =>
    `Sinyal ${nama} padam. Perjalanan yang melalui sinyal ini dilayani dengan perintah tertulis dan berjalan dengan Semboyan 6.`,
  kepadatan: (nomorKA: string, tambahan: number) =>
    `Kepadatan penumpang di peron menahan naik-turun KA ${nomorKA}; waktu berhenti bertambah ${tambahan} detik.`,
  klb: (nomorKA: string, keterangan: string) =>
    `Perjalanan Luar Biasa diwartakan: KLB ${nomorKA} — ${keterangan}.`,
} as const;
