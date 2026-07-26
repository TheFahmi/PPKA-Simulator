import { Acak, benihDariTeks } from './acak';
import { cariRute, type HasilRute, type IndeksEmplasemen } from './emplasemen';
import { KALIMAT, KODE_KEJADIAN, WARTA } from './semboyan';
import type {
  AspekSinyal,
  DetikHari,
  Dinas,
  Gangguan,
  KecepatanJam,
  JenisRute,
  KedudukanWesel,
  Kejadian,
  KeretaAktif,
  ModeOtomatis,
  PemakaianSepur,
  Pelanggaran,
  Rute,
  StatusBlok,
  StatusSinyal,
  StatusWesel,
  TingkatKejadian,
  Trip,
} from './tipe';
import { keDetikDinas, keJam, rentangDinas } from './waktu';

/* ------------------------------------------------------------------ */
/* Tetapan pemodelan                                                   */
/* ------------------------------------------------------------------ */

/** Kecepatan rangkaian di dalam emplasemen (meter per detik). */
const KECEPATAN_EMPLASEMEN = 9;
/**
 * Kecepatan KA yang berjalan langsung. Puncak kecepatan lintas menurut GAPEKA
 * adalah 60 km/jam pada petak Jatinegara-Manggarai dan 90 km/jam pada petak
 * Manggarai-Gambir; di dalam emplasemen dipakai angka di bawah keduanya.
 */
const KECEPATAN_LANGSUNG = 18;
/** Selang antara pewartaan dari stasiun tetangga dan tibanya di sinyal masuk. */
const SELANG_WARTA = 300;
/** Waktu jalan dari sinyal masuk sampai berhenti di peron. */
const LARI_MASUK = 90;
/** Waktu jalan dari sinyal masuk sampai melintas badan sepur bagi KA langsung. */
const LARI_MASUK_LANGSUNG = 30;
/** Batas tertahan di muka sinyal sebelum dicatat sebagai pelanggaran. */
const AMBANG_TERTAHAN = 120;
/** Ambang deviasi keberangkatan yang masih dihitung tepat waktu. */
export const AMBANG_TEPAT_WAKTU = 180;
/** Tambahan waktu bila perjalanan dilayani dengan perintah tertulis. */
const TAHAN_PERINTAH_TERTULIS = 60;

export interface KeadaanSimulasi {
  dinas: Dinas;
  waktu: DetikHari;
  mulai: DetikHari;
  selesaiPada: DetikHari;
  berjalan: boolean;
  /** Faktor percepatan jam dinas. */
  kecepatan: KecepatanJam;
  /** Tingkat bantuan pelayanan rute. */
  modeOtomatis: ModeOtomatis;
  /** Banyaknya rute yang dibentuk oleh pelayanan otomatis. */
  ruteOtomatis: number;
  dinasSelesai: boolean;
  blok: Record<string, StatusBlok>;
  wesel: Record<string, StatusWesel>;
  sinyal: Record<string, StatusSinyal>;
  rute: Record<string, Rute>;
  kereta: KeretaAktif[];
  kejadian: Kejadian[];
  gangguan: Gangguan[];
  pelanggaran: Pelanggaran[];
  pemakaianSepur: Record<string, PemakaianSepur>;
  konflikDicegah: number;
  /** Waktu keberangkatan terakhir per batas emplasemen (penjaga headway). */
  terakhirKeluar: Record<string, DetikHari>;
  acak: Acak;
  nomorUrut: number;
  benih: number;
}

/* ------------------------------------------------------------------ */
/* Penyiapan                                                           */
/* ------------------------------------------------------------------ */

export function buatKeadaanAwal(
  ix: IndeksEmplasemen,
  dinas: Dinas,
  perjalanan: Trip[],
  benih = benihDariTeks(dinas.id),
): KeadaanSimulasi {
  const acak = new Acak(benih);
  // Dinas malam melewati tengah malam; rentangnya dinyatakan dalam detik dinas
  // yang boleh melampaui 86400 supaya jam terus maju tanpa terpotong.
  const { mulai, selesai: selesaiPada } = rentangDinas(dinas.mulai, dinas.selesai);

  const blok: Record<string, StatusBlok> = {};
  for (const b of ix.data.blok) {
    blok[b.id] = { blokId: b.id, keadaan: 'BEBAS', keretaId: null, ruteId: null };
  }

  const wesel: Record<string, StatusWesel> = {};
  for (const w of ix.data.wesel) {
    wesel[w.id] = {
      weselId: w.id,
      kedudukan: w.kedudukanNormal,
      membalik: false,
      selesaiMembalikPada: null,
      terkunciOlehRute: null,
      gangguan: false,
    };
  }

  const sinyal: Record<string, StatusSinyal> = {};
  for (const s of ix.data.sinyal) {
    sinyal[s.id] = { sinyalId: s.id, aspek: 'MERAH', gangguan: false };
  }

  const pemakaianSepur: Record<string, PemakaianSepur> = {};
  for (const sp of ix.data.sepur) {
    pemakaianSepur[sp.id] = { sepurId: sp.id, jumlahKereta: 0, totalDetikDiduduki: 0 };
  }

  const kereta: KeretaAktif[] = perjalanan.map((t) => {
    const jadwalDatang = keDetikDinas(t.jamDatang, mulai);
    const jadwalBerangkat = Math.max(jadwalDatang, keDetikDinas(t.jamBerangkat, mulai));
    // Sebaran keterlambatan datang dari petak jalan: sebagian besar mendekati
    // jadwal, sebagian kecil terlambat beberapa menit.
    const deviasiAwal = Math.round(acak.normal(25, 70, -45, 330));
    const lari = t.langsung ? LARI_MASUK_LANGSUNG : LARI_MASUK;
    return {
      id: t.id,
      tripId: t.id,
      nomorKA: t.nomorKA,
      lin: t.lin,
      jenisSarana: t.jenisSarana,
      relasi: t.relasi,
      asal: t.asal,
      tujuan: t.tujuan,
      batasMasukId: t.batasMasukId,
      batasKeluarId: t.batasKeluarId,
      fase: 'BELUM_DINAS',
      sepurId: null,
      simpulMasukSepur: null,
      ruasId: null,
      kemajuan: 0,
      indeksRuas: 0,
      jalurRuas: [],
      simpulMasukRuas: [],
      ruteAktifId: null,
      tibaDiSinyalPada: jadwalDatang - lari + deviasiAwal,
      faktorKecepatan: 1,
      sepurLazimTerpakai: null,
      jadwalDatang,
      jadwalBerangkat,
      aktualDatang: null,
      aktualBerangkat: null,
      diwartakanPada: jadwalDatang - lari + deviasiAwal - SELANG_WARTA,
      deviasiDetik: deviasiAwal,
      sisaBerhentiDetik: t.waktuBerhentiMinimumDetik,
      waktuBerhentiMinimumDetik: t.waktuBerhentiMinimumDetik,
      langsung: Boolean(t.langsung),
      sebabTertahan: null,
      totalTertahanDetik: 0,
      keandalanData: t.keandalanData,
      dilayaniOtomatis: false,
      catatan: t.catatan ?? null,
      sepurLazim: Array.isArray(t.sepurLazim) ? t.sepurLazim : [],
    };
  });

  const K: KeadaanSimulasi = {
    dinas,
    waktu: mulai,
    mulai,
    selesaiPada,
    berjalan: false,
    kecepatan: 1,
    modeOtomatis: 'MATI',
    ruteOtomatis: 0,
    dinasSelesai: false,
    blok,
    wesel,
    sinyal,
    rute: {},
    kereta,
    kejadian: [],
    gangguan: [],
    pelanggaran: [],
    pemakaianSepur,
    konflikDicegah: 0,
    terakhirKeluar: {},
    acak,
    nomorUrut: 0,
    benih,
  };

  catat(K, 'DINAS', 'INFO', `Dinas ${dinas.nama} dimulai pukul ${keJam(mulai, false)}.`);
  catat(
    K,
    'DINAS',
    'INFO',
    `${kereta.length} perjalanan termuat pada papan. Bentuk rute masuk sebelum rangkaian mencapai sinyal masuk.`,
  );

  return K;
}

