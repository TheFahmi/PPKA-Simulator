/**
 * Pembangkit data/jadwal-manggarai.json
 *
 *   node tools/bangun-jadwal.mjs
 *
 * SUMBER DATA — dibaca 26 Juli 2026
 * ---------------------------------
 * 1. Commuter Line Bogor
 *    API jadwal resmi KAI Commuter yang dipakai halaman jadwal kci.id:
 *      GET https://kci.id/api/krl/schedules?stationid=MRI&timefrom=05:00&timeto=09:00
 *    (commuterline.id dan krl.co.id kini redirect permanen ke kci.id).
 *    Diambil seluruh 65 pemberhentian Lin Bogor di Manggarai pada 05.00-09.00,
 *    lengkap dengan nomor KA, jam di Manggarai, dan relasi.
 *
 * 2. Commuter Line Cikarang
 *    Berkas resmi KAI Commuter "Jadwal Commuter Line Jabodetabek — Update
 *    22 Juni 2026" (PDF), diunduh dari kci.id, disusun berdasarkan GAPEKA 2025.
 *    Di dalam berkas itu lin ini berjudul "Lin Bekasi". Diambil 62 pemberhentian
 *    di Manggarai pada 05.00-09.00 (32 arah barat, 30 arah timur).
 *
 * 3. Commuter Line Basoetta
 *    Pola operasi terverifikasi (Manggarai sebagai stasiun ujung; keberangkatan
 *    05.00-22.00 dengan selang 30 menit; nomor KA berada pada seri 8xx dengan
 *    contoh nyata KA 806A). Penetapan nomor untuk tiap keberangkatan TIDAK
 *    terverifikasi, sehingga seluruh baris Basoetta ditandai REKONSTRUKSI_POLA.
 *
 * TIDAK DIMASUKKAN
 * ----------------
 * KA jarak jauh. Per Juli 2026 tidak ada KA jarak jauh yang berhenti melayani
 * naik-turun penumpang di Stasiun Manggarai; pemindahan layanan dari Gambir
 * masih berstatus rencana. Nomor KA jarak jauh yang muncul di situs agregator
 * untuk Manggarai adalah kereta yang melintas, bukan berhenti, dan sebagian
 * justru nomor KA bandara yang salah kategori. Karena itu tidak ada satu pun
 * baris KA jarak jauh yang direka di berkas ini.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lama berhenti melayani naik-turun penumpang di Manggarai (detik). */
const BERHENTI_KRL = 100;
/** Selisih jam datang terhadap jam berangkat untuk KA yang melintas (detik). */
const DWELL_MODEL = 120;
/** Waktu penyiapan rangkaian untuk KA yang berdinas mulai dari Manggarai. */
const SIAP_RANGKAIAN = 360;
/** Waktu berdiri rangkaian yang mengakhiri dinas di Manggarai. */
const TAHAN_AKHIR = 300;

const perjalanan = [];

function jamKurang(jam, detik) {
  const [h, m] = jam.split(':').map(Number);
  let t = h * 3600 + m * 60 - detik;
  if (t < 0) t += 86400;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}.${p(Math.floor((t % 3600) / 60))}.${p(t % 60)}`;
}

function jamTambah(jam, detik) {
  return jamKurang(jam, -detik);
}

function jamPenuh(jam) {
  const [h, m] = jam.split(':').map(Number);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}.${p(m)}.00`;
}

/**
 * @param {object} o
 */
