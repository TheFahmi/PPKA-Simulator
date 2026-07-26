'use client';

import { useMemo, useState } from 'react';
import type { KeadaanSimulasi } from '@/lib/simulasi';
import type { TingkatKejadian } from '@/lib/tipe';
import { keJam } from '@/lib/waktu';

const WARNA_TINGKAT: Record<TingkatKejadian, string> = {
  NORMAL: '#1fb85a',
  INFO: '#4aa8d8',
  PERHATIAN: '#e9a51b',
  BAHAYA: '#e02b1d',
};

/**
 * Buku kejadian dinas. Kalimat warta ditulis sebagaimana lazimnya dicatat
 * pada buku WK, lengkap dengan jam pelayanan.
 */
export function LogKejadian({ sim }: { sim: KeadaanSimulasi }) {
  const [hanyaPenting, setHanyaPenting] = useState(false);

  // Dependensi memakai `sim` utuh: `sim.kejadian` dimutakhirkan di tempat oleh
  // mesin sehingga jati dirinya tidak pernah berganti.
  const daftar = useMemo(
    () =>
      hanyaPenting
        ? sim.kejadian.filter((k) => k.tingkat === 'PERHATIAN' || k.tingkat === 'BAHAYA')
        : sim.kejadian,
    [sim, hanyaPenting],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-panel-line bg-panel-sunken px-2 py-1.5">
        <span className="font-mono text-2xs text-vdu-dim">
          {sim.kejadian.length} catatan
        </span>
        <button
          type="button"
          className={`tombol-panel ${hanyaPenting ? 'tombol-panel-aktif' : ''}`}
          onClick={() => setHanyaPenting((v) => !v)}
        >
          Hanya perhatian &amp; bahaya
        </button>
      </div>
      <ol className="min-h-0 flex-1 divide-y divide-panel-line overflow-y-auto">
        {daftar.map((k) => (
          <li key={k.id} className="flex gap-2 px-2 py-1.5">
            <span className="shrink-0 font-mono text-2xs tabular-nums text-vdu-dim">
              {keJam(k.waktu)}
            </span>
            <span
              className="shrink-0 border px-1 font-mono text-[0.6rem] leading-4 tracking-wider"
              style={{ color: WARNA_TINGKAT[k.tingkat], borderColor: WARNA_TINGKAT[k.tingkat] }}
            >
              {k.kode}
            </span>
            <span className="min-w-0 flex-1 text-xs leading-snug text-vdu-muted">{k.teks}</span>
          </li>
        ))}
        {daftar.length === 0 && (
          <li className="px-3 py-6 text-center font-mono text-xs text-vdu-dim">
            Belum ada catatan pada saringan ini.
          </li>
        )}
      </ol>
    </div>
  );
}
