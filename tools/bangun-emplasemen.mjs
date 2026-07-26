/**
 * Pembangkit data/emplasemen-manggarai.json
 *
 * Skrip ini bukan bagian dari aplikasi; ia dijalankan pengembang saat tata
 * letak emplasemen berubah (mis. setelah switch over berikutnya). Sengaja
 * dipisah supaya koordinat, blok, dan penomoran wesel dibangkitkan konsisten
 * dan dapat diperiksa ulang terhadap sumber.
 *
 *   node tools/bangun-emplasemen.mjs
 *
 * ACUAN TATA LETAK
 * ----------------
 * Konfigurasi jalur mengikuti hasil Switch Over ke-7 (SO-7) yang dieksekusi
 * 17 Desember 2023 dan berlaku bagi penumpang sejak 20 Desember 2023:
 *
 *   Lantai 2 (layang) — Commuter Line Bogor
 *     Jalur  9  Lin Bogor & feeder dari/tujuan Jakarta Kota (arah Cikini)
 *     Jalur 10  sepur lurus arah Jakarta Kota + Lin Bogor tujuan Jakarta Kota
 *     Jalur 11  Lin Bogor tujuan Bogor/Nambo (arah Tebet) + sepur lurus arah Bogor
 *     Jalur 12  Lin Bogor & feeder dari/tujuan Bogor/Nambo
 *     Peron pulau di antara jalur 9-10 dan di antara jalur 11-12
 *
 *   Lantai dasar — Commuter Line Cikarang, KA barang/KLB, Commuter Line Basoetta
 *     Jalur  1  Lin Cikarang & feeder dari/tujuan Angke/Kampung Bandan (arah Sudirman)
 *     Jalur  2  sepur lurus arah Tanah Abang + tujuan Angke/Kampung Bandan via Angke
 *     Jalur  3  Lin Cikarang tujuan Bekasi/Cikarang (arah Matraman) + sepur lurus arah Jatinegara
 *     Jalur  4  Lin Cikarang tujuan Bekasi/Cikarang (arah Matraman)
 *     Jalur  5  KA barang & KLB kirim rangkaian  ┐ peron pulau di antaranya berstatus
 *     Jalur  6  KA barang & KLB kirim rangkaian  ┘ inaktif, bukan untuk penumpang
 *     Jalur  7  Commuter Line Basoetta dari/tujuan Bandara Soekarno-Hatta (arah BNI City)
 *     Jalur  8  Commuter Line Basoetta — peron pulau 7-8 ditambah satu peron sisi
 *     Ditambah satu jalur akses Balai Yasa Manggarai tanpa nomor.
 *
 * Sumber: tabel tata letak peron Stasiun Manggarai (Wikipedia bahasa Indonesia,
 * revisi 18 Juli 2026) yang menyitir Kompas.com 18 Desember 2023 "Daftar
 * Perubahan Jalur Transit di Stasiun Manggarai Mulai 20 Desember 2023", serta
 * siaran KAI Commuter mengenai SO-5/SO-7.
 *
 * YANG BUKAN HASIL VERIFIKASI (asumsi pemodelan, ditandai di berkas keluaran):
 *   - Susunan wesel, penomoran wesel, dan penamaan sinyal. Tata letak wesel
 *     sesungguhnya tidak dipublikasikan; yang dimodelkan di sini adalah bentuk
 *     emplasemen yang konsisten secara operasional dengan peruntukan jalur di
 *     atas, bukan gambar teknis emplasemen MRI.
 *   - Panjang peron dan panjang ruas dalam meter.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Skala gambar: 1 satuan kanvas = 0,5 meter. */
const SKALA_M = 0.5;

const simpul = [];
const ruas = [];
const wesel = [];
const sinyal = [];
const blok = [];
const sepur = [];
const peron = [];
const batas = [];

const petaSimpul = new Map();

function S(id, jenis, level, x, y) {
  const s = { id, jenis, level, x, y };
  simpul.push(s);
  petaSimpul.set(id, s);
  return id;
}

function jarak(a, b, titikBelok = []) {
  const p = petaSimpul.get(a);
  const q = petaSimpul.get(b);
  const titik = [p, ...titikBelok, q];
  let n = 0;
  for (let i = 1; i < titik.length; i += 1) {
    n += Math.hypot(titik[i].x - titik[i - 1].x, titik[i].y - titik[i - 1].y);
  }
  return n;
}

function R(id, jenis, dari, ke, opsi = {}) {
  const titikBelok = opsi.titikBelok ?? [];
  const blokId = opsi.blokId ?? `BLK-${id.replace(/^R[GL]-/, '')}`;
  const r = {
    id,
    jenis,
    dari,
    ke,
    blokId,
    panjangM: Math.round(jarak(dari, ke, titikBelok) * SKALA_M),
  };
  if (opsi.sepurId) r.sepurId = opsi.sepurId;
  if (titikBelok.length > 0) r.titikBelok = titikBelok;
  ruas.push(r);

  if (!blok.some((b) => b.id === blokId)) {
    blok.push({
      id: blokId,
      nama: opsi.namaBlok ?? blokId.replace('BLK-', ''),
      level: petaSimpul.get(dari).level,
      wilayah: jenis === 'PETAK_JALAN' ? 'PETAK_JALAN' : 'EMPLASEMEN',
    });
  }
  return id;
}

