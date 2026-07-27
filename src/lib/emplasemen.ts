import type {
  Emplasemen,
  KedudukanWesel,
  Level,
  Persilangan,
  Ruas,
  Simpul,
  Wesel,
} from './tipe';

/**
 * Pengindeksan topologi emplasemen dan pembentukan rute.
 *
 * Emplasemen dimodelkan sebagai graf: simpul = titik sambung/wesel/batas,
 * ruas = potongan sepur di antaranya. Rute dicari dengan penelusuran lebar
 * (BFS) yang tunduk pada kekangan wesel: dari kaki pangkal hanya boleh menuju
 * kaki lurus atau kaki belok, dan sebaliknya — persis seperti kekangan fisik
 * lidah wesel.
 */

export interface IndeksEmplasemen {
  data: Emplasemen;
  simpul: Map<string, Simpul>;
  ruas: Map<string, Ruas>;
  wesel: Map<string, Wesel>;
  /** Wesel berdasarkan simpul tempatnya berada. */
  weselDiSimpul: Map<string, Wesel>;
  /** Persilangan sebidang berdasarkan simpul tempatnya berada. */
  persilanganDiSimpul: Map<string, Persilangan>;
  /** Daftar id ruas yang bersinggungan pada tiap simpul. */
  ruasDiSimpul: Map<string, string[]>;
  /** Ruas badan sepur berdasarkan id sepur. */
  ruasSepur: Map<string, string>;
  /** Sinyal berdasarkan ruas yang dilindunginya. */
  sinyalPelindung: Map<string, string>;
  /** Daftar ruas per blok. */
  ruasPerBlok: Map<string, string[]>;
}

export function indeksEmplasemen(data: Emplasemen): IndeksEmplasemen {
  const simpul = new Map(data.simpul.map((s) => [s.id, s]));
  const ruas = new Map(data.ruas.map((r) => [r.id, r]));
  const wesel = new Map(data.wesel.map((w) => [w.id, w]));

  const weselDiSimpul = new Map<string, Wesel>();
  for (const w of data.wesel) weselDiSimpul.set(w.simpulId, w);

  const persilanganDiSimpul = new Map<string, Persilangan>();
  for (const p of data.persilangan ?? []) persilanganDiSimpul.set(p.simpulId, p);

  const ruasDiSimpul = new Map<string, string[]>();
  const daftar = (id: string) => {
    let arr = ruasDiSimpul.get(id);
    if (!arr) {
      arr = [];
      ruasDiSimpul.set(id, arr);
    }
    return arr;
  };
  for (const r of data.ruas) {
    daftar(r.dari).push(r.id);
    daftar(r.ke).push(r.id);
  }

  const ruasSepur = new Map<string, string>();
  for (const s of data.sepur) ruasSepur.set(s.id, s.ruasId);

  const sinyalPelindung = new Map<string, string>();
  for (const s of data.sinyal) sinyalPelindung.set(s.ruasDilindungi, s.id);

  const ruasPerBlok = new Map<string, string[]>();
  for (const r of data.ruas) {
    let arr = ruasPerBlok.get(r.blokId);
    if (!arr) {
      arr = [];
      ruasPerBlok.set(r.blokId, arr);
    }
    arr.push(r.id);
  }

  return {
    data,
    simpul,
    ruas,
    wesel,
    weselDiSimpul,
    persilanganDiSimpul,
    ruasDiSimpul,
    ruasSepur,
    sinyalPelindung,
    ruasPerBlok,
  };
}

/** Simpul lain dari sebuah ruas. */
export function simpulSeberang(r: Ruas, simpulId: string): string {
  return r.dari === simpulId ? r.ke : r.dari;
}

/**
 * Apakah perpindahan dari `ruasMasuk` ke `ruasKeluar` melewati `simpulId`
 * diperbolehkan secara fisik, dan bila melalui wesel, kedudukan apa yang dituntut.
 */
function transisiSah(
  ix: IndeksEmplasemen,
  simpulId: string,
  ruasMasukId: string,
  ruasKeluarId: string,
): { sah: boolean; wesel?: { weselId: string; kedudukan: KedudukanWesel } } {
  // Persilangan sebidang: sarana hanya boleh berjalan lurus terus pada
  // pasangan kakinya sendiri; berpindah ke sepur yang bersilangan mustahil.
  const silang = ix.persilanganDiSimpul.get(simpulId);
  if (silang) {
    const sepasang = silang.pasangan.some(
      ([a, b]) =>
        (a === ruasMasukId && b === ruasKeluarId) ||
        (b === ruasMasukId && a === ruasKeluarId),
    );
    return { sah: sepasang };
  }

  const w = ix.weselDiSimpul.get(simpulId);
  if (!w) {
    // Sambungan biasa: hanya boleh bila memang tepat dua ruas bertemu.
    return { sah: true };
  }
  if (ruasMasukId === w.ruasPangkal) {
    if (ruasKeluarId === w.ruasLurus)
      return { sah: true, wesel: { weselId: w.id, kedudukan: 'LURUS' } };
    if (ruasKeluarId === w.ruasBelok)
      return { sah: true, wesel: { weselId: w.id, kedudukan: 'BELOK' } };
    return { sah: false };
  }
  if (ruasMasukId === w.ruasLurus && ruasKeluarId === w.ruasPangkal)
    return { sah: true, wesel: { weselId: w.id, kedudukan: 'LURUS' } };
  if (ruasMasukId === w.ruasBelok && ruasKeluarId === w.ruasPangkal)
    return { sah: true, wesel: { weselId: w.id, kedudukan: 'BELOK' } };
  return { sah: false };
}

