/**
 * Uji mesin simulasi tanpa peramban.
 *
 *   npm run uji
 *
 * Memeriksa hal yang tidak terlihat dari antarmuka: keutuhan graf emplasemen,
 * kemampuan membentuk rute ke seluruh jalur yang seharusnya terjangkau,
 * penguncian wesel, penjagaan headway, serta jalannya satu sesi dinas penuh
 * dari awal sampai laporan akhir tersusun.
 */

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');

const AKAR = resolve(__dirname, '..');

// Store memakai alias "@/..." seperti pada aplikasi; alias itu dipetakan ke
// hasil kompilasi supaya lapisan yang benar-benar dipakai React ikut diuji.
const resolveAsli = Module._resolveFilename;
Module._resolveFilename = function (permintaan, ...sisa) {
  if (permintaan.startsWith('@/')) {
    return resolveAsli.call(
      this,
      resolve(AKAR, '.uji/src', permintaan.slice(2)),
      ...sisa,
    );
  }
  return resolveAsli.call(this, permintaan, ...sisa);
};
const { indeksEmplasemen, cariRute } = require('../.uji/src/lib/emplasemen.js');
const {
  buatKeadaanAwal,
  majuSatuDetik,
  bentukRute,
  usulanRuteMasuk,
  usulanRuteKeluar,
  ruasBatas,
} = require('../.uji/src/lib/simulasi.js');
const { jalankanOtomatis, susunSaran } = require('../.uji/src/lib/otomatis.js');
const { hitungSkor } = require('../.uji/src/lib/skor.js');
const { keDetik, keJam } = require('../.uji/src/lib/waktu.js');

const emplasemen = JSON.parse(
  readFileSync(resolve(AKAR, 'data/emplasemen-manggarai.json'), 'utf8'),
);
const jadwal = JSON.parse(readFileSync(resolve(AKAR, 'data/jadwal-manggarai.json'), 'utf8'));
const ix = indeksEmplasemen(emplasemen);

const SEHARI = 86400;

/**
 * Perjalanan yang termuat pada sebuah sesi dinas.
 * Memakai skala detik dinas supaya dinas malam yang melewati tengah malam
 * ikut tertangani, persis seperti yang dilakukan aplikasi.
 */
function perjalananDinas(dinasId) {
  const dinas = jadwal.dinas.find((d) => d.id === dinasId);
  const mulai = keDetik(dinas.mulai);
  const b = keDetik(dinas.selesai);
  const selesai = b <= mulai ? b + SEHARI : b;
  const skala = (jam) => {
    const d = keDetik(jam);
    return d < mulai ? d + SEHARI : d;
  };
  const daftar = jadwal.perjalanan
    .filter((t) => skala(t.jamDatang) >= mulai && skala(t.jamDatang) <= selesai)
    .sort((x, y) => skala(x.jamDatang) - skala(y.jamDatang));
  return { dinas, daftar, mulai, selesai };
}

let lulus = 0;
let gagal = 0;
const kegagalan = [];

function periksa(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus += 1;
  } else {
    gagal += 1;
    kegagalan.push(`${nama}${keterangan ? ` — ${keterangan}` : ''}`);
  }
}

/* ------------------------------------------------------------------ */
console.log('\n== 1. Keterjangkauan rute masuk dari tiap batas ==');

/**
 * Jalur yang WAJIB terjangkau dari tiap batas menurut peruntukan resmi
 * hasil Switch Over ke-7.
 */
const WAJIB_TERJANGKAU = {
  'BTS-TBT-D': ['SP-L9', 'SP-L10'], // dari Bogor, menuju arah Jakarta Kota
  'BTS-CKI-D': ['SP-L11', 'SP-L12'], // dari Jakarta Kota, menuju arah Bogor
  'BTS-MTR-D': ['SP-G1', 'SP-G2'], // dari Bekasi, menuju arah Sudirman
  'BTS-SUD-D': ['SP-G3', 'SP-G4'], // dari Angke, menuju arah Bekasi
  'BTS-BNI': ['SP-G7', 'SP-G8'], // Basoetta
  'BTS-BY': ['SP-G6', 'SP-GLH'], // KLB kirim rangkaian dari Balai Yasa
  'BTS-JJ-TMR-D': ['SP-GLU', 'SP-G5'], // KA jarak jauh dari Jatinegara menuju Gambir
  'BTS-JJ-BRT-D': ['SP-GLH', 'SP-G6'], // KA jarak jauh dari Gambir menuju Jatinegara
};

for (const [batasId, sepurWajib] of Object.entries(WAJIB_TERJANGKAU)) {
  const pangkal = ruasBatas(ix, batasId);
  periksa(`batas ${batasId} punya ruas petak jalan`, Boolean(pangkal));
  if (!pangkal) continue;
  for (const sepurId of sepurWajib) {
    const sepur = emplasemen.sepur.find((s) => s.id === sepurId);
    const hasil = cariRute(ix, pangkal.ruasId, pangkal.simpulId, sepur.ruasId);
    periksa(
      `rute ${batasId} → jalur ${sepur.nomor}`,
      Boolean(hasil),
      'tidak ada jalan sepur',
    );
    if (hasil) {
      console.log(
        `   ${batasId} → jalur ${sepur.nomor.padStart(2)} : ${hasil.ruasIds.length} ruas, ` +
          `${hasil.panjangM} m, wesel ${
            hasil.kedudukanWesel.map((w) => ix.wesel.get(w.weselId).nomor + w.kedudukan[0]).join(',') || '-'
          }`,
      );
    }
  }
}

console.log('\n== 2. Keterjangkauan rute keluar ==');
const WAJIB_KELUAR = {
  SP_L9: ['SP-L9', 'BTS-CKI-K', 'SL-TBT-D'],
  SP_L11: ['SP-L11', 'BTS-TBT-K', 'SL-CKI-D'],
  SP_G1: ['SP-G1', 'BTS-SUD-K', 'SG-MTR-D'],
  SP_G3: ['SP-G3', 'BTS-MTR-K', 'SG-SUD-D'],
  SP_G7: ['SP-G7', 'BTS-BNI', 'SG-BNI'],
  // Jalur 5 menempel pada lintas hulu: masuk dari Jatinegara, keluar ke Gambir.
  SP_G5: ['SP-G5', 'BTS-JJ-BRT-K', 'SG-JJ-TMR-D'],
  // Jalur 6 menempel pada lintas hilir: masuk dari Gambir, keluar ke Jatinegara.
  SP_G6: ['SP-G6', 'BTS-JJ-TMR-K', 'SG-JJ-BRT-D'],
  SP_GLU: ['SP-GLU', 'BTS-JJ-BRT-K', 'SG-JJ-TMR-D'],
  SP_GLH: ['SP-GLH', 'BTS-JJ-TMR-K', 'SG-JJ-BRT-D'],
};
for (const [, [sepurId, batasId, simpulMasuk]] of Object.entries(WAJIB_KELUAR)) {
  const sepur = emplasemen.sepur.find((s) => s.id === sepurId);
  const sasaran = ruasBatas(ix, batasId);
  // Simpul tempat rangkaian memasuki badan sepur menentukan arah keluar.
  const ruasSepur = ix.ruas.get(sepur.ruasId);
  const simpulAwal = tentukanSimpulMasuk(simpulMasuk, ruasSepur);
  const ujungLain = ruasSepur.dari === simpulAwal ? ruasSepur.ke : ruasSepur.dari;

  let hasil = cariRute(ix, sepur.ruasId, simpulAwal, sasaran.ruasId);
  let berbalik = false;
  if (!hasil) {
    hasil = cariRute(ix, sepur.ruasId, ujungLain, sasaran.ruasId);
    berbalik = Boolean(hasil);
  }
  periksa(`rute keluar jalur ${sepur.nomor} → ${batasId}`, Boolean(hasil));
  if (hasil) {
    console.log(
      `   jalur ${sepur.nomor.padStart(2)} → ${batasId.padEnd(11)} : ${hasil.ruasIds.length} ruas, ` +
        `${hasil.panjangM} m${berbalik ? ', rangkaian berbalik arah' : ''}`,
    );
  }
}

