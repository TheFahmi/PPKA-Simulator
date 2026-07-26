/**
 * Pengubah geometri OpenStreetMap menjadi graf emplasemen.
 *
 * Modul ini TIDAK menulis berkas. Ia hanya mengubah keluaran Overpass menjadi
 * simpul dan ruas berkoordinat papan, lengkap dengan laporan telaah supaya
 * mutunya dapat dinilai sebelum dipakai.
 *
 * Yang dikerjakan:
 *   1. Menyaring way rel di sekitar stasiun (membuang emplasemen tetangga).
 *   2. Memproyeksikan lintang-bujur ke meter, lalu memutar seluruh emplasemen
 *      sehingga sumbu utamanya mendatar — persis cara papan pelayanan digambar.
 *   3. Memecah way menjadi ruas hanya pada titik percabangan sungguhan,
 *      sehingga rantai lurus tetap menjadi satu ruas.
 *   4. Menetapkan kaki pangkal, lurus, dan belok tiap wesel DARI GEOMETRI —
 *      bukan dari tebakan.
 *   5. Menandai simpul berderajat empat sebagai persilangan sebidang.
 */

/** Jari-jari bumi untuk proyeksi lokal. */
const M_PER_DERAJAT_LINTANG = 110540;
const M_PER_DERAJAT_BUJUR = 111320;

export function bacaElemen(data) {
  const el = data.elements ?? [];
  const rel = el.filter(
    (e) =>
      e.type === 'way' &&
      e.tags &&
      ['rail', 'light_rail', 'narrow_gauge'].includes(e.tags.railway) &&
      Array.isArray(e.nodes) &&
      Array.isArray(e.geometry) &&
      e.nodes.length === e.geometry.length,
  );
  const simpulBertag = new Map();
  for (const e of el) {
    if (e.type === 'node' && e.tags) simpulBertag.set(e.id, e.tags);
  }
  const peron = el.filter(
    (e) =>
      e.type === 'way' &&
      e.tags &&
      (e.tags.railway === 'platform' || e.tags.public_transport === 'platform') &&
      Array.isArray(e.geometry),
  );
  return { rel, simpulBertag, peron };
}

/** Proyeksi lintang-bujur ke meter lokal, utara di atas. */
function proyeksi(pusat) {
  const skalaBujur = M_PER_DERAJAT_BUJUR * Math.cos((pusat.lat * Math.PI) / 180);
  return (t) => ({
    x: (t.lon - pusat.lon) * skalaBujur,
    y: -(t.lat - pusat.lat) * M_PER_DERAJAT_LINTANG,
  });
}

