'use client';

import { useState } from 'react';
import { Lampu, Warta } from '@/components/panel';
import type { IndeksEmplasemen } from '@/lib/emplasemen';
import type { KeadaanSimulasi } from '@/lib/simulasi';
import type { Level } from '@/lib/tipe';
import { usePapan } from '@/store/papan';

/**
 * Papan keadaan peralatan: kedudukan wesel, aspek sinyal, dan gangguan yang
 * sedang berlangsung. Wesel yang tidak terkunci rute boleh dibalik dari panel.
 */
export function PanelPeralatan({ ix, sim }: { ix: IndeksEmplasemen; sim: KeadaanSimulasi }) {
  const layaniWesel = usePapan((s) => s.layaniWesel);
  const [pesan, setPesan] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>('DASAR');

  const wesel = ix.data.wesel.filter((w) => w.level === level);
  const gangguanAktif = sim.gangguan.filter((g) => !g.teratasi);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-panel-line bg-panel-sunken px-2 py-1.5">
        {(['DASAR', 'LAYANG'] as Level[]).map((l) => (
          <button
            key={l}
            type="button"
            className={`tombol-panel ${level === l ? 'tombol-panel-aktif' : ''}`}
            onClick={() => setLevel(l)}
          >
            {l === 'DASAR' ? 'Lantai dasar' : 'Lantai layang'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {pesan && <Warta tingkat="perhatian">{pesan}</Warta>}

        {gangguanAktif.length > 0 && (
          <div className="space-y-1">
            <div className="font-mono text-2xs uppercase tracking-[0.14em] text-signal-aspect-red">
              Gangguan berlangsung
            </div>
            {gangguanAktif.map((g) => (
              <div
                key={g.id}
                className="border border-signal-aspect-red/60 bg-panel-sunken px-2 py-1.5 text-2xs leading-snug text-vdu-muted"
                style={{ borderColor: '#e02b1d' }}
              >
                {g.keterangan}
                {g.selesai !== null && (
                  <span className="ml-1 font-mono text-vdu-dim">
                    (perkiraan pulih {Math.max(0, Math.ceil((g.selesai - sim.waktu) / 60))} menit)
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="mb-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
            Kedudukan wesel
          </div>
          <div className="grid grid-cols-3 gap-1">
            {wesel.map((w) => {
              const s = sim.wesel[w.id];
              if (!s) return null;
              const warna = s.gangguan
                ? '#ff5cc8'
                : s.membalik
                  ? '#ff8a1f'
                  : s.kedudukan === 'LURUS'
                    ? '#8fd4ea'
                    : '#ffcf4d';
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setPesan(layaniWesel(w.id))}
                  disabled={Boolean(s.terkunciOlehRute) || s.gangguan || s.membalik}
                  title={
                    s.gangguan
                      ? 'Wesel dalam gangguan.'
                      : s.terkunciOlehRute
                        ? 'Wesel terkunci rute yang sedang dilayani.'
                        : 'Balik kedudukan wesel.'
                  }
                  className="flex items-center justify-between gap-1 border border-panel-line bg-panel-sunken px-2 py-1 font-mono text-2xs
                             enabled:hover:border-panel-line-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="text-vdu-muted">W{w.nomor}</span>
                  <span className="flex items-center gap-1" style={{ color: warna }}>
                    <Lampu warna={warna} ukuran={6} kedip={s.membalik} />
                    {s.gangguan
                      ? 'GGN'
                      : s.membalik
                        ? 'BALIK'
                        : s.kedudukan === 'LURUS'
                          ? 'LRS'
                          : 'BLK'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
            Aspek sinyal
          </div>
          <div className="grid grid-cols-3 gap-1">
            {ix.data.sinyal
              .filter((sg) => sg.level === level)
              .map((sg) => {
                const s = sim.sinyal[sg.id];
                if (!s) return null;
                const warna =
                  s.aspek === 'HIJAU'
                    ? '#22e05f'
                    : s.aspek === 'KUNING'
                      ? '#ffb302'
                      : s.aspek === 'PUTIH'
                        ? '#e6f1f6'
                        : s.aspek === 'PADAM'
                          ? '#2a3a43'
                          : '#ff2a1c';
                return (
                  <div
                    key={sg.id}
                    className="flex items-center justify-between gap-1 border border-panel-line bg-panel-sunken px-2 py-1 font-mono text-2xs"
                    title={`Sinyal ${sg.jenis.toLowerCase()} ${sg.nama}`}
                  >
                    <span className="text-vdu-muted">{sg.nama}</span>
                    <Lampu warna={warna} ukuran={7} menyala={s.aspek !== 'PADAM'} />
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