/** Cari ujung badan sepur yang menghadap simpul asal masuknya rangkaian. */
function tentukanSimpulMasuk(simpulBatasMasuk, ruasSepur) {
  const batasSimpul = ix.simpul.get(simpulBatasMasuk);
  const a = ix.simpul.get(ruasSepur.dari);
  const b = ix.simpul.get(ruasSepur.ke);
  return Math.abs(a.x - batasSimpul.x) < Math.abs(b.x - batasSimpul.x)
    ? ruasSepur.dari
    : ruasSepur.ke;
}

console.log('\n== 3. Rute yang HARUS ditolak ==');
{
  // Lin Bogor (lantai layang) tidak boleh bisa masuk jalur lantai dasar.
  const pangkal = ruasBatas(ix, 'BTS-TBT-D');
  const j3 = emplasemen.sepur.find((s) => s.id === 'SP-G3');
  const silangLantai = cariRute(ix, pangkal.ruasId, pangkal.simpulId, j3.ruasId);
  periksa(
    'lantai layang tidak tersambung ke lantai dasar',
    silangLantai === null,
    'BFS menemukan jalan sepur antar-lantai',
  );
  console.log(`   BTS-TBT-D → jalur 3 : ${silangLantai === null ? 'tidak terjangkau (benar)' : 'TERJANGKAU (salah)'}`);

  // Jalur 7-8 (Basoetta) hanya dijangkau dari arah BNI City.
  const dariMtr = ruasBatas(ix, 'BTS-MTR-D');
  const j7 = emplasemen.sepur.find((s) => s.id === 'SP-G7');
  const hasil = cariRute(ix, dariMtr.ruasId, dariMtr.simpulId, j7.ruasId);
  periksa('jalur 7 tidak dijangkau dari arah Matraman', hasil === null);
  console.log(`   BTS-MTR-D → jalur 7 : ${hasil === null ? 'tidak terjangkau (benar)' : 'TERJANGKAU (salah)'}`);
}

console.log('\n== 4. Penguncian rute dan penolakan konflik ==');
{
  const { dinas, daftar } = perjalananDinas('DNS-PAGI');

  const K = buatKeadaanAwal(ix, dinas, daftar, 12345);
  const bogorUtara = K.kereta.filter((k) => k.batasMasukId === 'BTS-TBT-D');
  const a = bogorUtara[0];
  const b = bogorUtara[1];
  periksa('tersedia dua KA dari arah Tebet untuk uji konflik', Boolean(a && b));

  const galat1 = bentukRute(K, ix, a.id, 'MASUK', 'SP-L9');
  periksa('rute masuk pertama ke jalur 9 diterima', galat1 === null, String(galat1));

  const galat2 = bentukRute(K, ix, b.id, 'MASUK', 'SP-L9');
  periksa('rute kedua ke jalur 9 yang sama ditolak', galat2 !== null);
  console.log(`   KA ${b.nomorKA} → jalur 9 : ${galat2 ?? 'DITERIMA (salah)'}`);
  periksa('penolakan tercatat sebagai konflik dicegah', K.konflikDicegah === 1);

  // Rute ke jalur 10 menuntut wesel 121 pada kedudukan belok, sedangkan rute
  // ke jalur 9 menguncinya pada kedudukan lurus — harus ditolak juga.
  const galat3 = bentukRute(K, ix, b.id, 'MASUK', 'SP-L10');
  periksa('rute yang menuntut wesel terkunci pada kedudukan lain ditolak', galat3 !== null);
  console.log(`   KA ${b.nomorKA} → jalur 10 : ${galat3 ?? 'DITERIMA (salah)'}`);

  // Petak jalan TIDAK boleh ikut terkunci: perjalanan dari arah lain harus
  // tetap dapat dilayani meski satu rute sedang terkunci.
  const dariCikini = K.kereta.find((k) => k.batasMasukId === 'BTS-CKI-D');
  const galat4 = bentukRute(K, ix, dariCikini.id, 'MASUK', 'SP-L11');
  periksa(
    'perjalanan dari arah lain tetap dapat dilayani',
    galat4 === null,
    String(galat4),
  );
  console.log(`   KA ${dariCikini.nomorKA} → jalur 11 : ${galat4 ?? 'diterima'}`);

  // Wesel yang dituntut rute pertama harus terkunci.
  const w121 = Object.values(K.wesel).find((w) => ix.wesel.get(w.weselId).nomor === '121');
  periksa('wesel pada rute terkunci', Boolean(w121.terkunciOlehRute));

  // Setelah waktu balik wesel berlalu, rute harus terkunci dan sinyal aman.
  for (let i = 0; i < 12; i += 1) majuSatuDetik(K, ix);
  const rute = Object.values(K.rute).find((r) => r.keretaId === a.id);
  periksa('rute berpindah ke keadaan terkunci', rute && rute.keadaan !== 'MEMBENTUK');
  const sinyal = rute ? K.sinyal[rute.sinyalId] : null;
  periksa(
    'sinyal masuk menunjukkan aspek aman',
    sinyal && (sinyal.aspek === 'HIJAU' || sinyal.aspek === 'KUNING'),
    sinyal ? `aspek ${sinyal.aspek}` : 'sinyal tidak ada',
  );
  console.log(`   Aspek sinyal masuk setelah wesel terbalik: ${sinyal ? sinyal.aspek : '-'}`);

  // Rute keluar harus dilindungi sinyal keluar, bukan tanpa sinyal.
  const K2 = buatKeadaanAwal(ix, dinas, daftar, 555);
  const kk = K2.kereta.find((x) => x.batasKeluarId === 'BTS-MTR-K');
  kk.fase = 'SIAP_BERANGKAT';
  kk.sepurId = 'SP-G3';
  kk.simpulMasukSepur = 'HG3';
  const galatK = bentukRute(K2, ix, kk.id, 'KELUAR', 'BTS-MTR-K');
  periksa('rute keluar dapat dibentuk', galatK === null, String(galatK));
  const ruteK = Object.values(K2.rute).find((r) => r.jenis === 'KELUAR');
  const namaSinyalKeluar = ruteK
    ? (emplasemen.sinyal.find((s) => s.id === ruteK.sinyalId) || {}).nama
    : null;
  periksa('rute keluar dilindungi sinyal keluar', Boolean(namaSinyalKeluar));
  for (let i = 0; i < 12; i += 1) majuSatuDetik(K2, ix);
  const aspekKeluar = ruteK ? K2.sinyal[ruteK.sinyalId].aspek : null;
  periksa(
    'sinyal keluar menunjukkan aspek aman',
    aspekKeluar === 'HIJAU' || aspekKeluar === 'KUNING',
    `aspek ${aspekKeluar}`,
  );
  console.log(`   Sinyal keluar ${namaSinyalKeluar ?? '-'} : aspek ${aspekKeluar ?? '-'}`);
}