function W(nomor, level, simpulId, ruasPangkal, ruasLurus, ruasBelok, kedudukanNormal = 'LURUS') {
  const id = `W-${nomor}`;
  wesel.push({
    id,
    nomor: String(nomor),
    level,
    simpulId,
    ruasPangkal,
    ruasLurus,
    ruasBelok,
    kedudukanNormal,
    // Wesel elektrik emplasemen besar: balik lidah beberapa detik.
    waktuBalikDetik: 7,
  });
  return id;
}

function SIG(nama, jenis, level, simpulId, ruasDilindungi, hadap, offsetY = -16, offsetX = 0) {
  sinyal.push({
    id: `SIG-${nama}`,
    nama,
    jenis,
    level,
    simpulId,
    ruasDilindungi,
    hadap,
    offsetY,
    offsetX,
  });
  return `SIG-${nama}`;
}

/* ================================================================== */
/* LANTAI DASAR — jalur 1-8, sepur lintas KA jarak jauh, akses Balai Yasa */
/* ================================================================== */

/*
 * Tata letak lantai dasar dari atas ke bawah:
 *
 *   jalur 1, 2          Commuter Line Cikarang arah Sudirman/Angke/Kampung Bandan
 *   jalur 3, 4          Commuter Line Cikarang arah Matraman/Bekasi/Cikarang
 *   sepur lintas hulu   KA jarak jauh arah Gambir            ┐ tidak bernomor peron
 *   jalur 5             sepur simpan/penyusulan lintas hulu  │
 *   jalur 6             sepur simpan/penyusulan lintas hilir │
 *   sepur lintas hilir  KA jarak jauh arah Jatinegara        ┘
 *   jalur 7, 8          Commuter Line Basoetta arah BNI City
 *
 * Sepur lintas KA jarak jauh sengaja TIDAK diberi nomor peron: tabel tata
 * letak resmi Stasiun Manggarai tidak mengalokasikan satu pun jalur bernomor
 * (1 sampai 12) untuk KA jarak jauh, sedangkan GAPEKA mencantumkan Manggarai
 * pada tiap perjalanan KA jarak jauh dengan status "Ls" — berjalan langsung.
 *
 * Jalur 5 dan 6 diperuntukkan bagi KA barang dan KLB kirim rangkaian menurut
 * tabel resmi; keduanya ditempatkan sebagai sepur simpan di sisi lintas KA
 * jarak jauh, bukan di sisi lintas Commuter Line, karena angkutan barang dan
 * KA jarak jauh berbagi lintas yang sama.
 */

const YG = {
  1: 44,
  2: 96,
  3: 160,
  4: 212,
  lu: 280, // sepur lintas hulu — arah Gambir
  5: 328,
  6: 392,
  lh: 440, // sepur lintas hilir — arah Jatinegara
  7: 500,
  8: 552,
  by: 488, // batas akses Balai Yasa (sisi barat)
};
const XKIRI = 100;
const XKANAN = 1600;
const XPERON_A = 620; // pangkal badan sepur
const XPERON_B = 1080; // ujung badan sepur

// -- Batas emplasemen -------------------------------------------------
S('SG-SUD-K', 'BATAS', 'DASAR', XKIRI, YG[1]);
S('SG-SUD-D', 'BATAS', 'DASAR', XKIRI, YG[4]);
S('SG-JJ-BRT-K', 'BATAS', 'DASAR', XKIRI, YG.lu);
S('SG-JJ-BRT-D', 'BATAS', 'DASAR', XKIRI, YG.lh);
S('SG-BY', 'BATAS', 'DASAR', XKIRI, YG.by);
S('SG-BNI', 'BATAS', 'DASAR', XKIRI, YG[8]);
S('SG-MTR-D', 'BATAS', 'DASAR', XKANAN, YG[1]);
S('SG-MTR-K', 'BATAS', 'DASAR', XKANAN, YG[4]);
S('SG-JJ-TMR-D', 'BATAS', 'DASAR', XKANAN, YG.lu);
S('SG-JJ-TMR-K', 'BATAS', 'DASAR', XKANAN, YG.lh);

// -- Simpul kepala & ujung badan sepur --------------------------------
// Jalur 7-8 melayani Commuter Line Basoetta yang berujung di Manggarai;
// sisi timurnya digambar berujung penghalang.
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const buntuKanan = n === 7 || n === 8;
  S(`HG${n}`, 'SAMBUNG', 'DASAR', XPERON_A, YG[n]);
  S(`TG${n}`, buntuKanan ? 'UJUNG' : 'SAMBUNG', 'DASAR', XPERON_B, YG[n]);
}
S('HLU', 'SAMBUNG', 'DASAR', XPERON_A, YG.lu);
S('TLU', 'SAMBUNG', 'DASAR', XPERON_B, YG.lu);
S('HLH', 'SAMBUNG', 'DASAR', XPERON_A, YG.lh);
S('TLH', 'SAMBUNG', 'DASAR', XPERON_B, YG.lh);

