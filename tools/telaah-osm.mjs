/**
 * Telaah bentuk graf sepur pada berkas Overpass sebelum dikonversi.
 *
 *   node tools/telaah-osm.mjs
 *
 * Tujuannya menjawab pertanyaan yang menentukan rancangan pengonversi:
 * berapa simpul berderajat tiga (wesel biasa), berapa berderajat empat atau
 * lebih (persilangan/wesel inggris yang TIDAK dapat diwakili model tiga kaki),
 * dan seberapa jauh emplasemen membentang.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KODE = ['MRI', 'KYA', 'SLO', 'JNG', 'LPN', 'BD'];

/** Jarak kasar dalam meter antara dua titik lintang-bujur. */
function jarakM(a, b) {
  const dx = (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (b.lat - a.lat) * 110540;
  return Math.hypot(dx, dy);
}

for (const kode of KODE) {
  const berkas = resolve(AKAR, 'tools/sumber/osm', `${kode}.json`);
  if (!existsSync(berkas)) {
    console.log(`${kode}: berkas belum ada`);
    continue;
  }
  const data = JSON.parse(readFileSync(berkas, 'utf8'));
  const el = data.elements ?? [];

  const stasiun = el.find(
    (e) => e.type === 'node' && e.tags && e.tags.railway === 'station',
  );
  const pusat = stasiun
    ? { lat: stasiun.lat, lon: stasiun.lon }
    : { lat: 0, lon: 0 };

  const rel = el.filter(
    (e) =>
      e.type === 'way' &&
      e.tags &&
      ['rail', 'light_rail', 'narrow_gauge'].includes(e.tags.railway) &&
      Array.isArray(e.nodes) &&
      Array.isArray(e.geometry) &&
      e.nodes.length === e.geometry.length,
  );

  const wesel = new Set(
    el.filter((e) => e.type === 'node' && e.tags?.railway === 'switch').map((e) => e.id),
  );
  const penghalang = new Set(
    el.filter((e) => e.type === 'node' && e.tags?.railway === 'buffer_stop').map((e) => e.id),
  );

  // Titik tiap simpul, dan berapa kali dipakai sebagai verteks.
  const titik = new Map();
  const pakai = new Map();
  for (const w of rel) {
    w.nodes.forEach((id, i) => {
      if (!titik.has(id)) titik.set(id, w.geometry[i]);
      pakai.set(id, (pakai.get(id) ?? 0) + 1);
    });
  }

  // Derajat = banyaknya potongan ruas yang bersinggungan di simpul itu.
  const derajat = new Map();
  for (const w of rel) {
    w.nodes.forEach((id, i) => {
      const ujung = i === 0 || i === w.nodes.length - 1;
      derajat.set(id, (derajat.get(id) ?? 0) + (ujung ? 1 : 2));
    });
  }

  const sebaran = {};
  for (const [, d] of derajat) sebaran[d] = (sebaran[d] ?? 0) + 1;

  const tigaKaki = [...derajat].filter(([, d]) => d === 3);
  const empatKaki = [...derajat].filter(([, d]) => d >= 4);
  const tigaKakiWesel = tigaKaki.filter(([id]) => wesel.has(id)).length;
  const empatKakiWesel = empatKaki.filter(([id]) => wesel.has(id)).length;

  // Wesel yang derajatnya bukan 3 — perlu penanganan khusus.
  const weselGanjil = [...wesel].filter((id) => (derajat.get(id) ?? 0) !== 3);

  // Bentangan emplasemen di sekitar pusat.
  const jarak = [...titik.values()].map((t) => jarakM(pusat, t));
  const dalam = (r) => jarak.filter((j) => j <= r).length;

  const layer = {};
  for (const w of rel) {
    const l = w.tags.layer ?? w.tags.level ?? '-';
    layer[l] = (layer[l] ?? 0) + 1;
  }

  console.log(
    `\n=== ${kode} ${stasiun?.tags?.name ?? '(simpul stasiun tidak ada)'} ===`,
  );
  console.log(`  way rel=${rel.length}  simpul=${titik.size}  wesel(tag)=${wesel.size}  penghalang=${penghalang.size}`);
  console.log(
    `  derajat: ${Object.entries(sebaran)
      .sort((a, b) => a[0] - b[0])
      .map(([d, n]) => `${d}→${n}`)
      .join('  ')}`,
  );
  console.log(
    `  simpul 3 kaki=${tigaKaki.length} (bertag wesel ${tigaKakiWesel})  ` +
      `simpul >=4 kaki=${empatKaki.length} (bertag wesel ${empatKakiWesel})`,
  );
  console.log(`  wesel bertag tapi derajatnya bukan 3: ${weselGanjil.length}`);
  console.log(
    `  titik dalam radius: 300m=${dalam(300)}  600m=${dalam(600)}  1000m=${dalam(1000)}  semua=${jarak.length}`,
  );
  console.log(`  layer/level: ${JSON.stringify(layer)}`);
}