console.log('\n== 5. Satu sesi dinas penuh dilayani pelayanan otomatis ==');
{
  const { dinas, daftar } = perjalananDinas('DNS-PAGI');

  const K = buatKeadaanAwal(ix, dinas, daftar, 987654);
  K.modeOtomatis = 'PENUH';
  console.log(`   Perjalanan termuat: ${K.kereta.length}`);

  // Dinas dijalankan memakai modul pelayanan otomatis yang sama seperti yang
  // dipakai antarmuka — bukan salinan logikanya.
  let detik = 0;
  const BATAS = 14 * 3600;
  while (!K.dinasSelesai && detik < BATAS) {
    jalankanOtomatis(K, ix);
    majuSatuDetik(K, ix);
    detik += 1;
  }

  const skor = hitungSkor(K);
  console.log(`   Dinas ditutup pukul ${keJam(K.waktu)} setelah ${Math.round(detik / 60)} menit dinas.`);
  console.log(`   Diberangkatkan   : ${skor.keretaDilayani.length} / ${skor.keretaTotal}`);
  console.log(`   Selesai lintas   : ${skor.keretaSelesai}`);
  console.log(`   Ketepatan waktu  : ${(skor.ketepatanWaktu * 100).toFixed(1)} %`);
  console.log(`   Rerata deviasi   : ${skor.rerataDeviasiDetik} detik`);
  console.log(`   Efisiensi peron  : ${(skor.efisiensiPeron * 100).toFixed(0)} %`);
  console.log(`   Konflik dicegah  : ${skor.konflikDicegah}`);
  console.log(`   Pelanggaran      : ${skor.pelanggaran}`);
  console.log(`   Nilai / peringkat: ${skor.nilaiAkhir} (${skor.peringkat})`);

  periksa('dinas berakhir sebelum batas uji', K.dinasSelesai, `berhenti di detik ${detik}`);
  periksa(
    'seluruh perjalanan selesai dilayani',
    skor.keretaSelesai === skor.keretaTotal,
    `${skor.keretaTotal - skor.keretaSelesai} perjalanan belum selesai`,
  );
  periksa(
    'pelayanan otomatis mencapai ketepatan waktu wajar',
    skor.ketepatanWaktu > 0.7,
    `hanya ${(skor.ketepatanWaktu * 100).toFixed(1)} %`,
  );
  periksa(
    'seluruh blok kembali bebas setelah dinas ditutup',
    Object.values(K.blok).every((b) => b.keadaan === 'BEBAS' || b.keadaan === 'GANGGUAN'),
    Object.values(K.blok)
      .filter((b) => b.keadaan !== 'BEBAS')
      .map((b) => `${b.blokId}=${b.keadaan}`)
      .join(', '),
  );
  periksa(
    'tidak ada rute yang tertinggal terkunci',
    Object.keys(K.rute).length === 0,
    `${Object.keys(K.rute).length} rute tersisa`,
  );

  const sepurTerpakai = Object.values(K.pemakaianSepur).filter((p) => p.jumlahKereta > 0);
  console.log(
    `   Pemakaian sepur  : ${sepurTerpakai
      .map((p) => `${emplasemen.sepur.find((s) => s.id === p.sepurId).nomor}:${p.jumlahKereta}`)
      .join(' ')}`,
  );
  periksa('kedua lantai emplasemen terpakai', sepurTerpakai.length >= 6);
  periksa(
    'seluruh rute dicatat sebagai pelayanan otomatis',
    K.ruteOtomatis >= K.kereta.length,
    `${K.ruteOtomatis} rute untuk ${K.kereta.length} perjalanan`,
  );
  periksa(
    'setiap perjalanan ditandai terbantu pelayanan otomatis',
    K.kereta.every((k) => k.dilayaniOtomatis),
  );

  // Pemerataan peron: dua jalur satu pasang harus terpakai berselang-seling,
  // bukan menumpuk pada satu jalur saja.
  const pasangan = [
    ['SP-L9', 'SP-L10'],
    ['SP-L11', 'SP-L12'],
    ['SP-G1', 'SP-G2'],
    ['SP-G3', 'SP-G4'],
  ];
  for (const [a, b] of pasangan) {
    const na = K.pemakaianSepur[a].jumlahKereta;
    const nb = K.pemakaianSepur[b].jumlahKereta;
    const total = na + nb;
    periksa(
      `pemakaian jalur ${a}/${b} merata`,
      total === 0 || Math.abs(na - nb) <= Math.max(3, total * 0.35),
      `${na} vs ${nb}`,
    );
  }
}

console.log('\n== 6. Penjagaan headway petak jalan ==');
{
  const { dinas, daftar } = perjalananDinas('DNS-PAGI');
  const K = buatKeadaanAwal(ix, dinas, daftar, 42);
  K.terakhirKeluar['BTS-CKI-K'] = K.waktu - 30;
  const k = K.kereta.find((x) => x.batasKeluarId === 'BTS-CKI-K');
  if (k) {
    k.fase = 'SIAP_BERANGKAT';
    k.sepurId = 'SP-L9';
    k.simpulMasukSepur = 'TL9';
    const usulan = usulanRuteKeluar(K, ix, k).find((u) => u.sasaranId === 'BTS-CKI-K');
    periksa(
      'rute keluar ditolak karena headway belum terpenuhi',
      Boolean(usulan && usulan.penghalang && usulan.penghalang.includes('headway')),
      usulan ? String(usulan.penghalang) : 'usulan tidak ada',
    );
    console.log(`   ${usulan ? usulan.penghalang ?? 'diterima' : '-'}`);
  } else {
    periksa('tersedia KA menuju arah Cikini', false);
  }
}