/*
 * Bentuk throat.
 *
 * Setiap petak jalan berujung pada satu wesel yang memecah ke sepasang sepur
 * sesuai peruntukannya: kaki lurus ke sepur lurus, kaki belok ke sepur belok.
 * Susunan ini menuruti sifat fisik wesel — ujung sebuah sepur hanya punya SATU
 * jalan keluar, yaitu lewat kaki pangkal wesel di depannya. Karena itu jalur
 * 9-10 memang hanya terjangkau dari arah Tebet dan jalur 11-12 hanya dari arah
 * Cikini, persis seperti peruntukan resminya.
 */

// -- Wesel sisi barat -------------------------------------------------
S('WG11', 'WESEL', 'DASAR', 300, YG[1]);
S('WG12', 'WESEL', 'DASAR', 300, YG[4]);
S('WG20', 'WESEL', 'DASAR', 400, YG.lu);
S('WG19', 'WESEL', 'DASAR', 320, YG.lh);
S('WG22', 'WESEL', 'DASAR', 440, YG.lh);
S('WG15', 'WESEL', 'DASAR', 300, YG[8]);

R('RG-PJ-SUD-K', 'PETAK_JALAN', 'SG-SUD-K', 'WG11', { namaBlok: 'PJ Sudirman (keluar)' });
R('RG-11-J1', 'PENGHUBUNG', 'WG11', 'HG1');
R('RG-11-J2', 'PENGHUBUNG', 'WG11', 'HG2');
R('RG-PJ-SUD-D', 'PETAK_JALAN', 'SG-SUD-D', 'WG12', { namaBlok: 'PJ Sudirman (masuk)' });
R('RG-12-J4', 'PENGHUBUNG', 'WG12', 'HG4');
R('RG-12-J3', 'PENGHUBUNG', 'WG12', 'HG3');

R('RG-PJ-JJ-BRT-K', 'PETAK_JALAN', 'SG-JJ-BRT-K', 'WG20', { namaBlok: 'PJ Gambir (keluar)' });
R('RG-20-LU', 'PENGHUBUNG', 'WG20', 'HLU');
R('RG-20-J5', 'PENGHUBUNG', 'WG20', 'HG5');

R('RG-PJ-JJ-BRT-D', 'PETAK_JALAN', 'SG-JJ-BRT-D', 'WG19', { namaBlok: 'PJ Gambir (masuk)' });
R('RG-PJ-BY', 'PETAK_JALAN', 'SG-BY', 'WG19', { namaBlok: 'Akses Balai Yasa' });
R('RG-19-22', 'PENGHUBUNG', 'WG19', 'WG22');
R('RG-22-LH', 'PENGHUBUNG', 'WG22', 'HLH');
R('RG-22-J6', 'PENGHUBUNG', 'WG22', 'HG6');

R('RG-PJ-BNI', 'PETAK_JALAN', 'SG-BNI', 'WG15', { namaBlok: 'PJ BNI City' });
R('RG-15-J8', 'PENGHUBUNG', 'WG15', 'HG8');
R('RG-15-J7', 'PENGHUBUNG', 'WG15', 'HG7');

W(11, 'DASAR', 'WG11', 'RG-PJ-SUD-K', 'RG-11-J1', 'RG-11-J2');
W(12, 'DASAR', 'WG12', 'RG-PJ-SUD-D', 'RG-12-J4', 'RG-12-J3');
W(20, 'DASAR', 'WG20', 'RG-PJ-JJ-BRT-K', 'RG-20-LU', 'RG-20-J5');
W(19, 'DASAR', 'WG19', 'RG-19-22', 'RG-PJ-JJ-BRT-D', 'RG-PJ-BY');
W(22, 'DASAR', 'WG22', 'RG-19-22', 'RG-22-LH', 'RG-22-J6');
W(15, 'DASAR', 'WG15', 'RG-PJ-BNI', 'RG-15-J8', 'RG-15-J7');

// -- Badan sepur ------------------------------------------------------
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  R(`RG-SP-J${n}`, 'SEPUR_PERON', `HG${n}`, `TG${n}`, {
    sepurId: `SP-G${n}`,
    namaBlok: `Jalur ${n}`,
  });
}
R('RG-SP-LU', 'SEPUR_EMPLASEMEN', 'HLU', 'TLU', {
  sepurId: 'SP-GLU',
  namaBlok: 'Sepur lintas hulu',
});
R('RG-SP-LH', 'SEPUR_EMPLASEMEN', 'HLH', 'TLH', {
  sepurId: 'SP-GLH',
  namaBlok: 'Sepur lintas hilir',
});

// -- Wesel sisi timur -------------------------------------------------
S('WG31', 'WESEL', 'DASAR', 1380, YG[1]);
S('WG32', 'WESEL', 'DASAR', 1380, YG[4]);
S('WG21', 'WESEL', 'DASAR', 1380, YG.lu);
S('WG23', 'WESEL', 'DASAR', 1380, YG.lh);

