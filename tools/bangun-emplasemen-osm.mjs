/**
 * Pembangkit data/stasiun/<KODE>/emplasemen.json dari geometri OpenStreetMap.
 *
 *   node tools/bangun-emplasemen-osm.mjs [KODE ...]
 *
 * YANG BERASAL DARI SURVEI (OpenStreetMap/OpenRailwayMap):
 *   - kedudukan tiap sepur dan bentuk lengkungnya
 *   - letak tiap wesel, dan kaki mana yang pangkal, lurus, dan belok
 *   - persilangan sebidang
 *   - penomoran jalur (railway:track_ref)
 *   - letak dan panjang peron
 *
 * YANG DISUSUN SENDIRI, BUKAN DARI SURVEI — ditandai pada berkas keluaran:
 *   - penomoran wesel (OSM tidak memuat ref/name pada satu pun wesel)
 *   - letak dan penamaan sinyal (OSM hampir tidak memuat railway=signal)
 *   - pembagian blok deteksi sarana
 *   - penetapan batas mana yang arah masuk dan mana yang arah keluar
 *
 * CARA MENGGAMBAR. Diagram jalur bukan peta berskala. Kedudukan memanjang
 * dipakai apa adanya, tetapi kedudukan melintang dipetakan menjadi lajur
 * berjarak tetap lewat pemetaan monoton — persis cara papan pelayanan
 * sungguhan digambar. Urutan sepur dan seluruh topologinya tetap sama dengan
 * hasil survei; yang berubah hanya renggang antar-sepur supaya terbaca.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bangunGraf, tetapkanKakiWesel, pasangkanPersilangan } from './osm-ke-graf.mjs';
import { STASIUN } from './stasiun-config.mjs';

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Renggang antar-lajur sepur pada gambar (satuan kanvas). */
const RENGGANG = 52;
/** Lebar kanvas yang disasar. */
const LEBAR_KANVAS = 1700;
/** Sisa ruang mendatar di kedua tepi. */
const TEPI_X = 90;

/* ------------------------------------------------------------------ */
/* Pemetaan melintang: kedudukan nyata menjadi lajur berjarak tetap     */
/* ------------------------------------------------------------------ */

/**
 * Susun pemetaan monoton dari kedudukan melintang nyata (meter) ke kedudukan
 * gambar (satuan kanvas), berdasarkan penampang emplasemen di sekitar pusat.
 * Sepur yang berdekatan di lapangan tetap berdekatan di gambar dan urutannya
 * tidak pernah tertukar.
 */
function petaLajur(ruas, level) {
  /*
   * Lajur disusun dari PENAMPANG MELINTANG emplasemen, bukan dari titik tengah
   * tiap ruas. Mencuplik titik tengah keliru: sepur leher yang sedang memencar
   * punya titik tengah pada kedudukan melintang yang berbeda-beda, sehingga
   * masing-masing membentuk lajur palsu dan kanvas membengkak berlipat-lipat.
   * Penampang pada satu kedudukan memanjang hanya memuat sepur yang benar-benar
   * berdampingan di situ.
   */
  const milik = ruas.filter((r) => r.level === level);
  const contoh = [];
  const potong = [0, -120, 120, -240, 240];
  for (const x0 of potong) {
    const pada = [];
    for (const r of milik) {
      for (let i = 1; i < r.titik.length; i += 1) {
        const a = r.titik[i - 1];
        const b = r.titik[i];
        if ((a.x - x0) * (b.x - x0) > 0) continue;
        const f = b.x === a.x ? 0 : (x0 - a.x) / (b.x - a.x);
        pada.push(a.y + f * (b.y - a.y));
        break;
      }
    }
    if (pada.length > contoh.length) contoh.length = 0, contoh.push(...pada);
  }
  if (contoh.length === 0) {
    for (const r of milik) contoh.push(r.titik[Math.floor(r.titik.length / 2)].y);
  }
  contoh.sort((a, b) => a - b);

  // Kelompokkan yang berdekatan (dalam 3,5 m) sebagai satu lajur.
  const lajur = [];
  for (const y of contoh) {
    const akhir = lajur[lajur.length - 1];
    if (akhir && y - akhir.y <= 3.5) {
      akhir.y = (akhir.y * akhir.n + y) / (akhir.n + 1);
      akhir.n += 1;
    } else {
      lajur.push({ y, n: 1 });
    }
  }

  const titikKendali = lajur.map((l, i) => ({ nyata: l.y, gambar: i * RENGGANG }));
  if (titikKendali.length === 0) return () => 0;
  if (titikKendali.length === 1) return () => titikKendali[0].gambar;

  /*
   * Di luar penampang, sepur yang memencar keluar emplasemen dimampatkan
   * secara logaritmik. Tanpa ini satu jalur depo yang menjauh 500 m akan
   * menarik tinggi kanvas menjadi berlipat-lipat, padahal pada papan pelayanan
   * sungguhnya sepur yang meninggalkan emplasemen justru dirapatkan ke tepi.
   * Urutan dan arah simpangannya tetap terjaga.
   */
  const mampat = (jarak) => RENGGANG * Math.log1p(Math.abs(jarak) / 4) * 0.55;

  return (y) => {
    const n = titikKendali.length;
    if (y <= titikKendali[0].nyata) {
      return titikKendali[0].gambar - mampat(titikKendali[0].nyata - y);
    }
    if (y >= titikKendali[n - 1].nyata) {
      return titikKendali[n - 1].gambar + mampat(y - titikKendali[n - 1].nyata);
    }
    for (let i = 1; i < n; i += 1) {
      const a = titikKendali[i - 1];
      const b = titikKendali[i];
      if (y <= b.nyata) {
        const f = (y - a.nyata) / (b.nyata - a.nyata || 1);
        return a.gambar + f * (b.gambar - a.gambar);
      }
    }
    return titikKendali[n - 1].gambar;
  };
}

