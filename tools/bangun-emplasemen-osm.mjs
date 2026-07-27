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
import { STASIUN, DIBANGUN } from './stasiun-config.mjs';

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
 * Tetapkan NOMOR LAJUR papan bagi tiap simpul.
 *
 * Papan pelayanan bukan peta. Sepur digambar sebagai garis mendatar pada lajur
 * berjarak tetap, dan leher wesel sebagai garis miring lurus yang berpindah
 * lajur — itulah bentuk yang dibaca petugas, dan itu pula bentuk denah
 * Manggarai yang disusun dari dokumen tata letak. Karena itu keluarannya
 * BILANGAN BULAT: tiap simpul jatuh tepat pada satu lajur, tidak pernah di
 * antara dua lajur. Bentuk lengkung yang sebenarnya tidak hilang — ia tersimpan
 * terpisah pada bidang `jalanOsm` untuk tampilan rel OSM.
 */
function tetapkanLajur(ruas, simpul, level) {
  const milik = ruas.filter((r) => r.level === level);
  const simpulMilik = simpul.filter((n) => n.level === level);
  const lajurSimpul = new Map();
  if (simpulMilik.length === 0) return { lajurSimpul, keLajur: () => 0 };

  /*
   * Lajur disusun dari PENAMPANG MELINTANG emplasemen, bukan dari titik tengah
   * tiap ruas. Mencuplik titik tengah keliru: sepur leher yang sedang memencar
   * punya titik tengah pada kedudukan melintang yang berbeda-beda, sehingga
   * masing-masing membentuk lajur palsu dan kanvas membengkak berlipat-lipat.
   * Beberapa penampang digabung supaya sepur yang hanya ada di sebagian panjang
   * emplasemen tetap memperoleh lajurnya sendiri.
   */
  const contoh = [];
  for (const x0 of [0, -120, 120, -240, 240, -360, 360]) {
    for (const r of milik) {
      for (let i = 1; i < r.titik.length; i += 1) {
        const a = r.titik[i - 1];
        const b = r.titik[i];
        if ((a.x - x0) * (b.x - x0) > 0) continue;
        const f = b.x === a.x ? 0 : (x0 - a.x) / (b.x - a.x);
        contoh.push(a.y + f * (b.y - a.y));
        break;
      }
    }
  }
  if (contoh.length === 0) for (const n of simpulMilik) contoh.push(n.y);

  // Renggang antar-sepur bersebelahan di lapangan berkisar 4-5 m; 3,5 m aman
  // sebagai ambang "sepur yang sama".
  const urut = [...contoh].sort((a, b) => a - b);
  const lajur = [];
  for (const y of urut) {
    const akhirL = lajur[lajur.length - 1];
    if (akhirL && y - akhirL.y <= 3.5) {
      akhirL.y = (akhirL.y * akhirL.n + y) / (akhirL.n + 1);
      akhirL.n += 1;
    } else {
      lajur.push({ y, n: 1 });
    }
  }
  const nilaiLajur = lajur.map((l) => l.y);
  const lo = nilaiLajur[0];
  const hi = nilaiLajur[nilaiLajur.length - 1];

  const terdekat = (y) => {
    let terbaik = 0;
    let jarak = Infinity;
    for (let i = 0; i < nilaiLajur.length; i += 1) {
      const d = Math.abs(nilaiLajur[i] - y);
      if (d < jarak) {
        jarak = d;
        terbaik = i;
      }
    }
    return terbaik;
  };

  /*
   * Simpul di dalam penampang langsung dibulatkan ke lajur terdekat. Yang di
   * luar penampang TIDAK boleh dibulatkan menurut jarak sebenarnya: lintas yang
   * melengkung menjauh 300 m akan melahirkan puluhan lajur palsu dan menarik
   * tinggi papan berlipat-lipat. Yang benar, dan yang dilakukan papan
   * sungguhan, adalah sepur itu MENERUSKAN lajurnya sendiri sampai tepi papan.
   */
  const terpakai = new Set();
  const kunciPakai = (n, l) => `${Math.round(n.x / 70)}|${l}`;
  for (const n of simpulMilik) {
    if (n.y >= lo - 3.5 && n.y <= hi + 3.5) {
      const l = terdekat(n.y);
      lajurSimpul.set(n.id, l);
      terpakai.add(kunciPakai(n, l));
    }
  }

  const tetanggaSimpul = new Map();
  for (const r of milik) {
    for (const [a, b] of [
      [r.dari, r.ke],
      [r.ke, r.dari],
    ]) {
      if (!tetanggaSimpul.has(a)) tetanggaSimpul.set(a, []);
      tetanggaSimpul.get(a).push(b);
    }
  }
  const petaSimpul = new Map(simpulMilik.map((n) => [n.id, n]));

  /*
   * Lajur dirambatkan keluar dari simpul yang sudah tertetapkan. Simpul yang
   * baru meneruskan lajur tetangganya; bila lajur itu sudah dipakai sepur lain
   * pada kedudukan memanjang yang sama, ia bergeser satu lajur ke arah
   * simpangannya yang sebenarnya — sehingga percabangan di luar penampang tetap
   * tergambar terpisah, bukan bertindih.
   */
  const antre = [...lajurSimpul.keys()];
  let kepala = 0;
  while (kepala < antre.length) {
    const idU = antre[kepala];
    kepala += 1;
    const u = petaSimpul.get(idU);
    const lu = lajurSimpul.get(idU);
    for (const idV of tetanggaSimpul.get(idU) ?? []) {
      if (lajurSimpul.has(idV)) continue;
      const v = petaSimpul.get(idV);
      if (!v) continue;
      const arah = v.y > u.y + 3.5 ? 1 : v.y < u.y - 3.5 ? -1 : 0;
      let l = lu;
      // Cari lajur bebas terdekat, mulai dari lajur yang diteruskan.
      for (let langkah = 0; langkah < 40; langkah += 1) {
        const calon = lu + (arah === 0 ? (langkah % 2 === 0 ? 1 : -1) * Math.ceil(langkah / 2) : arah * langkah);
        if (!terpakai.has(kunciPakai(v, calon))) {
          l = calon;
          break;
        }
      }
      lajurSimpul.set(idV, l);
      terpakai.add(kunciPakai(v, l));
      antre.push(idV);
    }
  }

  // Simpul yang benar-benar terpisah dari graf utama tetap perlu lajur.
  for (const n of simpulMilik) {
    if (!lajurSimpul.has(n.id)) lajurSimpul.set(n.id, terdekat(n.y));
  }

  return { lajurSimpul, keLajur: terdekat };
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
  for (const n of graf.simpul) n.level = levelSimpul.get(n.id) ?? 'DASAR';
  const lajurSimpul = new Map();
  const keLajurLevel = {};
  for (const lv of tingkat) {
    const hasil = tetapkanLajur(graf.ruas, graf.simpul, lv);
    keLajurLevel[lv] = hasil.keLajur;
    for (const [id, l] of hasil.lajurSimpul) lajurSimpul.set(id, l);
  }

  /*
   * Tinggi kanvas dihitung dari SIMPUL, bukan dari seluruh titik lengkung:
   * pada denah hanya simpul yang digambar, sebab tiap ruas menjadi garis lurus
   * dari simpul ke simpul.
   */
  const kanvasY = {};
  for (const lv of tingkat) {
    const nilai = graf.simpul
      .filter((n) => n.level === lv)
      .map((n) => (lajurSimpul.get(n.id) ?? 0) * RENGGANG);
    const min = nilai.length ? Math.min(...nilai) : 0;
    const maks = nilai.length ? Math.max(...nilai) : 0;
    kanvasY[lv] = { geser: 44 - min, tinggi: maks - min + 88 };
  }

  const keX = (x) => Math.round((x - minX) * skalaX + TEPI_X);
  const keGambarSimpul = (n) => ({
    x: keX(n.x),
    y: Math.round((lajurSimpul.get(n.id) ?? 0) * RENGGANG + kanvasY[n.level].geser),
  });
  /** Kedudukan tegak sebuah kedudukan melintang nyata, untuk peron. */
  const keYLajur = (y, level) =>
    Math.round(keLajurLevel[level](y) * RENGGANG + kanvasY[level].geser);

  /*
   * Tampilan kedua: geometri sebenarnya, tanpa pemetaan lajur dan tanpa
   * pemampatan. Skalanya seragam untuk kedua sumbu supaya bentuk lengkung
   * wesel, sudut percabangan, dan kelengkungan lintas terbaca apa adanya —
   * itulah gunanya tampilan ini di samping denah skematik. Seluruh lantai
   * memakai satu kanvas karena secara geografis memang saling menumpuk.
   */
  const ysNyata = graf.ruas.flatMap((r) => r.titik.map((p) => p.y));
  const minYn = Math.min(...ysNyata);
  const maksYn = Math.max(...ysNyata);
  const skalaOsm = (LEBAR_KANVAS - TEPI_X * 2) / Math.max(1, maksX - minX);
  const kanvasOsm = {
    lebar: LEBAR_KANVAS,
    tinggi: Math.round((maksYn - minYn) * skalaOsm + 88),
    meterPerSatuan: Number((1 / skalaOsm).toFixed(4)),
  };
  const keOsm = (t) => ({
    x: Math.round((t.x - minX) * skalaOsm + TEPI_X),
    y: Math.round((t.y - minYn) * skalaOsm + 44),
  });

  /* -- Simpul ---------------------------------------------------------- */
  const simpul = graf.simpul.map((s) => {
    const lv = levelSimpul.get(s.id) ?? 'DASAR';
    const g = keGambarSimpul(s);
    return { id: `S${s.id}`, jenis: s.jenis, level: lv, x: g.x, y: g.y, osm: keOsm(s) };
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
      /*
       * TIDAK ada titik belok pada denah. Tiap ruas digambar sebagai satu garis
       * lurus dari simpul ke simpul: sepur yang tetap pada lajurnya menjadi
       * garis mendatar, sepur yang berpindah lajur di leher wesel menjadi garis
       * miring. Itulah bentuk papan pelayanan, dan lengkung yang sebenarnya
       * tetap tersedia pada `jalanOsm`.
       */
      // Jalan sebenarnya dipakai tampilan rel OSM; titik yang berimpit dibuang.
      jalanOsm: r.titik
        .map((t) => keOsm(t))
        .filter((t, i, a) => i === 0 || t.x !== a[i - 1].x || t.y !== a[i - 1].y),
      _titik: null,
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

  /* -- Sepur ----------------------------------------------------------- */
  const jalurSumber = new Map(
    (sumber?.jalur ?? []).map((j) => [String(j.nomor), j]),
  );
  const sepur = [];
  for (const [nomor, r] of [...badanSepur].sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  )) {
    const info = jalurSumber.get(nomor);
    const rr = ruasPeta.get(r.id);
    sepur.push({
      id: `SP-${kode}-${nomor}`,
      nomor,
      label: `Jalur ${nomor}`,
      level: rr._level,
      jenis: info?.sepurLurus ? 'RAYA' : 'BELOK',
      peronId: null,
      panjangPeronM: 0,
      linDilayani: [],
      ruasId: rr.id,
      keterangan: info?.peruntukan ?? 'Peruntukan tidak dinyatakan sumber.',
    });
  }

  /* -- Peron ----------------------------------------------------------- */
  const peron = [];
  for (const p of graf.peron) {
    const dekat = p.titik.some((t) => Math.hypot(t.x, t.y) <= cfg.radius);
    if (!dekat) continue;
    const nomorPeron = (p.ref ?? '').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    const sepurIds = nomorPeron
      .map((n) => `SP-${kode}-${n}`)
      .filter((id) => sepur.some((s) => s.id === id));
    const lv = sepur.find((s) => sepurIds.includes(s.id))?.level ?? 'DASAR';
    const x1 = Math.min(...p.titik.map((t) => keX(t.x)));
    const x2 = Math.max(...p.titik.map((t) => keX(t.x)));
    /*
     * Bidang peron dibentangkan pada lajur sepur yang dilayaninya. Memakai
     * kedudukan nyata peron akan meleset dari sepurnya di papan, sebab papan
     * membulatkan kedudukan melintang ke lajur.
     */
    const yLajur = sepurIds
      .map((id) => simpulPeta.get(`S${(graf.ruas.find((r) => `R${r.id.replace(/[^0-9A-Za-z-]/g, '')}` === (sepur.find((x) => x.id === id) || {}).ruasId) || {}).dari}`))
      .filter(Boolean)
      .map((n) => n.y);
    const yPeron = yLajur.length
      ? yLajur
      : p.titik.map((t) => keYLajur(t.y, lv));
    const y1 = Math.min(...yPeron);
    const y2 = Math.max(...yPeron);
    const id = `PER-${kode}-${peron.length + 1}`;
    peron.push({
      id,
      nomor: p.ref ?? String(peron.length + 1),
      nama: p.ref ? `Peron jalur ${p.ref.replace(/;/g, '-')}` : `Peron ${peron.length + 1}`,
      level: lv,
      jenis: sepurIds.length > 1 ? 'PULAU' : 'SISI',
      sepurIds,
      geometri: {
        x: x1,
        y: Math.max(0, y1 - 6),
        lebar: Math.max(30, x2 - x1),
        tinggi: Math.max(14, y2 - y1 + 12),
      },
    });
    for (const s of sepur) {
      if (sepurIds.includes(s.id)) {
        s.peronId = id;
        s.panjangPeronM = Math.round(
          Math.hypot(
            p.titik[0].x - p.titik[p.titik.length - 1].x,
            p.titik[0].y - p.titik[p.titik.length - 1].y,
          ),
        );
      }
    }
  }

  /* -- Batas emplasemen ------------------------------------------------ */
  const lintasSumber = new Map((sumber?.lintas ?? []).map((l) => [l.kode, l]));
  const kelompok = new Map();
  for (const s of graf.simpul.filter((x) => x.jenis === 'BATAS')) {
    const kaki = (ruasDiSimpulAsli.get(s.id) ?? [])[0];
    if (!kaki) continue;
    const nama = kaki.tags.name ?? '';
    const sisiSimpul = s.x < 0 ? 'KIRI' : 'KANAN';
    let kodeLintas = null;
    for (const [petunjuk, sisiSyarat, kd] of cfg.lintasDariNama) {
      if (!nama.includes(petunjuk)) continue;
      if (sisiSyarat !== '*' && sisiSyarat !== sisiSimpul) continue;
      kodeLintas = kd;
      break;
    }
    /*
     * Simpul batas yang way-nya tak bernama tetap harus menjadi batas
     * emplasemen — itu jalur akses depo, sepur simpan, atau lintas yang belum
     * diberi nama di OSM. Membiarkannya tanpa batas membuat bagian emplasemen
     * itu tidak terjangkau sama sekali.
     */
    const sisi = s.x < 0 ? 'KIRI' : 'KANAN';
    const kunci = kodeLintas
      ? `${kodeLintas}|${sisi}`
      : `AKSES|${sisi}`;
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci).push({ simpul: s, ruas: kaki, bernama: Boolean(kodeLintas) });
  }

  const batas = [];
  for (const [kunci, anggota] of kelompok) {
    const [kodeLintas, sisi] = kunci.split('|');
    const info = lintasSumber.get(kodeLintas);
    anggota.sort((a, b) => a.simpul.y - b.simpul.y);
    const tunggal = anggota.length === 1 || info?.jenisJalur === 'TUNGGAL';
    // Sisi ikut masuk id: satu lintas dapat menyentuh emplasemen dari dua sisi
    // (mis. lintas yang membelok mengitari stasiun), dan tanpa sisi id-nya kembar.
    const buat = (a, akhiran, keterangan) => {
      const id = `BTS-${kode}-${kodeLintas}-${sisi === 'KIRI' ? 'B' : 'T'}${akhiran}`;
      batas.push({
        id,
        nama: kodeLintas === 'AKSES' ? `Jalur akses ${sisi === 'KIRI' ? 'barat' : 'timur'}${keterangan}` : `${info?.nama ?? `Arah ${kodeLintas}`}${keterangan}`,
        singkatan: kodeLintas,
        level: levelSimpul.get(a.simpul.id) ?? 'DASAR',
        simpulId: `S${a.simpul.id}`,
        sisi,
        stasiunTetangga: kodeLintas === 'AKSES' ? 'Emplasemen luar' : (info?.stasiunTetangga ?? kodeLintas),
        linDilayani: [],
        headwayMinimumDetik: tunggal ? 420 : 180,
        jalurTunggal: Boolean(tunggal),
      });
      // Ruas petak jalan ditandai supaya penguncian rute memperlakukannya benar.
      const rr = ruasPeta.get(a.ruas.id);
      if (rr) {
        rr.jenis = 'PETAK_JALAN';
        const b = blok.find((x) => x.id === rr.blokId);
        if (b) {
          b.wilayah = 'PETAK_JALAN';
          b.nama = `PJ ${info?.stasiunTetangga ?? kodeLintas}`;
        }
      }
    };

    if (kodeLintas === 'AKSES') {
      // Jalur akses depo/sepur simpan: tiap simpul menjadi batas tersendiri.
      anggota.forEach((a, i) => buat(a, `-${i + 1}`, ` ${i + 1}`));
    } else if (tunggal) {
      buat(anggota[0], '', '');
      // Sepur tambahan pada lintas tunggal tetap dipakai sebagai batas terpisah.
      anggota.slice(1).forEach((a, i) => buat(a, `-${i + 2}`, ` (sepur ${i + 2})`));
    } else {
      buat(anggota[0], '-D', ' (masuk)');
      buat(anggota[1], '-K', ' (keluar)');
      anggota.slice(2).forEach((a, i) => buat(a, `-${i + 3}`, ` (sepur ${i + 3})`));
    }
  }

  /* -- Sinyal ---------------------------------------------------------- */
  const sinyal = [];
  const ruasBersinyal = new Set();
  let hurufMasuk = 0;
  const HURUF = 'ABCDEFGHJKLMNPRSTUV';

  for (const b of batas) {
    const sId = b.simpulId.slice(1);
    const kaki = (ruasDiSimpulAsli.get(sId) ?? [])[0];
    if (!kaki) continue;
    const rr = ruasPeta.get(kaki.id);
    if (!rr || ruasBersinyal.has(rr.id)) continue;
    const simpulB = simpulPeta.get(b.simpulId);
    const lain = rr.dari === b.simpulId ? rr.ke : rr.dari;
    const simpulLain = simpulPeta.get(lain);
    const hadap = simpulLain && simpulB && simpulLain.x >= simpulB.x ? 1 : -1;
    sinyal.push({
      id: `SIG-${kode}-M${hurufMasuk}`,
      nama: HURUF[hurufMasuk % HURUF.length],
      jenis: 'MASUK',
      level: b.level,
      simpulId: b.simpulId,
      ruasDilindungi: rr.id,
      hadap,
      offsetY: -18,
      offsetX: hadap * 36,
    });
    ruasBersinyal.add(rr.id);
    hurufMasuk += 1;
  }

  for (const sp of sepur) {
    const badan = ruas.find((r) => r.id === sp.ruasId);
    if (!badan) continue;
    for (const ujung of [badan.dari, badan.ke]) {
      const asliUjung = ujung.slice(1);
      const tetangga = (ruasDiSimpulAsli.get(asliUjung) ?? []).filter(
        (r) => r.id !== badan.asli,
      );
      for (const t of tetangga) {
        const rr = ruasPeta.get(t.id);
        if (!rr || ruasBersinyal.has(rr.id)) continue;
        const simpulU = simpulPeta.get(ujung);
        const lain = rr.dari === ujung ? rr.ke : rr.dari;
        const simpulLain = simpulPeta.get(lain);
        const hadap = simpulLain && simpulU && simpulLain.x >= simpulU.x ? 1 : -1;
        // Satu ujung sepur dapat bercabang ke lebih dari satu ruas; masing-masing
        // memerlukan sinyal keluar tersendiri, jadi namanya diberi urutan.
        const dasar = `J${sp.nomor}${hadap === 1 ? 'T' : 'B'}`;
        let nama = dasar;
        let n = 2;
        while (sinyal.some((x) => x.nama === nama)) {
          nama = `${dasar}${n}`;
          n += 1;
        }
        sinyal.push({
          id: `SIG-${kode}-${nama}`,
          nama,
          jenis: 'KELUAR',
          level: sp.level,
          simpulId: ujung,
          ruasDilindungi: rr.id,
          hadap,
          offsetY: -18,
          offsetX: hadap * 22,
        });
        ruasBersinyal.add(rr.id);
      }
    }
  }

  /* -- Rakit ----------------------------------------------------------- */
  const kanvas = {};
  for (const lv of tingkat) {
    kanvas[lv] = { lebar: LEBAR_KANVAS, tinggi: Math.round(kanvasY[lv].tinggi) };
  }

  const emplasemen = {
    kodeStasiun: kode,
    namaStasiun: cfg.nama,
    acuan: {
      keterangan: `${cfg.keterangan} Bentuk emplasemen diturunkan dari geometri sepur tersurvei OpenStreetMap/OpenRailwayMap: kedudukan tiap sepur, letak tiap wesel beserta kaki pangkal-lurus-beloknya, persilangan sebidang, penomoran jalur, serta letak peron.`,
      tanggalAcuan: new Date().toISOString().slice(0, 10),
      sumber: [
        `OpenStreetMap / OpenRailwayMap lewat Overpass API, ditarik ke tools/sumber/osm/${kode}.json`,
        ...(sumber?.sumberTataLetak ?? []),
      ],
      catatanVerifikasi:
        'YANG BERASAL DARI SURVEI: kedudukan dan bentuk tiap sepur, letak tiap wesel beserta penetapan kaki pangkal, lurus, dan belok yang dihitung dari geometri, persilangan sebidang, penomoran jalur, dan letak peron. ' +
        'YANG DISUSUN SENDIRI DAN BUKAN DATA SURVEI: penomoran wesel (OpenStreetMap tidak memuat ref maupun name pada satu pun wesel), letak dan penamaan sinyal (OpenStreetMap hampir tidak memuat railway=signal pada stasiun-stasiun ini), pembagian blok deteksi sarana, serta penetapan batas mana yang arah masuk dan mana yang arah keluar pada lintas jalur ganda. ' +
        'CARA MENGGAMBAR: diagram jalur bukan peta berskala. Kedudukan memanjang dipakai apa adanya, sedangkan kedudukan melintang dibulatkan ke lajur berjarak tetap, dan tiap ruas digambar sebagai garis lurus dari simpul ke simpul — sepur menjadi garis mendatar, leher wesel menjadi garis miring, sama seperti papan pelayanan sungguhan. Urutan sepur dan seluruh topologinya tetap sama dengan hasil survei. Sepur yang meninggalkan penampang emplasemen dirapatkan ke tepi papan menurut urutannya, bukan menurut jarak sebenarnya. ' +
        'Tampilan kedua, "rel OSM", memakai bidang "osm" pada tiap simpul dan "jalanOsm" pada tiap ruas: itu geometri survei yang diskalakan seragam pada kedua sumbu tanpa pemetaan lajur maupun pemampatan, jadi berskala benar.',
      putarDerajat: Math.round(graf.sudutPutar * 10) / 10,
    },
    kanvas,
    kanvasOsm,
    simpul,
    ruas: ruas.map(({ asli, _titik, _nomor, _nama, _level, ...sisa }) => sisa),
    wesel,
    persilangan,
    sinyal,
    blok,
    sepur,
    peron,
    batas,
  };

  return { emplasemen, cfg, sumber, graf, ruas, sepur, batas, sinyal, kanvas };
}

