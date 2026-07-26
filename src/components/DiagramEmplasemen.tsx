'use client';

import { useMemo } from 'react';
import {
  jalurSvgRuas,
  panjangGambarRuas,
  titikPadaRuas,
  type IndeksEmplasemen,
} from '@/lib/emplasemen';
import { WARNA_LIN } from '@/lib/semboyan';
import type { KeadaanSimulasi } from '@/lib/simulasi';
import type { AspekSinyal, KeadaanBlok, KeretaAktif, Level } from '@/lib/tipe';

/**
 * Papan diagram jalur (track diagram) Stasiun Manggarai.
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
}

export function DiagramEmplasemen({
  ix,
  sim,
  level,
  keretaTerpilih,
  onPilihKereta,
  onPilihWesel,
}: Props) {
  const kanvas = ix.data.kanvas[level];

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
      aria-label={`Diagram jalur Stasiun Manggarai lantai ${level === 'DASAR' ? 'dasar' : 'layang'}`}
    >
      <defs>
        <pattern id={`arsir-${level}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#33505f" strokeWidth="2" />
        </pattern>
        <pattern id={`arsir-mati-${level}`} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1e3039" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Peron */}
      {peronLevel.map((p) => {
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
        const d = jalurSvgRuas(ix, r.id);
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
        const simpul = ix.simpul.get(w.simpulId);
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
        const simpul = ix.simpul.get(sg.simpulId);
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
        const awal = ix.simpul.get(ruas.dari);
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
        const simpul = ix.simpul.get(b.simpulId);
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
}: {
  ix: IndeksEmplasemen;
  kereta: KeretaAktif;
  terpilih: boolean;
  onPilih: (id: string | null) => void;
}) {
  const warna = WARNA_LIN[kereta.lin];
  const menunggu = kereta.fase === 'DIWARTAKAN' || kereta.fase === 'TERTAHAN_SINYAL';
  const panjang =
    kereta.jenisSarana === 'KA_ANTARKOTA' ? 52 : kereta.jenisSarana === 'KRL_8' ? 30 : 40;

  let x: number;
  let y: number;
  let sudut = 0;

  if (menunggu) {
    const batas = ix.data.batas.find((b) => b.id === kereta.batasMasukId);
    const simpul = batas ? ix.simpul.get(batas.simpulId) : undefined;
    if (!simpul || !batas) return null;
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
    const panjangRuas = panjangGambarRuas(ix, kereta.ruasId);
    const mundur = panjangRuas > 0 ? panjang / 2 / panjangRuas : 0;
    const titik = titikPadaRuas(
      ix,
      kereta.ruasId,
      Math.max(0, kereta.kemajuan - mundur),
      kereta.simpulMasukRuas[kereta.indeksRuas],
    );
    x = titik.x;
    y = titik.y;
    sudut = titik.sudut;
  } else {
    return null;
  }

  return (
    <g
      transform={`translate(${x} ${y}) rotate(${sudut})`}
      className="cursor-pointer"
      onClick={() => onPilih(terpilih ? null : kereta.id)}
    >
      <rect
        x={-panjang / 2}
        y={-7}
        width={panjang}
        height={14}
        fill={warna}
        stroke={terpilih ? '#ffb302' : '#04070a'}
        strokeWidth={terpilih ? 2 : 1}
        opacity={menunggu ? 0.75 : 1}
      />
      {/* Garis pemisah kereta pada rangkaian */}
      {[-panjang / 6, panjang / 6].map((dx) => (
        <line key={dx} x1={dx} y1={-7} x2={dx} y2={7} stroke="#04070a" strokeWidth="1" opacity="0.5" />
      ))}
      <g transform={`rotate(${-sudut})`}>
        <text
          x="0"
          y={-13}
          textAnchor="middle"
          className="font-mono"
          fontSize="10.5"
          fontWeight="600"
          fill={terpilih ? '#ffb302' : '#d6e6ee'}
          stroke="#04070a"
          strokeWidth="2.6"
          paintOrder="stroke"
        >
          {kereta.nomorKA}
        </text>
        {kereta.fase === 'TERTAHAN_SINYAL' && (
          <text
            x="0"
            y={22}
            textAnchor="middle"
            className="font-mono"
            fontSize="8.5"
            fill="#ff2a1c"
            stroke="#04070a"
            strokeWidth="2.4"
            paintOrder="stroke"
          >
            TERTAHAN S.7
          </text>
        )}
      </g>
    </g>
  );
}
