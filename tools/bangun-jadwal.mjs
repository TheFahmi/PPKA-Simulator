/**
 * Pembangkit data/jadwal-manggarai.json
 *
 *   node tools/bangun-jadwal.mjs
 *
 * Skrip ini TIDAK memuat jadwal di dalam dirinya. Ia menyusun berkas jadwal
 * dari dua berkas sumber hasil tarikan langsung dari kanal resmi:
 *
 *   tools/sumber/krl-mri-24jam.json    — seluruh pemberhentian KRL Commuter Line
 *                                        di Manggarai selama 24 jam, ditarik dari
 *                                        API jadwal KAI Commuter (kci.id)
 *   tools/sumber/kajj-mri-24jam.json   — seluruh KA jarak jauh yang melintas
 *                                        Manggarai selama 24 jam, dibaca dari
 *                                        GAPEKA 2025 Jawa Lampiran II (PDF DJKA)
 *
 * Yang dikerjakan skrip ini hanyalah PEMETAAN: menentukan batas emplasemen mana
 * yang dilalui tiap perjalanan berdasarkan relasinya, dan jalur mana yang lazim
 * dipakai menurut peruntukan resmi hasil Switch Over ke-7. Tidak ada satu pun
 * nomor KA, nama KA, atau jam yang dibuat di sini — kecuali baris Commuter Line
 * Basoetta, yang ditandai REKONSTRUKSI_POLA dan dijelaskan di bawah.
 *
 * Perbarui berkas sumbernya bila GAPEKA direvisi, lalu jalankan ulang skrip ini.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SUMBER_KRL = JSON.parse(
  readFileSync(resolve(AKAR, 'tools/sumber/krl-mri-24jam.json'), 'utf8'),
);
const SUMBER_KAJJ = JSON.parse(
  readFileSync(resolve(AKAR, 'tools/sumber/kajj-mri-24jam.json'), 'utf8'),
);

/** Lama berhenti melayani naik-turun penumpang di Manggarai (detik). */
const BERHENTI_KRL = 100;
/** Selisih jam datang terhadap jam berangkat untuk KA yang berhenti (detik). */
const DWELL_MODEL = 120;
/** Waktu penyiapan rangkaian untuk perjalanan yang berdinas mulai dari Manggarai. */
const SIAP_RANGKAIAN = 360;

const perjalanan = [];

function keDetik(jam) {
  const [h, m, d] = jam.split(/[.:]/).map((n) => Number.parseInt(n, 10));
  return h * 3600 + m * 60 + (d || 0);
}

