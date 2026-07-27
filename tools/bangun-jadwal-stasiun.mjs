/**
 * Pembangkit data/stasiun/<KODE>/jadwal.json dari berkas sumber penarikan.
 *
 *   node tools/bangun-jadwal-stasiun.mjs [KODE ...]
 *
 * Arah tiap perjalanan TIDAK ditebak. Berkas sumber mencatat stasiun tepat
 * sebelum dan sesudah stasiun ini pada tabel perjalanan KA itu sendiri, dan
 * daftar lintas mencatat stasiun tetangga tiap arah — keduanya dicocokkan
 * untuk menentukan dari batas mana kereta masuk dan ke batas mana ia keluar.
 * Perjalanan yang arahnya tidak dapat ditentukan TIDAK dimasukkan, dan
 * jumlahnya dilaporkan apa adanya.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STASIUN, DIBANGUN } from './stasiun-config.mjs';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lama berhenti minimum menurut golongan kereta (detik). */
const BERHENTI = { ANTARKOTA: 120, PERKOTAAN: 90, KRL: 90, BARANG: 180 };
/** Selisih jam datang bila sumber hanya memberi satu jam. */
const DWELL_MODEL = 120;
/** Waktu penyiapan rangkaian yang berdinas mulai dari stasiun ini. */
const SIAP_RANGKAIAN = 360;

const LIN = {
  ANTARKOTA: 'KAJJ',
  PERKOTAAN: 'LOKAL',
  KRL: 'KRL',
  BARANG: 'BARANG',
};
const SARANA = {
  ANTARKOTA: 'KA_ANTARKOTA',
  PERKOTAAN: 'KA_ANTARKOTA',
  KRL: 'KRL_12',
  BARANG: 'KA_BARANG',
};

