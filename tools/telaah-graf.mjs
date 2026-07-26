/**
 * Telaah hasil pengubahan OSM menjadi graf, sebelum dipakai membangun
 * berkas emplasemen. Menjawab pertanyaan yang menentukan rancangan:
 * berapa ruas per nomor jalur, seberapa tajam simpangan kaki belok wesel,
 * dan apakah ada bagian graf yang terputus.
 *
 *   node tools/telaah-graf.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bangunGraf, tetapkanKakiWesel, pasangkanPersilangan } from './osm-ke-graf.mjs';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Koordinat simpul stasiun, dibaca dari laporan penarikan OSM, beserta
 * jari-jari pemotongan emplasemen.
 *
 * Manggarai memakai jari-jari lebih besar dengan alasan yang harus dicatat:
 * dek layangnya TIDAK tersambung ke lantai dasar di dalam emplasemen, dan
 * jalan ramp yang menghubungkannya ke lintas berada di luar 700 m. Dengan
 * jari-jari 700 m dek layang terputus menjadi serpihan dan jalur 9-12 hilang;
 * pada 900 m keduabelas jalur terbaca utuh. Sementara itu 900 m masih di bawah
 * 1.038 m, yaitu jarak jalur bernomor milik Stasiun Matraman yang tidak boleh
 * ikut terbawa.
 */
export const PUSAT = {
  MRI: { lat: -6.2101704, lon: 106.849935, radius: 900 },
  KYA: { lat: -7.6299479, lon: 109.2540488, radius: 700 },
  SLO: { lat: -7.5561, lon: 110.8213, radius: 800 },
  JNG: { lat: -6.2149, lon: 106.8703, radius: 700 },
  LPN: { lat: -7.7896, lon: 110.3733, radius: 700 },
  BD: { lat: -6.9147, lon: 107.6021, radius: 800 },
};

for (const [kode, pusat] of Object.entries(PUSAT)) {
  const berkas = resolve(AKAR, 'tools/sumber/osm', `${kode}.json`);
  if (!existsSync(berkas)) {
    console.log(`${kode}: berkas OSM belum ada`);
    continue;
  }
  const data = JSON.parse(readFileSync(berkas, 'utf8'));
  const graf = bangunGraf(data, { pusat, radius: pusat.radius });
  const t = graf.telaah;

  console.log(`\n=== ${kode} ===`);
  console.log(
    `  simpul=${t.jumlahSimpul} ruas=${t.jumlahRuas} putar=${graf.sudutPutar.toFixed(1)}°`,
  );
  console.log(
    `  jenis simpul: ${Object.entries(t.perJenis)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')}`,
  );
  console.log(
    `  ruas per nomor jalur: ${
      Object.keys(t.ruasPerNomorJalur).length
        ? Object.entries(t.ruasPerNomorJalur)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
        : '(tidak ada)'
    }`,
  );
  console.log(
    `  panjang ruas ${t.panjangRuasTerpendek}-${t.panjangRuasTerpanjang} m, simpul >4 kaki=${t.simpulDerajatLebihDariEmpat}`,
  );

  // Bentang gambar setelah diputar.
  const xs = graf.ruas.flatMap((r) => r.titik.map((p) => p.x));
  const ys = graf.ruas.flatMap((r) => r.titik.map((p) => p.y));
  console.log(
    `  bentang: x ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))} m, ` +
      `y ${Math.round(Math.min(...ys))}..${Math.round(Math.max(...ys))} m`,
  );

  // Telaah wesel: seberapa masuk akal penetapan kaki lurus/belok.
  const ruasDi = new Map();
  for (const r of graf.ruas) {
    for (const s of [r.dari, r.ke]) {
      if (!ruasDi.has(s)) ruasDi.set(s, []);
      ruasDi.get(s).push(r);
    }
  }
  const simpangan = [];
  let weselGagal = 0;
  for (const s of graf.simpul.filter((x) => x.jenis === 'WESEL')) {
    const kaki = tetapkanKakiWesel(s, ruasDi.get(s.id) ?? []);
    if (!kaki) {
      weselGagal += 1;
      continue;
    }
    simpangan.push(kaki.simpanganBelokDerajat);
  }
  simpangan.sort((a, b) => a - b);
  const tengah = simpangan[Math.floor(simpangan.length / 2)] ?? 0;
  console.log(
    `  wesel: ${simpangan.length} tertetapkan, ${weselGagal} gagal; ` +
      `simpangan kaki belok ${simpangan[0] ?? 0}°..${simpangan[simpangan.length - 1] ?? 0}° (tengah ${tengah}°)`,
  );

  const silang = graf.simpul.filter((x) => x.jenis === 'SILANG');
  if (silang.length) {
    const p = silang.map((s) => pasangkanPersilangan(s, ruasDi.get(s.id) ?? []).length);
    console.log(`  persilangan: ${silang.length} simpul, pasangan per simpul ${p.join(',')}`);
  }

  // Keterhubungan: apakah seluruh ruas satu kesatuan?
  const tetangga = new Map();
  for (const r of graf.ruas) {
    for (const [a, b] of [
      [r.dari, r.ke],
      [r.ke, r.dari],
    ]) {
      if (!tetangga.has(a)) tetangga.set(a, new Set());
      tetangga.get(a).add(b);
    }
  }
  const terlihat = new Set();
  const gugus = [];
  for (const awal of tetangga.keys()) {
    if (terlihat.has(awal)) continue;
    const antre = [awal];
    terlihat.add(awal);
    let n = 0;
    while (antre.length) {
      const k = antre.pop();
      n += 1;
      for (const t of tetangga.get(k) ?? []) {
        if (!terlihat.has(t)) {
          terlihat.add(t);
          antre.push(t);
        }
      }
    }
    gugus.push(n);
  }
  gugus.sort((a, b) => b - a);
  console.log(`  gugus terhubung: ${gugus.length} (terbesar ${gugus[0]} simpul) ${gugus.slice(0, 6).join(',')}`);
}