export interface HasilRute {
  ruasIds: string[];
  kedudukanWesel: Array<{ weselId: string; kedudukan: KedudukanWesel }>;
  panjangM: number;
  blokIds: string[];
}

interface Simpai {
  ruasId: string;
  /** Simpul tempat rute keluar dari ruas ini (arah maju). */
  simpulDepan: string;
  jalur: string[];
  wesel: Array<{ weselId: string; kedudukan: KedudukanWesel }>;
}

/**
 * Cari rute dari ruas awal (ruas yang dilindungi sinyal) menuju ruas sasaran.
 *
 * `simpulAwal` adalah simpul di belakang ruas awal — yaitu kaki tempat kereta
 * memasuki ruas tersebut, sehingga arah maju dapat ditentukan.
 */
export function cariRute(
  ix: IndeksEmplasemen,
  ruasAwalId: string,
  simpulAwal: string,
  ruasSasaranId: string,
  opsi: { hindariRuas?: Set<string>; izinkanLewatSepurPeron?: boolean } = {},
): HasilRute | null {
  const ruasAwal = ix.ruas.get(ruasAwalId);
  if (!ruasAwal) return null;
  const hindari = opsi.hindariRuas ?? new Set<string>();
  if (hindari.has(ruasAwalId)) return null;

  if (ruasAwalId === ruasSasaranId) {
    return {
      ruasIds: [ruasAwalId],
      kedudukanWesel: [],
      panjangM: ruasAwal.panjangM,
      blokIds: [ruasAwal.blokId],
    };
  }

  const awal: Simpai = {
    ruasId: ruasAwalId,
    simpulDepan: simpulSeberang(ruasAwal, simpulAwal),
    jalur: [ruasAwalId],
    wesel: [],
  };

  const antre: Simpai[] = [awal];
  const dikunjungi = new Set<string>([`${ruasAwalId}|${awal.simpulDepan}`]);

  while (antre.length > 0) {
    const kini = antre.shift() as Simpai;
    const tetangga = ix.ruasDiSimpul.get(kini.simpulDepan) ?? [];

    for (const berikutId of tetangga) {
      if (berikutId === kini.ruasId) continue;
      if (hindari.has(berikutId)) continue;
      if (kini.jalur.includes(berikutId)) continue;

      const berikut = ix.ruas.get(berikutId);
      if (!berikut) continue;

      const t = transisiSah(ix, kini.simpulDepan, kini.ruasId, berikutId);
      if (!t.sah) continue;

      // Wesel yang sudah dituntut rute ini tidak boleh diminta kedudukan lain.
      if (t.wesel) {
        const bentrok = kini.wesel.find(
          (w) => w.weselId === t.wesel?.weselId && w.kedudukan !== t.wesel.kedudukan,
        );
        if (bentrok) continue;
      }

      const jalurBaru = [...kini.jalur, berikutId];
      const weselBaru = t.wesel ? [...kini.wesel, t.wesel] : kini.wesel;

      if (berikutId === ruasSasaranId) {
        const ruasIds = jalurBaru;
        return {
          ruasIds,
          kedudukanWesel: ringkasWesel(weselBaru),
          panjangM: ruasIds.reduce(
            (n, id) => n + (ix.ruas.get(id)?.panjangM ?? 0),
            0,
          ),
          blokIds: [
            ...new Set(ruasIds.map((id) => ix.ruas.get(id)?.blokId ?? '')),
          ].filter(Boolean),
        };
      }

      // Rute tidak boleh menembus sepur berperon lain.
      if (
        berikut.jenis === 'SEPUR_PERON' &&
        !opsi.izinkanLewatSepurPeron
      ) {
        continue;
      }

      const depan = simpulSeberang(berikut, kini.simpulDepan);
      const kunci = `${berikutId}|${depan}`;
      if (dikunjungi.has(kunci)) continue;
      dikunjungi.add(kunci);

      antre.push({
        ruasId: berikutId,
        simpulDepan: depan,
        jalur: jalurBaru,
        wesel: weselBaru,
      });
    }
  }

  return null;
}

function ringkasWesel(
  daftar: Array<{ weselId: string; kedudukan: KedudukanWesel }>,
): Array<{ weselId: string; kedudukan: KedudukanWesel }> {
  const peta = new Map<string, KedudukanWesel>();
  for (const w of daftar) peta.set(w.weselId, w.kedudukan);
  return [...peta.entries()].map(([weselId, kedudukan]) => ({
    weselId,
    kedudukan,
  }));
}