/* ------------------------------------------------------------------ */

function bangun(kode) {
  const cfg = STASIUN[kode];
  if (!cfg) throw new Error(`Tetapan stasiun ${kode} tidak ada`);

  const berkasOsm = resolve(AKAR, 'tools/sumber/osm', `${kode}.json`);
  if (!existsSync(berkasOsm)) throw new Error(`Berkas OSM ${kode} tidak ada`);
  const graf = bangunGraf(JSON.parse(readFileSync(berkasOsm, 'utf8')), {
    pusat: cfg.pusat,
    radius: cfg.radius,
  });

  // Sumber peruntukan jalur & daftar lintas (hasil penarikan terpisah).
  const berkasStasiun = resolve(AKAR, 'tools/sumber', `${kode}.json`);
  const sumber = existsSync(berkasStasiun)
    ? JSON.parse(readFileSync(berkasStasiun, 'utf8'))
    : null;

  /* -- Lantai tiap ruas ------------------------------------------------ */
  for (const r of graf.ruas) r.level = cfg.level(r.tags ?? {});
  const levelSimpul = new Map();
  for (const r of graf.ruas) {
    levelSimpul.set(r.dari, r.level);
    levelSimpul.set(r.ke, r.level);
  }

  /* -- Skala gambar ---------------------------------------------------- */
  const xs = graf.ruas.flatMap((r) => r.titik.map((p) => p.x));
  const minX = Math.min(...xs);
  const maksX = Math.max(...xs);
  const skalaX = (LEBAR_KANVAS - TEPI_X * 2) / Math.max(1, maksX - minX);

  const tingkat = [...new Set(graf.ruas.map((r) => r.level))];
  const peta = {};
  for (const lv of tingkat) peta[lv] = petaLajur(graf.ruas, lv);

  const kanvasY = {};
  for (const lv of tingkat) {
    const nilai = graf.ruas
      .filter((r) => r.level === lv)
      .flatMap((r) => r.titik.map((p) => peta[lv](p.y)));
    const min = Math.min(...nilai);
    kanvasY[lv] = { geser: 44 - min, tinggi: Math.max(...nilai) - min + 88 };
  }

  const keGambar = (t, level) => ({
    x: Math.round((t.x - minX) * skalaX + TEPI_X),
    y: Math.round(peta[level](t.y) + kanvasY[level].geser),
  });

  /* -- Simpul ---------------------------------------------------------- */
  const simpul = graf.simpul.map((s) => {
    const lv = levelSimpul.get(s.id) ?? 'DASAR';
    const g = keGambar({ x: s.x, y: s.y }, lv);
    return { id: `S${s.id}`, jenis: s.jenis, level: lv, x: g.x, y: g.y };
  });
  const simpulPeta = new Map(simpul.map((s) => [s.id, s]));

  /* -- Ruas ------------------------------------------------------------ */
  const nomorJalurRuas = new Map();
  for (const r of graf.ruas) {
    const ref = r.tags['railway:track_ref'];
    if (ref) nomorJalurRuas.set(r.id, String(ref));
  }

  // Badan sepur bernomor: ruas terpanjang yang membawa nomor jalur itu.
  const badanSepur = new Map();
  for (const [ruasId, nomor] of nomorJalurRuas) {
    const r = graf.ruas.find((x) => x.id === ruasId);
    const ada = badanSepur.get(nomor);
    if (!ada || r.panjangM > ada.panjangM) badanSepur.set(nomor, r);
  }
  const idBadan = new Set([...badanSepur.values()].map((r) => r.id));

  const ruas = graf.ruas.map((r) => {
    const lv = r.level;
    const titik = r.titik.map((t) => keGambar(t, lv));
    const nomor = nomorJalurRuas.get(r.id);
    const badan = idBadan.has(r.id);
    const jenis = badan
      ? 'SEPUR_PERON'
      : r.tags.service
        ? 'SEPUR_EMPLASEMEN'
        : 'PENGHUBUNG';
    return {
      id: `R${r.id.replace(/[^0-9A-Za-z-]/g, '')}`,
      asli: r.id,
      jenis,
      dari: `S${r.dari}`,
      ke: `S${r.ke}`,
      blokId: `BLK-${r.id.replace(/[^0-9A-Za-z-]/g, '')}`,
      panjangM: Math.max(5, r.panjangM),
      ...(badan ? { sepurId: `SP-${kode}-${nomor}` } : {}),
      ...(titik.length > 2 ? { titikBelok: titik.slice(1, -1) } : {}),
      _titik: titik,
      _nomor: nomor,
      _nama: r.tags.name ?? null,
      _level: lv,
    };
  });
  const ruasPeta = new Map(ruas.map((r) => [r.asli, r]));

  /* -- Wesel & persilangan --------------------------------------------- */
  const ruasDiSimpulAsli = new Map();
  for (const r of graf.ruas) {
    for (const s of [r.dari, r.ke]) {
      if (!ruasDiSimpulAsli.has(s)) ruasDiSimpulAsli.set(s, []);
      ruasDiSimpulAsli.get(s).push(r);
    }
  }

  const wesel = [];
  const persilangan = [];
  let nomorWesel = 1;
  for (const s of graf.simpul) {
    const kaki = ruasDiSimpulAsli.get(s.id) ?? [];
    if (s.jenis === 'WESEL') {
      const t = tetapkanKakiWesel(s, kaki);
      if (!t) continue;
      wesel.push({
        id: `W-${kode}-${nomorWesel}`,
        nomor: String(nomorWesel),
        level: levelSimpul.get(s.id) ?? 'DASAR',
        simpulId: `S${s.id}`,
        ruasPangkal: ruasPeta.get(t.pangkal.id).id,
        ruasLurus: ruasPeta.get(t.lurus.id).id,
        ruasBelok: ruasPeta.get(t.belok.id).id,
        kedudukanNormal: 'LURUS',
        waktuBalikDetik: 7,
      });
      nomorWesel += 1;
    } else if (s.jenis === 'SILANG') {
      const pas = pasangkanPersilangan(s, kaki);
      if (pas.length < 2) continue;
      persilangan.push({
        id: `X-${kode}-${persilangan.length + 1}`,
        nama: `Persilangan ${persilangan.length + 1}`,
        level: levelSimpul.get(s.id) ?? 'DASAR',
        simpulId: `S${s.id}`,
        pasangan: pas.map(([a, b]) => [ruasPeta.get(a.id).id, ruasPeta.get(b.id).id]),
      });
    }
  }

  /* -- Blok ------------------------------------------------------------ */
  const blok = ruas.map((r) => ({
    id: r.blokId,
    nama: r._nomor ? `Jalur ${r._nomor}` : (r._nama ?? r.id),
    level: r._level,
    wilayah: 'EMPLASEMEN',
  }));

  return {
    cfg,
    sumber,
    graf,
    simpul,
    simpulPeta,
    ruas,
    ruasPeta,
    wesel,
    persilangan,
    blok,
    badanSepur,
    keGambar,
    kanvasY,
    tingkat,
  };
}

/* ------------------------------------------------------------------ */

const daftar = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(STASIUN);

for (const kode of daftar) {
  try {
    const h = bangun(kode);
    const perLevel = {};
    for (const r of h.ruas) perLevel[r._level] = (perLevel[r._level] ?? 0) + 1;
    console.log(
      `${kode}: simpul=${h.simpul.length} ruas=${h.ruas.length} wesel=${h.wesel.length} ` +
        `silang=${h.persilangan.length} badanSepur=${h.badanSepur.size} ` +
        `level=${JSON.stringify(perLevel)} kanvas=${JSON.stringify(
          Object.fromEntries(
            Object.entries(h.kanvasY).map(([k, v]) => [k, Math.round(v.tinggi)]),
          ),
        )}`,
    );
  } catch (e) {
    console.error(`${kode}: GAGAL — ${e.message}`);
  }
}

export { bangun };
