import daftarMentah from '../../data/stasiun/daftar.json';
import type { Emplasemen, Schedule } from './tipe';

/**
 * Daftar stasiun yang dapat didinasi, beserta pemuatan datanya.
 *
 * Berkas data tiap stasiun berjumlah ratusan kilobita, dan seluruhnya lebih
 * dari dua megabita. Karena itu hanya RINGKASAN yang ikut terbawa pada muatan
 * awal — angka-angkanya dihitung ulang dari berkas asli oleh
 * tools/bangun-daftar-stasiun.mjs, jadi tidak mungkin melenceng dari data yang
 * kemudian dimuat. Emplasemen dan jadwalnya sendiri baru diambil ketika satu
 * stasiun benar-benar dipilih.
 */

export type KodeStasiun = 'MRI' | 'KYA' | 'SLO' | 'JNG' | 'LPN' | 'BD';

export type SumberDenah = 'DOKUMEN_RESMI' | 'SURVEI_OSM';

export interface RingkasStasiun {
  kode: KodeStasiun;
  nama: string;
  daop: string;
  keterangan: string;
  ciri: string[];
  jumlahSepur: number;
  jumlahSepurPeron: number;
  jumlahWesel: number;
  jumlahLintas: number;
  lintas: string[];
  bertingkat: boolean;
  jumlahPerjalanan: number;
  puncakPerJam: number;
  tingkatKesulitan: 'DASAR' | 'MENENGAH' | 'PADAT' | 'BERAT';
  jumlahDinas: number;
  sumberDenah: SumberDenah;
  punyaTampilanOsm: boolean;
  keandalanJadwal: Record<string, number>;
  gapeka: string;
}

export const DAFTAR_STASIUN = (daftarMentah as { stasiun: RingkasStasiun[] })
  .stasiun;

export const STASIUN_BAWAAN: KodeStasiun = 'MRI';

export function ringkasStasiun(kode: string): RingkasStasiun | undefined {
  return DAFTAR_STASIUN.find((s) => s.kode === kode);
}

export function kodeStasiunSah(kode: string | null | undefined): KodeStasiun {
  const ada = DAFTAR_STASIUN.some((s) => s.kode === kode);
  return ada ? (kode as KodeStasiun) : STASIUN_BAWAAN;
}

export interface DataStasiun {
  kode: KodeStasiun;
  emplasemen: Emplasemen;
  jadwal: Schedule;
}

const tersimpan = new Map<KodeStasiun, DataStasiun>();

/**
 * Muat data satu stasiun.
 *
 * Jalur berkasnya ditulis sebagai teks harfiah pada tiap cabang — bukan
 * disusun dari variabel — supaya pemaket dapat mengenalinya dan memecah tiap
 * stasiun menjadi berkas terpisah. Jalur yang dirakit saat berjalan akan
 * membuat pemaket menyerah dan membundel keenamnya sekaligus.
 */
export async function muatStasiun(kode: KodeStasiun): Promise<DataStasiun> {
  const ada = tersimpan.get(kode);
  if (ada) return ada;

  let emplasemen: unknown;
  let jadwal: unknown;

  switch (kode) {
    case 'MRI':
      emplasemen = (await import('../../data/emplasemen-manggarai.json')).default;
      jadwal = (await import('../../data/jadwal-manggarai.json')).default;
      break;
    case 'KYA':
      emplasemen = (await import('../../data/stasiun/KYA/emplasemen.json')).default;
      jadwal = (await import('../../data/stasiun/KYA/jadwal.json')).default;
      break;
    case 'SLO':
      emplasemen = (await import('../../data/stasiun/SLO/emplasemen.json')).default;
      jadwal = (await import('../../data/stasiun/SLO/jadwal.json')).default;
      break;
    case 'JNG':
      emplasemen = (await import('../../data/stasiun/JNG/emplasemen.json')).default;
      jadwal = (await import('../../data/stasiun/JNG/jadwal.json')).default;
      break;
    case 'LPN':
      emplasemen = (await import('../../data/stasiun/LPN/emplasemen.json')).default;
      jadwal = (await import('../../data/stasiun/LPN/jadwal.json')).default;
      break;
    case 'BD':
      emplasemen = (await import('../../data/stasiun/BD/emplasemen.json')).default;
      jadwal = (await import('../../data/stasiun/BD/jadwal.json')).default;
      break;
    default: {
      // Menjaga daftar cabang tetap lengkap bila kode stasiun bertambah.
      const belumTertangani: never = kode;
      throw new Error(`Stasiun ${String(belumTertangani)} tidak dikenal.`);
    }
  }

  const data: DataStasiun = {
    kode,
    emplasemen: emplasemen as Emplasemen,
    jadwal: jadwal as Schedule,
  };
  tersimpan.set(kode, data);
  return data;
}

/** Label tingkat kepadatan untuk layar pemilihan. */
export const LABEL_KESULITAN: Record<RingkasStasiun['tingkatKesulitan'], string> = {
  DASAR: 'Ringan',
  MENENGAH: 'Sedang',
  PADAT: 'Padat',
  BERAT: 'Berat',
};

export const LABEL_SUMBER_DENAH: Record<SumberDenah, string> = {
  DOKUMEN_RESMI: 'Denah disusun dari dokumen tata letak resmi',
  SURVEI_OSM: 'Denah diturunkan dari geometri sepur tersurvei',
};
