/**
 * Pembangkit data/stasiun/daftar.json — ringkasan tiap stasiun untuk halaman
 * pemilihan dinas.
 *
 *   node tools/bangun-daftar-stasiun.mjs
 *
 * Seluruh angka pada berkas ini DIHITUNG dari berkas emplasemen dan jadwal
 * yang sudah jadi, tidak ditulis tangan, supaya keterangan pada layar
 * pemilihan tidak pernah berbeda dengan data yang benar-benar dimuat.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STASIUN, DIBANGUN } from './stasiun-config.mjs';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baca = (p) => JSON.parse(readFileSync(resolve(AKAR, p), 'utf8'));

/**
 * Peringkat kepadatan dinas, dihitung dari perjalanan per jam tersibuk —
 * bukan penilaian selera. Ambangnya ditulis di sini supaya dapat ditelusuri.
 */
function tingkatKesulitan(perjalanan, jumlahSepur, jumlahLintas) {
  const perJam = new Map();
  for (const p of perjalanan) {
    const j = p.jamDatang.slice(0, 2);
    perJam.set(j, (perJam.get(j) ?? 0) + 1);
  }
  const puncak = Math.max(0, ...perJam.values());
  // Percabangan menambah beban karena rute keluar ikut menentukan lintas.
  const bobot = puncak + (jumlahLintas - 2) * 4 - Math.max(0, jumlahSepur - 8) * 1.5;
  if (bobot >= 34) return { tingkat: 'BERAT', puncakPerJam: puncak };
  if (bobot >= 20) return { tingkat: 'PADAT', puncakPerJam: puncak };
  if (bobot >= 12) return { tingkat: 'MENENGAH', puncakPerJam: puncak };
  return { tingkat: 'DASAR', puncakPerJam: puncak };
}

function ringkas(kode, empl, jadwal, sumberDenah) {
  const cfg = STASIUN[kode];
  const lintas = new Set(
    empl.batas.filter((b) => b.singkatan !== 'AKSES').map((b) => b.singkatan),
  );
  const sepurPeron = empl.sepur.filter((s) => s.peronId !== null);
  const level = new Set(empl.sepur.map((s) => s.level));
  const keandalan = {};
  for (const p of jadwal.perjalanan) {
    keandalan[p.keandalanData] = (keandalan[p.keandalanData] ?? 0) + 1;
  }
  const { tingkat, puncakPerJam } = tingkatKesulitan(
    jadwal.perjalanan,
    empl.sepur.length,
    lintas.size,
  );

  return {
    kode,
    nama: cfg.nama,
    daop: cfg.daop,
    keterangan: cfg.keterangan,
    ciri: cfg.ciri,
    jumlahSepur: empl.sepur.length,
    jumlahSepurPeron: sepurPeron.length,
    jumlahWesel: empl.wesel.length,
    jumlahLintas: lintas.size,
    lintas: [...lintas].sort(),
    bertingkat: level.size > 1,
    jumlahPerjalanan: jadwal.perjalanan.length,
    puncakPerJam,
    tingkatKesulitan: tingkat,
    jumlahDinas: jadwal.dinas.length,
    sumberDenah,
    // Tampilan "rel OSM" hanya tersedia bila denahnya memang berasal dari
    // geometri survei; denah rakitan dokumen tidak punya bentuk sebenarnya.
    punyaTampilanOsm: sumberDenah === 'SURVEI_OSM',
    keandalanJadwal: keandalan,
    gapeka: jadwal.gapeka,
  };
}

const stasiun = [];

// Manggarai memakai berkas rakitan dokumen tata letak resmi, bukan hasil OSM;
// alasannya tercatat pada tools/stasiun-config.mjs.
stasiun.push(
  ringkas(
    'MRI',
    baca('data/emplasemen-manggarai.json'),
    baca('data/jadwal-manggarai.json'),
    'DOKUMEN_RESMI',
  ),
);

for (const kode of DIBANGUN) {
  const e = `data/stasiun/${kode}/emplasemen.json`;
  const j = `data/stasiun/${kode}/jadwal.json`;
  if (!existsSync(resolve(AKAR, e)) || !existsSync(resolve(AKAR, j))) {
    console.error(`${kode}: berkas belum lengkap, dilewati`);
    continue;
  }
  stasiun.push(ringkas(kode, baca(e), baca(j), 'SURVEI_OSM'));
}

const keluaran = {
  versi: '1.0.0',
  catatan:
    'Seluruh angka pada berkas ini dihitung ulang dari berkas emplasemen dan jadwal masing-masing stasiun oleh tools/bangun-daftar-stasiun.mjs. Jangan disunting tangan.',
  stasiun,
};

writeFileSync(
  resolve(AKAR, 'data/stasiun/daftar.json'),
  `${JSON.stringify(keluaran, null, 2)}\n`,
  'utf8',
);

for (const s of stasiun) {
  console.log(
    `${s.kode.padEnd(4)} ${s.nama.padEnd(14)} sepur=${String(s.jumlahSepur).padStart(2)} ` +
      `lintas=${s.jumlahLintas} perjalanan=${String(s.jumlahPerjalanan).padStart(3)} ` +
      `puncak=${String(s.puncakPerJam).padStart(2)}/jam ${s.tingkatKesulitan.padEnd(9)} ` +
      `denah=${s.sumberDenah}`,
  );
}