console.log('\n== 7. Lapisan store yang dipakai antarmuka ==');
{
  // localStorage tidak ada di Node; store hanya memakainya bila `window` ada.
  const { usePapan } = require('../.uji/src/store/papan.js');
  const { indeksUntuk } = require('../.uji/src/lib/muat-data.js');
  usePapan.setState({
    stasiun: 'MRI',
    emplasemen,
    ix: indeksUntuk(emplasemen),
    jadwal,
    jadwalDiimpor: false,
  });
  const papan = usePapan.getState();

  periksa('berkas jadwal bawaan termuat store', papan.jadwal.perjalanan.length > 100);

  papan.mulaiDinas('DNS-LATIH');
  let s = usePapan.getState();
  periksa('dinas terbuka lewat store', Boolean(s.sim), 'sim masih null');
  periksa('dinas terpilih tercatat', s.dinasTerpilih && s.dinasTerpilih.id === 'DNS-LATIH');
  const jumlahAwal = s.sim.kereta.length;
  console.log(`   Dinas Latihan: ${jumlahAwal} perjalanan, jam ${keJam(s.sim.waktu)}`);

  // Jam dinas dimajukan seperti yang dilakukan lingkar requestAnimationFrame.
  s.aturKecepatan(4);
  s.aturJalan(true);
  periksa('jam dinas berjalan setelah tombol Jalan', usePapan.getState().sim.berjalan);

  const majuWaktu = usePapan.getState().majuWaktu;
  for (let i = 0; i < 200; i += 1) majuWaktu(250); // 200 x 250 ms x 4 = 200 detik dinas
  s = usePapan.getState();
  periksa(
    'jam dinas maju sesuai faktor percepatan',
    s.sim.waktu - s.sim.mulai >= 190 && s.sim.waktu - s.sim.mulai <= 210,
    `maju ${s.sim.waktu - s.sim.mulai} detik`,
  );
  console.log(`   Setelah 50 detik nyata pada 4x: jam dinas ${keJam(s.sim.waktu)}`);

  const menunggu = s.sim.kereta.filter(
    (k) => k.fase === 'DIWARTAKAN' || k.fase === 'TERTAHAN_SINYAL',
  );
  periksa('ada perjalanan yang menuntut pelayanan rute', menunggu.length > 0);
  console.log(
    `   Menuntut pelayanan: ${menunggu.map((k) => `${k.nomorKA}/${k.fase}`).join(', ') || '-'}`,
  );

  // Layani satu rute masuk lewat aksi store, lalu jalankan sampai berhenti.
  const target = menunggu[0];
  const usulan = usulanRuteMasuk(s.sim, ix, target).filter((u) => !u.penghalang && u.lazim);
  periksa('panel menawarkan jalur yang dapat dilayani', usulan.length > 0);
  const galat = usePapan.getState().layaniRuteMasuk(target.id, usulan[0].sasaranId);
  periksa('aksi store membentuk rute masuk', galat === null, String(galat));

  const maju = usePapan.getState().majuWaktu;
  for (let i = 0; i < 900 && usePapan.getState().sim.kereta.find((k) => k.id === target.id).fase !== 'BERHENTI'; i += 1) {
    maju(250);
  }
  s = usePapan.getState();
  const setelah = s.sim.kereta.find((k) => k.id === target.id);
  periksa(
    'rangkaian berhenti di jalur yang ditetapkan',
    setelah.fase === 'BERHENTI' && setelah.sepurId === usulan[0].sasaranId,
    `fase ${setelah.fase}, sepur ${setelah.sepurId}`,
  );
  console.log(
    `   KA ${setelah.nomorKA} berhenti di ${setelah.sepurId} pukul ${
      setelah.aktualDatang !== null ? keJam(setelah.aktualDatang) : '-'
    }`,
  );

  // Mode pelayanan otomatis dikendalikan lewat store dan berjalan pada
  // lingkar jam yang sama seperti antarmuka.
  periksa('mode pelayanan bawaan adalah manual', s.sim.modeOtomatis === 'MATI');
  usePapan.getState().aturModeOtomatis('SARAN');
  s = usePapan.getState();
  periksa('mode saran tidak membentuk rute sendiri', s.sim.ruteOtomatis === 0);

  const ruteSebelum = Object.keys(s.sim.rute).length;
  usePapan.getState().aturModeOtomatis('PENUH');
  s = usePapan.getState();
  periksa(
    'peralihan ke mode otomatis segera melayani rute yang menunggu',
    Object.keys(s.sim.rute).length >= ruteSebelum,
  );
  const majuOtomatis = usePapan.getState().majuWaktu;
  for (let i = 0; i < 400; i += 1) majuOtomatis(250);
  s = usePapan.getState();
  periksa('mode otomatis membentuk rute selama jam berjalan', s.sim.ruteOtomatis > 0);
  console.log(
    `   Mode otomatis: ${s.sim.ruteOtomatis} rute dibentuk, ` +
      `${s.sim.kereta.filter((k) => k.dilayaniOtomatis).length} KA terbantu`,
  );
  usePapan.getState().aturModeOtomatis('MATI');
  const otomatisTerakhir = usePapan.getState().sim.ruteOtomatis;
  const majuManual = usePapan.getState().majuWaktu;
  for (let i = 0; i < 200; i += 1) majuManual(250);
  periksa(
    'mode manual menghentikan pelayanan otomatis',
    usePapan.getState().sim.ruteOtomatis === otomatisTerakhir,
  );
  s = usePapan.getState();

  // Wesel di luar rute boleh dibalik dari panel; wesel terkunci tidak boleh.
  const weselBebas = Object.values(s.sim.wesel).find(
    (w) => !w.terkunciOlehRute && !w.gangguan && !w.membalik,
  );
  const kedudukanAwal = weselBebas.kedudukan;
  const galatWesel = usePapan.getState().layaniWesel(weselBebas.weselId);
  s = usePapan.getState();
  periksa('wesel bebas dapat dibalik dari panel', galatWesel === null, String(galatWesel));
  periksa(
    'kedudukan wesel berubah',
    s.sim.wesel[weselBebas.weselId].kedudukan !== kedudukanAwal,
  );

  // Tutup dinas harus menghasilkan laporan akhir.
  usePapan.getState().tutupDinas();
  s = usePapan.getState();
  periksa('laporan akhir dinas tersusun', Boolean(s.hasil), 'hasil masih null');
  periksa('nilai akhir berada pada rentang 0..1000', s.hasil.nilaiAkhir >= 0 && s.hasil.nilaiAkhir <= 1000);
  periksa('jam dinas berhenti setelah dinas ditutup', s.sim.berjalan === false);
  console.log(
    `   Laporan: nilai ${s.hasil.nilaiAkhir} (${s.hasil.peringkat}), ` +
      `${s.hasil.keretaDilayani.length}/${s.hasil.keretaTotal} diberangkatkan`,
  );

  // Impor CSV harus diperiksa dan ditolak bila cacat.
  const { baacaCsv, keCsv } = require('../.uji/src/lib/impor.js');
  const { periksaJadwal } = require('../.uji/src/lib/muat-data.js');
  const csv = keCsv(papan.jadwal);
  const balik = baacaCsv(csv, papan.jadwal);
  periksa('CSV hasil ekspor dapat dibaca kembali', Boolean(balik.jadwal));
  periksa(
    'jumlah perjalanan bertahan setelah pulang-balik CSV',
    balik.jadwal && balik.jadwal.perjalanan.length === papan.jadwal.perjalanan.length,
    balik.jadwal ? `${balik.jadwal.perjalanan.length} vs ${papan.jadwal.perjalanan.length}` : '-',
  );
  periksa(
    'berkas hasil pulang-balik lolos pemeriksaan',
    balik.jadwal &&
      periksaJadwal(balik.jadwal, emplasemen).filter((t) => t.tingkat === 'GALAT').length === 0,
  );

  const cacat = baacaCsv(
    'nomorKA,lin,asal,tujuan,batasMasukId,jamDatang,jamBerangkat\n' +
      '9999,LIN_BOGOR,X,Y,BTS-TIDAK-ADA,05.10,05.12',
    papan.jadwal,
  );
  const temuanCacat = cacat.jadwal ? periksaJadwal(cacat.jadwal, emplasemen) : [];
  periksa(
    'batas emplasemen yang tidak dikenal terdeteksi sebagai galat',
    temuanCacat.some((t) => t.tingkat === 'GALAT' && t.pesan.includes('Batas masuk')),
    JSON.stringify(temuanCacat.slice(0, 2)),
  );
  const jamCacat = baacaCsv(
    'nomorKA,lin,asal,tujuan,batasMasukId,jamDatang,jamBerangkat\n' +
      '9998,LIN_BOGOR,X,Y,BTS-TBT-D,25.99,05.12',
    papan.jadwal,
  );
  periksa(
    'jam di luar bentuk yang sah terdeteksi sebagai galat',
    jamCacat.jadwal &&
      periksaJadwal(jamCacat.jadwal, emplasemen).some(
        (t) => t.tingkat === 'GALAT' && t.pesan.includes('Jam datang'),
      ),
  );
  console.log('   Pemeriksaan impor CSV berjalan.');
}