/* ------------------------------------------------------------------ */
/* Pencatatan                                                          */
/* ------------------------------------------------------------------ */

function catat(
  K: KeadaanSimulasi,
  kode: keyof typeof KODE_KEJADIAN,
  tingkat: TingkatKejadian,
  teks: string,
  keretaId?: string,
): void {
  K.nomorUrut += 1;
  K.kejadian.unshift({
    id: `EV-${K.nomorUrut}`,
    waktu: K.waktu,
    tingkat,
    kode: KODE_KEJADIAN[kode],
    teks,
    ...(keretaId ? { keretaId } : {}),
  });
  if (K.kejadian.length > 400) K.kejadian.length = 400;
}

function catatPelanggaran(
  K: KeadaanSimulasi,
  jenis: Pelanggaran['jenis'],
  keterangan: string,
  bobot: number,
  keretaId?: string,
): void {
  K.nomorUrut += 1;
  K.pelanggaran.push({
    id: `PL-${K.nomorUrut}`,
    waktu: K.waktu,
    jenis,
    keterangan,
    bobot,
    ...(keretaId ? { keretaId } : {}),
  });
  catat(K, 'PELANGGARAN', 'BAHAYA', keterangan, keretaId);
}

/* ------------------------------------------------------------------ */
/* Bantuan topologi                                                    */
/* ------------------------------------------------------------------ */

/** Ruas petak jalan yang bersambung dengan sebuah batas emplasemen. */
export function ruasBatas(ix: IndeksEmplasemen, batasId: string): {
  ruasId: string;
  simpulId: string;
} | null {
  const b = ix.data.batas.find((x) => x.id === batasId);
  if (!b) return null;
  const daftar = ix.ruasDiSimpul.get(b.simpulId) ?? [];
  const ruasId = daftar[0];
  if (!ruasId) return null;
  return { ruasId, simpulId: b.simpulId };
}

/** Susun daftar simpul masuk untuk tiap ruas pada sebuah jalur. */
function simpulMasukJalur(
  ix: IndeksEmplasemen,
  ruasIds: string[],
  simpulAwal: string,
): string[] {
  const hasil: string[] = [];
  let simpul = simpulAwal;
  for (const id of ruasIds) {
    hasil.push(simpul);
    const r = ix.ruas.get(id);
    if (!r) break;
    simpul = r.dari === simpul ? r.ke : r.dari;
  }
  return hasil;
}

/* ------------------------------------------------------------------ */
/* Pemeriksaan & pembentukan rute                                      */
/* ------------------------------------------------------------------ */

export interface UsulanRute {
  sasaranId: string;
  /** Label yang ditampilkan pada tombol panel. */
  label: string;
  hasil: HasilRute | null;
  /** Simpul tempat rangkaian memasuki ruas pertama rute. */
  simpulAwal: string;
  /** Rute menuntut rangkaian berbalik arah lebih dulu. */
  berbalikArah: boolean;
  /** Alasan penolakan; null berarti rute dapat dibentuk. */
  penghalang: string | null;
  /** Peringatan yang tidak menghalangi tetapi dicatat sebagai pelanggaran. */
  peringatan: string | null;
  lazim: boolean;
}

/**
 * Blok yang dituntut rute, di luar petak jalan.
 *
 * Petak jalan berada di luar batas emplasemen dan diatur dengan pelayanan blok
 * antar-stasiun, bukan dengan penguncian rute. Bila petak jalan ikut dikunci,
 * PPKA tidak akan pernah dapat menyiapkan rute perjalanan berikutnya dari arah
 * yang sama — padahal justru itu yang dituntut dinas.
 */
function blokDikunci(ix: IndeksEmplasemen, hasil: HasilRute): string[] {
  const daftar = new Set<string>();
  for (const ruasId of hasil.ruasIds) {
    const r = ix.ruas.get(ruasId);
    if (!r || r.jenis === 'PETAK_JALAN') continue;
    daftar.add(r.blokId);
  }
  return [...daftar];
}

function periksaHasilRute(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  hasil: HasilRute,
  keretaId: string,
): string | null {
  for (const blokId of blokDikunci(ix, hasil)) {
    const s = K.blok[blokId];
    if (!s) continue;
    if (s.keretaId === keretaId) continue;
    if (s.keadaan === 'DIDUDUKI') {
      return `blok ${namaBlok(ix, blokId)} sedang diduduki sarana`;
    }
    if (s.keadaan === 'RESERVASI') {
      return `blok ${namaBlok(ix, blokId)} sudah terkunci rute lain`;
    }
    if (s.keadaan === 'DIBLOKIR') return `blok ${namaBlok(ix, blokId)} sedang diblokir`;
    if (s.keadaan === 'GANGGUAN') return `blok ${namaBlok(ix, blokId)} dalam gangguan`;
  }
  for (const { weselId, kedudukan } of hasil.kedudukanWesel) {
    const w = K.wesel[weselId];
    const def = ix.wesel.get(weselId);
    if (!w || !def) continue;
    if (w.gangguan) return `wesel ${def.nomor} dalam gangguan`;
    if (w.terkunciOlehRute && w.kedudukan !== kedudukan) {
      return `wesel ${def.nomor} terkunci rute lain pada kedudukan ${w.kedudukan.toLowerCase()}`;
    }
  }
  return null;
}

function namaBlok(ix: IndeksEmplasemen, blokId: string): string {
  return ix.data.blok.find((b) => b.id === blokId)?.nama ?? blokId;
}

/** Jenis rute yang dibentuk saat kereta memasuki emplasemen. */
export function jenisRuteMasuk(kereta: KeretaAktif): 'MASUK' | 'LANGSUNG' {
  return kereta.langsung ? 'LANGSUNG' : 'MASUK';
}

/**
 * Sambung dua penggal rute menjadi satu rute utuh.
 * Dipakai untuk KA berjalan langsung: satu rute dari batas masuk, melalui
 * badan sepur, sampai batas keluar — tanpa pemberhentian di antaranya.
 */