/** Sudut sumbu utama sebaran titik (analisis komponen utama sederhana). */
function sudutSumbuUtama(titik) {
  const n = titik.length;
  if (n < 2) return 0;
  const mx = titik.reduce((a, t) => a + t.x, 0) / n;
  const my = titik.reduce((a, t) => a + t.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const t of titik) {
    const dx = t.x - mx;
    const dy = t.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

function putar(t, sudut) {
  const c = Math.cos(sudut);
  const s = Math.sin(sudut);
  return { x: t.x * c - t.y * s, y: t.x * s + t.y * c };
}

/**
 * Bangun graf emplasemen dari keluaran Overpass.
 *
 * @param {object} data      keluaran Overpass apa adanya
 * @param {object} opsi
 * @param {{lat:number,lon:number}} opsi.pusat  koordinat simpul stasiun
 * @param {number} opsi.radius                  jari-jari pemotongan (meter)
 * @param {(tags:object)=>string} [opsi.level]  penentu lantai dari tag way
 * @param {boolean} [opsi.balikSumbuX]          balik arah timur-barat pada gambar
 */
export function bangunGraf(data, opsi) {
  const { rel, simpulBertag, peron } = bacaElemen(data);
  const proyeksikan = proyeksi(opsi.pusat);
  const radius = opsi.radius ?? 600;

  /*
   * -- 1. Saring dan POTONG way pada batas emplasemen --------------------
   * Overpass mengembalikan way secara utuh, sehingga lintas menerus dapat
   * membentang berkilo-kilometer keluar emplasemen. Way dipotong pada verteks
   * terakhir yang masih di dalam jari-jari, supaya papan hanya memuat wilayah
   * pengaturan stasiun ini.
   */
  const dipakai = [];
  for (const w of rel) {
    const dalam = w.geometry.map((t) => {
      const p = proyeksikan(t);
      return Math.hypot(p.x, p.y) <= radius;
    });
    if (!dalam.some(Boolean)) continue;

    // Ambil rentang menerus terpanjang yang berada di dalam jari-jari,
    // ditambah satu verteks di kedua ujungnya sebagai batas emplasemen.
    let awalTerbaik = 0;
    let akhirTerbaik = -1;
    let awal = -1;
    for (let i = 0; i <= dalam.length; i += 1) {
      if (i < dalam.length && dalam[i]) {
        if (awal < 0) awal = i;
      } else if (awal >= 0) {
        if (i - 1 - awal > akhirTerbaik - awalTerbaik) {
          awalTerbaik = awal;
          akhirTerbaik = i - 1;
        }
        awal = -1;
      }
    }
    if (akhirTerbaik < awalTerbaik) continue;
    const a = Math.max(0, awalTerbaik - 1);
    const b = Math.min(w.nodes.length - 1, akhirTerbaik + 1);
    if (b - a < 1) continue;

    dipakai.push({
      ...w,
      nodes: w.nodes.slice(a, b + 1),
      geometry: w.geometry.slice(a, b + 1),
    });
  }

  // -- 2. Putar sehingga sumbu utama mendatar ------------------------------
  const titikUtama = [];
  for (const w of dipakai) {
    if (w.tags.usage !== 'main') continue;
    for (const t of w.geometry) {
      const p = proyeksikan(t);
      if (Math.hypot(p.x, p.y) <= radius) titikUtama.push(p);
    }
  }
  const semuaTitik = dipakai.flatMap((w) => w.geometry.map(proyeksikan));
  const sudut = -sudutSumbuUtama(titikUtama.length >= 10 ? titikUtama : semuaTitik);
  const arahX = opsi.balikSumbuX ? -1 : 1;
  const ubah = (t) => {
    const p = putar(proyeksikan(t), sudut);
    return { x: p.x * arahX, y: p.y };
  };

  // -- 3. Hitung pemakaian tiap simpul OSM --------------------------------
  const koordinat = new Map();
  const derajat = new Map();
  for (const w of dipakai) {
    w.nodes.forEach((id, i) => {
      if (!koordinat.has(id)) koordinat.set(id, ubah(w.geometry[i]));
      const ujung = i === 0 || i === w.nodes.length - 1;
      derajat.set(id, (derajat.get(id) ?? 0) + (ujung ? 1 : 2));
    });
  }

  const titikPercabangan = new Set();
  for (const [id, d] of derajat) {
    const tag = simpulBertag.get(id);
    const istimewa =
      tag &&
      ['switch', 'buffer_stop', 'railway_crossing', 'crossing'].includes(tag.railway);
    if (d !== 2 || istimewa) titikPercabangan.add(id);
  }

  // -- 4. Pecah way menjadi ruas pada titik percabangan --------------------
  const ruas = [];
  for (const w of dipakai) {
    let mulai = 0;
    for (let i = 1; i < w.nodes.length; i += 1) {
      const akhirRuas = i === w.nodes.length - 1 || titikPercabangan.has(w.nodes[i]);
      if (!akhirRuas) continue;
      const idSimpul = w.nodes.slice(mulai, i + 1);
      const titik = w.geometry.slice(mulai, i + 1).map(ubah);
      if (idSimpul.length >= 2) {
        ruas.push({
          id: `R${w.id}-${mulai}`,
          wayId: w.id,
          dari: String(idSimpul[0]),
          ke: String(idSimpul[idSimpul.length - 1]),
          titik,
          tags: w.tags,
          panjangM: panjangGaris(titik),
        });
      }
      mulai = i;
    }
  }

  // -- 5. Derajat sesudah pemecahan, untuk penggolongan simpul ------------
  const derajatRuas = new Map();
  for (const r of ruas) {
    derajatRuas.set(r.dari, (derajatRuas.get(r.dari) ?? 0) + 1);
    derajatRuas.set(r.ke, (derajatRuas.get(r.ke) ?? 0) + 1);
  }

  const simpul = [];
  for (const [id, d] of derajatRuas) {
    const koor = koordinat.get(Number(id)) ?? koordinat.get(id);
    if (!koor) continue;
    const tag = simpulBertag.get(Number(id)) ?? simpulBertag.get(id) ?? {};
    let jenis = 'SAMBUNG';
    if (d === 1) jenis = tag.railway === 'buffer_stop' ? 'UJUNG' : 'BATAS';
    else if (d === 3) jenis = 'WESEL';
    else if (d >= 4) jenis = 'SILANG';
    simpul.push({ id: String(id), jenis, derajat: d, x: koor.x, y: koor.y, tags: tag });
  }

  /*
   * -- 6. Buang serpihan graf --------------------------------------------
   * Pemotongan jari-jari dapat menyisakan potongan sepur yang tidak tersambung
   * ke emplasemen utama. Namun gugus terbesar saja TIDAK cukup: pada stasiun
   * bertingkat seperti Manggarai, dek layang memang tidak tersambung ke lantai
   * dasar di dalam emplasemen, sehingga ia berdiri sebagai gugus tersendiri
   * yang sah. Karena itu yang dibuang hanyalah gugus yang terlalu kecil untuk
   * menjadi bagian emplasemen.
   */
  const tetangga = new Map();
  for (const r of ruas) {
    for (const [a, b] of [
      [r.dari, r.ke],
      [r.ke, r.dari],
    ]) {
      if (!tetangga.has(a)) tetangga.set(a, new Set());
      tetangga.get(a).add(b);
    }
  }
  const terlihat = new Set();
  const gugusan = [];
  for (const awal of tetangga.keys()) {
    if (terlihat.has(awal)) continue;
    const gugus = new Set([awal]);
    const antre = [awal];
    terlihat.add(awal);
    while (antre.length) {
      const k = antre.pop();
      for (const t of tetangga.get(k) ?? []) {
        if (terlihat.has(t)) continue;
        terlihat.add(t);
        gugus.add(t);
        antre.push(t);
      }
    }
    gugusan.push(gugus);
  }
  const ambangGugus = opsi.minGugus ?? 8;
  const dipakaiSimpul = new Set();
  for (const g of gugusan) {
    if (g.size < ambangGugus) continue;
    for (const id of g) dipakaiSimpul.add(id);
  }
  const ruasUtama = ruas.filter((r) => dipakaiSimpul.has(r.dari) && dipakaiSimpul.has(r.ke));
  const simpulUtama = simpul.filter((s) => dipakaiSimpul.has(s.id));
  const dibuang = { simpul: simpul.length - simpulUtama.length, ruas: ruas.length - ruasUtama.length };

  return {
    simpul: simpulUtama,
    ruas: ruasUtama,
    dibuang,
    peron: peron.map((p) => ({
      id: String(p.id),
      ref: p.tags.ref ?? null,
      tags: p.tags,
      titik: p.geometry.map(ubah),
    })),
    sudutPutar: (sudut * 180) / Math.PI,
    telaah: telaahGraf(simpulUtama, ruasUtama),
  };
}

function panjangGaris(titik) {
  let n = 0;
  for (let i = 1; i < titik.length; i += 1) {
    n += Math.hypot(titik[i].x - titik[i - 1].x, titik[i].y - titik[i - 1].y);
  }
  return Math.round(n);
}

/**
 * Tentukan kaki pangkal, lurus, dan belok sebuah wesel dari geometri.
 *
 * Kaki pangkal adalah kaki tunggal yang berhadapan dengan dua kaki lainnya;
 * ia dikenali karena arahnya paling berlawanan terhadap rerata dua kaki lain.
 * Di antara dua kaki sisanya, yang paling sedikit menyimpang dari kelurusan
 * pangkal adalah kaki lurus.
 */
export function tetapkanKakiWesel(simpul, ruasDiSimpul) {
  if (ruasDiSimpul.length !== 3) return null;
  const arah = ruasDiSimpul.map((r) => {
    const titik = r.dari === simpul.id ? r.titik : [...r.titik].reverse();
    const a = titik[0];
    const b = titik[1] ?? titik[titik.length - 1];
    return { ruas: r, sudut: Math.atan2(b.y - a.y, b.x - a.x) };
  });

  // Selisih sudut terkecil pada lingkaran. Pembungkusannya harus lewat modulo
  // penuh; mengurangi sekali saja menghasilkan nilai negatif untuk selisih
  // di atas 1,5 putaran.
  const beda = (a, b) => {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };

  // Pangkal = kaki yang paling berlawanan terhadap dua kaki lainnya.
  let pangkal = null;
  let terbaik = -1;
  for (let i = 0; i < 3; i += 1) {
    const lain = arah.filter((_, j) => j !== i);
    const nilai = lain.reduce((n, l) => n + beda(arah[i].sudut, l.sudut), 0);
    if (nilai > terbaik) {
      terbaik = nilai;
      pangkal = i;
    }
  }

  const sisa = arah.filter((_, j) => j !== pangkal);
  const lurusSudut = arah[pangkal].sudut + Math.PI;
  const menyimpang = sisa.map((s) => beda(s.sudut, lurusSudut));
  const iLurus = menyimpang[0] <= menyimpang[1] ? 0 : 1;

  return {
    pangkal: arah[pangkal].ruas,
    lurus: sisa[iLurus].ruas,
    belok: sisa[1 - iLurus].ruas,
    simpanganBelokDerajat: Math.round((menyimpang[1 - iLurus] * 180) / Math.PI),
    simpanganLurusDerajat: Math.round((menyimpang[iLurus] * 180) / Math.PI),
  };
}

/**
 * Pasangkan kaki persilangan sebidang: tiap kaki disandingkan dengan kaki yang
 * paling lurus terhadapnya. Tidak ada sambungan yang dikarang — perpindahan
 * antar-pasangan tetap mustahil.
 */
export function pasangkanPersilangan(simpul, ruasDiSimpul) {
  const arah = ruasDiSimpul.map((r) => {
    const titik = r.dari === simpul.id ? r.titik : [...r.titik].reverse();
    const a = titik[0];
    const b = titik[1] ?? titik[titik.length - 1];
    return { ruas: r, sudut: Math.atan2(b.y - a.y, b.x - a.x) };
  });
  // Selisih sudut terkecil pada lingkaran. Pembungkusannya harus lewat modulo
  // penuh; mengurangi sekali saja menghasilkan nilai negatif untuk selisih
  // di atas 1,5 putaran.
  const beda = (a, b) => {
    let d = Math.abs(a - b) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };

  const belum = new Set(arah.map((_, i) => i));
  const pasangan = [];
  while (belum.size >= 2) {
    const [i] = belum;
    belum.delete(i);
    let terbaik = null;
    let paling = Infinity;
    for (const j of belum) {
      const simpang = Math.abs(Math.PI - beda(arah[i].sudut, arah[j].sudut));
      if (simpang < paling) {
        paling = simpang;
        terbaik = j;
      }
    }
    if (terbaik === null) break;
    belum.delete(terbaik);
    pasangan.push([arah[i].ruas, arah[terbaik].ruas]);
  }
  return pasangan;
}

function telaahGraf(simpul, ruas) {
  const perJenis = {};
  for (const s of simpul) perJenis[s.jenis] = (perJenis[s.jenis] ?? 0) + 1;

  const perTrackRef = {};
  for (const r of ruas) {
    const ref = r.tags['railway:track_ref'];
    if (!ref) continue;
    perTrackRef[ref] = (perTrackRef[ref] ?? 0) + 1;
  }

  const derajatTinggi = simpul.filter((s) => s.derajat > 4).length;

  return {
    jumlahSimpul: simpul.length,
    jumlahRuas: ruas.length,
    perJenis,
    ruasPerNomorJalur: perTrackRef,
    simpulDerajatLebihDariEmpat: derajatTinggi,
    panjangRuasTerpendek: Math.min(...ruas.map((r) => r.panjangM)),
    panjangRuasTerpanjang: Math.max(...ruas.map((r) => r.panjangM)),
  };
}
