/**
 * Memeriksa bahwa setiap perjalanan pada data/stasiun/<KODE>/jadwal.json
 * benar-benar dapat dilayani di atas emplasemen stasiun yang bersangkutan,
 * memakai pencari rute yang sama dengan yang dipakai permainan.
 *
 *   npm run uji:stasiun
 *
 * Sebuah perjalanan dinyatakan terlayani bila ada sekurang-kurangnya satu sepur
 * yang dapat dicapai dari batas masuknya DAN dari sepur itu ada rute keluar ke
 * batas keluarnya. Pemeriksaan ini yang menangkap kekeliruan pemetaan arah:
 * batas yang salah hampir selalu berujung pada rute yang tidak terbentuk.
 */

const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const Module = require('node:module');

const AKAR = resolve(__dirname, '..');

const resolveAsli = Module._resolveFilename;
Module._resolveFilename = function (permintaan, ...sisa) {
  if (permintaan.startsWith('@/')) {
    return resolveAsli.call(this, resolve(AKAR, '.uji/src', permintaan.slice(2)), ...sisa);
  }
  return resolveAsli.call(this, permintaan, ...sisa);
};

const { indeksEmplasemen, cariRute } = require('../.uji/src/lib/emplasemen.js');

const KODE = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['KYA', 'SLO', 'JNG', 'LPN', 'BD'];

let gagalTotal = 0;

/** Ruas yang menyentuh simpul sebuah batas. */
function ruasDiBatas(empl, batas) {
  return empl.ruas.filter((r) => r.dari === batas.simpulId || r.ke === batas.simpulId);
}

for (const kode of KODE) {
  const dEmpl = resolve(AKAR, 'data/stasiun', kode, 'emplasemen.json');
  const dJadwal = resolve(AKAR, 'data/stasiun', kode, 'jadwal.json');
  if (!existsSync(dEmpl) || !existsSync(dJadwal)) {
    console.log(`${kode}: berkas belum lengkap, dilewati`);
    continue;
  }
  const empl = JSON.parse(readFileSync(dEmpl, 'utf8'));
  const jadwal = JSON.parse(readFileSync(dJadwal, 'utf8'));
  const ix = indeksEmplasemen(empl);

  // Sepur mana yang terjangkau dari tiap batas, dan dari sepur mana tiap batas
  // dapat dicapai. Dihitung sekali, lalu dipakai ulang untuk semua perjalanan.
  const dariBatas = new Map();
  const keBatas = new Map();

  for (const b of empl.batas) {
    const masuk = new Set();
    const keluar = new Set();
    for (const rb of ruasDiBatas(empl, b)) {
      for (const sp of empl.sepur) {
        const rs = empl.ruas.find((r) => r.id === sp.ruasId);
        if (!rs) continue;
        // cariRute(ix, ruasAwal, simpulAwal, ruasSasaran)
        if (!masuk.has(sp.id) && cariRute(ix, rb.id, b.simpulId, rs.id)) masuk.add(sp.id);
        if (
          !keluar.has(sp.id) &&
          (cariRute(ix, rs.id, rs.dari, rb.id) || cariRute(ix, rs.id, rs.ke, rb.id))
        ) {
          keluar.add(sp.id);
        }
      }
    }
    dariBatas.set(b.id, masuk);
    keBatas.set(b.id, keluar);
  }

  const gagal = [];
  const tanpaLazim = [];
  for (const p of jadwal.perjalanan) {
    const masuk = dariBatas.get(p.batasMasukId) ?? new Set();
    const keluar = keBatas.get(p.batasKeluarId) ?? new Set();
    const tembus = [...masuk].filter((s) => keluar.has(s));
    if (tembus.length === 0) {
      gagal.push(`${p.nomorKA} ${p.batasMasukId} -> ${p.batasKeluarId}`);
      continue;
    }
    if (!p.sepurLazim.some((s) => tembus.includes(s))) {
      tanpaLazim.push(`${p.nomorKA} lazim=[${p.sepurLazim.join(',')}] tembus=[${tembus.join(',')}]`);
    }
  }

  const jam = new Set(jadwal.perjalanan.map((p) => p.jamDatang.slice(0, 2)));
  const tanda = gagal.length === 0 && tanpaLazim.length === 0 ? '✓' : '✗';
  console.log(
    `${kode} ${tanda} perjalanan=${jadwal.perjalanan.length} jam=${jam.size}/24 ` +
      `takTerlayani=${gagal.length} lazimTakTerjangkau=${tanpaLazim.length}`,
  );
  for (const g of gagal.slice(0, 6)) console.log(`    tak terlayani: ${g}`);
  for (const g of tanpaLazim.slice(0, 6)) console.log(`    lazim meleset: ${g}`);
  gagalTotal += gagal.length + tanpaLazim.length;
}

if (gagalTotal > 0) {
  console.error(`\n${gagalTotal} perjalanan bermasalah.`);
  process.exit(1);
}
console.log('\nSeluruh perjalanan terlayani di atas emplasemennya.');