function sambungRute(ix: IndeksEmplasemen, a: HasilRute, b: HasilRute): HasilRute | null {
  const peta = new Map<string, KedudukanWesel>();
  for (const w of [...a.kedudukanWesel, ...b.kedudukanWesel]) {
    const ada = peta.get(w.weselId);
    // Rute yang menuntut satu wesel pada dua kedudukan berbeda mustahil dibentuk.
    if (ada !== undefined && ada !== w.kedudukan) return null;
    peta.set(w.weselId, w.kedudukan);
  }
  const ruasIds = [...a.ruasIds, ...b.ruasIds.slice(1)];
  return {
    ruasIds,
    kedudukanWesel: [...peta.entries()].map(([weselId, kedudukan]) => ({ weselId, kedudukan })),
    panjangM: ruasIds.reduce((n, id) => n + (ix.ruas.get(id)?.panjangM ?? 0), 0),
    blokIds: [...new Set(ruasIds.map((id) => ix.ruas.get(id)?.blokId ?? '').filter(Boolean))],
  };
}

/**
 * Daftar sepur yang dapat dituju rute masuk untuk sebuah kereta.
 *
 * Bagi KA berjalan langsung, tiap pilihan bukan sekadar sepur pemberhentian
 * melainkan sepur yang DILEWATI: rute yang dibentuk membentang utuh dari batas
 * masuk sampai batas keluar. Pilihannya tetap bermakna karena PPKA dapat
 * melewatkan KA pada sepur lintas atau membelokkannya ke sepur simpan untuk
 * penyusulan.
 */
export function usulanRuteMasuk(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  kereta: KeretaAktif,
): UsulanRute[] {
  const pangkal = ruasBatas(ix, kereta.batasMasukId);
  if (!pangkal) return [];
  const sasaranKeluar =
    kereta.langsung && kereta.batasKeluarId ? ruasBatas(ix, kereta.batasKeluarId) : null;

  return ix.data.sepur.map((sp) => {
    let hasil = cariRute(ix, pangkal.ruasId, pangkal.simpulId, sp.ruasId);
    const lazim = (kereta.sepurLazim ?? []).includes(sp.id);
    let penghalang: string | null = null;
    let peringatan: string | null = null;

    if (hasil && kereta.langsung) {
      if (!sasaranKeluar) {
        hasil = null;
      } else {
        const simpulMasukSepur = simpulMasukJalur(ix, hasil.ruasIds, pangkal.simpulId).at(-1);
        const lanjutan = simpulMasukSepur
          ? cariRute(ix, sp.ruasId, simpulMasukSepur, sasaranKeluar.ruasId)
          : null;
        hasil = lanjutan ? sambungRute(ix, hasil, lanjutan) : null;
      }
    }

    if (!hasil) {
      penghalang = kereta.langsung
        ? 'tidak ada jalan sepur lurus lewat sepur ini'
        : 'tidak ada jalan sepur menuju jalur ini';
    } else {
      penghalang = periksaHasilRute(K, ix, hasil, kereta.id);
    }

    if (!penghalang) {
      if (sp.peronId === null && !kereta.langsung && kereta.lin !== 'KLB' && kereta.lin !== 'LANGSIR') {
        peringatan = `${sp.label} tidak berperon aktif — penumpang tidak dapat naik-turun.`;
      } else if (!lazim) {
        peringatan = kereta.langsung
          ? `${sp.label} bukan sepur lintas lazim perjalanan ini; dipakai untuk penyusulan.`
          : `${sp.label} di luar peruntukan lazim relasi ini.`;
      }
    }

    return {
      sasaranId: sp.id,
      label: sp.label,
      hasil,
      simpulAwal: pangkal.simpulId,
      berbalikArah: false,
      penghalang,
      peringatan,
      lazim,
    };
  });
}

/** Daftar batas keluar yang dapat dituju rute keluar. */
export function usulanRuteKeluar(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  kereta: KeretaAktif,
): UsulanRute[] {
  // KA berjalan langsung tidak pernah menuntut rute keluar tersendiri: rute
  // yang dibentuk sejak awal sudah membentang sampai batas keluar.
  if (kereta.langsung) return [];
  if (!kereta.sepurId) return [];
  const sp = ix.data.sepur.find((s) => s.id === kereta.sepurId);
  if (!sp) return [];
  const simpulAwal = kereta.simpulMasukSepur;
  if (!simpulAwal) return [];

  const ruasSepur = ix.ruas.get(sp.ruasId);
  const ujungLain = ruasSepur
    ? ruasSepur.dari === simpulAwal
      ? ruasSepur.ke
      : ruasSepur.dari
    : null;

  return ix.data.batas.map((b) => {
    const sasaran = ruasBatas(ix, b.id);
    let hasil: HasilRute | null = null;
    let simpulDipakai = simpulAwal;
    let berbalikArah = false;

    if (sasaran) {
      // Jalan terus lebih dulu; bila tidak ada, rangkaian berbalik arah —
      // hal biasa bagi perjalanan yang berakhir di Manggarai dan bagi sepur
      // berujung penghalang seperti jalur 7-8.
      hasil = cariRute(ix, sp.ruasId, simpulAwal, sasaran.ruasId);
      if (!hasil && ujungLain) {
        hasil = cariRute(ix, sp.ruasId, ujungLain, sasaran.ruasId);
        if (hasil) {
          simpulDipakai = ujungLain;
          berbalikArah = true;
        }
      }
    }

    let penghalang: string | null = null;
    let peringatan: string | null = null;

    if (!hasil) {
      penghalang = 'tidak ada jalan sepur menuju batas ini';
    } else {
      penghalang = periksaHasilRute(K, ix, hasil, kereta.id);
      if (!penghalang) {
        const terakhir = K.terakhirKeluar[b.id];
        if (terakhir !== undefined && K.waktu - terakhir < b.headwayMinimumDetik) {
          const sisa = b.headwayMinimumDetik - (K.waktu - terakhir);
          penghalang = `headway minimum petak jalan belum terpenuhi, tunggu ${sisa} detik`;
        }
      }
    }

    if (!penghalang && kereta.batasKeluarId && b.id !== kereta.batasKeluarId) {
      peringatan = `Batas keluar tidak sesuai jadwal perjalanan (seharusnya ${
        ix.data.batas.find((x) => x.id === kereta.batasKeluarId)?.nama ?? '-'
      }).`;
    } else if (!penghalang && berbalikArah) {
      peringatan = 'Rangkaian berbalik arah lebih dulu.';
    }

    return {
      sasaranId: b.id,
      label: b.nama,
      hasil,
      simpulAwal: simpulDipakai,
      berbalikArah,
      penghalang,
      peringatan,
      lazim: b.id === kereta.batasKeluarId,
    };
  });
}

/**
 * Sinyal yang melindungi sebuah rute.
 *
 * Pada rute masuk, sinyal masuk melindungi ruas pertama (petak jalan). Pada
 * rute keluar, ruas pertama adalah badan sepur yang tidak berpelindung; yang
 * melindungi adalah sinyal keluar pada ruas berikutnya. Karena itu penelusuran
 * dilakukan menurut urutan ruas, bukan hanya ruas pertama.
 */
function sinyalUntukRute(ix: IndeksEmplasemen, ruasIds: string[]): string | null {
  for (const ruasId of ruasIds) {
    const sinyalId = ix.sinyalPelindung.get(ruasId);
    if (sinyalId) return sinyalId;
  }
  return null;
}