R('RG-PJ-MTR-D', 'PETAK_JALAN', 'SG-MTR-D', 'WG31', { namaBlok: 'PJ Matraman (masuk)' });
R('RG-31-J1', 'PENGHUBUNG', 'WG31', 'TG1');
R('RG-31-J2', 'PENGHUBUNG', 'WG31', 'TG2');
R('RG-PJ-MTR-K', 'PETAK_JALAN', 'SG-MTR-K', 'WG32', { namaBlok: 'PJ Matraman (keluar)' });
R('RG-32-J4', 'PENGHUBUNG', 'WG32', 'TG4');
R('RG-32-J3', 'PENGHUBUNG', 'WG32', 'TG3');

R('RG-PJ-JJ-TMR-D', 'PETAK_JALAN', 'SG-JJ-TMR-D', 'WG21', { namaBlok: 'PJ Jatinegara (masuk)' });
R('RG-21-LU', 'PENGHUBUNG', 'WG21', 'TLU');
R('RG-21-J5', 'PENGHUBUNG', 'WG21', 'TG5');
R('RG-PJ-JJ-TMR-K', 'PETAK_JALAN', 'SG-JJ-TMR-K', 'WG23', { namaBlok: 'PJ Jatinegara (keluar)' });
R('RG-23-LH', 'PENGHUBUNG', 'WG23', 'TLH');
R('RG-23-J6', 'PENGHUBUNG', 'WG23', 'TG6');

W(31, 'DASAR', 'WG31', 'RG-PJ-MTR-D', 'RG-31-J1', 'RG-31-J2');
W(32, 'DASAR', 'WG32', 'RG-PJ-MTR-K', 'RG-32-J4', 'RG-32-J3');
W(21, 'DASAR', 'WG21', 'RG-PJ-JJ-TMR-D', 'RG-21-LU', 'RG-21-J5');
W(23, 'DASAR', 'WG23', 'RG-PJ-JJ-TMR-K', 'RG-23-LH', 'RG-23-J6');

/* ================================================================== */
/* LANTAI LAYANG — jalur 9-12                                          */
/* ================================================================== */

const YL = { 9: 44, 10: 96, 11: 160, 12: 212 };

S('SL-CKI-K', 'BATAS', 'LAYANG', XKIRI, YL[9]);
S('SL-CKI-D', 'BATAS', 'LAYANG', XKIRI, YL[12]);
S('SL-TBT-D', 'BATAS', 'LAYANG', XKANAN, YL[9]);
S('SL-TBT-K', 'BATAS', 'LAYANG', XKANAN, YL[12]);

for (const n of [9, 10, 11, 12]) {
  S(`HL${n}`, 'SAMBUNG', 'LAYANG', XPERON_A, YL[n]);
  S(`TL${n}`, 'SAMBUNG', 'LAYANG', XPERON_B, YL[n]);
}

S('WL101', 'WESEL', 'LAYANG', 300, YL[9]);
S('WL102', 'WESEL', 'LAYANG', 300, YL[12]);

R('RL-PJ-CKI-K', 'PETAK_JALAN', 'SL-CKI-K', 'WL101', { namaBlok: 'PJ Cikini (keluar)' });
R('RL-101-J9', 'PENGHUBUNG', 'WL101', 'HL9');
R('RL-101-J10', 'PENGHUBUNG', 'WL101', 'HL10');
R('RL-PJ-CKI-D', 'PETAK_JALAN', 'SL-CKI-D', 'WL102', { namaBlok: 'PJ Cikini (masuk)' });
R('RL-102-J12', 'PENGHUBUNG', 'WL102', 'HL12');
R('RL-102-J11', 'PENGHUBUNG', 'WL102', 'HL11');

W(101, 'LAYANG', 'WL101', 'RL-PJ-CKI-K', 'RL-101-J9', 'RL-101-J10');
W(102, 'LAYANG', 'WL102', 'RL-PJ-CKI-D', 'RL-102-J12', 'RL-102-J11');

for (const n of [9, 10, 11, 12]) {
  R(`RL-SP-J${n}`, 'SEPUR_PERON', `HL${n}`, `TL${n}`, {
    sepurId: `SP-L${n}`,
    namaBlok: `Jalur ${n}`,
  });
}

S('WL121', 'WESEL', 'LAYANG', 1380, YL[9]);
S('WL122', 'WESEL', 'LAYANG', 1380, YL[12]);

R('RL-PJ-TBT-D', 'PETAK_JALAN', 'SL-TBT-D', 'WL121', { namaBlok: 'PJ Tebet (masuk)' });
R('RL-121-J9', 'PENGHUBUNG', 'WL121', 'TL9');
R('RL-121-J10', 'PENGHUBUNG', 'WL121', 'TL10');
R('RL-PJ-TBT-K', 'PETAK_JALAN', 'SL-TBT-K', 'WL122', { namaBlok: 'PJ Tebet (keluar)' });
R('RL-122-J12', 'PENGHUBUNG', 'WL122', 'TL12');
R('RL-122-J11', 'PENGHUBUNG', 'WL122', 'TL11');

W(121, 'LAYANG', 'WL121', 'RL-PJ-TBT-D', 'RL-121-J9', 'RL-121-J10');
W(122, 'LAYANG', 'WL122', 'RL-PJ-TBT-K', 'RL-122-J12', 'RL-122-J11');