function tambah(o) {
  const {
    nomorKA,
    lin,
    jam,
    asal,
    tujuan,
    batasMasukId,
    batasKeluarId,
    sepurLazim,
    keandalanData,
    peran = 'MELINTAS', // MELINTAS | MULAI | AKHIR
    jenisSarana = 'KRL_12',
    catatan,
  } = o;

  let jamDatang;
  let jamBerangkat;
  if (peran === 'LANGSUNG') {
    // KA berjalan langsung tidak berhenti: jam datang dan jam berangkat sama,
    // yakni jam melintas yang tercantum GAPEKA dengan tanda "Ls".
    jamDatang = jamPenuh(jam);
    jamBerangkat = jamPenuh(jam);
  } else if (peran === 'MULAI') {
    jamBerangkat = jamPenuh(jam);
    jamDatang = jamKurang(jam, SIAP_RANGKAIAN);
  } else if (peran === 'AKHIR') {
    jamDatang = jamPenuh(jam);
    jamBerangkat = jamTambah(jam, TAHAN_AKHIR);
  } else {
    jamBerangkat = jamPenuh(jam);
    jamDatang = jamKurang(jam, DWELL_MODEL);
  }

  perjalanan.push({
    id: `TRIP-${nomorKA}`,
    nomorKA,
    lin,
    jenisSarana,
    relasi: `${asal} - ${tujuan}`,
    asal,
    tujuan,
    batasMasukId,
    batasKeluarId,
    jamDatang,
    jamBerangkat,
    sepurLazim,
    waktuBerhentiMinimumDetik: peran === 'LANGSUNG' ? 0 : BERHENTI_KRL,
    langsung: peran === 'LANGSUNG',
    keandalanData,
    ...(catatan ? { catatan } : {}),
  });
}

/* ================================================================== */
/* 1. Commuter Line Bogor — lantai layang, jalur 9-12                  */
/* ================================================================== */

const SEPUR_KE_JAKARTAKOTA = ['SP-L9', 'SP-L10'];
const SEPUR_KE_BOGOR = ['SP-L11', 'SP-L12'];

/** Arah utara: masuk dari Tebet, keluar ke Cikini. Nomor KA ganjil. */
const BOGOR_UTARA = [
  ['1157', '05:06', 'Bogor', 'Jakarta Kota'],
  ['1159', '05:11', 'Bogor', 'Jakarta Kota'],
  ['1161', '05:21', 'Bogor', 'Jakarta Kota'],
  ['1165', '05:31', 'Bogor', 'Jakarta Kota'],
  ['1167', '05:38', 'Depok', 'Jakarta Kota'],
  ['1169', '05:42', 'Bogor', 'Jakarta Kota'],
  ['1171', '05:51', 'Bogor', 'Jakarta Kota'],
  ['1173', '05:57', 'Bogor', 'Jakarta Kota'],
  ['1501', '06:01', 'Nambo', 'Jakarta Kota'],
  ['1175', '06:06', 'Bogor', 'Jakarta Kota'],
  ['1177', '06:13', 'Bogor', 'Jakarta Kota'],
  ['1179', '06:21', 'Bogor', 'Jakarta Kota'],
  ['1181', '06:29', 'Bojonggede', 'Jakarta Kota'],
  ['1183', '06:33', 'Bogor', 'Jakarta Kota'],
  ['1185', '06:41', 'Depok', 'Jakarta Kota'],
  ['1187', '06:48', 'Bojonggede', 'Jakarta Kota'],
  ['1189', '06:53', 'Bogor', 'Jakarta Kota'],
  ['1191', '06:57', 'Bogor', 'Jakarta Kota'],
  ['1503', '07:03', 'Nambo', 'Jakarta Kota'],
  ['1193', '07:12', 'Bogor', 'Jakarta Kota'],
  ['1197', '07:24', 'Bogor', 'Jakarta Kota'],
  ['1203', '07:43', 'Bogor', 'Jakarta Kota'],
  ['1205', '07:47', 'Bogor', 'Jakarta Kota'],
  ['1207', '07:54', 'Bogor', 'Jakarta Kota'],
  ['1209', '07:58', 'Bogor', 'Jakarta Kota'],
  ['1505', '08:03', 'Nambo', 'Jakarta Kota'],
  ['1213A', '08:13', 'Bogor', 'Jakarta Kota'],
  ['1215A', '08:23', 'Bogor', 'Jakarta Kota'],
  ['1217A', '08:29', 'Bogor', 'Jakarta Kota'],
  ['1219', '08:35', 'Bogor', 'Jakarta Kota'],
  ['1225', '08:48', 'Bogor', 'Jakarta Kota'],
  ['1507', '08:55', 'Nambo', 'Jakarta Kota'],
];