/** Bentuk rute. Mengembalikan alasan penolakan, atau null bila berhasil. */
export function bentukRute(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  keretaId: string,
  jenis: 'MASUK' | 'KELUAR',
  sasaranId: string,
  olehOtomatis = false,
): string | null {
  const kereta = K.kereta.find((k) => k.id === keretaId);
  if (!kereta) return 'kereta tidak dikenal';

  const usulan =
    jenis === 'MASUK'
      ? usulanRuteMasuk(K, ix, kereta).find((u) => u.sasaranId === sasaranId)
      : usulanRuteKeluar(K, ix, kereta).find((u) => u.sasaranId === sasaranId);

  if (!usulan || !usulan.hasil) {
    return 'tidak ada jalan sepur menuju sasaran';
  }
  if (usulan.penghalang) {
    K.konflikDicegah += 1;
    catat(
      K,
      'RUTE_TOLAK',
      'PERHATIAN',
      KALIMAT.ruteDitolak(kereta.nomorKA, usulan.penghalang),
      kereta.id,
    );
    return usulan.penghalang;
  }

  const jenisTersimpan: JenisRute =
    jenis === 'MASUK' ? jenisRuteMasuk(kereta) : 'KELUAR';

  // Rute sejenis yang sudah dibentuk diganti — kecuali bila sudah diduduki
  // sarana; rute yang sedang dijalani tidak boleh dibongkar dari panel.
  for (const r of Object.values(K.rute)) {
    if (r.keretaId !== keretaId || r.jenis !== jenisTersimpan || r.keadaan === 'BEBAS') continue;
    if (r.keadaan === 'DIDUDUKI') {
      return 'rute sebelumnya sedang diduduki sarana dan tidak dapat diganti';
    }
    bebaskanRute(K, ix, r.id, false);
  }

  const hasil = usulan.hasil;
  const sinyalId = sinyalUntukRute(ix, hasil.ruasIds);
  K.nomorUrut += 1;
  const ruteId = `RT-${K.nomorUrut}`;

  const rute: Rute = {
    id: ruteId,
    jenis: jenisTersimpan,
    keretaId,
    ruasIds: hasil.ruasIds,
    kedudukanWesel: hasil.kedudukanWesel,
    sinyalId: sinyalId ?? '',
    simpulAwal: usulan.simpulAwal,
    berbalikArah: usulan.berbalikArah,
    sasaranId,
    keadaan: 'MEMBENTUK',
    dibentukPada: K.waktu,
    terkunciPada: null,
  };
  K.rute[ruteId] = rute;

  // Balik wesel yang belum pada kedudukan yang dituntut.
  for (const { weselId, kedudukan } of hasil.kedudukanWesel) {
    const w = K.wesel[weselId];
    const def = ix.wesel.get(weselId);
    if (!w || !def) continue;
    w.terkunciOlehRute = ruteId;
    if (w.kedudukan !== kedudukan) {
      w.membalik = true;
      w.selesaiMembalikPada = K.waktu + def.waktuBalikDetik;
      w.kedudukan = kedudukan;
    }
  }

  // Reservasi blok di dalam emplasemen.
  for (const blokId of blokDikunci(ix, hasil)) {
    const s = K.blok[blokId];
    if (!s) continue;
    if (s.keadaan === 'BEBAS') {
      s.keadaan = 'RESERVASI';
      s.ruteId = ruteId;
    }
  }

  if (olehOtomatis) {
    K.ruteOtomatis += 1;
    kereta.dilayaniOtomatis = true;
  }

  if (usulan.peringatan) {
    catat(K, 'RUTE_BENTUK', 'PERHATIAN', usulan.peringatan, kereta.id);
  }

  const namaSinyal = sinyalId
    ? (ix.data.sinyal.find((s) => s.id === sinyalId)?.nama ?? '-')
    : '-';
  const olehSiapa = olehOtomatis ? ' (pelayanan otomatis)' : '';
  catat(
    K,
    'RUTE_BENTUK',
    'NORMAL',
    jenis === 'MASUK'
      ? `Rute masuk KA ${kereta.nomorKA} ke ${usulan.label} dilayani${olehSiapa}. Wesel ${hasil.kedudukanWesel
          .map((w) => ix.wesel.get(w.weselId)?.nomor)
          .filter(Boolean)
          .join(', ') || '-'} dibalik.`
      : `Rute keluar KA ${kereta.nomorKA} ${usulan.label} dilayani${olehSiapa}.`,
    kereta.id,
  );

  // Penetapan jalur baru dinilai ketika rangkaian benar-benar berhenti di
  // sepur itu — rute yang dibentuk lalu dibatalkan tidak menghukum petugas.
  void namaSinyal;
  return null;
}

/** Batalkan/bebaskan rute. */
export function bebaskanRute(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  ruteId: string,
  catatKejadian = true,
): void {
  const rute = K.rute[ruteId];
  if (!rute) return;
  // Rute yang sedang diduduki sarana hanya dibebaskan oleh mesin setelah
  // rangkaian melewatinya, tidak pernah atas perintah panel.
  if (rute.keadaan === 'DIDUDUKI' && catatKejadian) return;

  for (const { weselId } of rute.kedudukanWesel) {
    const w = K.wesel[weselId];
    if (w && w.terkunciOlehRute === ruteId) w.terkunciOlehRute = null;
  }
  for (const ruasId of rute.ruasIds) {
    const r = ix.ruas.get(ruasId);
    if (!r) continue;
    const s = K.blok[r.blokId];
    if (!s) continue;
    if (s.ruteId === ruteId && s.keadaan === 'RESERVASI') {
      s.keadaan = 'BEBAS';
      s.ruteId = null;
    }
  }
  if (rute.sinyalId) {
    const sg = K.sinyal[rute.sinyalId];
    if (sg && !sg.gangguan) sg.aspek = 'MERAH';
  }

  rute.keadaan = 'BEBAS';
  delete K.rute[ruteId];

  if (catatKejadian) {
    const kereta = K.kereta.find((k) => k.id === rute.keretaId);
    catat(
      K,
      'RUTE_BEBAS',
      'NORMAL',
      `Rute ${rute.jenis.toLowerCase()} KA ${kereta?.nomorKA ?? '-'} dibebaskan.`,
      rute.keretaId,
    );
  }
}

/** Balik satu wesel dari panel, di luar pelayanan rute. */
export function balikWesel(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  weselId: string,
): string | null {
  const w = K.wesel[weselId];
  const def = ix.wesel.get(weselId);
  if (!w || !def) return 'wesel tidak dikenal';
  if (w.gangguan) return `wesel ${def.nomor} dalam gangguan`;
  if (w.terkunciOlehRute) return `wesel ${def.nomor} terkunci rute yang sedang dilayani`;
  if (w.membalik) return `wesel ${def.nomor} sedang membalik`;

  w.kedudukan = w.kedudukan === 'LURUS' ? 'BELOK' : 'LURUS';
  w.membalik = true;
  w.selesaiMembalikPada = K.waktu + def.waktuBalikDetik;
  catat(
    K,
    'RUTE_BENTUK',
    'INFO',
    `Wesel ${def.nomor} dibalik ke kedudukan ${w.kedudukan.toLowerCase()}.`,
  );
  return null;
}

