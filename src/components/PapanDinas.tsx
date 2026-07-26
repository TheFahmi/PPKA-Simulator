'use client';

import { useMemo, useState } from 'react';
import { Lampu, TandaKeandalan } from '@/components/panel';
import { NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import { labelFase, menuntutTindakan, urutkanPapanDinas, WARNA_FASE } from '@/lib/tampilan';
import type { IndeksEmplasemen } from '@/lib/emplasemen';
import type { KeadaanSimulasi } from '@/lib/simulasi';
import { golonganDeviasi, keDeviasi, keJam } from '@/lib/waktu';

type Saring = 'AKTIF' | 'SEMUA' | 'TINDAKAN';

/**
 * Papan dinas: daftar perjalanan pada sesi dinas berjalan, disusun menurut
 * urutan tuntutan pelayanan — bukan sekadar urutan jam.
 */
export function PapanDinas({
  ix,
  sim,
  terpilih,
  onPilih,
}: {
  ix: IndeksEmplasemen;
  sim: KeadaanSimulasi;
  terpilih: string | null;
  onPilih: (id: string | null) => void;
}) {
  const [saring, setSaring] = useState<Saring>('AKTIF');

  // Bergantung pada `sim` secara utuh, bukan pada `sim.kereta`: mesin memutakhirkan
  // isi larik di tempat, sehingga jati diri larik tidak pernah berubah dan memo
  // akan membeku bila dipakai sebagai dependensi.
  const daftar = useMemo(() => {
    const semua = urutkanPapanDinas(sim.kereta);
    if (saring === 'SEMUA') return semua;
    if (saring === 'TINDAKAN') return semua.filter(menuntutTindakan);
    return semua.filter((k) => k.fase !== 'SELESAI' && k.fase !== 'BATAL');
  }, [sim, saring]);

  const jumlahTindakan = sim.kereta.filter(menuntutTindakan).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-panel-line bg-panel-sunken px-2 py-1.5">
        {(
          [
            ['TINDAKAN', `Menunggu pelayanan (${jumlahTindakan})`],
            ['AKTIF', 'Dalam dinas'],
            ['SEMUA', 'Seluruh perjalanan'],
          ] as Array<[Saring, string]>
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            className={`tombol-panel ${saring === nilai ? 'tombol-panel-aktif' : ''}`}
            onClick={() => setSaring(nilai)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="kepala-kolom w-[4.5rem]">No. KA</th>
              <th className="kepala-kolom w-[5.5rem]">Lin</th>
              <th className="kepala-kolom">Relasi</th>
              <th className="kepala-kolom w-[4.5rem] text-right">Datang</th>
              <th className="kepala-kolom w-[4.5rem] text-right">Berangkat</th>
              <th className="kepala-kolom w-[3.5rem] text-center">Jalur</th>
              <th className="kepala-kolom w-[10rem]">Keadaan</th>
              <th className="kepala-kolom w-[4rem] text-right">Deviasi</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((k) => {
              const sepur = ix.data.sepur.find((s) => s.id === k.sepurId);
              const gol = golonganDeviasi(k.deviasiDetik);
              const warnaDev =
                gol === 'LAMBAT_BERAT'
                  ? '#e02b1d'
                  : gol === 'LAMBAT'
                    ? '#e9a51b'
                    : gol === 'AWAL'
                      ? '#4aa8d8'
                      : '#1fb85a';
              const aktifBaris = k.id === terpilih;
              return (
                <tr
                  key={k.id}
                  // Baris berlaku sebagai kendali pemilihan perjalanan, karena itu
                  // harus terjangkau papan ketik seperti tombol biasa.
                  role="button"
                  tabIndex={0}
                  aria-pressed={aktifBaris}
                  aria-label={`Perjalanan KA ${k.nomorKA}, ${k.relasi}, ${labelFase(k)}`}
                  onClick={() => onPilih(aktifBaris ? null : k.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPilih(aktifBaris ? null : k.id);
                    }
                  }}
                  className={`cursor-pointer transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-signal-aspect-yellow ${
                    aktifBaris
                      ? 'bg-panel-rail outline outline-1 -outline-offset-1 outline-signal-aspect-yellow'
                      : 'hover:bg-panel-raised'
                  }`}
                >
                  <td className="sel-data font-semibold">
                    <span className="flex items-center gap-1.5">
                      {menuntutTindakan(k) ? (
                        <Lampu warna={WARNA_FASE[k.fase]} kedip={k.fase === 'TERTAHAN_SINYAL'} ukuran={6} />
                      ) : (
                        <span className="inline-block w-1.5" />
                      )}
                      {k.nomorKA}
                    </span>
                  </td>
                  <td className="sel-data">
                    <span
                      className="border-l-2 pl-1.5 text-2xs uppercase tracking-wider"
                      style={{ borderColor: WARNA_LIN[k.lin], color: WARNA_LIN[k.lin] }}
                    >
                      {NAMA_LIN[k.lin]}
                    </span>
                  </td>
                  <td className="sel-data text-vdu-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{k.relasi}</span>
                      <TandaKeandalan nilai={k.keandalanData} />
                    </span>
                  </td>
                  <td className="sel-data text-right text-vdu-muted">
                    {keJam(k.jadwalDatang, false)}
                  </td>
                  <td className="sel-data text-right">{keJam(k.jadwalBerangkat, false)}</td>
                  <td className="sel-data text-center">
                    {sepur ? (
                      <span className="border border-panel-line-bright px-1 font-semibold">
                        {sepur.nomor}
                      </span>
                    ) : (
                      <span className="text-vdu-dim">—</span>
                    )}
                  </td>
                  <td className="sel-data" style={{ color: WARNA_FASE[k.fase] }}>
                    {labelFase(k)}
                  </td>
                  <td className="sel-data text-right" style={{ color: warnaDev }}>
                    {k.fase === 'BELUM_DINAS' ? '—' : keDeviasi(k.deviasiDetik)}
                  </td>
                </tr>
              );
            })}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center font-mono text-xs text-vdu-dim">
                  Tidak ada perjalanan pada saringan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
