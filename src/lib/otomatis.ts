import type { IndeksEmplasemen } from './emplasemen';
import {
  bentukRute,
  jenisRuteMasuk,
  usulanRuteKeluar,
  usulanRuteMasuk,
  type KeadaanSimulasi,
  type UsulanRute,
} from './simulasi';
import type { KeretaAktif } from './tipe';

/**
 * Pelayanan rute otomatis.
 *
 * Modul ini menghitung penetapan jalur yang akan diambil bila pelayanan
 * diserahkan kepada papan. Ia dipakai untuk dua hal sekaligus: menyusun usul
 * bagi petugas pada mode SARAN, dan melayani sendiri rute pada mode PENUH.
 * Keduanya memakai penalaran yang sama supaya usul yang ditampilkan benar-benar
 * sama dengan yang akan dikerjakan papan.
 *
 * Kaidah pelayanannya meniru kebiasaan dinas, bukan sekadar mengambil pilihan
 * pertama yang tersedia:
 *
 *  1. Perjalanan yang sudah tertahan di muka sinyal dilayani lebih dahulu.
 *  2. Jalur dipilih dari peruntukan lazim relasinya; di antara jalur lazim yang
 *     bebas, dipilih yang paling jarang terpakai supaya beban peron merata dan
 *     kedua jalur satu pasang terpakai berselang-seling.
 *  3. Jalur di luar peruntukan lazim TIDAK diambil selama rangkaian belum
 *     tertahan. Menahan sebentar lebih baik daripada menurunkan penumpang di
 *     peron yang salah — dan jalur tanpa peron aktif tidak pernah diambil untuk
 *     perjalanan berpenumpang.
 *  4. Rute keluar hanya dibentuk menuju batas emplasemen sesuai jadwal
 *     perjalanan. Papan tidak pernah memberangkatkan kereta ke arah yang keliru.
 *  5. Rute keluar disiapkan menjelang waktu berangkat, bukan jauh sebelumnya,
 *     supaya tidak mengunci wesel yang masih dibutuhkan perjalanan lain.
 */

/** Selang sebelum jam berangkat saat rute keluar mulai disiapkan (detik). */
const AMBANG_SIAP_KELUAR = 90;

export interface SaranPelayanan {
  keretaId: string;
  nomorKA: string;
  jenis: 'MASUK' | 'KELUAR';
  sasaranId: string;
  label: string;
  alasan: string;
  /** Rangkaian sudah tertahan di muka sinyal — pelayanan mendesak. */
  mendesak: boolean;
}

/** Perjalanan yang sedang menuntut pelayanan rute, terurut menurut kemendesakan. */
function antreanPelayanan(K: KeadaanSimulasi): KeretaAktif[] {
  const perluMasuk = K.kereta.filter(
    (k) => k.fase === 'TERTAHAN_SINYAL' || k.fase === 'DIWARTAKAN',
  );
  const perluKeluar = K.kereta.filter(
    (k) =>
      (k.fase === 'SIAP_BERANGKAT' ||
        (k.fase === 'BERHENTI' &&
          (k.sisaBerhentiDetik <= 30 || K.waktu >= k.jadwalBerangkat - AMBANG_SIAP_KELUAR))) &&
      k.sepurId !== null,
  );

  return [...perluMasuk, ...perluKeluar].sort((a, b) => {
    const bobot = (k: KeretaAktif) =>
      k.fase === 'TERTAHAN_SINYAL' ? 0 : k.fase === 'SIAP_BERANGKAT' ? 1 : 2;
    const d = bobot(a) - bobot(b);
    if (d !== 0) return d;
    return a.tibaDiSinyalPada - b.tibaDiSinyalPada;
  });
}

function sudahAdaRute(
  K: KeadaanSimulasi,
  kereta: KeretaAktif,
  jenis: 'MASUK' | 'KELUAR',
): boolean {
  const dicari = jenis === 'MASUK' ? jenisRuteMasuk(kereta) : 'KELUAR';
  return Object.values(K.rute).some((r) => r.keretaId === kereta.id && r.jenis === dicari);
}

/** Jumlah rangkaian yang sudah dilayani di sebuah sepur pada dinas ini. */
function beban(K: KeadaanSimulasi, sepurId: string): number {
  return K.pemakaianSepur[sepurId]?.jumlahKereta ?? 0;
}