/* ------------------------------------------------------------------ */
/* Langkah waktu                                                       */
/* ------------------------------------------------------------------ */

export function majuSatuDetik(K: KeadaanSimulasi, ix: IndeksEmplasemen): void {
  if (K.dinasSelesai) return;
  K.waktu += 1;

  selesaikanBalikWesel(K);
  kunciRuteSiap(K, ix);
  jalankanGangguan(K, ix);
  gerakkanKereta(K, ix);
  bangkitkanKejadian(K, ix);
  hitungPemakaianSepur(K);

  const adaSisa = K.kereta.some(
    (k) => k.fase !== 'SELESAI' && k.fase !== 'BATAL' && k.fase !== 'BELUM_DINAS',
  );
  const adaBelum = K.kereta.some((k) => k.fase === 'BELUM_DINAS');

  if (K.waktu >= K.selesaiPada && !adaSisa && !adaBelum) {
    akhiriDinas(K);
  } else if (K.waktu >= K.selesaiPada + 1800) {
    // Batas keras: dinas ditutup walau masih ada rangkaian di emplasemen.
    akhiriDinas(K);
  }
}

function akhiriDinas(K: KeadaanSimulasi): void {
  K.dinasSelesai = true;
  K.berjalan = false;
  catat(
    K,
    'DINAS',
    'INFO',
    `Dinas ${K.dinas.nama} ditutup pukul ${keJam(K.waktu, false)}. Laporan akhir dinas disusun.`,
  );
}

function selesaikanBalikWesel(K: KeadaanSimulasi): void {
  for (const w of Object.values(K.wesel)) {
    if (w.membalik && w.selesaiMembalikPada !== null && K.waktu >= w.selesaiMembalikPada) {
      w.membalik = false;
      w.selesaiMembalikPada = null;
    }
  }
}

function kunciRuteSiap(K: KeadaanSimulasi, ix: IndeksEmplasemen): void {
  for (const rute of Object.values(K.rute)) {
    if (rute.keadaan !== 'MEMBENTUK') continue;
    const siap = rute.kedudukanWesel.every(({ weselId, kedudukan }) => {
      const w = K.wesel[weselId];
      return w && !w.membalik && w.kedudukan === kedudukan;
    });
    if (!siap) continue;

    rute.keadaan = 'TERKUNCI';
    rute.terkunciPada = K.waktu;

    const sinyal = rute.sinyalId ? K.sinyal[rute.sinyalId] : undefined;
    const def = rute.sinyalId
      ? ix.data.sinyal.find((s) => s.id === rute.sinyalId)
      : undefined;
    if (sinyal && def) {
      sinyal.aspek = sinyal.gangguan ? 'PADAM' : aspekRuteTerkunci(rute);
      const kereta = K.kereta.find((k) => k.id === rute.keretaId);
      const aspek: AspekSinyal = sinyal.aspek;
      catat(
        K,
        'SINYAL_AMAN',
        'NORMAL',
        rute.jenis === 'MASUK'
          ? KALIMAT.ruteTerbentuk(
              kereta?.nomorKA ?? '-',
              ix.data.sepur.find((s) => s.id === rute.sasaranId)?.label ?? '-',
              `${def.nama} (${aspek.toLowerCase()})`,
            )
          : KALIMAT.ruteKeluarTerbentuk(
              kereta?.nomorKA ?? '-',
              ix.data.batas.find((b) => b.id === rute.sasaranId)?.nama ?? '-',
              `${def.nama} (${aspek.toLowerCase()})`,
            ),
        rute.keretaId,
      );
    }
  }
}

/**
 * Aspek yang ditunjukkan sinyal bagi rute yang sudah terkunci.
 * Rute yang melalui sepur belok dilayani dengan Semboyan 6; rute yang
 * seluruhnya lurus dengan Semboyan 5.
 */
function aspekRuteTerkunci(rute: Rute): AspekSinyal {
  return rute.kedudukanWesel.some((w) => w.kedudukan === 'BELOK') ? 'KUNING' : 'HIJAU';
}

function ruteUntuk(K: KeadaanSimulasi, keretaId: string, jenis: JenisRute): Rute | null {
  for (const r of Object.values(K.rute)) {
    if (r.keretaId === keretaId && r.jenis === jenis) return r;
  }
  return null;
}

function dudukiBlok(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  ruasId: string,
  keretaId: string,
): void {
  const r = ix.ruas.get(ruasId);
  if (!r) return;
  const s = K.blok[r.blokId];
  if (!s) return;
  s.keadaan = 'DIDUDUKI';
  s.keretaId = keretaId;
}

function lepasBlok(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  ruasId: string,
  keretaId: string,
): void {
  const r = ix.ruas.get(ruasId);
  if (!r) return;
  const s = K.blok[r.blokId];
  if (!s || s.keretaId !== keretaId) return;
  s.keadaan = 'BEBAS';
  s.keretaId = null;
  s.ruteId = null;
}

function gerakkanKereta(K: KeadaanSimulasi, ix: IndeksEmplasemen): void {
  for (const k of K.kereta) {
    switch (k.fase) {
      case 'BELUM_DINAS': {
        if (K.waktu >= k.diwartakanPada) {
          k.fase = 'DIWARTAKAN';
          const batas = ix.data.batas.find((b) => b.id === k.batasMasukId);
          catat(
            K,
            'WARTA_AMAN',
            'INFO',
            WARTA.minta(batas?.stasiunTetangga ?? '-', k.nomorKA),
            k.id,
          );
        }
        break;
      }

      case 'DIWARTAKAN': {
        if (K.waktu < k.tibaDiSinyalPada) break;
        const rute = ruteUntuk(K, k.id, jenisRuteMasuk(k));
        if (rute && rute.keadaan === 'TERKUNCI' && ruteBolehDiduduki(K, ix, rute, k.id)) {
          mulaiMenjalaniRute(K, ix, k, rute, 'MASUK');
        } else {
          k.fase = 'TERTAHAN_SINYAL';
          const batas = ix.data.batas.find((b) => b.id === k.batasMasukId);
          const namaSinyal = namaSinyalMasuk(ix, k.batasMasukId);
          k.sebabTertahan = rute
            ? 'petak blok di muka masih diduduki sarana'
            : 'rute masuk belum terbentuk';
          catat(
            K,
            'KERETA_TAHAN',
            'PERHATIAN',
            KALIMAT.tertahan(k.nomorKA, namaSinyal ?? (batas?.singkatan ?? '-')),
            k.id,
          );
        }
        break;
      }

      case 'TERTAHAN_SINYAL': {
        k.deviasiDetik += 1;
        k.totalTertahanDetik += 1;
        if (k.totalTertahanDetik === AMBANG_TERTAHAN) {
          catatPelanggaran(
            K,
            'KERETA_TERTAHAN',
            `KA ${k.nomorKA} tertahan di muka sinyal masuk lebih dari ${AMBANG_TERTAHAN / 60} menit.`,
            25,
            k.id,
          );
        }
        const rute = ruteUntuk(K, k.id, jenisRuteMasuk(k));
        if (rute && rute.keadaan === 'TERKUNCI' && ruteBolehDiduduki(K, ix, rute, k.id)) {
          mulaiMenjalaniRute(K, ix, k, rute, 'MASUK');
        }
        break;
      }

      case 'MASUK':
      case 'BERANGKAT': {
        majuDiJalur(K, ix, k);
        break;
      }

      case 'BERHENTI': {
        if (k.sisaBerhentiDetik > 0) {
          k.sisaBerhentiDetik -= 1;
          break;
        }
        if (K.waktu >= k.jadwalBerangkat) {
          k.fase = 'SIAP_BERANGKAT';
          catat(
            K,
            'WARTA_BERANGKAT',
            'INFO',
            `KA ${k.nomorKA} siap berangkat dari ${
              ix.data.sepur.find((s) => s.id === k.sepurId)?.label.toLowerCase() ?? '-'
            }. Menunggu rute keluar.`,
            k.id,
          );
        }
        break;
      }

      case 'SIAP_BERANGKAT': {
        if (K.waktu > k.jadwalBerangkat) k.deviasiDetik = K.waktu - k.jadwalBerangkat;
        const rute = ruteUntuk(K, k.id, 'KELUAR');
        if (rute && rute.keadaan === 'TERKUNCI' && ruteBolehDiduduki(K, ix, rute, k.id)) {
          k.aktualBerangkat = K.waktu;
          k.deviasiDetik = K.waktu - k.jadwalBerangkat;
          mulaiMenjalaniRute(K, ix, k, rute, 'KELUAR');
          const batas = ix.data.batas.find((b) => b.id === rute.sasaranId);
          K.terakhirKeluar[rute.sasaranId] = K.waktu;
          catat(
            K,
            'KERETA_BERANGKAT',
            'NORMAL',
            WARTA.berangkat(batas?.stasiunTetangga ?? '-', k.nomorKA, keJam(K.waktu)),
            k.id,
          );
        }
        break;
      }

      default:
        break;
    }
  }
}