/* ------------------------------------------------------------------ */
/* Geometri gambar                                                     */
/* ------------------------------------------------------------------ */

/**
 * Cara papan digambar.
 *
 * `DENAH` adalah diagram jalur seperti papan pelayanan sungguhan: kedudukan
 * melintang dipetakan menjadi lajur berjarak tetap supaya terbaca. `OSM`
 * memakai geometri survei apa adanya dengan skala seragam pada kedua sumbu,
 * sehingga sudut wesel dan kelengkungan lintas tampak sebenarnya. Topologinya
 * sama persis — yang berbeda hanya koordinatnya.
 */
export type ModeGambar = 'DENAH' | 'OSM';

/** Rangkaian titik gambar sebuah ruas, dari `dari` menuju `ke`. */
export function titikRuas(
  ix: IndeksEmplasemen,
  ruasId: string,
  gaya: ModeGambar = 'DENAH',
): Array<{ x: number; y: number }> {
  const r = ix.ruas.get(ruasId);
  if (!r) return [];
  if (gaya === 'OSM' && r.jalanOsm && r.jalanOsm.length >= 2) return r.jalanOsm;
  const a = ix.simpul.get(r.dari);
  const b = ix.simpul.get(r.ke);
  if (!a || !b) return [];
  if (gaya === 'OSM') {
    // Emplasemen tanpa geometri survei tetap dapat digambar; bentuknya sama
    // dengan denah, bukan garis kosong.
    const ao = a.osm ?? a;
    const bo = b.osm ?? b;
    return [
      { x: ao.x, y: ao.y },
      { x: bo.x, y: bo.y },
    ];
  }
  return [
    { x: a.x, y: a.y },
    ...(r.titikBelok ?? []),
    { x: b.x, y: b.y },
  ];
}

/** Jalur SVG sebuah ruas. Ruas dengan titik belok digambar bersudut tegas. */
export function jalurSvgRuas(
  ix: IndeksEmplasemen,
  ruasId: string,
  gaya: ModeGambar = 'DENAH',
): string {
  const titik = titikRuas(ix, ruasId, gaya);
  if (titik.length === 0) return '';
  const [awal, ...sisa] = titik;
  if (!awal) return '';
  return (
    `M ${bulat(awal.x)} ${bulat(awal.y)} ` +
    sisa.map((t) => `L ${bulat(t.x)} ${bulat(t.y)}`).join(' ')
  );
}

/** Panjang gambar (satuan kanvas) sebuah ruas. */
export function panjangGambarRuas(
  ix: IndeksEmplasemen,
  ruasId: string,
  gaya: ModeGambar = 'DENAH',
): number {
  const titik = titikRuas(ix, ruasId, gaya);
  let n = 0;
  for (let i = 1; i < titik.length; i += 1) {
    const p = titik[i - 1];
    const q = titik[i];
    if (!p || !q) continue;
    n += Math.hypot(q.x - p.x, q.y - p.y);
  }
  return n;
}

/**
 * Titik pada ruas untuk kemajuan 0..1, dihitung dari simpul `dariSimpul`.
 * Dipakai untuk menempatkan penanda sarana pada papan.
 */
export function titikPadaRuas(
  ix: IndeksEmplasemen,
  ruasId: string,
  kemajuan: number,
  dariSimpul?: string,
  gaya: ModeGambar = 'DENAH',
): { x: number; y: number; sudut: number } {
  let titik = titikRuas(ix, ruasId, gaya);
  const r = ix.ruas.get(ruasId);
  if (r && dariSimpul && dariSimpul === r.ke) titik = [...titik].reverse();
  if (titik.length < 2) {
    const t = titik[0] ?? { x: 0, y: 0 };
    return { x: t.x, y: t.y, sudut: 0 };
  }

  const total = titik.reduce((n, t, i) => {
    if (i === 0) return 0;
    const p = titik[i - 1];
    return p ? n + Math.hypot(t.x - p.x, t.y - p.y) : n;
  }, 0);

  let sisa = Math.max(0, Math.min(1, kemajuan)) * total;
  for (let i = 1; i < titik.length; i += 1) {
    const p = titik[i - 1];
    const q = titik[i];
    if (!p || !q) continue;
    const l = Math.hypot(q.x - p.x, q.y - p.y);
    if (sisa <= l || i === titik.length - 1) {
      const f = l === 0 ? 0 : sisa / l;
      return {
        x: p.x + (q.x - p.x) * f,
        y: p.y + (q.y - p.y) * f,
        sudut: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI,
      };
    }
    sisa -= l;
  }
  const t = titik[titik.length - 1] ?? { x: 0, y: 0 };
  return { x: t.x, y: t.y, sudut: 0 };
}

function bulat(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sepurPadaLevel(data: Emplasemen, level: Level) {
  return data.sepur.filter((s) => s.level === level);
}
