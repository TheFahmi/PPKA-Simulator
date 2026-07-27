'use client';

import { useMemo } from 'react';
import {
  jalurSvgRuas,
  panjangGambarRuas,
  titikPadaRuas,
  type IndeksEmplasemen,
  type ModeGambar,
} from '@/lib/emplasemen';
import { WARNA_LIN } from '@/lib/semboyan';
import type { KeadaanSimulasi } from '@/lib/simulasi';
import type { AspekSinyal, KeadaanBlok, KeretaAktif, Level } from '@/lib/tipe';

/**
 * Papan diagram jalur (track diagram) emplasemen stasiun.
 *
 * Digambar langsung sebagai SVG mengikuti tata letak emplasemen pada berkas
 * data: sepur sebagai garis, wesel sebagai kaki bercabang dengan kaki tak
 * terlayan diredupkan, sinyal sebagai tiang berlensa, peron sebagai bidang
 * berarsir. Warna garis menyatakan keadaan blok, bukan hiasan.
 */

const MARGIN_X = 190;
const MARGIN_ATAS = 40;
const MARGIN_BAWAH = 26;

const WARNA_BLOK: Record<KeadaanBlok, string> = {
  BEBAS: '#1fb85a',
  DIDUDUKI: '#e02b1d',
  RESERVASI: '#e9a51b',
  DIBLOKIR: '#8f6bd6',
  GANGGUAN: '#ff5cc8',
};

const WARNA_ASPEK: Record<AspekSinyal, string> = {
  MERAH: '#ff2a1c',
  KUNING: '#ffb302',
  HIJAU: '#22e05f',
  PUTIH: '#e6f1f6',
  PADAM: '#2a3a43',
};

interface Props {
  ix: IndeksEmplasemen;
  sim: KeadaanSimulasi;
  level: Level;
  keretaTerpilih: string | null;
  onPilihKereta: (id: string | null) => void;
  onPilihWesel?: (weselId: string) => void;
  /** Denah skematik (bawaan) atau geometri sepur tersurvei. */
  gaya?: ModeGambar;
}