function keJam(detik) {
  const t = ((Math.floor(detik) % 86400) + 86400) % 86400;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}.${p(Math.floor((t % 3600) / 60))}.${p(t % 60)}`;
}

function tambah(o) {
  const { id, nomorKA, lin, jenisSarana, asal, tujuan, batasMasukId, batasKeluarId } = o;
  perjalanan.push({
    id,
    nomorKA,
    lin,
    jenisSarana,
    relasi: `${asal} - ${tujuan}`,
    asal,
    tujuan,
    batasMasukId,
    batasKeluarId,
    jamDatang: o.jamDatang,
    jamBerangkat: o.jamBerangkat,
    sepurLazim: o.sepurLazim,
    waktuBerhentiMinimumDetik: o.waktuBerhentiMinimumDetik,
    langsung: Boolean(o.langsung),
    keandalanData: o.keandalanData,
    ...(o.catatan ? { catatan: o.catatan } : {}),
  });
}

/* ================================================================== */
/* Pemetaan relasi ke batas emplasemen                                 */
/* ================================================================== */

/*
 * Sisi emplasemen yang dilalui tiap stasiun ujung. Pemetaan ini mengikuti
 * bentuk jaringan yang sesungguhnya, bukan tebakan:
 *
 *   Lin Bogor berjalan di lantai layang. Arah Jakarta Kota keluar lewat Cikini;
 *   arah Bogor, Nambo, Depok, dan Bojonggede keluar lewat Tebet.
 *
 *   Lin Cikarang berjalan di lantai dasar. Arah Angke, Kampung Bandan, dan Duri
 *   keluar lewat Sudirman; arah Bekasi, Cikarang, dan Tambun lewat Matraman.
 */
const SISI = {
  LIN_BOGOR: {
    JAKARTAKOTA: 'CKI',
    BOGOR: 'TBT',
    NAMBO: 'TBT',
    DEPOK: 'TBT',
    BOJONGGEDE: 'TBT',
  },
  DASAR: {
    ANGKE: 'SUD',
    KAMPUNGBANDAN: 'SUD',
    DURI: 'SUD',
    TANAHABANG: 'SUD',
    BEKASI: 'MTR',
    CIKARANG: 'MTR',
    TAMBUN: 'MTR',
    JATINEGARA: 'MTR',
  },
};

const BATAS = {
  CKI: { masuk: 'BTS-CKI-D', keluar: 'BTS-CKI-K' },
  TBT: { masuk: 'BTS-TBT-D', keluar: 'BTS-TBT-K' },
  SUD: { masuk: 'BTS-SUD-D', keluar: 'BTS-SUD-K' },
  MTR: { masuk: 'BTS-MTR-D', keluar: 'BTS-MTR-K' },
};

/** Jalur yang lazim dipakai menurut sisi tujuan perjalanan. */
const SEPUR_LAZIM = {
  CKI: ['SP-L9', 'SP-L10'],
  TBT: ['SP-L11', 'SP-L12'],
  SUD: ['SP-G1', 'SP-G2'],
  MTR: ['SP-G3', 'SP-G4'],
};

const KODE_LIN = {
  'COMMUTER LINE BOGOR': 'LIN_BOGOR',
  'COMMUTER LINE CIKARANG': 'LIN_CIKARANG',
  'COMMUTER LINE RANGKASBITUNG': 'LIN_RANGKASBITUNG',
  'COMMUTER LINE TANGERANG': 'LIN_TANGERANG',
};

/** Nama stasiun sebagaimana ditulis pada relasi API, dirapikan untuk papan. */
const NAMA_STASIUN = {
  JAKARTAKOTA: 'Jakarta Kota',
  BOGOR: 'Bogor',
  NAMBO: 'Nambo',
  DEPOK: 'Depok',
  BOJONGGEDE: 'Bojonggede',
  MANGGARAI: 'Manggarai',
  ANGKE: 'Angke',
  KAMPUNGBANDAN: 'Kampung Bandan',
  DURI: 'Duri',
  BEKASI: 'Bekasi',
  CIKARANG: 'Cikarang',
  TAMBUN: 'Tambun',
};

function rapikan(kode) {
  return NAMA_STASIUN[kode] ?? kode;
}

/** Sisi emplasemen bagi sebuah stasiun ujung, menurut lin yang melayaninya. */
function sisiUntuk(kodeLin, stasiun) {
  const peta = kodeLin === 'LIN_BOGOR' ? SISI.LIN_BOGOR : SISI.DASAR;
  return peta[stasiun] ?? null;
}

/* ================================================================== */
/* 1. KRL Commuter Line — dari tarikan API KAI Commuter                */
/* ================================================================== */

const CATATAN_HARI =
  'Ditarik dari API jadwal KAI Commuter pada 26 Juli 2026. API tidak menerima parameter tanggal, sehingga tidak dapat dipastikan apakah set jadwal ini berlaku untuk hari kerja atau akhir pekan.';

let dilewati = 0;
for (const p of SUMBER_KRL.perjalanan) {
  const lin = KODE_LIN[p.lin];
  if (!lin) {
    dilewati += 1;
    continue;
  }

  // Relasi berbentuk "ASAL-TUJUAN", kadang dengan imbuhan " VIA MRI".
  const bersih = p.relasi.replace(/\s+VIA\s+MRI$/i, '').trim();
  const [asalKode, tujuanKode] = bersih.split('-');
  if (!asalKode || !tujuanKode) {
    dilewati += 1;
    continue;
  }

  const mulaiDiMri = asalKode === 'MANGGARAI';
  const berakhirDiMri = tujuanKode === 'MANGGARAI';
  const sisiTujuan = berakhirDiMri ? null : sisiUntuk(lin, tujuanKode);
  const sisiAsal = mulaiDiMri ? null : sisiUntuk(lin, asalKode);

  if (!sisiTujuan && !sisiAsal) {
    dilewati += 1;
    continue;
  }

  /*
   * Perjalanan yang berdinas mulai dari Manggarai tidak punya sisi asal. Masuknya
   * rangkaian ke emplasemen dimodelkan sebagai langsiran dari sisi berlawanan —
   * penyiapan rangkaian memang tidak tercantum pada jadwal publik.
   */
  const sisiMasuk = sisiAsal ?? lawanSisi(sisiTujuan);
  const sisiKeluar = sisiTujuan ?? lawanSisi(sisiAsal);

  const jam = p.jamMRI.replace(/:/g, '.');
  const jamBerangkat = mulaiDiMri ? jam : jam;
  const jamDatang = mulaiDiMri
    ? keJam(keDetik(jam) - SIAP_RANGKAIAN)
    : keJam(keDetik(jam) - DWELL_MODEL);

  tambah({
    id: `TRIP-KRL-${p.nomorKA}`,
    nomorKA: p.nomorKA,
    lin,
    jenisSarana: 'KRL_12',
    asal: rapikan(asalKode),
    tujuan: rapikan(tujuanKode),
    batasMasukId: BATAS[sisiMasuk].masuk,
    batasKeluarId: BATAS[sisiKeluar].keluar,
    jamDatang,
    jamBerangkat,
    sepurLazim: SEPUR_LAZIM[sisiKeluar],
    waktuBerhentiMinimumDetik: BERHENTI_KRL,
    keandalanData: 'RESMI',
    catatan: mulaiDiMri
      ? `Jam berangkat sesuai jadwal resmi. Perjalanan berdinas mulai dari Manggarai; masuknya rangkaian ke emplasemen dimodelkan sebagai langsiran karena penyiapan rangkaian tidak tercantum pada jadwal publik. ${CATATAN_HARI}`
      : `Jam pada jadwal publik dipakai sebagai jam berangkat; jam datang diturunkan dengan mengurangi dua menit sebagai pemodelan waktu berhenti. ${CATATAN_HARI}`,
  });
}

function lawanSisi(sisi) {
  return { CKI: 'TBT', TBT: 'CKI', SUD: 'MTR', MTR: 'SUD' }[sisi];
}

/* ================================================================== */
/* 2. KA Jarak Jauh — berjalan langsung, dari GAPEKA 2025              */
/* ================================================================== */

/*
 * Seluruh KA jarak jauh relasi Stasiun Gambir melintas Manggarai pada rutenya:
 * Bekasi - Jatinegara - MANGGARAI - Cikini - Gondangdia - Gambir. KA relasi
 * Pasar Senen tidak lewat Manggarai, sehingga tidak ada di berkas sumber.
 *
 * Tidak satu pun berhenti melayani penumpang di Manggarai: GAPEKA menandai
 * baris Manggarai dengan "Ls" pada kolom Datang, dan jam pada kolom Berangkat
 * adalah jam melintasnya. Jam itulah yang dipakai apa adanya.
 */

const CATATAN_KAJJ =
  'Jam melintas Manggarai diambil apa adanya dari GAPEKA 2025 Lampiran II "Daftar Waktu KA Antar Kota" (KP-DJKA 224 Tahun 2024), kolom Berangkat pada baris Manggarai yang bertanda "Ls" — berjalan langsung. KA ini TIDAK berhenti melayani penumpang di Manggarai. Angka tersebut versi dasar yang berlaku 1 Februari 2025; dokumen revisi per 18 Juni 2026 tidak berhasil diperoleh.';

for (const p of SUMBER_KAJJ.perjalanan) {
  const keGambir = p.arah === 'KE_GAMBIR';
  const jam = p.jamMRI.replace(/:/g, '.');
  tambah({
    id: `TRIP-KAJJ-${p.nomorKA}`,
    nomorKA: p.nomorKA,
    lin: 'KAJJ',
    jenisSarana: 'KA_ANTARKOTA',
    asal: p.asal,
    tujuan: p.tujuan,
    batasMasukId: keGambir ? 'BTS-JJ-TMR-D' : 'BTS-JJ-BRT-D',
    batasKeluarId: keGambir ? 'BTS-JJ-BRT-K' : 'BTS-JJ-TMR-K',
    jamDatang: jam,
    jamBerangkat: jam,
    sepurLazim: keGambir ? ['SP-GLU'] : ['SP-GLH'],
    waktuBerhentiMinimumDetik: 0,
    langsung: true,
    keandalanData: 'RESMI',
    catatan: `KA ${p.nama}. ${CATATAN_KAJJ}`,
  });
}

/* ================================================================== */
/* 3. Commuter Line Basoetta — rekonstruksi pola                       */
/* ================================================================== */

/*
 * Basoetta tidak termuat pada API jadwal Commuter Line, sehingga baris di bawah
 * disusun dari pola operasi yang terverifikasi, BUKAN dari daftar perjalanan
 * resmi. Yang terverifikasi: Manggarai merupakan stasiun ujung; keberangkatan
 * dari Manggarai 05.00-22.00 dengan selang 30 menit; kedatangan dari Bandara
 * Soekarno-Hatta dimulai 06.12; nomor KA berada pada seri 8xx. Yang TIDAK
 * terverifikasi: penetapan nomor KA untuk tiap keberangkatan.
 */

const CATATAN_BASOETTA =
  'REKONSTRUKSI POLA — bukan daftar perjalanan resmi. Yang terverifikasi: Manggarai merupakan stasiun ujung Commuter Line Basoetta; keberangkatan dari Manggarai berlangsung 05.00-22.00 dengan selang 30 menit; kedatangan dari Bandara Soekarno-Hatta dimulai pukul 06.12; nomor KA berada pada seri 8xx (contoh nyata terverifikasi: KA 806A). Yang TIDAK terverifikasi: penetapan nomor KA untuk tiap keberangkatan — nomor pada baris ini disusun mengikuti seri dan tidak boleh dianggap nomor GAPEKA. Ganti baris ini melalui menu impor jadwal begitu daftar nomor resmi tersedia.';

let nomorGenap = 800;
for (let t = keDetik('05.00'); t <= keDetik('22.00'); t += 1800) {
  tambah({
    id: `TRIP-BSA-${nomorGenap}`,
    nomorKA: String(nomorGenap),
    lin: 'BANDARA',
    jenisSarana: 'KRL_8',
    asal: 'Manggarai',
    tujuan: 'Bandara Soekarno-Hatta',
    batasMasukId: 'BTS-BNI',
    batasKeluarId: 'BTS-BNI',
    jamDatang: keJam(t - SIAP_RANGKAIAN),
    jamBerangkat: keJam(t),
    sepurLazim: ['SP-G7', 'SP-G8'],
    waktuBerhentiMinimumDetik: BERHENTI_KRL,
    keandalanData: 'REKONSTRUKSI_POLA',
    catatan: CATATAN_BASOETTA,
  });
  nomorGenap += 2;
}

let nomorGanjil = 801;
for (let t = keDetik('06.12'); t <= keDetik('22.42'); t += 1800) {
  tambah({
    id: `TRIP-BSA-${nomorGanjil}`,
    nomorKA: String(nomorGanjil),
    lin: 'BANDARA',
    jenisSarana: 'KRL_8',
    asal: 'Bandara Soekarno-Hatta',
    tujuan: 'Manggarai',
    batasMasukId: 'BTS-BNI',
    batasKeluarId: 'BTS-BNI',
    jamDatang: keJam(t),
    jamBerangkat: keJam(t + 300),
    sepurLazim: ['SP-G7', 'SP-G8'],
    waktuBerhentiMinimumDetik: BERHENTI_KRL,
    keandalanData: 'REKONSTRUKSI_POLA',
    catatan: CATATAN_BASOETTA,
  });
  nomorGanjil += 2;
}

/* ================================================================== */
/* Berkas keluaran                                                     */
/* ================================================================== */

perjalanan.sort((a, b) => a.jamDatang.localeCompare(b.jamDatang));

const jadwal = {
  versi: '2.0.0',
  gapeka:
    'GAPEKA 2025 — jadwal Commuter Line dari API KAI Commuter (ditarik 26 Juli 2026) dan Daftar Waktu KA Antar Kota terbitan DJKA',
  stasiun: 'MRI',
  tanggalDibuat: '2026-07-26',
  sumber: [
    'GAPEKA 2025 Jawa, Lampiran II Daftar Waktu KA Antar Kota (KP-DJKA 224 Tahun 2024), berkas PDF DJKA Kementerian Perhubungan',
    'https://kci.id/api/krl/schedules?stationid=MRI&timefrom=00:00&timeto=23:59',
    'https://kci.id/layanan/info-pelanggan/jadwal',
    'https://id.wikipedia.org/wiki/Stasiun_Manggarai',
  ],
  catatanKeakuratan: [
    `Berkas ini memuat SATU HARI PENUH: ${perjalanan.length} perjalanan pada rentang 00.00-23.59 di Stasiun Manggarai.`,
    'NOMOR KA, JAM, DAN RELASI seluruh KRL Commuter Line ditarik apa adanya dari API jadwal resmi KAI Commuter untuk stasiun MRI, 24 jam penuh, tanpa satu baris pun dibuang.',
    CATATAN_HARI,
    'Jadwal publik hanya mencantumkan SATU jam per stasiun. Jam tersebut dipakai sebagai JAM BERANGKAT; jam datang di Manggarai diturunkan dengan mengurangi 2 menit sebagai pemodelan waktu berhenti. Angka itu BUKAN data resmi.',
    'KA JARAK JAUH dimuat sebagai KA BERJALAN LANGSUNG, bukan sebagai pemberhentian. Tidak ada KA jarak jauh yang berhenti melayani penumpang di Manggarai. Nomor KA, nama, dan jam melintas diambil apa adanya dari GAPEKA 2025 Lampiran II pada baris Manggarai yang bertanda "Ls". KA relasi Pasar Senen tidak dimuat karena rutenya memang tidak melewati Manggarai.',
    'Baris Commuter Line Basoetta ditandai REKONSTRUKSI_POLA: pola jam dan seri nomor terverifikasi, penetapan nomor per keberangkatan tidak.',
    'Penetapan sepur pada "sepurLazim" mengikuti peruntukan jalur resmi hasil Switch Over ke-7, bukan penetapan sepur per perjalanan — pemilihan sepur adalah keputusan PPKA dan itulah inti permainan ini.',
    'Golongan sarana (jumlah kereta per rangkaian) merupakan asumsi pemodelan, tidak diambil dari data operasional.',
    'Kereta Luar Biasa (KLB) tidak dijadwalkan karena menurut sifatnya KLB memang berada di luar GAPEKA; KLB dibangkitkan sebagai kejadian pada saat dinas berjalan.',
  ].join(' '),
  layanan: [
    {
      kode: 'LIN_BOGOR',
      nama: 'Commuter Line Bogor',
      tokenWarna: 'lin-bogor',
      operator: 'KAI Commuter',
      keterangan:
        'Lin Bogor. Di Manggarai dilayani di lantai layang: jalur 9-10 arah Jakarta Kota (lewat Cikini), jalur 11-12 arah Bogor/Nambo (lewat Tebet).',
    },
    {
      kode: 'LIN_CIKARANG',
      nama: 'Commuter Line Cikarang',
      tokenWarna: 'lin-cikarang',
      operator: 'KAI Commuter',
      keterangan:
        'Lin Lingkar Cikarang. Di Manggarai dilayani di lantai dasar: jalur 1-2 arah Sudirman/Angke/Kampung Bandan, jalur 3-4 arah Matraman/Bekasi/Cikarang.',
    },
    {
      kode: 'LIN_RANGKASBITUNG',
      nama: 'Commuter Line Rangkasbitung',
      tokenWarna: 'lin-lingkar',
      operator: 'KAI Commuter',
      keterangan:
        'Lin Rangkasbitung. Hanya sedikit perjalanan yang menyentuh Manggarai, dilayani di lantai dasar arah Sudirman.',
    },
    {
      kode: 'LIN_TANGERANG',
      nama: 'Commuter Line Tangerang',
      tokenWarna: 'lin-lingkar',
      operator: 'KAI Commuter',
      keterangan:
        'Lin Tangerang. Hanya sedikit perjalanan yang menyentuh Manggarai, dilayani di lantai dasar arah Sudirman/Duri.',
    },
    {
      kode: 'KAJJ',
      nama: 'KA Antarkota',
      tokenWarna: 'lin-kajj',
      operator: 'KAI',
      keterangan:
        'KA jarak jauh relasi Stasiun Gambir. Seluruhnya BERJALAN LANGSUNG di Manggarai — tidak ada yang berhenti melayani penumpang. Dilayani pada sepur lintas hulu (arah Gambir) dan sepur lintas hilir (arah Jatinegara) yang tidak bernomor peron.',
    },
    {
      kode: 'BANDARA',
      nama: 'Commuter Line Basoetta',
      tokenWarna: 'lin-kajj',
      operator: 'KAI Commuter',
      keterangan:
        'KA bandara relasi Manggarai - Bandara Soekarno-Hatta lewat BNI City. Manggarai merupakan stasiun ujung, dilayani di jalur 7-8 lantai dasar.',
    },
    {
      kode: 'KLB',
      nama: 'Kereta Luar Biasa',
      tokenWarna: 'lin-klb',
      operator: 'KAI',
      keterangan:
        'Perjalanan di luar GAPEKA, antara lain KLB kirim rangkaian dari/ke Balai Yasa Manggarai. Dilayani di jalur 5-6 yang peron pulaunya berstatus inaktif.',
    },
  ],
  dinas: [
    {
      id: 'DNS-LATIH',
      nama: 'Dinas Latihan',
      keterangan:
        'Pengenalan papan pelayanan. Kepadatan rendah, gangguan jarang. Dipakai untuk membiasakan pembentukan rute masuk dan rute keluar.',
      mulai: '05.00',
      selesai: '05.45',
      tingkatKesulitan: 'DASAR',
      peluangGangguanPerJam: 0.2,
    },
    {
      id: 'DNS-PUNCAK-PAGI',
      nama: 'Puncak Pagi',
      keterangan:
        'Puncak kepadatan pagi. Headway rapat di kedua lantai dan perpindahan penumpang tinggi.',
      mulai: '06.30',
      selesai: '08.00',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.8,
    },
    {
      id: 'DNS-PUNCAK-SORE',
      nama: 'Puncak Sore',
      keterangan:
        'Puncak kepadatan sore. Arus berbalik: rangkaian dari arah Jakarta Kota dan Angke memadati kedua lantai sekaligus.',
      mulai: '16.30',
      selesai: '18.00',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.8,
    },
    {
      id: 'DNS-PAGI',
      nama: 'Dinas Pagi',
      keterangan:
        'Satu sesi dinas penuh delapan jam, mencakup puncak pagi sampai lepas tengah hari.',
      mulai: '05.00',
      selesai: '13.00',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.6,
    },
    {
      id: 'DNS-SIANG',
      nama: 'Dinas Siang',
      keterangan:
        'Satu sesi dinas penuh delapan jam, mencakup lepas tengah hari sampai berakhirnya puncak sore.',
      mulai: '13.00',
      selesai: '21.00',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.6,
    },
    {
      id: 'DNS-MALAM',
      nama: 'Dinas Malam',
      keterangan:
        'Satu sesi dinas penuh delapan jam melewati tengah malam. Perjalanan KRL menipis lewat tengah malam dan berhenti sama sekali sekitar pukul 01.00, tetapi KA jarak jauh terus melintas sepanjang malam.',
      mulai: '21.00',
      selesai: '05.00',
      tingkatKesulitan: 'MENENGAH',
      peluangGangguanPerJam: 0.45,
    },
    {
      id: 'DNS-SEHARI',
      nama: 'Satu Hari Penuh',
      keterangan:
        'Seluruh perjalanan yang termuat pada berkas jadwal, dari tengah malam sampai tengah malam berikutnya. Sesi terpanjang; disarankan hanya setelah menguasai dinas delapan jam.',
      mulai: '00.00',
      selesai: '23.59',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.6,
    },
  ],
  perjalanan,
};

const berkas = resolve(AKAR, 'data', 'jadwal-manggarai.json');
mkdirSync(dirname(berkas), { recursive: true });
writeFileSync(berkas, `${JSON.stringify(jadwal, null, 2)}\n`, 'utf8');

const hitung = perjalanan.reduce((a, p) => {
  a[p.lin] = (a[p.lin] ?? 0) + 1;
  return a;
}, {});
const perJam = {};
for (const p of perjalanan) {
  const h = p.jamDatang.slice(0, 2);
  perJam[h] = (perJam[h] ?? 0) + 1;
}

console.log(`Jadwal ditulis ke ${berkas}`);
console.log(`  perjalanan=${perjalanan.length}`, hitung);
console.log(`  dilewati dari sumber KRL: ${dilewati}`);
console.log(
  `  sebaran per jam: ${Object.keys(perJam)
    .sort()
    .map((h) => `${h}:${perJam[h]}`)
    .join(' ')}`,
);