for (const [nomorKA, jam, asal, tujuan] of BOGOR_UTARA) {
  tambah({
    nomorKA,
    lin: 'LIN_BOGOR',
    jam,
    asal,
    tujuan,
    batasMasukId: 'BTS-TBT-D',
    batasKeluarId: 'BTS-CKI-K',
    sepurLazim: SEPUR_KE_JAKARTAKOTA,
    keandalanData: 'RESMI',
  });
}

/** Arah selatan: masuk dari Cikini, keluar ke Tebet. Nomor KA genap. */
const BOGOR_SELATAN = [
  ['1504', '05:37', 'Jakarta Kota', 'Nambo'],
  ['1152', '05:50', 'Jakarta Kota', 'Bogor'],
  ['1154', '05:58', 'Jakarta Kota', 'Bogor'],
  ['1156A', '06:05', 'Jakarta Kota', 'Bogor'],
  ['1158A', '06:13', 'Jakarta Kota', 'Bogor'],
  ['1506', '06:34', 'Jakarta Kota', 'Nambo'],
  ['1164', '06:39', 'Jakarta Kota', 'Bogor'],
  ['1166', '06:48', 'Jakarta Kota', 'Bogor'],
  ['1168', '06:52', 'Jakarta Kota', 'Bogor'],
  ['1170', '07:00', 'Jakarta Kota', 'Bogor'],
  ['1172', '07:05', 'Jakarta Kota', 'Bogor'],
  ['1174', '07:13', 'Jakarta Kota', 'Depok'],
  ['1176', '07:21', 'Jakarta Kota', 'Bogor'],
  ['1178', '07:28', 'Jakarta Kota', 'Bogor'],
  ['1180', '07:33', 'Jakarta Kota', 'Bogor'],
  ['1182', '07:43', 'Jakarta Kota', 'Bogor'],
  ['1184', '07:47', 'Jakarta Kota', 'Depok'],
  ['1186', '07:52', 'Jakarta Kota', 'Bogor'],
  ['1188', '07:59', 'Jakarta Kota', 'Bogor'],
  ['1508', '08:03', 'Jakarta Kota', 'Nambo'],
  ['1190', '08:07', 'Jakarta Kota', 'Bogor'],
  ['1194', '08:17', 'Jakarta Kota', 'Bogor'],
  ['1200', '08:43', 'Jakarta Kota', 'Bogor'],
  ['1202', '08:47', 'Jakarta Kota', 'Bogor'],
];

for (const [nomorKA, jam, asal, tujuan] of BOGOR_SELATAN) {
  tambah({
    nomorKA,
    lin: 'LIN_BOGOR',
    jam,
    asal,
    tujuan,
    batasMasukId: 'BTS-CKI-D',
    batasKeluarId: 'BTS-TBT-K',
    sepurLazim: SEPUR_KE_BOGOR,
    keandalanData: 'RESMI',
  });
}

/** Berdinas mulai dari Manggarai menuju Bogor. */
const BOGOR_MULAI_MRI = [
  ['1000', '05:10'],
  ['1002', '05:27'],
  ['1004', '05:54'],
  ['1006', '06:26'],
  ['1008', '06:56'],
  ['1010', '07:17'],
  ['1012', '07:38'],
  ['1014', '08:37'],
  ['1016', '08:58'],
];

for (const [nomorKA, jam] of BOGOR_MULAI_MRI) {
  tambah({
    nomorKA,
    lin: 'LIN_BOGOR',
    jam,
    asal: 'Manggarai',
    tujuan: 'Bogor',
    batasMasukId: 'BTS-CKI-D',
    batasKeluarId: 'BTS-TBT-K',
    sepurLazim: SEPUR_KE_BOGOR,
    keandalanData: 'RESMI',
    peran: 'MULAI',
    catatan:
      'Jam berangkat sesuai jadwal resmi. Perjalanan berdinas mulai dari Manggarai; masuknya rangkaian ke emplasemen dimodelkan sebagai langsiran dari arah Cikini karena penyiapan rangkaian tidak tercantum di jadwal publik.',
  });
}

/* ================================================================== */
/* 2. Commuter Line Cikarang — lantai dasar, jalur 1-4                 */
/* ================================================================== */

const SEPUR_KE_BARAT = ['SP-G1', 'SP-G2'];
const SEPUR_KE_TIMUR = ['SP-G3', 'SP-G4'];