/* ================================================================== */
/* Sinyal                                                              */
/* ================================================================== */

// Sinyal masuk — berdiri di batas emplasemen, melindungi petak jalan masuk.
SIG('C', 'MASUK', 'DASAR', 'SG-SUD-D', 'RG-PJ-SUD-D', 1, -18, 40);
SIG('D', 'MASUK', 'DASAR', 'SG-MTR-D', 'RG-PJ-MTR-D', -1, -18, -40);
SIG('E', 'MASUK', 'DASAR', 'SG-BNI', 'RG-PJ-BNI', 1, -18, 40);
SIG('F', 'MASUK', 'DASAR', 'SG-BY', 'RG-PJ-BY', 1, -18, 40);
SIG('G', 'MASUK', 'DASAR', 'SG-JJ-BRT-D', 'RG-PJ-JJ-BRT-D', 1, -18, 40);
SIG('H', 'MASUK', 'DASAR', 'SG-JJ-TMR-D', 'RG-PJ-JJ-TMR-D', -1, -18, -40);
SIG('A', 'MASUK', 'LAYANG', 'SL-CKI-D', 'RL-PJ-CKI-D', 1, -18, 40);
SIG('B', 'MASUK', 'LAYANG', 'SL-TBT-D', 'RL-PJ-TBT-D', -1, -18, -40);

// Sinyal keluar — berdiri di ujung badan sepur, melindungi ruas berikutnya.
const keluarDasar = [
  ['J1B', 'HG1', 'RG-11-J1', -1],
  ['J2B', 'HG2', 'RG-11-J2', -1],
  ['J3B', 'HG3', 'RG-12-J3', -1],
  ['J4B', 'HG4', 'RG-12-J4', -1],
  ['J5B', 'HG5', 'RG-20-J5', -1],
  ['J6B', 'HG6', 'RG-22-J6', -1],
  ['J7B', 'HG7', 'RG-15-J7', -1],
  ['J8B', 'HG8', 'RG-15-J8', -1],
  ['LUB', 'HLU', 'RG-20-LU', -1],
  ['LHB', 'HLH', 'RG-22-LH', -1],
  ['J1T', 'TG1', 'RG-31-J1', 1],
  ['J2T', 'TG2', 'RG-31-J2', 1],
  ['J3T', 'TG3', 'RG-32-J3', 1],
  ['J4T', 'TG4', 'RG-32-J4', 1],
  ['J5T', 'TG5', 'RG-21-J5', 1],
  ['J6T', 'TG6', 'RG-23-J6', 1],
  ['LUT', 'TLU', 'RG-21-LU', 1],
  ['LHT', 'TLH', 'RG-23-LH', 1],
];
for (const [nama, simpulId, ruasDilindungi, hadap] of keluarDasar) {
  SIG(nama, 'KELUAR', 'DASAR', simpulId, ruasDilindungi, hadap, -18, hadap * 22);
}

const keluarLayang = [
  ['J9U', 'HL9', 'RL-101-J9', -1],
  ['J10U', 'HL10', 'RL-101-J10', -1],
  ['J11U', 'HL11', 'RL-102-J11', -1],
  ['J12U', 'HL12', 'RL-102-J12', -1],
  ['J9S', 'TL9', 'RL-121-J9', 1],
  ['J10S', 'TL10', 'RL-121-J10', 1],
  ['J11S', 'TL11', 'RL-122-J11', 1],
  ['J12S', 'TL12', 'RL-122-J12', 1],
];
for (const [nama, simpulId, ruasDilindungi, hadap] of keluarLayang) {
  SIG(nama, 'KELUAR', 'LAYANG', simpulId, ruasDilindungi, hadap, -18, hadap * 22);
}

/* ================================================================== */
/* Sepur, peron, batas                                                 */
/* ================================================================== */