/* ------------------------------------------------------------------ */

const daftar = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DIBANGUN;

/** Pemeriksaan keutuhan graf, sama ketatnya seperti pembangkit terdahulu. */
function periksa(e) {
  const galat = [];
  const idSimpul = new Set(e.simpul.map((s) => s.id));
  const idRuas = new Set(e.ruas.map((r) => r.id));
  for (const r of e.ruas) {
    if (!idSimpul.has(r.dari)) galat.push(`ruas ${r.id}: simpul ${r.dari} tidak ada`);
    if (!idSimpul.has(r.ke)) galat.push(`ruas ${r.id}: simpul ${r.ke} tidak ada`);
  }
  const derajat = new Map();
  for (const r of e.ruas) {
    derajat.set(r.dari, (derajat.get(r.dari) ?? 0) + 1);
    derajat.set(r.ke, (derajat.get(r.ke) ?? 0) + 1);
  }
  for (const w of e.wesel) {
    if (!idSimpul.has(w.simpulId)) galat.push(`wesel ${w.id}: simpul hilang`);
    for (const kaki of [w.ruasPangkal, w.ruasLurus, w.ruasBelok]) {
      if (!idRuas.has(kaki)) galat.push(`wesel ${w.id}: ruas ${kaki} tidak ada`);
      const r = e.ruas.find((x) => x.id === kaki);
      if (r && r.dari !== w.simpulId && r.ke !== w.simpulId) {
        galat.push(`wesel ${w.id}: ruas ${kaki} tidak menyentuh simpulnya`);
      }
    }
    const set = new Set([w.ruasPangkal, w.ruasLurus, w.ruasBelok]);
    if (set.size !== 3) galat.push(`wesel ${w.id}: kaki tidak berbeda`);
    if ((derajat.get(w.simpulId) ?? 0) !== 3)
      galat.push(`wesel ${w.id}: derajat ${derajat.get(w.simpulId)}`);
  }
  for (const p of e.persilangan) {
    for (const [a, b] of p.pasangan) {
      if (!idRuas.has(a) || !idRuas.has(b)) galat.push(`persilangan ${p.id}: ruas hilang`);
    }
  }
  for (const s of e.sinyal) {
    if (!idRuas.has(s.ruasDilindungi)) galat.push(`sinyal ${s.nama}: ruas hilang`);
  }
  for (const sp of e.sepur) {
    if (!idRuas.has(sp.ruasId)) galat.push(`sepur ${sp.id}: ruas hilang`);
  }
  for (const b of e.batas) {
    if (!idSimpul.has(b.simpulId)) galat.push(`batas ${b.id}: simpul hilang`);
  }
  const idGanda = (arr) => {
    const s = new Set();
    return arr.filter((x) => (s.has(x.id) ? true : (s.add(x.id), false))).map((x) => x.id);
  };
  for (const [nama, arr] of [
    ['simpul', e.simpul],
    ['ruas', e.ruas],
    ['wesel', e.wesel],
    ['sinyal', e.sinyal],
    ['sepur', e.sepur],
    ['batas', e.batas],
  ]) {
    const g = idGanda(arr);
    if (g.length) galat.push(`${nama}: id ganda ${g.slice(0, 3).join(',')}`);
  }
  return galat;
}

for (const kode of daftar) {
  try {
    const h = bangun(kode);
    const e = h.emplasemen;
    const galat = periksa(e);
    const tujuan = resolve(AKAR, 'data/stasiun', kode);
    if (galat.length) {
      console.error(`${kode}: TIDAK KONSISTEN (${galat.length})`);
      for (const g of galat.slice(0, 8)) console.error(`   - ${g}`);
      continue;
    }
    mkdirSync(tujuan, { recursive: true });
    writeFileSync(
      resolve(tujuan, 'emplasemen.json'),
      `${JSON.stringify(e, null, 2)}\n`,
      'utf8',
    );
    console.log(
      `${kode} ✓ simpul=${e.simpul.length} ruas=${e.ruas.length} wesel=${e.wesel.length} ` +
        `silang=${e.persilangan.length} sepur=${e.sepur.length} peron=${e.peron.length} ` +
        `batas=${e.batas.length} sinyal=${e.sinyal.length} ` +
        `kanvas=${JSON.stringify(Object.fromEntries(Object.entries(e.kanvas).map(([k, v]) => [k, v.tinggi])))}`,
    );
  } catch (e) {
    console.error(`${kode}: GAGAL — ${e.message}`);
  }
}

export { bangun };