/** Arah barat: masuk dari Matraman, keluar ke Sudirman. */
const CIKARANG_BARAT = [
  ['5023B', '05:05', 'Bekasi', 'Angke'],
  ['5027B', '05:11', 'Cikarang', 'Angke'],
  ['5505B', '05:19', 'Cikarang', 'Kampung Bandan'],
  ['5029B', '05:24', 'Cikarang', 'Angke'],
  ['5507B', '05:42', 'Cikarang', 'Kampung Bandan'],
  ['5031B', '05:53', 'Bekasi', 'Kampung Bandan'],
  ['5033B', '06:04', 'Cikarang', 'Angke'],
  ['5509B', '06:11', 'Cikarang', 'Kampung Bandan'],
  ['5037B', '06:17', 'Bekasi', 'Angke'],
  ['5511C', '06:33', 'Cikarang', 'Kampung Bandan'],
  ['5039C', '06:38', 'Cikarang', 'Angke'],
  ['5041C', '06:44', 'Bekasi', 'Angke'],
  ['5043C', '06:50', 'Cikarang', 'Angke'],
  ['5045B', '07:05', 'Bekasi', 'Angke'],
  ['5049B', '07:10', 'Cikarang', 'Angke'],
  ['5515B', '07:15', 'Tambun', 'Kampung Bandan'],
  ['5051B', '07:25', 'Bekasi', 'Angke'],
  ['5053B', '07:34', 'Bekasi', 'Angke'],
  ['5517B', '07:40', 'Cikarang', 'Kampung Bandan'],
  ['5055C', '07:56', 'Cikarang', 'Angke'],
  ['5057B', '08:04', 'Bekasi', 'Angke'],
  ['5519C', '08:13', 'Cikarang', 'Kampung Bandan'],
  ['5059B', '08:25', 'Bekasi', 'Angke'],
  ['5521B', '08:35', 'Bekasi', 'Kampung Bandan'],
  ['5063C', '08:42', 'Cikarang', 'Kampung Bandan'],
  ['5065B', '08:53', 'Cikarang', 'Angke'],
];

for (const [nomorKA, jam, asal, tujuan] of CIKARANG_BARAT) {
  tambah({
    nomorKA,
    lin: 'LIN_CIKARANG',
    jam,
    asal,
    tujuan,
    batasMasukId: 'BTS-MTR-D',
    batasKeluarId: 'BTS-SUD-K',
    sepurLazim: SEPUR_KE_BARAT,
    keandalanData: 'RESMI',
  });
}

/** Berdinas mulai dari Manggarai ke arah barat. */
const CIKARANG_MULAI_BARAT = [
  ['5707B', '06:21', 'Kampung Bandan'],
  ['5513B', '06:55', 'Kampung Bandan'],
  ['5711B', '07:20', 'Angke'],
  ['5715B', '07:47', 'Kampung Bandan'],
  ['5719B', '08:19', 'Angke'],
  ['5523B', '08:48', 'Kampung Bandan'],
];

for (const [nomorKA, jam, tujuan] of CIKARANG_MULAI_BARAT) {
  tambah({
    nomorKA,
    lin: 'LIN_CIKARANG',
    jam,
    asal: 'Manggarai',
    tujuan,
    batasMasukId: 'BTS-MTR-D',
    batasKeluarId: 'BTS-SUD-K',
    sepurLazim: SEPUR_KE_BARAT,
    keandalanData: 'RESMI',
    peran: 'MULAI',
    catatan:
      'Jam berangkat sesuai jadwal resmi. Perjalanan berdinas mulai dari Manggarai; masuknya rangkaian dimodelkan sebagai langsiran dari arah Matraman.',
  });
}