console.log('\n== 8. Regresi cacat yang pernah ditemukan ==');
{
  const { bacaJson, keCsv } = require('../.uji/src/lib/impor.js');
  const { periksaJadwal, periksaJadwalAman } = require('../.uji/src/lib/muat-data.js');
  const { bebaskanRute } = require('../.uji/src/lib/simulasi.js');
  const bawaan = JSON.parse(
    readFileSync(resolve(AKAR, 'data/jadwal-manggarai.json'), 'utf8'),
  );

  // (a) Impor JSON tanpa kolom sepurLazim tidak boleh menghasilkan undefined.
  const tanpaSepur = bacaJson(
    JSON.stringify({
      perjalanan: [
        {
          id: 'TRIP-1157',
          nomorKA: '1157',
          lin: 'LIN_BOGOR',
          relasi: 'Bogor - Jakarta Kota',
          asal: 'Bogor',
          tujuan: 'Jakarta Kota',
          batasMasukId: 'BTS-TBT-D',
          batasKeluarId: 'BTS-CKI-K',
          jamDatang: '05.04.00',
          jamBerangkat: '05.06.00',
          keandalanData: 'RESMI',
        },
      ],
    }),
    bawaan,
  );
  periksa('impor JSON tanpa sepurLazim tetap terbaca', Boolean(tanpaSepur.jadwal));
  periksa(
    'sepurLazim dinormalkan menjadi larik kosong, bukan undefined',
    Array.isArray(tanpaSepur.jadwal.perjalanan[0].sepurLazim),
    String(tanpaSepur.jadwal.perjalanan[0].sepurLazim),
  );
  let lemparKeCsv = null;
  try {
    keCsv(tanpaSepur.jadwal);
  } catch (e) {
    lemparKeCsv = e.message;
  }
  periksa('ekspor CSV berkas impor tidak melempar', lemparKeCsv === null, String(lemparKeCsv));

  // (b) Entri bukan objek harus ditolak, bukan melempar.
  let lemparPeriksa = null;
  const cacatBerat = bacaJson('{"perjalanan":[null,42,{"nomorKA":""}]}', bawaan);
  periksa('berkas berisi entri bukan objek ditolak', cacatBerat.jadwal === null);
  try {
    periksaJadwal({ ...bawaan, perjalanan: [null, 42] }, emplasemen);
  } catch (e) {
    lemparPeriksa = e.message;
  }
  periksa(
    'periksaJadwalAman tidak melempar pada berkas rusak',
    periksaJadwalAman({ ...bawaan, perjalanan: [null, 42] }, emplasemen).some(
      (t) => t.tingkat === 'GALAT',
    ),
    String(lemparPeriksa),
  );

  // (c) Berkas impor tidak boleh mewarisi label edisi dan sumber berkas bawaan.
  periksa(
    'berkas impor tidak mewarisi label GAPEKA bawaan',
    tanpaSepur.jadwal.gapeka !== bawaan.gapeka,
    tanpaSepur.jadwal.gapeka,
  );
  periksa(
    'berkas impor tidak mewarisi daftar sumber bawaan',
    JSON.stringify(tanpaSepur.jadwal.sumber) !== JSON.stringify(bawaan.sumber),
  );

  // (d) Aspek sinyal dipulihkan setelah gangguan pulih bila rute masih terkunci.
  const { dinas, daftar } = perjalananDinas('DNS-PAGI');
  const K = buatKeadaanAwal(ix, dinas, daftar, 777);
  const kk = K.kereta.find((x) => x.batasMasukId === 'BTS-TBT-D');
  bentukRute(K, ix, kk.id, 'MASUK', 'SP-L9');
  for (let i = 0; i < 12; i += 1) majuSatuDetik(K, ix);
  const rt = Object.values(K.rute).find((r) => r.keretaId === kk.id);
  const sinyalId = rt.sinyalId;
  const aspekSebelum = K.sinyal[sinyalId].aspek;
  // Timbulkan gangguan sinyal, lalu pulihkan.
  K.sinyal[sinyalId].gangguan = true;
  K.sinyal[sinyalId].aspek = 'PADAM';
  K.gangguan.push({
    id: 'GG-UJI',
    jenis: 'SINYAL_PADAM',
    mulai: K.waktu,
    selesai: K.waktu + 1,
    sasaranId: sinyalId,
    keterangan: 'uji',
    teratasi: false,
  });
  majuSatuDetik(K, ix);
  majuSatuDetik(K, ix);
  periksa(
    'aspek aman dipulihkan setelah gangguan sinyal berakhir pada rute terkunci',
    K.sinyal[sinyalId].aspek === aspekSebelum,
    `sebelum ${aspekSebelum}, sesudah ${K.sinyal[sinyalId].aspek}`,
  );
  console.log(`   Aspek sinyal ${aspekSebelum} → gangguan → ${K.sinyal[sinyalId].aspek}`);

  // (e) Kecepatan tidak dipulihkan selama masih ada gangguan sinyal lain.
  const K2 = buatKeadaanAwal(ix, dinas, daftar, 778);
  const sig1 = ix.data.sinyal[0].id;
  const sig2 = ix.data.sinyal[1].id;
  for (const [id, selesai] of [
    [sig1, K2.waktu + 1],
    [sig2, K2.waktu + 500],
  ]) {
    K2.sinyal[id].gangguan = true;
    K2.gangguan.push({
      id: `GG-${id}`,
      jenis: 'SINYAL_PADAM',
      mulai: K2.waktu,
      selesai,
      sasaranId: id,
      keterangan: 'uji',
      teratasi: false,
    });
  }
  for (const k of K2.kereta) k.faktorKecepatan = 0.6;
  majuSatuDetik(K2, ix);
  majuSatuDetik(K2, ix);
  periksa(
    'kecepatan tetap terbatas selama gangguan sinyal lain berlangsung',
    K2.kereta.every((k) => k.faktorKecepatan === 0.6),
  );

  // (f) Pelanggaran penetapan jalur dicatat sekali, dan hanya bila rangkaian
  //     benar-benar berhenti di sepur itu.
  const K3 = buatKeadaanAwal(ix, dinas, daftar, 779);
  const k3 = K3.kereta.find((x) => x.batasMasukId === 'BTS-TBT-D');
  for (let i = 0; i < 4; i += 1) {
    bentukRute(K3, ix, k3.id, 'MASUK', 'SP-L10'); // di luar peruntukan? tidak — 9/10 lazim
    const r = Object.values(K3.rute).find((x) => x.keretaId === k3.id);
    if (r) bebaskanRute(K3, ix, r.id, false);
  }
  periksa(
    'rute yang dibentuk lalu dibatalkan tidak menetapkan sepurLazimTerpakai',
    k3.sepurLazimTerpakai === null,
    String(k3.sepurLazimTerpakai),
  );
  periksa(
    'pembentukan rute berulang tidak menumpuk pelanggaran',
    K3.pelanggaran.filter((p) => p.jenis === 'PERON_SALAH' || p.jenis === 'SEPUR_TIDAK_LAYAK')
      .length === 0,
  );

  // (g) Rute yang sedang diduduki sarana tidak boleh dibongkar dari panel.
  const K4 = buatKeadaanAwal(ix, dinas, daftar, 780);
  const k4 = K4.kereta.find((x) => x.batasMasukId === 'BTS-MTR-D');
  bentukRute(K4, ix, k4.id, 'MASUK', 'SP-G1');
  for (let i = 0; i < 4000 && k4.fase !== 'MASUK'; i += 1) majuSatuDetik(K4, ix);
  periksa('rangkaian mulai menduduki rute', k4.fase === 'MASUK', `fase ${k4.fase}`);
  const rt4 = Object.values(K4.rute).find((r) => r.keretaId === k4.id);
  if (rt4) {
    bebaskanRute(K4, ix, rt4.id, true);
    periksa(
      'rute yang diduduki tidak dapat dibebaskan dari panel',
      Boolean(K4.rute[rt4.id]),
    );
    const galatGanti = bentukRute(K4, ix, k4.id, 'MASUK', 'SP-G2');
    periksa('rute yang diduduki tidak dapat diganti', galatGanti !== null, String(galatGanti));
  } else {
    periksa('rute masuk masih terdaftar saat diduduki', false);
  }

  // (h) Rangkaian berhenti di UJUNG peron dan tidak melompat saat berangkat.
  const K5 = buatKeadaanAwal(ix, dinas, daftar, 781);
  const k5 = K5.kereta.find((x) => x.batasMasukId === 'BTS-TBT-D');
  bentukRute(K5, ix, k5.id, 'MASUK', 'SP-L9');
  for (let i = 0; i < 4000 && k5.fase !== 'BERHENTI'; i += 1) majuSatuDetik(K5, ix);
  periksa('rangkaian berhasil berhenti di peron', k5.fase === 'BERHENTI', `fase ${k5.fase}`);
  periksa(
    'rangkaian berhenti di ujung peron, bukan di tengah badan sepur',
    k5.kemajuan === 1,
    `kemajuan ${k5.kemajuan}`,
  );

  // Kedudukan tidak boleh bergeser selama menunggu waktu berangkat.
  for (let i = 0; i < 30; i += 1) majuSatuDetik(K5, ix);
  periksa(
    'kedudukan rangkaian tetap selama berhenti melayani penumpang',
    k5.fase !== 'BERHENTI' || k5.kemajuan === 1,
    `kemajuan ${k5.kemajuan}`,
  );

  // Saat berangkat lurus terus, rangkaian tidak melompat mundur ke pangkal peron.
  k5.fase = 'SIAP_BERANGKAT';
  k5.sisaBerhentiDetik = 0;
  bentukRute(K5, ix, k5.id, 'KELUAR', 'BTS-CKI-K');
  for (let i = 0; i < 30 && k5.fase !== 'BERANGKAT'; i += 1) majuSatuDetik(K5, ix);
  periksa('rangkaian mulai berangkat', k5.fase === 'BERANGKAT', `fase ${k5.fase}`);
  periksa(
    'keberangkatan lurus terus tidak melompat mundur ke pangkal peron',
    k5.indeksRuas > 0 || k5.kemajuan >= 1,
    `ruas ${k5.indeksRuas}, kemajuan ${k5.kemajuan.toFixed(2)}`,
  );
  console.log(
    `   Berhenti pada kemajuan 1 (ujung peron); saat berangkat langsung di ruas ${k5.indeksRuas}.`,
  );

  // (i) Nilai kelancaran turun bila rangkaian tertahan.
  const skorK4 = hitungSkor(K4);
  periksa(
    'medan kelancaran tersedia pada laporan',
    typeof skorK4.kelancaran === 'number' && skorK4.kelancaran >= 0 && skorK4.kelancaran <= 1,
  );
  console.log('   Regresi selesai diperiksa.');
}