const definisiSepur = [
  ['SP-GLU', 'LU', 'Sepur lintas hulu', 'DASAR', 'RAYA', null, ['KAJJ'], 'RG-SP-LU',
    'Sepur lintas KA jarak jauh arah Gambir. Tidak berperon: KA jarak jauh berjalan langsung di Manggarai.'],
  ['SP-GLH', 'LH', 'Sepur lintas hilir', 'DASAR', 'RAYA', null, ['KAJJ'], 'RG-SP-LH',
    'Sepur lintas KA jarak jauh arah Jatinegara. Tidak berperon: KA jarak jauh berjalan langsung di Manggarai.'],
  ['SP-G1', '1', 'Jalur 1', 'DASAR', 'BELOK', 'PER-G12', ['LIN_CIKARANG'], 'RG-SP-J1',
    'Lin Cikarang dan feeder dari/tujuan Angke atau Kampung Bandan, arah Sudirman.'],
  ['SP-G2', '2', 'Jalur 2', 'DASAR', 'RAYA', 'PER-G12', ['LIN_CIKARANG'], 'RG-SP-J2',
    'Sepur lurus arah Tanah Abang; melayani tujuan Angke/Kampung Bandan via Angke.'],
  ['SP-G3', '3', 'Jalur 3', 'DASAR', 'RAYA', 'PER-G34', ['LIN_CIKARANG'], 'RG-SP-J3',
    'Sepur lurus arah Jatinegara; melayani tujuan Bekasi/Cikarang arah Matraman.'],
  ['SP-G4', '4', 'Jalur 4', 'DASAR', 'BELOK', 'PER-G34', ['LIN_CIKARANG'], 'RG-SP-J4',
    'Lin Cikarang tujuan Bekasi/Cikarang, arah Matraman.'],
  ['SP-G5', '5', 'Jalur 5', 'DASAR', 'SIMPAN', null, ['KLB','KAJJ'], 'RG-SP-J5',
    'KA barang dan KLB kirim rangkaian. Peron pulau di antara jalur 5-6 berstatus inaktif.'],
  ['SP-G6', '6', 'Jalur 6', 'DASAR', 'SIMPAN', null, ['KLB','KAJJ'], 'RG-SP-J6',
    'KA barang dan KLB kirim rangkaian. Tidak melayani naik-turun penumpang.'],
  ['SP-G7', '7', 'Jalur 7', 'DASAR', 'BADUG', 'PER-G78', ['BANDARA'], 'RG-SP-J7',
    'Commuter Line Basoetta dari/tujuan Bandara Soekarno-Hatta, arah BNI City.'],
  ['SP-G8', '8', 'Jalur 8', 'DASAR', 'BADUG', 'PER-G78', ['BANDARA'], 'RG-SP-J8',
    'Commuter Line Basoetta; dilengkapi peron sisi khusus KA bandara.'],
  ['SP-L9', '9', 'Jalur 9', 'LAYANG', 'BELOK', 'PER-L910', ['LIN_BOGOR'], 'RL-SP-J9',
    'Lin Bogor dan feeder dari/tujuan Jakarta Kota, arah Cikini.'],
  ['SP-L10', '10', 'Jalur 10', 'LAYANG', 'RAYA', 'PER-L910', ['LIN_BOGOR'], 'RL-SP-J10',
    'Sepur lurus arah Jakarta Kota; melayani Lin Bogor tujuan Jakarta Kota.'],
  ['SP-L11', '11', 'Jalur 11', 'LAYANG', 'RAYA', 'PER-L1112', ['LIN_BOGOR'], 'RL-SP-J11',
    'Lin Bogor tujuan Bogor/Nambo arah Tebet; sekaligus sepur lurus arah Bogor.'],
  ['SP-L12', '12', 'Jalur 12', 'LAYANG', 'BELOK', 'PER-L1112', ['LIN_BOGOR'], 'RL-SP-J12',
    'Lin Bogor dan feeder dari/tujuan Bogor/Nambo, arah Tebet.'],
];

for (const [
  id,
  nomor,
  label,
  level,
  jenis,
  peronId,
  linDilayani,
  ruasId,
  keterangan,
] of definisiSepur) {
  sepur.push({
    id,
    nomor,
    label,
    level,
    jenis,
    peronId,
    panjangPeronM: peronId === null ? 0 : 250,
    linDilayani,
    ruasId,
    keterangan,
  });
}

const definisiPeron = [
  ['PER-G12', '1-2', 'Peron pulau jalur 1-2', 'DASAR', 'PULAU', ['SP-G1', 'SP-G2'], YG[1], YG[2]],
  ['PER-G34', '3-4', 'Peron pulau jalur 3-4', 'DASAR', 'PULAU', ['SP-G3', 'SP-G4'], YG[3], YG[4]],
  ['PER-G56', '5-6', 'Peron pulau jalur 5-6 (inaktif)', 'DASAR', 'PULAU', [], YG[5], YG[6]],
  ['PER-G78', '7-8', 'Peron pulau jalur 7-8', 'DASAR', 'PULAU', ['SP-G7', 'SP-G8'], YG[7], YG[8]],
  ['PER-L910', '9-10', 'Peron pulau jalur 9-10', 'LAYANG', 'PULAU', ['SP-L9', 'SP-L10'], YL[9], YL[10]],
  ['PER-L1112', '11-12', 'Peron pulau jalur 11-12', 'LAYANG', 'PULAU', ['SP-L11', 'SP-L12'], YL[11], YL[12]],
];

for (const [id, nomor, nama, level, jenis, sepurIds, yAtas, yBawah] of definisiPeron) {
  peron.push({
    id,
    nomor,
    nama,
    level,
    jenis,
    sepurIds,
    geometri: {
      x: XPERON_A + 14,
      y: (yAtas + yBawah) / 2 - 9,
      lebar: XPERON_B - XPERON_A - 28,
      tinggi: 18,
    },
  });
}

peron.push({
  id: 'PER-G8S',
  nomor: '8',
  nama: 'Peron sisi jalur 8 (khusus KA bandara)',
  level: 'DASAR',
  jenis: 'SISI',
  sepurIds: ['SP-G8'],
  // Diberi jarak lebih ke bawah agar tidak berimpit dengan penanda nomor jalur 8.
  geometri: { x: XPERON_A + 14, y: YG[8] + 26, lebar: XPERON_B - XPERON_A - 28, tinggi: 14 },
});