/** Arah timur: masuk dari Sudirman, keluar ke Matraman. */
const CIKARANG_TIMUR = [
  ['5016B', '05:22', 'Angke', 'Bekasi'],
  ['5018B', '05:29', 'Kampung Bandan', 'Cikarang'],
  ['5022C', '05:52', 'Angke', 'Tambun'],
  ['5024C', '05:59', 'Angke', 'Bekasi'],
  ['6002B', '06:23', 'Kampung Bandan', 'Cikarang'],
  ['5028B', '06:37', 'Angke', 'Bekasi'],
  ['6004C', '06:51', 'Kampung Bandan', 'Cikarang'],
  ['5030C', '06:55', 'Angke', 'Bekasi'],
  ['5034C', '07:00', 'Angke', 'Cikarang'],
  ['5036C', '07:14', 'Angke', 'Bekasi'],
  ['6006B', '07:19', 'Kampung Bandan', 'Bekasi'],
  ['5038C', '07:32', 'Angke', 'Cikarang'],
  ['5044D', '07:43', 'Angke', 'Cikarang'],
  ['6008B', '07:49', 'Kampung Bandan', 'Bekasi'],
  ['5046B', '07:59', 'Angke', 'Bekasi'],
  ['5048D', '08:14', 'Angke', 'Cikarang'],
  ['5050C', '08:23', 'Angke', 'Cikarang'],
  ['5052C', '08:33', 'Angke', 'Cikarang'],
  ['5054B', '08:45', 'Angke', 'Bekasi'],
  ['5056B', '08:54', 'Angke', 'Bekasi'],
];

for (const [nomorKA, jam, asal, tujuan] of CIKARANG_TIMUR) {
  tambah({
    nomorKA,
    lin: 'LIN_CIKARANG',
    jam,
    asal,
    tujuan,
    batasMasukId: 'BTS-SUD-D',
    batasKeluarId: 'BTS-MTR-K',
    sepurLazim: SEPUR_KE_TIMUR,
    keandalanData: 'RESMI',
  });
}

/** Berdinas mulai dari Manggarai ke arah timur. */
const CIKARANG_MULAI_TIMUR = [
  ['5012', '05:10', 'Bekasi'],
  ['5014', '05:16', 'Cikarang'],
  ['5020A', '05:40', 'Cikarang'],
  ['5026', '06:03', 'Cikarang'],
];

for (const [nomorKA, jam, tujuan] of CIKARANG_MULAI_TIMUR) {
  tambah({
    nomorKA,
    lin: 'LIN_CIKARANG',
    jam,
    asal: 'Manggarai',
    tujuan,
    batasMasukId: 'BTS-SUD-D',
    batasKeluarId: 'BTS-MTR-K',
    sepurLazim: SEPUR_KE_TIMUR,
    keandalanData: 'RESMI',
    peran: 'MULAI',
    catatan:
      'Jam berangkat sesuai jadwal resmi. Perjalanan berdinas mulai dari Manggarai; masuknya rangkaian dimodelkan sebagai langsiran dari arah Sudirman.',
  });
}

/** Mengakhiri dinas di Manggarai — rangkaian ditarik keluar arah Matraman. */
const CIKARANG_AKHIR_MRI = [
  ['5706B', '07:03', 'Kampung Bandan'],
  ['5708B', '07:33', 'Kampung Bandan'],
  ['5710B', '08:03', 'Angke'],
  ['5712B', '08:18', 'Kampung Bandan'],
  ['5714B', '08:33', 'Kampung Bandan'],
  ['5716B', '08:56', 'Kampung Bandan'],
];

for (const [nomorKA, jam, asal] of CIKARANG_AKHIR_MRI) {
  tambah({
    nomorKA,
    lin: 'LIN_CIKARANG',
    jam,
    asal,
    tujuan: 'Manggarai',
    batasMasukId: 'BTS-SUD-D',
    batasKeluarId: 'BTS-MTR-K',
    sepurLazim: SEPUR_KE_TIMUR,
    keandalanData: 'RESMI',
    peran: 'AKHIR',
    catatan:
      'Jam datang sesuai jadwal resmi; perjalanan berakhir di Manggarai. Penarikan rangkaian keluar emplasemen ke arah Matraman adalah pemodelan, bukan jadwal publik.',
  });
}

/* ================================================================== */
/* 3. Commuter Line Basoetta — lantai dasar, jalur 7-8                 */
/* ================================================================== */

