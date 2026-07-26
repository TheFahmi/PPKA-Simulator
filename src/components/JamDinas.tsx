'use client';

import { useEffect, useRef } from 'react';
import { Lampu } from '@/components/panel';
import { keJam } from '@/lib/waktu';
import { usePapan } from '@/store/papan';
import type { KecepatanJam, ModeOtomatis } from '@/lib/tipe';

/**
 * Jam dinas berjalan atas dasar requestAnimationFrame, bukan waktu nyata:
 * satu detik dinas maju sesuai faktor percepatan yang dipilih PPKA.
 */
export function useJamDinas(): void {
  const majuWaktu = usePapan((s) => s.majuWaktu);
  const terakhir = useRef<number | null>(null);
  const bingkai = useRef<number | null>(null);

  useEffect(() => {
    const langkah = (t: number) => {
      if (terakhir.current !== null) {
        const delta = Math.min(500, t - terakhir.current);
        majuWaktu(delta);
      }
      terakhir.current = t;
      bingkai.current = window.requestAnimationFrame(langkah);
    };
    bingkai.current = window.requestAnimationFrame(langkah);
    return () => {
      if (bingkai.current !== null) window.cancelAnimationFrame(bingkai.current);
      terakhir.current = null;
    };
  }, [majuWaktu]);
}

const KECEPATAN: KecepatanJam[] = [1, 2, 4];

const MODE: Array<{ nilai: ModeOtomatis; label: string; keterangan: string }> = [
  {
    nilai: 'MATI',
    label: 'Manual',
    keterangan: 'Seluruh rute dilayani petugas. Papan tidak membentuk rute apa pun.',
  },
  {
    nilai: 'SARAN',
    label: 'Saran',
    keterangan:
      'Papan menghitung usul penetapan jalur beserta alasannya; pembentukan rute tetap di tangan petugas.',
  },
  {
    nilai: 'PENUH',
    label: 'Otomatis',
    keterangan:
      'Papan melayani sendiri rute masuk dan rute keluar. Petugas mengawasi dan tetap boleh menyela dengan membentuk rute lain.',
  },
];

export function PanelJam() {
  const sim = usePapan((s) => s.sim);
  const aturJalan = usePapan((s) => s.aturJalan);
  const aturKecepatan = usePapan((s) => s.aturKecepatan);
  const aturModeOtomatis = usePapan((s) => s.aturModeOtomatis);
  const tutupDinas = usePapan((s) => s.tutupDinas);

  if (!sim) return null;

  const rentang = sim.selesaiPada - sim.mulai;
  const lewat = Math.max(0, Math.min(rentang, sim.waktu - sim.mulai));
  const persen = rentang > 0 ? (lewat / rentang) * 100 : 0;

  return (
    <div className="flex items-stretch gap-0 border border-panel-line bg-panel-base">
      <div className="flex items-center gap-3 border-r border-panel-line px-3 py-2">
        <Lampu
          warna={sim.dinasSelesai ? '#4d6673' : sim.berjalan ? '#1fb85a' : '#e9a51b'}
          kedip={sim.berjalan && !sim.dinasSelesai}
        />
        <div>
          <div className="font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">
            Jam dinas
          </div>
          <div className="font-mono text-jam font-semibold leading-none text-vdu-primary tabular-nums">
            {keJam(sim.waktu)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-r border-panel-line px-3">
        <button
          type="button"
          className={`tombol-panel ${sim.berjalan ? '' : 'tombol-panel-aktif'}`}
          onClick={() => aturJalan(false)}
          disabled={sim.dinasSelesai}
        >
          Tahan
        </button>
        <button
          type="button"
          className={`tombol-panel ${sim.berjalan ? 'tombol-panel-aktif' : ''}`}
          onClick={() => aturJalan(true)}
          disabled={sim.dinasSelesai}
        >
          Jalan
        </button>
      </div>

      <div className="flex items-center gap-1 border-r border-panel-line px-3">
        <span className="mr-1 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
          Percepatan
        </span>
        {KECEPATAN.map((k) => (
          <button
            key={k}
            type="button"
            className={`tombol-panel ${sim.kecepatan === k ? 'tombol-panel-aktif' : ''}`}
            onClick={() => aturKecepatan(k)}
            disabled={sim.dinasSelesai}
          >
            {k}×
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r border-panel-line px-3">
        <span className="mr-1 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
          Pelayanan
        </span>
        {MODE.map((m) => (
          <button
            key={m.nilai}
            type="button"
            title={m.keterangan}
            className={`tombol-panel ${sim.modeOtomatis === m.nilai ? 'tombol-panel-aktif' : ''}`}
            onClick={() => aturModeOtomatis(m.nilai)}
            disabled={sim.dinasSelesai}
          >
            {m.label}
          </button>
        ))}
        {sim.modeOtomatis === 'PENUH' && (
          <span className="ml-1 flex items-center gap-1 font-mono text-2xs text-signal-aspect-yellow">
            <Lampu warna="#ffb302" kedip ukuran={6} />
            {sim.ruteOtomatis} rute
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
        <div className="flex items-baseline justify-between font-mono text-2xs text-vdu-dim">
          <span>
            {sim.dinas.nama} · {sim.dinas.mulai}–{sim.dinas.selesai}
          </span>
          <span className="tabular-nums">{persen.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full border border-panel-line bg-panel-sunken">
          <div
            className="h-full bg-signal-aspect-yellow transition-[width] duration-200"
            style={{ width: `${persen}%` }}
          />
        </div>
      </div>

      <div className="flex items-center border-l border-panel-line px-3">
        <button
          type="button"
          className="tombol-panel tombol-panel-bahaya"
          onClick={tutupDinas}
          disabled={sim.dinasSelesai}
        >
          Tutup dinas
        </button>
      </div>
    </div>
  );
}