function namaSinyalMasuk(ix: IndeksEmplasemen, batasId: string): string | null {
  const pangkal = ruasBatas(ix, batasId);
  if (!pangkal) return null;
  const sigId = ix.sinyalPelindung.get(pangkal.ruasId);
  if (!sigId) return null;
  return ix.data.sinyal.find((s) => s.id === sigId)?.nama ?? null;
}

/**
 * Rangkaian baru boleh menduduki rute bila petak jalan di depannya tidak
 * sedang diduduki sarana lain — kekangan blok, bukan kekangan rute.
 */
function ruteBolehDiduduki(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  rute: Rute,
  keretaId: string,
): boolean {
  for (const ruasId of rute.ruasIds) {
    const r = ix.ruas.get(ruasId);
    if (!r) continue;
    const s = K.blok[r.blokId];
    if (!s) continue;
    if (s.keadaan === 'DIDUDUKI' && s.keretaId !== null && s.keretaId !== keretaId) {
      return false;
    }
  }
  return true;
}

function mulaiMenjalaniRute(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  k: KeretaAktif,
  rute: Rute,
  jenis: 'MASUK' | 'KELUAR',
): void {
  const simpulAwal = rute.simpulAwal;

  k.jalurRuas = rute.ruasIds;
  k.simpulMasukRuas = simpulMasukJalur(ix, rute.ruasIds, simpulAwal);
  k.indeksRuas = 0;
  /*
   * Rangkaian yang berangkat sudah berdiri di ujung peron, bukan di pangkal
   * badan sepur. Untuk keberangkatan yang berjalan terus, ujung itu adalah
   * kemajuan 1 terhadap simpul masuknya — jadi rangkaian langsung meneruskan
   * perjalanan tanpa melompat mundur ke pangkal peron. Untuk keberangkatan
   * yang berbalik arah, rute dimulai dari ujung yang lain, sehingga tempat
   * rangkaian berdiri justru berada pada kemajuan 0.
   */
  k.kemajuan = jenis === 'KELUAR' && !rute.berbalikArah ? 1 : 0;
  k.ruasId = rute.ruasIds[0] ?? null;
  k.ruteAktifId = rute.id;
  k.fase = jenis === 'MASUK' ? 'MASUK' : 'BERANGKAT';
  k.sebabTertahan = null;
  rute.keadaan = 'DIDUDUKI';

  if (k.ruasId) dudukiBlok(K, ix, k.ruasId, k.id);
  // Sinyal tetap menunjukkan aspek aman sampai rangkaian benar-benar
  // melewatinya; penurunan aspek ditangani pada `majuDiJalur`.
}

function majuDiJalur(K: KeadaanSimulasi, ix: IndeksEmplasemen, k: KeretaAktif): void {
  const ruasId = k.jalurRuas[k.indeksRuas];
  if (!ruasId) return;
  const ruas = ix.ruas.get(ruasId);
  if (!ruas) return;

  const kecepatanDasar = k.langsung ? KECEPATAN_LANGSUNG : KECEPATAN_EMPLASEMEN;
  const durasi = Math.max(2, ruas.panjangM / (kecepatanDasar * k.faktorKecepatan));
  k.kemajuan += 1 / durasi;

  if (k.kemajuan < 1) return;

  const terakhir = k.indeksRuas >= k.jalurRuas.length - 1;

  if (terakhir) {
    // KA berjalan langsung tidak pernah berhenti di sepur; rutenya membentang
    // sampai batas keluar, jadi ujung rute berarti sudah keluar emplasemen.
    if (k.fase === 'MASUK' && !k.langsung) {
      berhentiDiSepur(K, ix, k, ruasId);
    } else {
      selesaiKeluar(K, ix, k);
    }
    return;
  }

  // Pindah ke ruas berikutnya; ruas di belakang dibebaskan.
  const berikut = k.jalurRuas[k.indeksRuas + 1];
  k.indeksRuas += 1;
  k.kemajuan = 0;
  k.ruasId = berikut ?? null;
  if (berikut) dudukiBlok(K, ix, berikut, k.id);
  lepasBlok(K, ix, ruasId, k.id);

  // Saat kepala rangkaian KA langsung memasuki badan sepur, itulah saat KA
  // melintas Manggarai — jam yang dicantumkan GAPEKA dengan tanda "Ls".
  if (k.langsung && berikut && k.aktualBerangkat === null) {
    const sepur = ix.data.sepur.find((s) => s.ruasId === berikut);
    if (sepur) catatLintasLangsung(K, k, sepur);
  }

  // Sinyal jatuh ke aspek berhenti setelah rangkaian melewatinya dan
  // menduduki pendeteksi berikutnya.
  const rute = k.ruteAktifId ? K.rute[k.ruteAktifId] : undefined;
  if (rute && rute.sinyalId) {
    const def = ix.data.sinyal.find((s) => s.id === rute.sinyalId);
    if (def && def.ruasDilindungi === ruasId) {
      const sg = K.sinyal[rute.sinyalId];
      if (sg && !sg.gangguan && sg.aspek !== 'MERAH') {
        sg.aspek = 'MERAH';
        catat(
          K,
          'SINYAL_MERAH',
          'NORMAL',
          `Sinyal ${def.nama} kembali menunjukkan aspek merah setelah dilewati KA ${k.nomorKA}.`,
          k.id,
        );
      }
    }
  }

  // Rute masuk berhenti di badan sepur; rute yang sudah dilalui dibebaskan.
  if (k.fase === 'BERANGKAT' && k.indeksRuas === 1) {
    // Rangkaian meninggalkan badan sepur.
    const sepur = ix.data.sepur.find((s) => s.id === k.sepurId);
    if (sepur) {
      catat(
        K,
        'RUTE_BEBAS',
        'NORMAL',
        `${sepur.label} bebas kembali setelah keberangkatan KA ${k.nomorKA}.`,
        k.id,
      );
    }
  }
}