const CATATAN_BASOETTA =
  'REKONSTRUKSI POLA. Yang terverifikasi: Manggarai merupakan stasiun ujung Commuter Line Basoetta; keberangkatan dari Manggarai berlangsung 05.00-22.00 dengan selang 30 menit; kedatangan dari Bandara Soekarno-Hatta dimulai pukul 06.12; nomor KA berada pada seri 8xx (contoh nyata terverifikasi: KA 806A). Yang TIDAK terverifikasi: penetapan nomor KA untuk tiap keberangkatan — nomor pada baris ini disusun mengikuti seri dan tidak boleh dianggap nomor GAPEKA. Ganti baris ini melalui menu impor jadwal begitu daftar nomor resmi tersedia.';

/*
 * Keberangkatan dari Manggarai mengikuti pola resmi: setiap 30 menit tepat,
 * tanpa lubang. Kedatangan dari Bandara Soekarno-Hatta dimulai 06.12 sesuai
 * jadwal arah balik, juga berselang 30 menit.
 */
const BASOETTA = [
  ['800', '05:00', 'BERANGKAT'],
  ['802', '05:30', 'BERANGKAT'],
  ['804', '06:00', 'BERANGKAT'],
  ['801', '06:12', 'DATANG'],
  ['806', '06:30', 'BERANGKAT'],
  ['803', '06:42', 'DATANG'],
  ['808', '07:00', 'BERANGKAT'],
  ['805', '07:12', 'DATANG'],
  ['810', '07:30', 'BERANGKAT'],
  ['807', '07:42', 'DATANG'],
  ['812', '08:00', 'BERANGKAT'],
  ['809', '08:12', 'DATANG'],
  ['814', '08:30', 'BERANGKAT'],
  ['811', '08:42', 'DATANG'],
];

for (const [nomorKA, jam, arah] of BASOETTA) {
  const dariBandara = arah === 'DATANG';
  tambah({
    nomorKA,
    lin: 'BANDARA',
    jam,
    asal: dariBandara ? 'Bandara Soekarno-Hatta' : 'Manggarai',
    tujuan: dariBandara ? 'Manggarai' : 'Bandara Soekarno-Hatta',
    batasMasukId: 'BTS-BNI',
    batasKeluarId: 'BTS-BNI',
    sepurLazim: ['SP-G7', 'SP-G8'],
    keandalanData: 'REKONSTRUKSI_POLA',
    peran: dariBandara ? 'AKHIR' : 'MULAI',
    jenisSarana: 'KRL_8',
    catatan: CATATAN_BASOETTA,
  });
}

/* ================================================================== */
/* 4. KA Jarak Jauh — berjalan langsung, tidak berhenti di Manggarai   */
/* ================================================================== */

/*
 * Seluruh KA jarak jauh relasi Stasiun Gambir melintas Stasiun Manggarai pada
 * rute normalnya: Bekasi - Jatinegara - MANGGARAI - Cikini - Gondangdia -
 * Gambir. KA relasi Pasar Senen TIDAK lewat Manggarai (rutenya Jatinegara -
 * Pondok Jati - Kramat - Gang Sentiong - Pasar Senen), sehingga tidak dimuat.
 *
 * Tidak ada satu pun KA jarak jauh yang BERHENTI melayani penumpang di
 * Manggarai. GAPEKA mencantumkan Manggarai pada setiap perjalanan KA jarak
 * jauh dengan tanda "Ls" pada kolom Datang — berjalan langsung — dan jam pada
 * kolom Berangkat adalah jam melintasnya. Jam di bawah ini diambil apa adanya
 * dari kolom itu, jadi TIDAK diperkirakan maupun dihitung sendiri.
 *
 * Sumber: GAPEKA 2025 Jawa, Lampiran II "Daftar Waktu KA Antar Kota"
 * (Keputusan Dirjen Perkeretaapian KP-DJKA 224 Tahun 2024, berlaku 1 Februari
 * 2025), berkas PDF terbitan DJKA Kementerian Perhubungan.
 */

const CATATAN_KAJJ =
  'Jam melintas Manggarai diambil apa adanya dari GAPEKA 2025 Lampiran II "Daftar Waktu KA Antar Kota" (KP-DJKA 224 Tahun 2024), kolom Berangkat pada baris Manggarai yang bertanda "Ls" — berjalan langsung. KA ini TIDAK berhenti melayani penumpang di Manggarai. Perlu dicatat: angka ini versi dasar GAPEKA 2025 yang berlaku 1 Februari 2025; dokumen revisi per 18 Juni 2026 tidak berhasil diperoleh, sehingga perjalanan yang berubah pada revisi itu berpotensi berbeda.';