batas.push(
  {
    id: 'BTS-JJ-BRT-D',
    nama: 'Arah Gambir (masuk)',
    singkatan: 'GMR',
    level: 'DASAR',
    simpulId: 'SG-JJ-BRT-D',
    sisi: 'KIRI',
    stasiunTetangga: 'Cikini - Gambir',
    linDilayani: ['KAJJ'],
    headwayMinimumDetik: 300,
  },
  {
    id: 'BTS-JJ-BRT-K',
    nama: 'Arah Gambir (keluar)',
    singkatan: 'GMR',
    level: 'DASAR',
    simpulId: 'SG-JJ-BRT-K',
    sisi: 'KIRI',
    stasiunTetangga: 'Cikini - Gambir',
    linDilayani: ['KAJJ'],
    headwayMinimumDetik: 300,
  },
  {
    id: 'BTS-JJ-TMR-D',
    nama: 'Arah Jatinegara (masuk)',
    singkatan: 'JNG',
    level: 'DASAR',
    simpulId: 'SG-JJ-TMR-D',
    sisi: 'KANAN',
    stasiunTetangga: 'Jatinegara',
    linDilayani: ['KAJJ'],
    headwayMinimumDetik: 300,
  },
  {
    id: 'BTS-JJ-TMR-K',
    nama: 'Arah Jatinegara (keluar)',
    singkatan: 'JNG',
    level: 'DASAR',
    simpulId: 'SG-JJ-TMR-K',
    sisi: 'KANAN',
    stasiunTetangga: 'Jatinegara',
    linDilayani: ['KAJJ', 'KLB'],
    headwayMinimumDetik: 300,
  },
);

