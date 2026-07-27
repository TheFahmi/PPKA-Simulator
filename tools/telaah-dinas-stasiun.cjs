/**
 * Telaah mengapa sebagian perjalanan tidak terberangkatkan pada dinas
 * stasiun tertentu. Bukan uji; alat bantu diagnosis.
 *
 *   node tools/telaah-dinas-stasiun.cjs KYA SLO JNG LPN BD
 */

const { readFileSync } = require('node:fs');
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
const { buatKeadaanAwal, majuSatuDetik, ruasBatas } = require('../.uji/src/lib/simulasi.js');
const { jalankanOtomatis } = require('../.uji/src/lib/otomatis.js');
const { perjalananDinas } = require('../.uji/src/lib/muat-data.js');

const baca = (p) => JSON.parse(readFileSync(resolve(AKAR, p), 'utf8'));

for (const kode of process.argv.slice(2)) {
  const empl = baca(`data/stasiun/${kode}/emplasemen.json`);
  const jadwal = baca(`data/stasiun/${kode}/jadwal.json`);
  const ix = indeksEmplasemen(empl);

  console.log(`\n=== ${kode} — ${empl.namaStasiun} ===`);

  // Berapa sepur lazim per lintas keluar, dan berapa yang benar-benar tembus.
  const perBatasKeluar = new Map();
  for (const t of jadwal.perjalanan) {
    if (!perBatasKeluar.has(t.batasKeluarId)) perBatasKeluar.set(t.batasKeluarId, new Set());
    for (const sp of t.sepurLazim) perBatasKeluar.get(t.batasKeluarId).add(sp);
  }
  for (const [b, set] of perBatasKeluar) {
    const bt = empl.batas.find((x) => x.id === b);
    const rb = empl.ruas.filter((r) => r.dari === bt.simpulId || r.ke === bt.simpulId);
    const tembus = [...set].filter((spId) => {
      const sp = empl.sepur.find((x) => x.id === spId);
      const rs = empl.ruas.find((r) => r.id === sp.ruasId);
      return rb.some((x) => cariRute(ix, rs.id, rs.dari, x.id) || cariRute(ix, rs.id, rs.ke, x.id));
    });
    console.log(
      `  keluar ${b.padEnd(22)} lazim=${[...set].map((x) => x.split('-').pop()).join(',').padEnd(18)} ` +
        `tembus=${tembus.map((x) => x.split('-').pop()).join(',')}`,
    );
  }

  const kandidat = jadwal.dinas.filter((d) => !/SEHARI/.test(d.id));
  const dinas = kandidat.reduce(
    (a, d) =>
      perjalananDinas(jadwal, d.mulai, d.selesai).length >
      perjalananDinas(jadwal, a.mulai, a.selesai).length
        ? d
        : a,
    kandidat[0],
  );
  const daftar = perjalananDinas(jadwal, dinas.mulai, dinas.selesai);
  const K = buatKeadaanAwal(ix, dinas, daftar);
  K.modeOtomatis = 'PENUH';
  let detik = 0;
  while (!K.dinasSelesai && detik < 20 * 3600) {
    jalankanOtomatis(K, ix);
    majuSatuDetik(K, ix);
    detik += 1;
  }

  const gagal = K.kereta.filter((k) => k.aktualBerangkat === null);
  console.log(`  dinas ${dinas.nama}: ${daftar.length} perjalanan, ${gagal.length} tak berangkat`);
  for (const k of gagal.slice(0, 8)) {
    console.log(
      `    KA ${String(k.nomorKA).padEnd(7)} fase=${String(k.fase).padEnd(18)} ` +
        `sepur=${String(k.sepurId ?? '-').padEnd(12)} lazim=${(k.sepurLazim ?? [])
          .map((x) => x.split('-').pop())
          .join(',')
          .padEnd(14)} keluar=${k.batasKeluarId}`,
    );
  }

  const jenis = {};
  for (const v of K.pelanggaran) jenis[v.jenis] = (jenis[v.jenis] ?? 0) + 1;
  console.log(`  pelanggaran: ${JSON.stringify(jenis)}`);

  // Lama berhenti terjadwal — penyebab lazim antrean peron pada stasiun kecil.
  const dwell = daftar.map((t) => {
    const [h, m] = t.jamDatang.split('.').map(Number);
    const [h2, m2] = t.jamBerangkat.split('.').map(Number);
    let d = (h2 * 60 + m2) - (h * 60 + m);
    if (d < 0) d += 1440;
    return d;
  });
  dwell.sort((a, b) => a - b);
  console.log(
    `  lama berhenti terjadwal (menit): min=${dwell[0]} tengah=${dwell[Math.floor(dwell.length / 2)]} ` +
      `maks=${dwell[dwell.length - 1]} · >15 menit: ${dwell.filter((d) => d > 15).length}/${dwell.length}`,
  );
}