/** Arah keluar Jakarta: masuk dari arah Gambir, keluar ke arah Jatinegara. */
const KAJJ_KELUAR_JAKARTA = [
  ['26', '06:09', 'Argo Merbabu', 'Semarang Tawang'],
  ['6', '06:29', 'Argo Semeru', 'Surabaya Gubeng'],
  ['130', '06:44', 'Papandayan', 'Garut'],
  ['50F', '07:09', 'Purwojaya', 'Kroya'],
  ['20', '07:24', 'Argo Muria', 'Semarang Tawang'],
  ['132', '07:38', 'Parahyangan', 'Bandung'],
  ['46', '07:54', 'Taksaka', 'Yogyakarta'],
  ['2', '08:29', 'Argo Bromo Anggrek', 'Surabaya Pasarturi'],
  ['128', '08:39', 'Pangandaran', 'Banjar'],
  ['16', '08:59', 'Argo Dwipangga', 'Solo Balapan'],
];

for (const [nomorKA, jam, nama, tujuan] of KAJJ_KELUAR_JAKARTA) {
  tambah({
    nomorKA,
    lin: 'KAJJ',
    jam,
    asal: 'Gambir',
    tujuan,
    batasMasukId: 'BTS-JJ-BRT-D',
    batasKeluarId: 'BTS-JJ-TMR-K',
    sepurLazim: ['SP-GLH'],
    keandalanData: 'RESMI',
    peran: 'LANGSUNG',
    jenisSarana: 'KA_ANTARKOTA',
    catatan: `KA ${nama}. ${CATATAN_KAJJ}`,
  });
}

/** Arah masuk Jakarta: masuk dari arah Jatinegara, keluar ke arah Gambir. */
const KAJJ_MASUK_JAKARTA = [
  ['7', '05:35', 'Bima', 'Surabaya Gubeng'],
  ['63', '06:24', 'Manahan', 'Solo Balapan'],
  ['131', '07:51', 'Parahyangan', 'Bandung'],
  ['117', '08:18', 'Gunungjati', 'Cirebon'],
];

for (const [nomorKA, jam, nama, asal] of KAJJ_MASUK_JAKARTA) {
  tambah({
    nomorKA,
    lin: 'KAJJ',
    jam,
    asal,
    tujuan: 'Gambir',
    batasMasukId: 'BTS-JJ-TMR-D',
    batasKeluarId: 'BTS-JJ-BRT-K',
    sepurLazim: ['SP-GLU'],
    keandalanData: 'RESMI',
    peran: 'LANGSUNG',
    jenisSarana: 'KA_ANTARKOTA',
    catatan: `KA ${nama}. ${CATATAN_KAJJ}`,
  });
}

/* ================================================================== */
/* Berkas keluaran                                                     */
/* ================================================================== */

perjalanan.sort((a, b) => a.jamDatang.localeCompare(b.jamDatang));