function keDetik(jam) {
  const [h, m, d] = jam.split(/[.:]/).map((n) => Number.parseInt(n, 10));
  return h * 3600 + m * 60 + (d || 0);
}
function keJam(detik) {
  const t = ((Math.floor(detik) % 86400) + 86400) % 86400;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}.${p(Math.floor((t % 3600) / 60))}.${p(t % 60)}`;
}
/** Kode stasiun di dalam tanda kurung, mis. "Randegan (RDN)" -> "RDN". */
function kodeStasiun(teks) {
  const m = /\(([^)]+)\)\s*$/.exec(String(teks ?? '').trim());
  return m ? m[1].trim().toUpperCase() : String(teks ?? '').trim().toUpperCase();
}

/**
 * Stasiun tetangga yang benar-benar muncul pada kolom "stasiun sebelum" dan
 * "stasiun sesudah" di berkas sumber, dipetakan ke kode lintas.
 *
 * Daftar `lintas[].stasiunTetangga` pada berkas sumber sudah memuat sebagian
 * besar di antaranya, tetapi tidak semuanya cocok kata per kata: sumber jadwal
 * Jatinegara menulis Bekasi (perhentian KA jarak jauh berikutnya) sedangkan
 * tabel tata letak menulis Klender (stasiun tetangga sebenarnya), dan sebagian
 * nama ditulis tanpa spasi. Karena itu pemetaan ditulis lengkap dan terbuka di
 * sini, bukan ditebak dengan pencocokan lunak yang bisa salah diam-diam.
 * Seluruh nama di bawah ini diambil dari keluaran nyata berkas sumber.
 */
const TETANGGA = {
  KYA: { RDN: 'PWT', KJ: 'KTA', SKP: 'MA' },
  SLO: {
    PWS: 'YK',
    SK: 'SGU',
    // Lintas ke Semarang (SMT maupun SMO) sama-sama meninggalkan Solo Balapan
    // lewat sisi utara melalui Kadipiro; emplasemen hanya punya satu batas utara.
    KDO: 'SMT',
  },
  JNG: { BEKASI: 'BKS', PONDOKJATI: 'PSE', MATRAMAN: 'MRI' },
  LPN: { YOGYAKARTA: 'YK', MAGUWO: 'MGW' },
  BD: {
    // Andir dan Ciroyom sama-sama berada di lintas barat menuju Padalarang.
    ANDIR: 'PDL',
    CIROYOM: 'PDL',
    CIKUDAPATEUH: 'KAC',
  },
};

/**
 * Sebagian sumber tidak mencantumkan stasiun tetangga sama sekali. Untuk itu
 * arah ditentukan dari stasiun ujung relasi, yang masih merupakan pembacaan
 * data — bukan rekaan — selama stasiun ujungnya hanya dapat dicapai lewat satu
 * arah dari stasiun ini.
 *
 * Di Jatinegara seluruh 320 perjalanan Commuter Line berbentuk demikian.
 * Sisi timur tidak bermakna ganda: Bekasi, Cikarang, dan Tambun hanya dapat
 * dicapai lewat lintas timur. Sisi barat bermakna ganda karena Kampung Bandan
 * dan Angke dapat dicapai baik lewat Pasar Senen maupun lewat Manggarai —
 * itulah sebabnya sebagian nama tujuan pada sumber diberi keterangan "VIA MRI"
 * atau "VIA PSE".
 */
const UJUNG = {
  JNG: {
    BEKASI: 'BKS',
    CIKARANG: 'BKS',
    TAMBUN: 'BKS',
    MANGGARAI: 'MRI',
    // Ujung barat yang bermakna ganda; lihat `viaBarat` di bawah.
    KAMPUNGBANDAN: null,
    ANGKE: null,
    JAKARTAKOTA: null,
  },
};

/** Membaca keterangan "VIA MRI" / "VIA PSE" pada nama tujuan. */
function viaBarat(teks) {
  const t = String(teks ?? '').toUpperCase();
  if (t.includes('VIA MRI')) return 'MRI';
  if (t.includes('VIA PSE')) return 'PSE';
  return null;
}

/** Nama stasiun tanpa keterangan "VIA ...". */
function pokok(teks) {
  return String(teks ?? '')
    .toUpperCase()
    .replace(/\s*VIA\s+\w+\s*$/, '')
    .replace(/\s+/g, '')
    .trim();
}

function bangun(kode) {
  const cfg = STASIUN[kode];
  const berkasSumber = resolve(AKAR, 'tools/sumber', `${kode}.json`);
  const berkasEmpl = resolve(AKAR, 'data/stasiun', kode, 'emplasemen.json');
  if (!existsSync(berkasSumber)) throw new Error('berkas sumber stasiun tidak ada');
  if (!existsSync(berkasEmpl)) throw new Error('berkas emplasemen belum dibangun');

  const sumber = JSON.parse(readFileSync(berkasSumber, 'utf8'));
  const empl = JSON.parse(readFileSync(berkasEmpl, 'utf8'));

  /* -- Peta stasiun tetangga -> kode lintas ---------------------------- */
  const lintasDariTetangga = new Map(Object.entries(TETANGGA[kode] ?? {}));

  /* -- Peta kode lintas -> batas masuk & keluar ------------------------ */
  const batasMasuk = new Map();
  const batasKeluar = new Map();
  for (const b of empl.batas) {
    if (b.singkatan === 'AKSES') continue;
    if (b.id.endsWith('-D')) batasMasuk.set(b.singkatan, b.id);
    else if (b.id.endsWith('-K')) batasKeluar.set(b.singkatan, b.id);
    else {
      // Lintas jalur tunggal: satu batas melayani kedua arah.
      if (!batasMasuk.has(b.singkatan)) batasMasuk.set(b.singkatan, b.id);
      if (!batasKeluar.has(b.singkatan)) batasKeluar.set(b.singkatan, b.id);
    }
  }

  /* -- Jalur lazim menurut lintas -------------------------------------- */
  const sepurPeron = empl.sepur.filter((s) => s.peronId !== null).map((s) => s.id);
  const lazimPerLintas = new Map();
  for (const j of sumber.jalur ?? []) {
    const idSepur = `SP-${kode}-${j.nomor}`;
    if (!empl.sepur.some((s) => s.id === idSepur)) continue;
    for (const kd of j.lintasTerkait ?? []) {
      if (!lazimPerLintas.has(kd)) lazimPerLintas.set(kd, []);
      lazimPerLintas.get(kd).push(idSepur);
    }
  }

  /* -- Perjalanan ------------------------------------------------------ */
  const perjalanan = [];
  const dilewati = { tanpaArah: 0, lintasTakDikenal: 0, tanpaJam: 0 };
  const lintasTakDikenal = new Set();

  for (const p of sumber.jadwal?.perjalanan ?? []) {
    const jamAcuan = p.jamBerangkat ?? p.jamDatang;
    if (!jamAcuan) {
      dilewati.tanpaJam += 1;
      continue;
    }

    const kdSebelum = p.stasiunSebelum ? kodeStasiun(p.stasiunSebelum) : null;
    const kdSesudah = p.stasiunSesudah ? kodeStasiun(p.stasiunSesudah) : null;
    let lintasMasuk = kdSebelum ? lintasDariTetangga.get(kdSebelum) : null;
    let lintasKeluar = kdSesudah ? lintasDariTetangga.get(kdSesudah) : null;
    let arahDariUjung = false;

    /*
     * Cadangan bila kolom tetangga kosong: baca stasiun ujung relasi. Sisi yang
     * bermakna ganda dipenuhi dari keterangan "VIA ..."; bila keterangan itu pun
     * tidak ada, sisi tersebut ditandai REKONSTRUKSI_POLA, tidak dibuang, karena
     * membuang seluruhnya justru akan menghapus mayoritas lalu lintas stasiun.
     */
    const ujung = UJUNG[kode];
    if (ujung && !lintasMasuk && !lintasKeluar) {
      const dari = ujung[pokok(p.asal)];
      const ke = ujung[pokok(p.tujuan)];
      const adaDari = pokok(p.asal) in ujung;
      const adaKe = pokok(p.tujuan) in ujung;
      if (adaDari && adaKe) {
        const via = viaBarat(p.tujuan) ?? viaBarat(p.asal);
        lintasMasuk = dari ?? via ?? 'PSE';
        lintasKeluar = ke ?? via ?? 'PSE';
        arahDariUjung = true;
      }
    }

    if (!lintasMasuk && !lintasKeluar) {
      if (kdSebelum || kdSesudah) {
        dilewati.lintasTakDikenal += 1;
        if (kdSebelum) lintasTakDikenal.add(kdSebelum);
        if (kdSesudah) lintasTakDikenal.add(kdSesudah);
      } else {
        dilewati.tanpaArah += 1;
      }
      continue;
    }

    /*
     * Perjalanan yang berpangkal atau berakhir di stasiun ini hanya punya satu
     * sisi. Sisi yang kosong dimodelkan sebagai langsiran dari arah lain yang
     * tersedia — penyiapan dan penarikan rangkaian tidak tercantum di GAPEKA.
     */
    const lainnya = [...batasMasuk.keys()].filter(
      (k) => k !== lintasMasuk && k !== lintasKeluar,
    );
    const kdMasuk = lintasMasuk ?? lainnya[0] ?? lintasKeluar;
    const kdKeluar = lintasKeluar ?? lainnya[0] ?? lintasMasuk;
    const idMasuk = batasMasuk.get(kdMasuk);
    const idKeluar = batasKeluar.get(kdKeluar);
    if (!idMasuk || !idKeluar) {
      dilewati.lintasTakDikenal += 1;
      continue;
    }

    const berhentiDiSini = p.berhenti !== false;
    const jamBerangkat = keJam(keDetik(jamAcuan));
    const jamDatang = p.jamDatang
      ? keJam(keDetik(p.jamDatang))
      : keJam(keDetik(jamAcuan) - (lintasMasuk ? DWELL_MODEL : SIAP_RANGKAIAN));

    const lazim = lazimPerLintas.get(kdKeluar) ?? sepurPeron;

    perjalanan.push({
      id: `TRIP-${kode}-${p.nomorKA}`,
      nomorKA: String(p.nomorKA),
      lin: LIN[p.kelas] ?? 'KAJJ',
      jenisSarana: SARANA[p.kelas] ?? 'KA_ANTARKOTA',
      relasi: `${p.asal} - ${p.tujuan}`,
      asal: String(p.asal ?? '').replace(/\s*\([^)]*\)\s*$/, ''),
      tujuan: String(p.tujuan ?? '').replace(/\s*\([^)]*\)\s*$/, ''),
      batasMasukId: idMasuk,
      batasKeluarId: idKeluar,
      jamDatang: berhentiDiSini ? jamDatang : jamBerangkat,
      jamBerangkat,
      sepurLazim: berhentiDiSini ? lazim : (lazimPerLintas.get(kdKeluar) ?? lazim),
      waktuBerhentiMinimumDetik: berhentiDiSini ? (BERHENTI[p.kelas] ?? 120) : 0,
      langsung: !berhentiDiSini,
      keandalanData: arahDariUjung && !viaBarat(p.tujuan) && !viaBarat(p.asal) ? 'REKONSTRUKSI_POLA' : 'RESMI',
      catatan: [
        p.nama ? `KA ${p.nama}.` : '',
        arahDariUjung
          ? `Arah dibaca dari relasi ${p.asal}–${p.tujuan}${
              viaBarat(p.tujuan) ?? viaBarat(p.asal)
                ? ', termasuk keterangan lintas yang tercantum pada sumber.'
                : '; sumber tidak menyebut lewat Manggarai atau Pasar Senen, sehingga sisi barat direkonstruksi.'
            }`
          : '',
        !p.jamDatang && berhentiDiSini ? 'Jam datang diturunkan dari jam berangkat, bukan angka resmi.' : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  perjalanan.sort((a, b) => a.jamDatang.localeCompare(b.jamDatang));

  const jadwal = {
    versi: '1.0.0',
    gapeka: sumber.sumberJadwal?.join('; ') ?? 'GAPEKA 2025',
    stasiun: kode,
    tanggalDibuat: sumber.ditarikPada ?? new Date().toISOString().slice(0, 10),
    sumber: sumber.sumberJadwal ?? [],
    catatanKeakuratan: [
      `Berkas ini memuat ${perjalanan.length} perjalanan pada rentang 00.00-23.59 di Stasiun ${cfg.nama}.`,
      'NOMOR KA, NAMA, JAM, DAN RELASI diambil apa adanya dari berkas sumber hasil penarikan; tidak satu pun direka.',
      'ARAH MASUK DAN ARAH KELUAR ditentukan dengan mencocokkan stasiun tetangga yang tercantum pada tabel perjalanan tiap KA dengan daftar lintas stasiun ini — bukan ditebak.',
      'Bila sumber hanya memberi satu jam per perjalanan, jam itu dipakai sebagai jam berangkat dan jam datang diturunkan dengan mengurangi dua menit sebagai pemodelan waktu berhenti. Angka turunan itu BUKAN data resmi.',
      'Perjalanan yang berpangkal atau berakhir di stasiun ini dimodelkan masuk atau keluar sebagai langsiran dari arah lain, karena penyiapan dan penarikan rangkaian tidak tercantum pada jadwal publik.',
      'Penetapan sepur pada "sepurLazim" mengikuti kolom lintasTerkait pada peruntukan jalur resmi, bukan penetapan sepur per perjalanan — pemilihan sepur adalah keputusan PPKA.',
      sumber.catatan ?? '',
    ]
      .filter(Boolean)
      .join(' '),
    layanan: [
      { kode: 'KAJJ', nama: 'KA Antarkota', tokenWarna: 'lin-kajj', operator: 'KAI', keterangan: 'Kereta api antarkota.' },
      { kode: 'LOKAL', nama: 'KA Lokal', tokenWarna: 'lin-lingkar', operator: 'KAI', keterangan: 'Kereta api lokal dan aglomerasi.' },
      { kode: 'KRL', nama: 'Commuter Line', tokenWarna: 'lin-cikarang', operator: 'KAI Commuter', keterangan: 'Kereta rel listrik komuter.' },
      { kode: 'BARANG', nama: 'KA Barang', tokenWarna: 'lin-klb', operator: 'KAI Logistik', keterangan: 'Angkutan barang; rangkaian panjang, percepatan lambat, prioritas paling rendah.' },
      { kode: 'KLB', nama: 'Kereta Luar Biasa', tokenWarna: 'lin-klb', operator: 'KAI', keterangan: 'Perjalanan di luar GAPEKA.' },
    ],
    dinas: [
      { id: `DNS-${kode}-LATIH`, nama: 'Dinas Latihan', keterangan: 'Pengenalan papan pelayanan pada jam yang tidak padat.', mulai: '09.00', selesai: '11.00', tingkatKesulitan: 'DASAR', peluangGangguanPerJam: 0.2 },
      { id: `DNS-${kode}-PAGI`, nama: 'Dinas Pagi', keterangan: 'Satu sesi dinas penuh delapan jam.', mulai: '05.00', selesai: '13.00', tingkatKesulitan: 'MENENGAH', peluangGangguanPerJam: 0.5 },
      { id: `DNS-${kode}-SIANG`, nama: 'Dinas Siang', keterangan: 'Satu sesi dinas penuh delapan jam.', mulai: '13.00', selesai: '21.00', tingkatKesulitan: 'MENENGAH', peluangGangguanPerJam: 0.5 },
      { id: `DNS-${kode}-MALAM`, nama: 'Dinas Malam', keterangan: 'Satu sesi dinas penuh delapan jam melewati tengah malam.', mulai: '21.00', selesai: '05.00', tingkatKesulitan: 'MENENGAH', peluangGangguanPerJam: 0.45 },
      { id: `DNS-${kode}-SEHARI`, nama: 'Satu Hari Penuh', keterangan: 'Seluruh perjalanan yang termuat pada berkas jadwal.', mulai: '00.00', selesai: '23.59', tingkatKesulitan: 'PADAT', peluangGangguanPerJam: 0.5 },
    ],
    perjalanan,
  };

  return { jadwal, dilewati, lintasTakDikenal, batasMasuk, batasKeluar };
}

const daftar = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DIBANGUN;

for (const kode of daftar) {
  try {
    const { jadwal, dilewati, lintasTakDikenal } = bangun(kode);
    const tujuan = resolve(AKAR, 'data/stasiun', kode);
    mkdirSync(tujuan, { recursive: true });
    writeFileSync(resolve(tujuan, 'jadwal.json'), `${JSON.stringify(jadwal, null, 2)}\n`, 'utf8');
    const perLin = {};
    for (const p of jadwal.perjalanan) perLin[p.lin] = (perLin[p.lin] ?? 0) + 1;
    const perJam = new Set(jadwal.perjalanan.map((p) => p.jamDatang.slice(0, 2)));
    console.log(
      `${kode} ✓ perjalanan=${jadwal.perjalanan.length} ${JSON.stringify(perLin)} ` +
        `jam=${perJam.size}/24 dilewati=${JSON.stringify(dilewati)}` +
        (lintasTakDikenal.size ? ` tetanggaTakDikenal=${[...lintasTakDikenal].slice(0, 6).join(',')}` : ''),
    );
  } catch (e) {
    console.error(`${kode}: GAGAL — ${e.message}`);
  }
}

export { bangun };