/** Pilih jalur masuk terbaik bagi sebuah perjalanan. */
function pilihJalurMasuk(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  k: KeretaAktif,
): SaranPelayanan | null {
  const tersedia = usulanRuteMasuk(K, ix, k).filter((u) => !u.penghalang);
  if (tersedia.length === 0) return null;

  const mendesak = k.fase === 'TERTAHAN_SINYAL';
  const lazim = tersedia.filter((u) => u.lazim);

  const bandingBeban = (a: UsulanRute, b: UsulanRute) =>
    beban(K, a.sasaranId) - beban(K, b.sasaranId);

  if (lazim.length > 0) {
    const pilihan = [...lazim].sort(bandingBeban)[0] as UsulanRute;
    return {
      keretaId: k.id,
      nomorKA: k.nomorKA,
      jenis: 'MASUK',
      sasaranId: pilihan.sasaranId,
      label: pilihan.label,
      alasan:
        lazim.length > 1
          ? `Sesuai peruntukan relasi; dipilih karena paling jarang terpakai pada dinas ini (${beban(K, pilihan.sasaranId)} rangkaian).`
          : 'Satu-satunya jalur sesuai peruntukan yang dapat dilayani saat ini.',
      mendesak,
    };
  }

  // Tidak ada jalur lazim yang bebas. Menahan lebih baik daripada salah peron —
  // pengalihan hanya ditempuh bila rangkaian sudah tertahan di muka sinyal.
  if (!mendesak) return null;

  // KA berjalan langsung, KLB, dan langsiran tidak menuntut peron; bagi KA
  // berpenumpang yang berhenti, sepur tanpa peron aktif tidak pernah dipakai.
  const bebasPeron = k.langsung || k.lin === 'KLB' || k.lin === 'LANGSIR';
  const layak = bebasPeron
    ? tersedia
    : tersedia.filter((u) => ix.data.sepur.find((s) => s.id === u.sasaranId)?.peronId !== null);
  if (layak.length === 0) return null;

  const pilihan = [...layak].sort(bandingBeban)[0] as UsulanRute;
  return {
    keretaId: k.id,
    nomorKA: k.nomorKA,
    jenis: 'MASUK',
    sasaranId: pilihan.sasaranId,
    label: pilihan.label,
    alasan:
      'Pengalihan darurat: rangkaian tertahan di muka sinyal dan tidak ada jalur sesuai peruntukan yang bebas.',
    mendesak: true,
  };
}

/** Pilih batas keluar bagi sebuah perjalanan yang siap berangkat. */
function pilihJalurKeluar(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  k: KeretaAktif,
): SaranPelayanan | null {
  const tersedia = usulanRuteKeluar(K, ix, k).filter((u) => !u.penghalang && u.lazim);
  const pilihan = tersedia[0];
  if (!pilihan) return null;
  return {
    keretaId: k.id,
    nomorKA: k.nomorKA,
    jenis: 'KELUAR',
    sasaranId: pilihan.sasaranId,
    label: pilihan.label,
    alasan: pilihan.berbalikArah
      ? 'Sesuai jadwal perjalanan; rangkaian berbalik arah lebih dulu.'
      : 'Batas emplasemen sesuai jadwal perjalanan.',
    mendesak: k.fase === 'SIAP_BERANGKAT' && K.waktu > k.jadwalBerangkat,
  };
}

/**
 * Susun usul pelayanan untuk seluruh perjalanan yang sedang menuntut rute.
 * Tidak mengubah keadaan apa pun.
 */
export function susunSaran(K: KeadaanSimulasi, ix: IndeksEmplasemen): SaranPelayanan[] {
  const hasil: SaranPelayanan[] = [];
  for (const k of antreanPelayanan(K)) {
    const perluMasuk = k.fase === 'TERTAHAN_SINYAL' || k.fase === 'DIWARTAKAN';
    const jenis: 'MASUK' | 'KELUAR' = perluMasuk ? 'MASUK' : 'KELUAR';
    if (sudahAdaRute(K, k, jenis)) continue;
    const saran = perluMasuk ? pilihJalurMasuk(K, ix, k) : pilihJalurKeluar(K, ix, k);
    if (saran) hasil.push(saran);
  }
  return hasil;
}

/** Usul pelayanan untuk satu perjalanan tertentu, atau null bila tidak ada. */
export function saranUntuk(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  keretaId: string,
): SaranPelayanan | null {
  return susunSaran(K, ix).find((s) => s.keretaId === keretaId) ?? null;
}

/**
 * Layani sendiri seluruh rute yang dapat dilayani saat ini.
 * Mengembalikan banyaknya rute yang berhasil dibentuk.
 */
export function jalankanOtomatis(K: KeadaanSimulasi, ix: IndeksEmplasemen): number {
  let dibentuk = 0;
  for (const saran of susunSaran(K, ix)) {
    const galat = bentukRute(K, ix, saran.keretaId, saran.jenis, saran.sasaranId, true);
    if (galat === null) dibentuk += 1;
  }
  return dibentuk;
}