const jadwal = {
  versi: '1.0.0',
  gapeka:
    'GAPEKA 2025 — jadwal Commuter Line Jabodetabek pembaruan 22 Juni 2026 (KAI Commuter)',
  stasiun: 'MRI',
  tanggalDibuat: '2026-07-26',
  sumber: [
    'GAPEKA 2025 Jawa, Lampiran II Daftar Waktu KA Antar Kota (KP-DJKA 224 Tahun 2024), berkas PDF DJKA Kementerian Perhubungan',
    'https://kci.id/api/krl/schedules?stationid=MRI&timefrom=05:00&timeto=09:00',
    'https://kci.id/files/download/documents/Jadwal Commuter Line Jabodetabek - Update 22 Juni 2026.pdf',
    'https://kci.id/layanan/info-pelanggan/jadwal',
    'https://id.wikipedia.org/wiki/Stasiun_Manggarai',
  ],
  catatanKeakuratan: [
    'NOMOR KA, JAM, DAN RELASI Commuter Line Bogor serta Commuter Line Cikarang diambil apa adanya dari kanal resmi KAI Commuter (API jadwal kci.id dan berkas jadwal PDF terbitan 22 Juni 2026). Baris tersebut ditandai keandalanData "RESMI".',
    'Jadwal publik hanya mencantumkan SATU jam per stasiun. Jam tersebut dipakai sebagai JAM BERANGKAT. Jam datang di Manggarai diturunkan dengan mengurangi 2 menit sebagai pemodelan waktu berhenti; angka ini BUKAN data resmi.',
    'Baris Commuter Line Basoetta ditandai "REKONSTRUKSI_POLA": pola jam dan seri nomor terverifikasi, penetapan nomor per keberangkatan tidak.',
    'Penetapan sepur pada "sepurLazim" mengikuti peruntukan jalur resmi hasil Switch Over ke-7, bukan penetapan sepur per perjalanan — pemilihan sepur adalah keputusan PPKA dan itulah inti permainan ini.',
    'Golongan sarana (jumlah kereta per rangkaian) merupakan asumsi pemodelan, tidak diambil dari data operasional.',
    'KA JARAK JAUH dimuat sebagai KA BERJALAN LANGSUNG, bukan sebagai pemberhentian. Tidak ada KA jarak jauh yang berhenti melayani penumpang di Manggarai; pemindahan layanan dari Stasiun Gambir masih berstatus rencana. Nomor KA, nama, dan jam melintas diambil apa adanya dari GAPEKA 2025 Lampiran II terbitan DJKA pada baris Manggarai yang bertanda "Ls". Angka tersebut versi dasar yang berlaku 1 Februari 2025; dokumen revisi per 18 Juni 2026 tidak berhasil diperoleh. KA relasi Pasar Senen tidak dimuat karena rutenya memang tidak melewati Manggarai.',
    'Kereta Luar Biasa (KLB) tidak dijadwalkan di berkas ini karena menurut sifatnya KLB memang berada di luar GAPEKA; KLB dibangkitkan sebagai kejadian pada saat dinas berjalan.',
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
        'Lin Lingkar Cikarang, pada berkas jadwal resmi berjudul Lin Bekasi. Di Manggarai dilayani di lantai dasar: jalur 1-2 arah Sudirman/Angke/Kampung Bandan, jalur 3-4 arah Matraman/Bekasi/Cikarang.',
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
      kode: 'KAJJ',
      nama: 'KA Antarkota',
      tokenWarna: 'lin-kajj',
      operator: 'KAI',
      keterangan:
        'KA jarak jauh relasi Stasiun Gambir. Seluruhnya BERJALAN LANGSUNG di Manggarai — tidak ada yang berhenti melayani penumpang. Dilayani pada sepur lintas hulu (arah Gambir) dan sepur lintas hilir (arah Jatinegara) yang tidak bernomor peron.',
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
      id: 'DNS-PAGI-1',
      nama: 'Dinas Pagi I',
      keterangan:
        'Awal jam sibuk. Arus Lin Bogor dari arah Tebet mulai rapat sementara sebagian rangkaian masih berdinas mulai dari Manggarai.',
      mulai: '05.00',
      selesai: '06.30',
      tingkatKesulitan: 'MENENGAH',
      peluangGangguanPerJam: 0.45,
    },
    {
      id: 'DNS-PUNCAK',
      nama: 'Dinas Puncak Pagi',
      keterangan:
        'Puncak kepadatan. Headway rapat di kedua lantai, perpindahan penumpang tinggi, dan penarikan rangkaian yang mengakhiri dinas menambah beban emplasemen.',
      mulai: '06.30',
      selesai: '08.00',
      tingkatKesulitan: 'PADAT',
      peluangGangguanPerJam: 0.8,
    },
    {
      id: 'DNS-PAGI-PENUH',
      nama: 'Dinas Pagi Penuh',
      keterangan:
        'Satu sesi dinas penuh 05.00-09.00 dengan seluruh perjalanan yang termuat di berkas jadwal. Disarankan setelah menguasai dua dinas sebelumnya.',
      mulai: '05.00',
      selesai: '09.00',
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
console.log(`Jadwal ditulis ke ${berkas}`);
console.log(`  perjalanan=${perjalanan.length}`, hitung);