batas.push(
  {
    id: 'BTS-SUD-D',
    nama: 'Arah Sudirman (masuk)',
    singkatan: 'SUD',
    level: 'DASAR',
    simpulId: 'SG-SUD-D',
    sisi: 'KIRI',
    stasiunTetangga: 'Sudirman',
    linDilayani: ['LIN_CIKARANG'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-SUD-K',
    nama: 'Arah Sudirman (keluar)',
    singkatan: 'SUD',
    level: 'DASAR',
    simpulId: 'SG-SUD-K',
    sisi: 'KIRI',
    stasiunTetangga: 'Sudirman',
    linDilayani: ['LIN_CIKARANG'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-BNI',
    nama: 'Arah BNI City',
    singkatan: 'BNI',
    level: 'DASAR',
    simpulId: 'SG-BNI',
    sisi: 'KIRI',
    stasiunTetangga: 'BNI City',
    linDilayani: ['BANDARA'],
    headwayMinimumDetik: 300,
  },
  {
    id: 'BTS-MTR-D',
    nama: 'Arah Matraman (masuk)',
    singkatan: 'MTR',
    level: 'DASAR',
    simpulId: 'SG-MTR-D',
    sisi: 'KANAN',
    stasiunTetangga: 'Matraman',
    linDilayani: ['LIN_CIKARANG'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-MTR-K',
    nama: 'Arah Matraman (keluar)',
    singkatan: 'MTR',
    level: 'DASAR',
    simpulId: 'SG-MTR-K',
    sisi: 'KANAN',
    stasiunTetangga: 'Matraman',
    linDilayani: ['LIN_CIKARANG', 'KLB'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-BY',
    nama: 'Balai Yasa Manggarai',
    singkatan: 'BY',
    level: 'DASAR',
    simpulId: 'SG-BY',
    sisi: 'KIRI',
    stasiunTetangga: 'Balai Yasa Manggarai',
    linDilayani: ['KLB', 'LANGSIR'],
    headwayMinimumDetik: 300,
  },
  {
    id: 'BTS-CKI-D',
    nama: 'Arah Cikini (masuk)',
    singkatan: 'CKI',
    level: 'LAYANG',
    simpulId: 'SL-CKI-D',
    sisi: 'KIRI',
    stasiunTetangga: 'Cikini',
    linDilayani: ['LIN_BOGOR'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-CKI-K',
    nama: 'Arah Cikini (keluar)',
    singkatan: 'CKI',
    level: 'LAYANG',
    simpulId: 'SL-CKI-K',
    sisi: 'KIRI',
    stasiunTetangga: 'Cikini',
    linDilayani: ['LIN_BOGOR'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-TBT-D',
    nama: 'Arah Tebet (masuk)',
    singkatan: 'TBT',
    level: 'LAYANG',
    simpulId: 'SL-TBT-D',
    sisi: 'KANAN',
    stasiunTetangga: 'Tebet',
    linDilayani: ['LIN_BOGOR'],
    headwayMinimumDetik: 180,
  },
  {
    id: 'BTS-TBT-K',
    nama: 'Arah Tebet (keluar)',
    singkatan: 'TBT',
    level: 'LAYANG',
    simpulId: 'SL-TBT-K',
    sisi: 'KANAN',
    stasiunTetangga: 'Tebet',
    linDilayani: ['LIN_BOGOR'],
    headwayMinimumDetik: 180,
  },
);

/* ================================================================== */
/* Rakit & tulis                                                       */
/* ================================================================== */

const emplasemen = {
  kodeStasiun: 'MRI',
  namaStasiun: 'Manggarai',
  acuan: {
    keterangan:
      'Peruntukan jalur mengikuti hasil Switch Over ke-7 (SO-7), dieksekusi 17 Desember 2023 dan berlaku bagi penumpang sejak 20 Desember 2023. Emplasemen terdiri atas 12 jalur bernomor ditambah satu jalur akses Balai Yasa tanpa nomor, dengan tujuh peron (enam peron pulau dan satu peron sisi).',
    tanggalAcuan: '2023-12-20',
    sumber: [
      'Tabel tata letak peron Stasiun Manggarai, Wikipedia bahasa Indonesia (revisi 18 Juli 2026)',
      'Kompas.com, 18 Desember 2023 — Daftar Perubahan Jalur Transit di Stasiun Manggarai Mulai 20 Desember 2023',
      'KAI Commuter — siaran perubahan pola operasi terkait Switch Over Stasiun Manggarai',
    ],
    catatanVerifikasi:
      'PERUNTUKAN JALUR, PEMBAGIAN LANTAI, DAN SUSUNAN PERON diambil dari sumber di atas. SUSUNAN WESEL, PENOMORAN WESEL, PENAMAAN SINYAL, PANJANG PERON, DAN PANJANG RUAS DALAM METER adalah asumsi pemodelan — gambar teknis emplasemen Stasiun Manggarai tidak dipublikasikan. Bentuk emplasemen di sini dibuat konsisten secara operasional dengan peruntukan jalur resmi, bukan salinan gambar sepur milik KAI.',
  },
  kanvas: {
    DASAR: { lebar: 1700, tinggi: 640 },
    LAYANG: { lebar: 1700, tinggi: 256 },
  },
  simpul,
  ruas,
  wesel,
  sinyal,
  blok,
  sepur,
  peron,
  batas,
};

/* -- Pemeriksaan keutuhan graf sebelum ditulis ---------------------- */
const idSimpul = new Set(simpul.map((s) => s.id));
const idRuas = new Set(ruas.map((r) => r.id));
const galat = [];

for (const r of ruas) {
  if (!idSimpul.has(r.dari)) galat.push(`Ruas ${r.id}: simpul pangkal ${r.dari} tidak ada`);
  if (!idSimpul.has(r.ke)) galat.push(`Ruas ${r.id}: simpul ujung ${r.ke} tidak ada`);
}
for (const w of wesel) {
  if (!idSimpul.has(w.simpulId)) galat.push(`Wesel ${w.id}: simpul ${w.simpulId} tidak ada`);
  for (const kaki of [w.ruasPangkal, w.ruasLurus, w.ruasBelok]) {
    if (!idRuas.has(kaki)) galat.push(`Wesel ${w.id}: ruas ${kaki} tidak ada`);
    const r = ruas.find((x) => x.id === kaki);
    if (r && r.dari !== w.simpulId && r.ke !== w.simpulId) {
      galat.push(`Wesel ${w.id}: ruas ${kaki} tidak bersinggungan dengan ${w.simpulId}`);
    }
  }
}
for (const s of sinyal) {
  if (!idRuas.has(s.ruasDilindungi)) galat.push(`Sinyal ${s.nama}: ruas ${s.ruasDilindungi} tidak ada`);
}
for (const sp of sepur) {
  if (!idRuas.has(sp.ruasId)) galat.push(`Sepur ${sp.id}: ruas ${sp.ruasId} tidak ada`);
}
// Setiap simpul non-batas/non-ujung harus punya minimal dua ruas.
const derajat = new Map();
for (const r of ruas) {
  derajat.set(r.dari, (derajat.get(r.dari) ?? 0) + 1);
  derajat.set(r.ke, (derajat.get(r.ke) ?? 0) + 1);
}
for (const s of simpul) {
  const d = derajat.get(s.id) ?? 0;
  if (s.jenis === 'WESEL' && d !== 3) galat.push(`Simpul wesel ${s.id} berderajat ${d}, seharusnya 3`);
  if (s.jenis === 'SAMBUNG' && d !== 2) galat.push(`Simpul sambung ${s.id} berderajat ${d}, seharusnya 2`);
  if (s.jenis === 'UJUNG' && d !== 1) galat.push(`Simpul ujung ${s.id} berderajat ${d}, seharusnya 1`);
  if (s.jenis === 'BATAS' && d !== 1) galat.push(`Simpul batas ${s.id} berderajat ${d}, seharusnya 1`);
}

if (galat.length > 0) {
  console.error('Emplasemen tidak konsisten:');
  for (const g of galat) console.error('  -', g);
  process.exit(1);
}

const berkas = resolve(AKAR, 'data', 'emplasemen-manggarai.json');
mkdirSync(dirname(berkas), { recursive: true });
writeFileSync(berkas, `${JSON.stringify(emplasemen, null, 2)}\n`, 'utf8');

console.log(`Emplasemen ditulis ke ${berkas}`);
console.log(
  `  simpul=${simpul.length} ruas=${ruas.length} wesel=${wesel.length} ` +
    `sinyal=${sinyal.length} blok=${blok.length} sepur=${sepur.length} peron=${peron.length}`,
);