/**
 * Catat lintasnya KA yang berjalan langsung di Manggarai.
 * Bagi KA langsung, jam lintas inilah yang dinilai ketepatan waktunya —
 * bukan jam berangkat, karena memang tidak ada pemberhentian.
 */
function catatLintasLangsung(
  K: KeadaanSimulasi,
  k: KeretaAktif,
  sepur: { id: string; label: string },
): void {
  k.aktualDatang = K.waktu;
  k.aktualBerangkat = K.waktu;
  k.deviasiDetik = K.waktu - k.jadwalBerangkat;
  k.sepurId = sepur.id;
  k.sepurLazimTerpakai = k.sepurLazim.includes(sepur.id);

  const p = K.pemakaianSepur[sepur.id];
  if (p) p.jumlahKereta += 1;

  catat(
    K,
    'KERETA_BERANGKAT',
    'NORMAL',
    `KA ${k.nomorKA} (${k.relasi}) berjalan langsung lewat ${sepur.label.toLowerCase()} pukul ${keJam(K.waktu)}.`,
    k.id,
  );
}

function berhentiDiSepur(
  K: KeadaanSimulasi,
  ix: IndeksEmplasemen,
  k: KeretaAktif,
  ruasSepur: string,
): void {
  const ruas = ix.ruas.get(ruasSepur);
  const sepur = ix.data.sepur.find((s) => s.ruasId === ruasSepur);

  k.fase = 'BERHENTI';
  // Rangkaian berhenti di ujung peron — tempat kepala rangkaian berhenti
  // menghadap sinyal keluar. Kemajuan TIDAK dikembalikan ke tengah badan sepur;
  // penanda pada papan harus tetap di tempat rangkaian benar-benar berhenti.
  k.kemajuan = 1;
  k.aktualDatang = K.waktu;
  k.sepurId = sepur?.id ?? null;
  k.simpulMasukSepur = k.simpulMasukRuas[k.indeksRuas] ?? null;
  k.sisaBerhentiDetik = k.waktuBerhentiMinimumDetik;
  if (k.aktualDatang > k.jadwalDatang) {
    k.deviasiDetik = k.aktualDatang - k.jadwalDatang;
  }

  if (ruas) dudukiBlok(K, ix, ruasSepur, k.id);

  // Bebaskan rute masuk kecuali badan sepur yang sedang diduduki.
  const rute = ruteUntuk(K, k.id, jenisRuteMasuk(k));
  if (rute) {
    for (const id of rute.ruasIds) {
      if (id === ruasSepur) continue;
      lepasBlok(K, ix, id, k.id);
      const r = ix.ruas.get(id);
      if (!r) continue;
      const s = K.blok[r.blokId];
      if (s && s.ruteId === rute.id && s.keadaan === 'RESERVASI') {
        s.keadaan = 'BEBAS';
        s.ruteId = null;
      }
    }
    for (const { weselId } of rute.kedudukanWesel) {
      const w = K.wesel[weselId];
      if (w && w.terkunciOlehRute === rute.id) w.terkunciOlehRute = null;
    }
    delete K.rute[rute.id];
  }

  if (sepur) {
    const p = K.pemakaianSepur[sepur.id];
    if (p) p.jumlahKereta += 1;

    // Ketertiban penetapan jalur dinilai di sini, sekali per perjalanan.
    const lazim = k.sepurLazim.includes(sepur.id);
    k.sepurLazimTerpakai = lazim;
    if (!lazim && k.lin !== 'KLB' && k.lin !== 'LANGSIR') {
      if (sepur.peronId === null) {
        catatPelanggaran(
          K,
          'SEPUR_TIDAK_LAYAK',
          `KA ${k.nomorKA} dilayani di ${sepur.label.toLowerCase()} yang tidak berperon aktif; penumpang tidak dapat naik-turun.`,
          40,
          k.id,
        );
      } else {
        catatPelanggaran(
          K,
          'PERON_SALAH',
          `KA ${k.nomorKA} dilayani di ${sepur.label.toLowerCase()}, di luar peruntukan lazim relasinya.`,
          15,
          k.id,
        );
      }
    }
  }

  const batas = ix.data.batas.find((b) => b.id === k.batasMasukId);
  catat(
    K,
    'WARTA_MASUK',
    'NORMAL',
    WARTA.masuk(batas?.stasiunTetangga ?? '-', k.nomorKA, keJam(K.waktu)),
    k.id,
  );
  catat(
    K,
    'KERETA_DATANG',
    'NORMAL',
    `KA ${k.nomorKA} (${k.relasi}) berhenti di ${sepur?.label.toLowerCase() ?? '-'}.`,
    k.id,
  );
}

function selesaiKeluar(K: KeadaanSimulasi, ix: IndeksEmplasemen, k: KeretaAktif): void {
  for (const id of k.jalurRuas) lepasBlok(K, ix, id, k.id);
  const rute = ruteUntuk(K, k.id, k.langsung ? 'LANGSUNG' : 'KELUAR');
  if (k.langsung && k.batasKeluarId) K.terakhirKeluar[k.batasKeluarId] = K.waktu;
  if (rute) {
    for (const { weselId } of rute.kedudukanWesel) {
      const w = K.wesel[weselId];
      if (w && w.terkunciOlehRute === rute.id) w.terkunciOlehRute = null;
    }
    for (const id of rute.ruasIds) {
      const r = ix.ruas.get(id);
      if (!r) continue;
      const s = K.blok[r.blokId];
      if (s && s.ruteId === rute.id) {
        s.keadaan = 'BEBAS';
        s.ruteId = null;
        s.keretaId = null;
      }
    }
    delete K.rute[rute.id];
  }

  k.fase = 'SELESAI';
  k.ruasId = null;
  k.sepurId = null;
  k.ruteAktifId = null;
  catat(
    K,
    'KERETA_BERANGKAT',
    'NORMAL',
    `KA ${k.nomorKA} keluar batas emplasemen menuju ${k.tujuan}.`,
    k.id,
  );
}