export function DiagramEmplasemen({
  ix,
  sim,
  level,
  keretaTerpilih,
  onPilihKereta,
  onPilihWesel,
  gaya = 'DENAH',
}: Props) {
  /*
   * Tampilan rel OSM memakai satu kanvas untuk seluruh lantai — secara
   * geografis lantai-lantai itu memang saling menumpuk — sedangkan denah
   * skematik memberi tiap lantai kanvasnya sendiri.
   */
  const kanvas =
    (gaya === 'OSM' ? ix.data.kanvasOsm : undefined) ?? ix.data.kanvas[level];

  /** Kedudukan sebuah simpul pada tampilan yang sedang dipakai. */
  const letak = (simpulId: string): { x: number; y: number } | undefined => {
    const s = ix.simpul.get(simpulId);
    if (!s) return undefined;
    return gaya === 'OSM' ? (s.osm ?? { x: s.x, y: s.y }) : { x: s.x, y: s.y };
  };

  /**
   * Kaki wesel yang sedang tidak terlayan — digambar redup.
   * Dependensinya `sim` utuh karena `sim.wesel` dimutakhirkan di tempat.
   */
  const kakiMati = useMemo(() => {
    const set = new Set<string>();
    for (const w of ix.data.wesel) {
      if (w.level !== level) continue;
      const s = sim.wesel[w.id];
      if (!s) continue;
      set.add(s.kedudukan === 'LURUS' ? w.ruasBelok : w.ruasLurus);
    }
    return set;
  }, [ix, sim, level]);

  const ruasLevel = useMemo(
    () => ix.data.ruas.filter((r) => ix.simpul.get(r.dari)?.level === level),
    [ix, level],
  );

  const peronLevel = ix.data.peron.filter((p) => p.level === level);
  const sepurLevel = ix.data.sepur.filter((s) => s.level === level);
  const sinyalLevel = ix.data.sinyal.filter((s) => s.level === level);
  const weselLevel = ix.data.wesel.filter((w) => w.level === level);
  const batasLevel = ix.data.batas.filter((b) => b.level === level);

  const keretaLevel = sim.kereta.filter((k) => keretaAdaDiLevel(ix, k, level));

  const viewBox = [
    -MARGIN_X,
    -MARGIN_ATAS,
    kanvas.lebar + MARGIN_X * 2,
    kanvas.tinggi + MARGIN_ATAS + MARGIN_BAWAH,
  ].join(' ');

  return (
    <svg
      viewBox={viewBox}
      className="block h-auto w-full select-none"
      role="img"
      aria-label={`${
        gaya === 'OSM' ? 'Geometri sepur tersurvei' : 'Diagram jalur'
      } Stasiun ${ix.data.namaStasiun} lantai ${level === 'DASAR' ? 'dasar' : 'layang'}`}
    >
      <defs>
        <pattern id={`arsir-${level}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#33505f" strokeWidth="2" />
        </pattern>
        <pattern id={`arsir-mati-${level}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1e3039" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Peron. Bidangnya digambar pada koordinat denah; pada tampilan rel OSM
          bidang itu tidak digambar karena letaknya akan meleset dari sepur
          yang sebenarnya, dan peron yang salah letak lebih menyesatkan
          daripada peron yang tidak digambar. */}
      {gaya === 'DENAH' &&
        peronLevel.map((p) => {
          const aktif = p.sepurIds.length > 0;
          return (
            <g key={p.id}>
              <rect
                x={p.geometri.x}
                y={p.geometri.y}
                width={p.geometri.lebar}
                height={p.geometri.tinggi}
                fill={`url(#arsir${aktif ? '' : '-mati'}-${level})`}
                stroke={aktif ? '#33505f' : '#1e3039'}
                strokeWidth="1"
              />
              <text
                x={p.geometri.x + 8}
                y={p.geometri.y + p.geometri.tinggi / 2 + 4}
                className="font-mono"
                fontSize="10"
                letterSpacing="1.4"
                fill={aktif ? '#8fa7b3' : '#728d9b'}
              >
                PERON {p.nomor}
                {aktif ? '' : ' · INAKTIF'}
              </text>
            </g>
          );
        })}

      {/* Ruas sepur */}
      {ruasLevel.map((r) => {
        const d = jalurSvgRuas(ix, r.id, gaya);
        const blok = sim.blok[r.blokId];
        const mati = kakiMati.has(r.id);
        const warna = mati ? '#33474f' : WARNA_BLOK[blok?.keadaan ?? 'BEBAS'];
        const tebal = r.jenis === 'SEPUR_PERON' ? 4 : 3;
        return (
          <g key={r.id}>
            {/* Bantalan gelap agar garis terbaca di atas peron */}
            <path d={d} stroke="#060b0e" strokeWidth={tebal + 3} fill="none" strokeLinecap="butt" />
            <path
              d={d}
              stroke={warna}
              strokeWidth={tebal}
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={r.jenis === 'PETAK_JALAN' ? '10 5' : undefined}
              opacity={mati ? 0.4 : 1}
            />
          </g>
        );
      })}

      {/* Wesel: nomor + kedudukan */}
      {weselLevel.map((w) => {
        const s = sim.wesel[w.id];
        const simpul = letak(w.simpulId);
        if (!s || !simpul) return null;
        const warna = s.gangguan
          ? '#ff5cc8'
          : s.membalik
            ? '#ff8a1f'
            : s.kedudukan === 'LURUS'
              ? '#8fd4ea'
              : '#ffcf4d';
        return (
          <g
            key={w.id}
            className={onPilihWesel ? 'cursor-pointer' : undefined}
            onClick={onPilihWesel ? () => onPilihWesel(w.id) : undefined}
          >
            <rect x={simpul.x - 15} y={simpul.y + 8} width="30" height="13" fill="#060b0e" stroke={warna} strokeWidth="1" />
            <text
              x={simpul.x}
              y={simpul.y + 18}
              textAnchor="middle"
              className="font-mono"
              fontSize="9"
              fill={warna}
            >
              {w.nomor}
              {s.gangguan ? '!' : s.membalik ? '~' : s.kedudukan === 'LURUS' ? 'L' : 'B'}
            </text>
          </g>
        );
      })}

      {/* Sinyal */}
      {sinyalLevel.map((sg) => {
        const s = sim.sinyal[sg.id];
        const simpul = letak(sg.simpulId);
        if (!s || !simpul) return null;
        const x = simpul.x + sg.offsetX;
        const yLensa = simpul.y + sg.offsetY;
        const warna = WARNA_ASPEK[s.aspek];
        const menyala = s.aspek !== 'PADAM';
        return (
          <g key={sg.id}>
            <line x1={x} y1={simpul.y} x2={x} y2={yLensa} stroke="#4d6673" strokeWidth="1.5" />
            <line x1={x} y1={yLensa} x2={x + sg.hadap * 9} y2={yLensa} stroke="#4d6673" strokeWidth="1.5" />
            <circle
              cx={x + sg.hadap * 9}
              cy={yLensa}
              r="5"
              fill={warna}
              stroke="#060b0e"
              strokeWidth="1"
              opacity={menyala ? 1 : 0.6}
            />
            {menyala && (
              <circle cx={x + sg.hadap * 9} cy={yLensa} r="8" fill={warna} opacity="0.22" />
            )}
            <text
              x={x + sg.hadap * 17}
              y={yLensa - 7}
              textAnchor={sg.hadap === 1 ? 'start' : 'end'}
              className="font-mono"
              fontSize="9"
              letterSpacing="0.6"
              fill={s.gangguan ? '#ff5cc8' : '#8fa7b3'}
            >
              {sg.nama}
            </text>
          </g>
        );
      })}

      {/* Nomor jalur */}
      {sepurLevel.map((sp) => {
        const ruas = ix.ruas.get(sp.ruasId);
        if (!ruas) return null;
        const awal = letak(ruas.dari);
        if (!awal) return null;
        const atas = Number(sp.nomor) % 2 === 1;
        const y = atas ? awal.y - 20 : awal.y + 8;
        const diduduki = sim.kereta.some(
          (k) => k.sepurId === sp.id && (k.fase === 'BERHENTI' || k.fase === 'SIAP_BERANGKAT'),
        );
        return (
          <g key={sp.id}>
            <rect
              x={awal.x + 8}
              y={y}
              width="34"
              height="14"
              fill={diduduki ? '#e02b1d' : '#0a1116'}
              stroke={diduduki ? '#e02b1d' : '#33505f'}
              strokeWidth="1"
            />
            <text
              x={awal.x + 25}
              y={y + 10.5}
              textAnchor="middle"
              className="font-mono"
              fontSize="10"
              fontWeight="600"
              fill={diduduki ? '#04070a' : '#d6e6ee'}
            >
              {sp.nomor}
            </text>
          </g>
        );
      })}

      {/* Batas emplasemen */}
      {batasLevel.map((b) => {
        const simpul = letak(b.simpulId);
        if (!simpul) return null;
        const kiri = b.sisi === 'KIRI';
        const arah = kiri ? -1 : 1;
        const xUjung = simpul.x + arah * 26;
        return (
          <g key={b.id}>
            <line
              x1={simpul.x}
              y1={simpul.y}
              x2={xUjung}
              y2={simpul.y}
              stroke="#33505f"
              strokeWidth="2"
            />
            <path
              d={`M ${xUjung} ${simpul.y - 8} L ${xUjung + arah * 11} ${simpul.y} L ${xUjung} ${simpul.y + 8} Z`}
              fill="#1e3039"
              stroke="#33505f"
              strokeWidth="1"
            />
            <text
              x={xUjung + arah * 18}
              y={simpul.y - 6}
              textAnchor={kiri ? 'end' : 'start'}
              className="font-mono"
              fontSize="10"
              letterSpacing="1"
              fill="#8fa7b3"
            >
              {b.singkatan}
            </text>
            <text
              x={xUjung + arah * 18}
              y={simpul.y + 8}
              textAnchor={kiri ? 'end' : 'start'}
              className="font-mono"
              fontSize="8.5"
              fill="#728d9b"
            >
              {b.stasiunTetangga}
            </text>
          </g>
        );
      })}

      {/* Sarana */}
      {keretaLevel.map((k) => (
        <PenandaKereta
          key={k.id}
          ix={ix}
          kereta={k}
          terpilih={k.id === keretaTerpilih}
          onPilih={onPilihKereta}
          gaya={gaya}
        />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function keretaAdaDiLevel(ix: IndeksEmplasemen, k: KeretaAktif, level: Level): boolean {
  if (k.fase === 'SELESAI' || k.fase === 'BELUM_DINAS' || k.fase === 'BATAL') return false;
  if (k.ruasId) {
    const r = ix.ruas.get(k.ruasId);
    return ix.simpul.get(r?.dari ?? '')?.level === level;
  }
  const batas = ix.data.batas.find((b) => b.id === k.batasMasukId);
  return batas?.level === level;
}

function PenandaKereta({
  ix,
  kereta,
  terpilih,
  onPilih,
  gaya,
}: {
  ix: IndeksEmplasemen;
  kereta: KeretaAktif;
  terpilih: boolean;
  onPilih: (id: string | null) => void;
  gaya: ModeGambar;
}) {
  const warna = WARNA_LIN[kereta.lin];
  const menunggu = kereta.fase === 'DIWARTAKAN' || kereta.fase === 'TERTAHAN_SINYAL';
  const panjang =
    kereta.jenisSarana === 'KA_BARANG'
      ? 68
      : kereta.jenisSarana === 'KA_ANTARKOTA'
        ? 52
        : kereta.jenisSarana === 'KRL_8'
          ? 30
          : 40;

  let x: number;
  let y: number;
  let sudut = 0;

  if (menunggu) {
    const batas = ix.data.batas.find((b) => b.id === kereta.batasMasukId);
    const asli = batas ? ix.simpul.get(batas.simpulId) : undefined;
    if (!asli || !batas) return null;
    const simpul = gaya === 'OSM' ? (asli.osm ?? asli) : asli;
    const arah = batas.sisi === 'KIRI' ? -1 : 1;
    x = simpul.x + arah * 78;
    y = simpul.y;
  } else if (kereta.ruasId) {
    /*
     * Kemajuan menyatakan kedudukan KEPALA rangkaian. Penanda digambar sebagai
     * badan rangkaian, jadi titik tengahnya ditarik mundur setengah panjang
     * rangkaian. Tanpa ini, rangkaian yang berhenti di ujung peron akan
     * tergambar separuh menjorok keluar melewati ujung badan sepur.
     */
    const panjangRuas = panjangGambarRuas(ix, kereta.ruasId, gaya);
    const mundur = panjangRuas > 0 ? panjang / 2 / panjangRuas : 0;
    const titik = titikPadaRuas(
      ix,
      kereta.ruasId,
      Math.max(0, kereta.kemajuan - mundur),
      kereta.simpulMasukRuas[kereta.indeksRuas],
      gaya,
    );
    x = titik.x;
    y = titik.y;
    sudut = titik.sudut;
  } else {
    return null;
  }

  const tertahan = kereta.fase === 'TERTAHAN_SINYAL';
  const warnaTanda = terpilih ? '#ffb302' : tertahan ? '#ff2a1c' : warna;

  return (
    <g
      transform={`translate(${x} ${y}) rotate(${sudut})`}
      className="cursor-pointer"
      onClick={() => onPilih(terpilih ? null : kereta.id)}
      opacity={kereta.fase === 'DIWARTAKAN' ? 0.62 : 1}
    >
      <SimbolRangkaian
        panjang={panjang}
        warna={warna}
        jenisSarana={kereta.jenisSarana}
        terpilih={terpilih}
      />

      {/* Penanda berhenti di muka sinyal: palang merah di muka rangkaian. */}
      {tertahan && (
        <line
          x1={panjang / 2 + 4}
          y1={-9}
          x2={panjang / 2 + 4}
          y2={9}
          stroke="#ff2a1c"
          strokeWidth="2.5"
        />
      )}

      {/* Label nomor KA tetap mendatar walau rangkaian berjalan di sepur miring. */}
      <g transform={`rotate(${-sudut})`}>
        <line x1="0" y1={-8} x2="0" y2={-14} stroke={warnaTanda} strokeWidth="1" />
        <TandaNomor nomor={kereta.nomorKA} warna={warnaTanda} />
      </g>
    </g>
  );
}

/**
 * Simbol rangkaian.
 *
 * Digambar sebagai badan bersambung dengan hidung bersudut di muka, sehingga
 * arah jalan terbaca tanpa perlu tanda panah tambahan. Sekat antar-kereta
 * dibuat sebagai celah selebar latar papan, bukan garis di atas badan, supaya
 * tetap terbaca sebagai satu rangkaian pada ukuran kecil. Rangkaian yang
 * ditarik lokomotif memakai balok muka yang lebih tinggi dan lebih gelap.
 */
function SimbolRangkaian({
  panjang,
  warna,
  jenisSarana,
  terpilih,
}: {
  panjang: number;
  warna: string;
  jenisSarana: KeretaAktif['jenisSarana'];
  terpilih: boolean;
}) {
  const t = 13; // tinggi badan
  const h = t / 2;
  const muka = panjang / 2;
  const buntut = -panjang / 2;
  const berlokomotif =
    jenisSarana === 'KA_ANTARKOTA' ||
    jenisSarana === 'KA_BARANG' ||
    jenisSarana === 'LOKOMOTIF';
  const panjangLok = berlokomotif ? 15 : 0;
  const pangkalKereta = muka - panjangLok;

  // Badan kereta: hidung bersudut di muka, buntut sedikit dipangkas.
  const badan = berlokomotif
    ? `M ${buntut + 2} ${-h} L ${pangkalKereta} ${-h} L ${pangkalKereta} ${h} L ${buntut + 2} ${h} L ${buntut} ${h - 2} L ${buntut} ${-h + 2} Z`
    : `M ${buntut + 2} ${-h} L ${muka - 6} ${-h} L ${muka} ${-h + 3} L ${muka} ${h - 3} L ${muka - 6} ${h} L ${buntut + 2} ${h} L ${buntut} ${h - 2} L ${buntut} ${-h + 2} Z`;

  const jumlahSekat = jenisSarana === 'KRL_8' ? 2 : jenisSarana === 'KA_BARANG' ? 5 : 3;
  const awal = buntut + 2;
  const akhir = pangkalKereta - (berlokomotif ? 0 : 6);
  const sekat = Array.from(
    { length: jumlahSekat },
    (_, i) => awal + ((akhir - awal) * (i + 1)) / (jumlahSekat + 1),
  );

  return (
    <g>
      <path
        d={badan}
        fill={warna}
        stroke={terpilih ? '#ffb302' : '#04070a'}
        strokeWidth={terpilih ? 2 : 1}
        strokeLinejoin="miter"
      />
      {/* Sekat antar-kereta */}
      {sekat.map((dx) => (
        <line key={dx} x1={dx} y1={-h} x2={dx} y2={h} stroke="#04070a" strokeWidth="1.4" />
      ))}
      {berlokomotif && (
        <>
          <path
            d={`M ${pangkalKereta} ${-h - 1.5} L ${muka - 5} ${-h - 1.5} L ${muka} ${-h + 3} L ${muka} ${h - 3} L ${muka - 5} ${h + 1.5} L ${pangkalKereta} ${h + 1.5} Z`}
            fill={gelapkan(warna, 0.55)}
            stroke={terpilih ? '#ffb302' : '#04070a'}
            strokeWidth={terpilih ? 2 : 1}
            strokeLinejoin="miter"
          />
          {/* Garis kap lokomotif */}
          <line
            x1={pangkalKereta + 4}
            y1={0}
            x2={muka - 4}
            y2={0}
            stroke={warna}
            strokeWidth="1.6"
          />
        </>
      )}
    </g>
  );
}

/** Kotak nomor KA bergaya label papan, bukan teks mengambang. */
function TandaNomor({ nomor, warna }: { nomor: string; warna: string }) {
  const lebar = Math.max(26, nomor.length * 6.4 + 8);
  return (
    <g transform={`translate(${-lebar / 2} -27)`}>
      <rect width={lebar} height={13} fill="#04070a" stroke={warna} strokeWidth="1" />
      <text
        x={lebar / 2}
        y={9.6}
        textAnchor="middle"
        className="font-mono"
        fontSize="9.5"
        fontWeight="600"
        letterSpacing="0.3"
        fill={warna}
      >
        {nomor}
      </text>
    </g>
  );
}

/** Gelapkan warna heks untuk badan lokomotif. */
function gelapkan(heks: string, faktor: number): string {
  const n = Number.parseInt(heks.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * faktor);
  const g = Math.round(((n >> 8) & 255) * faktor);
  const b = Math.round((n & 255) * faktor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