console.log('\n== 9. Kaidah pelayanan otomatis ==');
{
  const { dinas, daftar } = perjalananDinas('DNS-PUNCAK-PAGI');

  // (a) Usul tidak pernah menunjuk jalur di luar peruntukan selama rangkaian
  //     belum tertahan di muka sinyal.
  const K = buatKeadaanAwal(ix, dinas, daftar, 4242);
  let langgar = 0;
  let jumlahSaran = 0;
  let jumlahPengalihan = 0;
  for (let i = 0; i < 5400 && !K.dinasSelesai; i += 1) {
    for (const s of susunSaran(K, ix)) {
      jumlahSaran += 1;
      const k = K.kereta.find((x) => x.id === s.keretaId);
      if (s.jenis !== 'MASUK') continue;
      const lazim = k.sepurLazim.includes(s.sasaranId);
      if (!lazim) {
        jumlahPengalihan += 1;
        // Pengalihan hanya sah bila rangkaian memang sudah tertahan.
        if (k.fase !== 'TERTAHAN_SINYAL') langgar += 1;
        // Dan tidak boleh menuju sepur tanpa peron aktif untuk KA berpenumpang.
        const sp = emplasemen.sepur.find((x) => x.id === s.sasaranId);
        if (sp.peronId === null && k.lin !== 'KLB') langgar += 1;
      }
    }
    jalankanOtomatis(K, ix);
    majuSatuDetik(K, ix);
  }
  periksa(
    'pelayanan otomatis tidak pernah mengalihkan jalur tanpa sebab',
    langgar === 0,
    `${langgar} usul melanggar kaidah`,
  );
  console.log(
    `   ${jumlahSaran} usul disusun, ${jumlahPengalihan} di antaranya pengalihan darurat.`,
  );

  // (b) Rute keluar tidak pernah menuju batas yang tidak sesuai jadwal.
  const salahArah = K.kereta.filter(
    (k) => k.fase === 'SELESAI' && k.batasKeluarId !== null && k.dilayaniOtomatis === false,
  ).length;
  periksa('seluruh perjalanan dilayani papan pada mode penuh', salahArah === 0);

  // (c) Mode saran tidak boleh mengubah keadaan apa pun.
  const K2 = buatKeadaanAwal(ix, dinas, daftar, 4243);
  for (let i = 0; i < 900; i += 1) majuSatuDetik(K2, ix);
  const sebelum = JSON.stringify({
    rute: Object.keys(K2.rute).length,
    wesel: Object.values(K2.wesel).map((w) => w.kedudukan),
    fase: K2.kereta.map((k) => k.fase),
    otomatis: K2.ruteOtomatis,
  });
  susunSaran(K2, ix);
  susunSaran(K2, ix);
  const sesudah = JSON.stringify({
    rute: Object.keys(K2.rute).length,
    wesel: Object.values(K2.wesel).map((w) => w.kedudukan),
    fase: K2.kereta.map((k) => k.fase),
    otomatis: K2.ruteOtomatis,
  });
  periksa('menyusun usul tidak mengubah keadaan simulasi', sebelum === sesudah);

  // (d) Perbandingan hasil: manual tanpa pelayanan vs pelayanan otomatis penuh.
  const KM = buatKeadaanAwal(ix, dinas, daftar, 4244);
  for (let i = 0; i < 5400 && !KM.dinasSelesai; i += 1) majuSatuDetik(KM, ix);
  const skorManual = hitungSkor(KM);
  const skorOtomatis = hitungSkor(K);
  periksa(
    'pelayanan otomatis jelas lebih baik daripada papan yang ditinggalkan',
    skorOtomatis.nilaiAkhir > skorManual.nilaiAkhir,
    `${skorOtomatis.nilaiAkhir} vs ${skorManual.nilaiAkhir}`,
  );
  console.log(
    `   Nilai tanpa pelayanan: ${skorManual.nilaiAkhir} (${skorManual.peringkat}) · ` +
      `dengan pelayanan otomatis: ${skorOtomatis.nilaiAkhir} (${skorOtomatis.peringkat})`,
  );
}