function hitungPemakaianSepur(K: KeadaanSimulasi): void {
  for (const k of K.kereta) {
    if (k.sepurId && (k.fase === 'BERHENTI' || k.fase === 'SIAP_BERANGKAT')) {
      const p = K.pemakaianSepur[k.sepurId];
      if (p) p.totalDetikDiduduki += 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Kejadian luar biasa                                                 */
/* ------------------------------------------------------------------ */

function jalankanGangguan(K: KeadaanSimulasi, ix: IndeksEmplasemen): void {
  for (const g of K.gangguan) {
    if (g.teratasi || g.selesai === null || K.waktu < g.selesai) continue;
    g.teratasi = true;

    if (g.jenis === 'WESEL_MACET') {
      const w = K.wesel[g.sasaranId];
      if (w) w.gangguan = false;
      const nomor = ix.wesel.get(g.sasaranId)?.nomor ?? '-';
      catat(K, 'GANGGUAN_PULIH', 'NORMAL', `Gangguan wesel ${nomor} selesai ditangani.`);
    } else if (g.jenis === 'SINYAL_PADAM') {
      const s = K.sinyal[g.sasaranId];
      if (s) {
        s.gangguan = false;
        // Bila masih ada rute terkunci yang dilindungi sinyal ini, aspeknya
        // dikembalikan ke aspek aman — bukan dijatuhkan ke merah.
        const ruteTerkunci = Object.values(K.rute).find(
          (r) => r.sinyalId === g.sasaranId && r.keadaan === 'TERKUNCI',
        );
        s.aspek = ruteTerkunci ? aspekRuteTerkunci(ruteTerkunci) : 'MERAH';
      }
      const nama = ix.data.sinyal.find((x) => x.id === g.sasaranId)?.nama ?? '-';
      catat(K, 'GANGGUAN_PULIH', 'NORMAL', `Sinyal ${nama} berdinas kembali.`);

      // Kecepatan baru pulih bila tidak ada gangguan persinyalan lain.
      const masihTerganggu = K.gangguan.some(
        (x) => x.jenis === 'SINYAL_PADAM' && !x.teratasi && x.id !== g.id,
      );
      if (!masihTerganggu) {
        for (const k of K.kereta) k.faktorKecepatan = 1;
      }
    }
  }
}

function bangkitkanKejadian(K: KeadaanSimulasi, ix: IndeksEmplasemen): void {
  const peluangPerDetik = K.dinas.peluangGangguanPerJam / 3600;
  if (!K.acak.peluang(peluangPerDetik)) return;

  const pilihan = K.acak.bulat(1, 100);

  if (pilihan <= 25) {
    // Gangguan wesel.
    const bebas = ix.data.wesel.filter((w) => {
      const s = K.wesel[w.id];
      return s && !s.gangguan && !s.terkunciOlehRute;
    });
    const w = K.acak.pilih(bebas);
    if (!w) return;
    const s = K.wesel[w.id];
    if (!s) return;
    s.gangguan = true;
    const lama = K.acak.bulat(180, 480);
    K.gangguan.push({
      id: `GG-${(K.nomorUrut += 1)}`,
      jenis: 'WESEL_MACET',
      mulai: K.waktu,
      selesai: K.waktu + lama,
      sasaranId: w.id,
      keterangan: KALIMAT.weselMacet(w.nomor),
      teratasi: false,
    });
    catat(K, 'GANGGUAN', 'BAHAYA', KALIMAT.weselMacet(w.nomor));
    return;
  }

  if (pilihan <= 45) {
    // Gangguan persinyalan.
    const bebas = ix.data.sinyal.filter((sg) => {
      const s = K.sinyal[sg.id];
      return s && !s.gangguan;
    });
    const sg = K.acak.pilih(bebas);
    if (!sg) return;
    const s = K.sinyal[sg.id];
    if (!s) return;
    s.gangguan = true;
    s.aspek = 'PADAM';
    const lama = K.acak.bulat(180, 420);
    K.gangguan.push({
      id: `GG-${(K.nomorUrut += 1)}`,
      jenis: 'SINYAL_PADAM',
      mulai: K.waktu,
      selesai: K.waktu + lama,
      sasaranId: sg.id,
      keterangan: KALIMAT.sinyalPadam(sg.nama),
      teratasi: false,
    });
    for (const k of K.kereta) {
      if (k.fase === 'MASUK' || k.fase === 'BERANGKAT') k.faktorKecepatan = 0.6;
      if (k.fase === 'BERHENTI') k.sisaBerhentiDetik += TAHAN_PERINTAH_TERTULIS;
    }
    catat(K, 'GANGGUAN', 'BAHAYA', KALIMAT.sinyalPadam(sg.nama));
    return;
  }

  if (pilihan <= 80) {
    // Kepadatan penumpang menahan naik-turun.
    const berhenti = K.kereta.filter((k) => k.fase === 'BERHENTI');
    const k = K.acak.pilih(berhenti);
    if (!k) return;
    const tambahan = K.acak.bulat(30, 110);
    k.sisaBerhentiDetik += tambahan;
    K.gangguan.push({
      id: `GG-${(K.nomorUrut += 1)}`,
      jenis: 'KEPADATAN_PENUMPANG',
      mulai: K.waktu,
      selesai: K.waktu + tambahan,
      sasaranId: k.id,
      keterangan: KALIMAT.kepadatan(k.nomorKA, tambahan),
      teratasi: false,
    });
    catat(K, 'GANGGUAN', 'PERHATIAN', KALIMAT.kepadatan(k.nomorKA, tambahan), k.id);
    return;
  }

  // Kereta Luar Biasa — kirim rangkaian dari Balai Yasa.
  const adaKlb = K.kereta.some((k) => k.lin === 'KLB' && k.fase !== 'SELESAI');
  if (adaKlb) return;
  const nomor = `KLB ${K.acak.bulat(2801, 2899)}`;
  const jadwalDatang = K.waktu + 240;
  K.kereta.push({
    id: `KLB-${(K.nomorUrut += 1)}`,
    tripId: `KLB-${K.nomorUrut}`,
    nomorKA: nomor,
    lin: 'KLB',
    jenisSarana: 'KRL_12',
    relasi: 'Balai Yasa Manggarai - Jatinegara',
    asal: 'Balai Yasa Manggarai',
    tujuan: 'Jatinegara',
    batasMasukId: 'BTS-BY',
    batasKeluarId: 'BTS-JJ-TMR-K',
    fase: 'BELUM_DINAS',
    sepurId: null,
    simpulMasukSepur: null,
    ruasId: null,
    kemajuan: 0,
    indeksRuas: 0,
    jalurRuas: [],
    simpulMasukRuas: [],
    ruteAktifId: null,
    tibaDiSinyalPada: jadwalDatang - LARI_MASUK,
    faktorKecepatan: 1,
    sepurLazimTerpakai: null,
    jadwalDatang,
    jadwalBerangkat: jadwalDatang + 600,
    aktualDatang: null,
    aktualBerangkat: null,
    diwartakanPada: K.waktu,
    deviasiDetik: 0,
    sisaBerhentiDetik: 240,
    waktuBerhentiMinimumDetik: 240,
    langsung: false,
    sebabTertahan: null,
    totalTertahanDetik: 0,
    keandalanData: 'CONTOH',
    dilayaniOtomatis: false,
    catatan:
      'Kereta Luar Biasa dibangkitkan sebagai kejadian dinas. KLB memang berada di luar GAPEKA sehingga tidak termuat pada berkas jadwal.',
    sepurLazim: ['SP-G6'],
  });
  catat(
    K,
    'GANGGUAN',
    'PERHATIAN',
    KALIMAT.klb(nomor, 'kirim rangkaian dari Balai Yasa Manggarai ke arah Jatinegara'),
  );
}