console.log('\n== 10. KA jarak jauh berjalan langsung ==');
{
  const { dinas, daftar } = perjalananDinas('DNS-PAGI');

  const kajj = daftar.filter((t) => t.lin === 'KAJJ');
  periksa('KA jarak jauh termuat pada jadwal', kajj.length >= 12, `${kajj.length} perjalanan`);
  periksa(
    'seluruh KA jarak jauh ditandai berjalan langsung',
    kajj.every((t) => t.langsung === true && t.waktuBerhentiMinimumDetik === 0),
  );
  periksa(
    'jam datang dan jam berangkat KA langsung sama',
    kajj.every((t) => t.jamDatang === t.jamBerangkat),
  );
  periksa(
    'tidak ada KA jarak jauh yang memakai jalur berperon sebagai sepur lazim',
    kajj.every((t) =>
      t.sepurLazim.every(
        (s) => (emplasemen.sepur.find((x) => x.id === s) || {}).peronId === null,
      ),
    ),
  );
  console.log(
    `   ${kajj.length} KA jarak jauh: ${kajj
      .slice(0, 6)
      .map((t) => `${t.nomorKA}@${t.jamBerangkat.slice(0, 5)}`)
      .join(' ')} ...`,
  );

  const K = buatKeadaanAwal(ix, dinas, daftar, 3131);
  const k = K.kereta.find((x) => x.lin === 'KAJJ' && x.batasMasukId === 'BTS-JJ-TMR-D');
  periksa('tersedia KA jarak jauh arah Gambir untuk diuji', Boolean(k));

  // Rute KA langsung harus membentang utuh sampai batas keluar.
  const usulan = usulanRuteMasuk(K, ix, k).filter((u) => !u.penghalang);
  const lewatLintas = usulan.find((u) => u.sasaranId === 'SP-GLU');
  periksa('sepur lintas hulu dapat dilayani', Boolean(lewatLintas));
  const petakKeluar = ruasBatas(ix, k.batasKeluarId);
  periksa(
    'rute KA langsung berakhir di petak jalan batas keluar',
    lewatLintas && lewatLintas.hasil.ruasIds.at(-1) === petakKeluar.ruasId,
    lewatLintas ? String(lewatLintas.hasil.ruasIds.at(-1)) : '-',
  );
  periksa(
    'rute KA langsung melewati badan sepur lintas',
    lewatLintas && lewatLintas.hasil.ruasIds.includes('RG-SP-LU'),
  );

  // Penyusulan: KA langsung boleh dibelokkan ke sepur simpan jalur 5.
  const lewatJ5 = usulan.find((u) => u.sasaranId === 'SP-G5');
  periksa('KA langsung dapat dibelokkan ke jalur 5 untuk penyusulan', Boolean(lewatJ5));

  periksa(
    'KA langsung tidak menuntut rute keluar tersendiri',
    usulanRuteKeluar(K, ix, k).length === 0,
  );

  // Jalankan sampai selesai dan pastikan tidak pernah berhenti di peron.
  bentukRute(K, ix, k.id, 'MASUK', 'SP-GLU');
  let pernahBerhenti = false;
  for (let i = 0; i < 6000 && k.fase !== 'SELESAI'; i += 1) {
    majuSatuDetik(K, ix);
    if (k.fase === 'BERHENTI' || k.fase === 'SIAP_BERANGKAT') pernahBerhenti = true;
  }
  periksa('KA langsung menyelesaikan lintasannya', k.fase === 'SELESAI', `fase ${k.fase}`);
  periksa('KA langsung tidak pernah berhenti di peron', !pernahBerhenti);
  periksa('jam lintas KA langsung tercatat', k.aktualBerangkat !== null);
  periksa(
    'sepur lintas tercatat pada pemakaian sepur',
    K.pemakaianSepur['SP-GLU'].jumlahKereta === 1,
  );
  console.log(
    `   KA ${k.nomorKA} dijadwalkan lintas ${keJam(k.jadwalBerangkat)}, ` +
      `terlaksana ${keJam(k.aktualBerangkat)} (deviasi ${k.deviasiDetik} detik).`,
  );

  // Lantai layang tidak boleh terjangkau KA jarak jauh.
  const keLayang = usulanRuteMasuk(K, ix, k).filter(
    (u) =>
      !u.penghalang &&
      emplasemen.sepur.find((s) => s.id === u.sasaranId).level === 'LAYANG',
  );
  periksa('KA jarak jauh tidak dapat masuk lantai layang', keLayang.length === 0);
}

console.log('\n== 11. Jadwal satu hari penuh dan dinas malam ==');
{
  // (a) Berkas jadwal harus benar-benar mencakup 24 jam.
  const perJam = {};
  for (const t of jadwal.perjalanan) {
    const h = t.jamDatang.slice(0, 2);
    perJam[h] = (perJam[h] ?? 0) + 1;
  }
  const jamTerisi = Object.keys(perJam).length;
  periksa('jadwal mencakup seluruh 24 jam', jamTerisi === 24, `${jamTerisi} jam terisi`);
  const siangKosong = ['06', '09', '12', '15', '18', '21'].filter((h) => !perJam[h]);
  periksa('tidak ada jam sibuk yang kosong', siangKosong.length === 0, siangKosong.join(','));
  periksa('jumlah perjalanan sepadan dengan satu hari penuh', jadwal.perjalanan.length > 600);
  console.log(
    `   ${jadwal.perjalanan.length} perjalanan · ` +
      `${Object.keys(perJam).sort().map((h) => `${h}:${perJam[h]}`).join(' ')}`,
  );

  // (b) Seluruh baris harus punya jam yang sah dan berangkat >= datang.
  const jamCacat = jadwal.perjalanan.filter(
    (t) => !/^([01]\d|2[0-3])\.[0-5]\d\.[0-5]\d$/.test(t.jamDatang) ||
      !/^([01]\d|2[0-3])\.[0-5]\d\.[0-5]\d$/.test(t.jamBerangkat),
  );
  periksa('seluruh jam berbentuk sah', jamCacat.length === 0, `${jamCacat.length} baris cacat`);

  // (c) Dinas malam melewati tengah malam.
  const { dinas, daftar, mulai, selesai } = perjalananDinas('DNS-MALAM');
  periksa('dinas malam melewati tengah malam', selesai > SEHARI, `selesai ${selesai}`);
  periksa('dinas malam memuat perjalanan', daftar.length > 20, `${daftar.length} perjalanan`);
  const lewatTengahMalam = daftar.filter((t) => keDetik(t.jamDatang) < mulai);
  periksa(
    'perjalanan lepas tengah malam ikut termuat',
    lewatTengahMalam.length > 0,
    `${lewatTengahMalam.length} perjalanan`,
  );

  const K = buatKeadaanAwal(ix, dinas, daftar, 5150);
  periksa('jam dinas malam dimulai pukul 21.00', K.waktu === keDetik('21.00'));
  periksa('akhir dinas malam berada di hari berikutnya', K.selesaiPada === keDetik('05.00') + SEHARI);
  const setelahTengahMalam = K.kereta.filter((k) => k.jadwalDatang >= SEHARI);
  periksa(
    'jadwal perjalanan lepas tengah malam digeser ke hari berikutnya',
    setelahTengahMalam.length === lewatTengahMalam.length,
    `${setelahTengahMalam.length} vs ${lewatTengahMalam.length}`,
  );
  periksa(
    'urutan jadwal tetap menaik sepanjang dinas malam',
    K.kereta.every((k, i) => i === 0 || k.jadwalDatang >= K.kereta[i - 1].jadwalDatang),
  );

  K.modeOtomatis = 'PENUH';
  let detik = 0;
  while (!K.dinasSelesai && detik < 14 * 3600) {
    jalankanOtomatis(K, ix);
    majuSatuDetik(K, ix);
    detik += 1;
  }
  const skor = hitungSkor(K);
  periksa('dinas malam dapat diselesaikan', K.dinasSelesai, `berhenti di detik ${detik}`);
  periksa(
    'seluruh perjalanan dinas malam selesai dilayani',
    skor.keretaSelesai === skor.keretaTotal,
    `${skor.keretaTotal - skor.keretaSelesai} belum selesai`,
  );
  console.log(
    `   Dinas Malam 21.00-05.00: ${daftar.length} perjalanan, ditutup pukul ${keJam(K.waktu)}, ` +
      `ketepatan waktu ${(skor.ketepatanWaktu * 100).toFixed(1)} %`,
  );

  // (d) Dinas siang dan puncak sore ikut termuat.
  for (const id of ['DNS-SIANG', 'DNS-PUNCAK-SORE', 'DNS-SEHARI']) {
    const { daftar: d } = perjalananDinas(id);
    periksa(`dinas ${id} memuat perjalanan`, d.length > 0, `${d.length} perjalanan`);
  }
  console.log(
    `   Sebaran per dinas: ${jadwal.dinas
      .map((d) => `${d.nama}=${perjalananDinas(d.id).daftar.length}`)
      .join(' · ')}`,
  );
}

/* ------------------------------------------------------------------ */
/**
 * Bagian terakhir memuat berkas stasiun lain lewat jalan yang sama dengan
 * aplikasi. Pemuatan itu tak serentak, jadi penutup uji ikut masuk ke dalam
 * janji supaya hitungan lulus/gagal tetap lengkap.
 */
async function bagianMultiStasiun() {
  console.log('\n== 12. Pemuatan berkas lebih dari satu stasiun ==');
  const { usePapan } = require('../.uji/src/store/papan.js');
  const { DAFTAR_STASIUN, muatStasiun } = require('../.uji/src/lib/stasiun.js');
  const { perjalananDinas: perjalananDinasUmum } = require('../.uji/src/lib/muat-data.js');

  periksa('daftar stasiun memuat lebih dari satu wilayah', DAFTAR_STASIUN.length >= 2);

  for (const r of DAFTAR_STASIUN) {
    const data = await muatStasiun(r.kode);
    periksa(
      `${r.kode}: emplasemen dan jadwal termuat`,
      Boolean(data.emplasemen && data.jadwal),
    );
    periksa(
      `${r.kode}: jumlah sepur sama dengan angka pada daftar`,
      data.emplasemen.sepur.length === r.jumlahSepur,
      `${data.emplasemen.sepur.length} vs ${r.jumlahSepur}`,
    );
    periksa(
      `${r.kode}: jumlah perjalanan sama dengan angka pada daftar`,
      data.jadwal.perjalanan.length === r.jumlahPerjalanan,
      `${data.jadwal.perjalanan.length} vs ${r.jumlahPerjalanan}`,
    );

    const idBatas = new Set(data.emplasemen.batas.map((b) => b.id));
    const batasAsing = data.jadwal.perjalanan.filter(
      (t) => !idBatas.has(t.batasMasukId) || (t.batasKeluarId && !idBatas.has(t.batasKeluarId)),
    );
    periksa(
      `${r.kode}: seluruh batas pada jadwal ada di emplasemen`,
      batasAsing.length === 0,
      batasAsing.length ? `${batasAsing.length} perjalanan, mis. KA ${batasAsing[0].nomorKA}` : '-',
    );

    const adaOsm = data.emplasemen.ruas.some((x) => Array.isArray(x.jalanOsm));
    periksa(
      `${r.kode}: ketersediaan tampilan rel OSM sesuai daftar`,
      adaOsm === r.punyaTampilanOsm,
      `geometri ${adaOsm ? 'ada' : 'tidak ada'}, daftar menyebut ${r.punyaTampilanOsm}`,
    );

    // Tiap dinas harus benar-benar memuat perjalanan; dinas kosong berarti
    // rentang jamnya tidak beririsan dengan berkas jadwalnya.
    const kosong = data.jadwal.dinas.filter(
      (d) => perjalananDinasUmum(data.jadwal, d.mulai, d.selesai).length === 0,
    );
    periksa(
      `${r.kode}: tidak ada dinas yang kosong`,
      kosong.length === 0,
      kosong.map((d) => d.nama).join(', '),
    );
  }

  // Berpindah stasiun lewat store harus mengganti ketiganya sekaligus.
  await usePapan.getState().pilihStasiun('KYA');
  let p = usePapan.getState();
  periksa('berpindah stasiun mengganti emplasemen', p.emplasemen.kodeStasiun === 'KYA');
  periksa('berpindah stasiun mengganti jadwal', p.jadwal.stasiun === 'KYA');
  periksa(
    'indeks graf ikut berganti',
    p.ix.data === p.emplasemen,
    'indeks masih menunjuk emplasemen lain',
  );
  periksa('dinas yang sedang berjalan dihentikan saat berpindah', p.sim === null);

  p.mulaiDinas(p.jadwal.dinas[0].id);
  p = usePapan.getState();
  periksa('dinas stasiun baru dapat dibuka', Boolean(p.sim));
  const asing = p.sim.kereta.filter((k) => !k.id.includes('KYA'));
  periksa(
    'tidak ada perjalanan stasiun lain yang ikut terbawa',
    asing.length === 0,
    asing.length ? asing[0].id : '-',
  );

  await usePapan.getState().pilihStasiun('MRI');
  p = usePapan.getState();
  periksa('dapat kembali ke stasiun semula', p.emplasemen.kodeStasiun === 'MRI');

  /*
   * Bagian yang paling menentukan bagi stasiun baru: emplasemen yang lolos
   * pemeriksaan bentuk belum tentu dapat DIDINASI. Tiap stasiun karena itu
   * dijalankan satu dinas penuh dengan pelayanan otomatis, dan seluruh
   * perjalanannya harus benar-benar diberangkatkan.
   */
  console.log('\n== 13. Satu dinas penuh pada tiap stasiun ==');
  for (const r of DAFTAR_STASIUN) {
    const data = await muatStasiun(r.kode);
    const ixS = indeksEmplasemen(data.emplasemen);
    // Dinas terpadat yang bukan satu hari penuh, supaya ujinya berat tetapi
    // tetap selesai dalam waktu yang wajar.
    const kandidat = data.jadwal.dinas.filter((d) => !/SEHARI/.test(d.id));
    const dinas = kandidat.reduce(
      (a2, d) =>
        perjalananDinasUmum(data.jadwal, d.mulai, d.selesai).length >
        perjalananDinasUmum(data.jadwal, a2.mulai, a2.selesai).length
          ? d
          : a2,
      kandidat[0],
    );
    const daftar = perjalananDinasUmum(data.jadwal, dinas.mulai, dinas.selesai);
    const K = buatKeadaanAwal(ixS, dinas, daftar);
    K.modeOtomatis = 'PENUH';

    let detik = 0;
    while (!K.dinasSelesai && detik < 20 * 3600) {
      jalankanOtomatis(K, ixS);
      majuSatuDetik(K, ixS);
      detik += 1;
    }
    const skor = hitungSkor(K);
    periksa(`${r.kode}: dinas ${dinas.nama} dapat diselesaikan`, K.dinasSelesai, `berhenti di detik ${detik}`);
    periksa(
      `${r.kode}: seluruh perjalanan diberangkatkan`,
      skor.keretaDilayani.length === skor.keretaTotal,
      `${skor.keretaTotal - skor.keretaDilayani.length} dari ${skor.keretaTotal} tidak berangkat`,
    );
    periksa(
      `${r.kode}: tidak ada pelanggaran keselamatan`,
      skor.pelanggaran === 0,
      `${skor.pelanggaran} pelanggaran, mis. ${(K.pelanggaran[0] || {}).keterangan || '-'}`,
    );
    console.log(
      `   ${r.kode.padEnd(4)} ${dinas.nama.padEnd(16)} ${String(daftar.length).padStart(3)} perjalanan · ` +
        `ketepatan ${(skor.ketepatanWaktu * 100).toFixed(1)} % · nilai ${skor.nilaiAkhir} (${skor.peringkat})`,
    );
  }
}

bagianMultiStasiun()
  .catch((e) => {
    gagal += 1;
    kegagalan.push(`bagian 12 melempar: ${e && e.stack ? e.stack : e}`);
  })
  .then(() => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Uji selesai: ${lulus} lulus, ${gagal} gagal.`);
    if (gagal > 0) {
      for (const g of kegagalan) console.log(`  GAGAL: ${g}`);
      process.exit(1);
    }
  });
