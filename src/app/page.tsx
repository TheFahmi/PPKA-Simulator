'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KepalaPapan } from '@/components/KepalaPapan';
import { Modul, Petak, TandaKeandalan, Warta } from '@/components/panel';
import { perjalananDinas, ringkasKeandalan } from '@/lib/muat-data';
import { NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import {
  DAFTAR_STASIUN,
  LABEL_KESULITAN,
  LABEL_SUMBER_DENAH,
  type RingkasStasiun,
} from '@/lib/stasiun';
import type { KodeLin } from '@/lib/tipe';
import { usePapan } from '@/store/papan';

const WARNA_KESULITAN: Record<RingkasStasiun['tingkatKesulitan'], string> = {
  DASAR: '#1fb85a',
  MENENGAH: '#e9a51b',
  PADAT: '#e9a51b',
  BERAT: '#e02b1d',
};

export default function Briefing() {
  const stasiun = usePapan((s) => s.stasiun);
  const ringkas = usePapan((s) => s.ringkas);
  const emplasemen = usePapan((s) => s.emplasemen);
  const memuat = usePapan((s) => s.memuatStasiun);
  const galatMuat = usePapan((s) => s.galatMuat);
  const jadwal = usePapan((s) => s.jadwal);
  const jadwalDiimpor = usePapan((s) => s.jadwalDiimpor);
  const pilihStasiun = usePapan((s) => s.pilihStasiun);
  const mulaiDinas = usePapan((s) => s.mulaiDinas);
  const [dipilih, setDipilih] = useState<string | null>(null);

  // Stasiun bawaan dimuat begitu halaman dibuka; berpindah stasiun memuat
  // berkasnya sendiri, jadi tidak ada data stasiun lain yang ikut terbawa.
  useEffect(() => {
    void pilihStasiun(stasiun);
  }, [pilihStasiun, stasiun]);

  const dinasTerpilih =
    jadwal?.dinas.find((d) => d.id === dipilih) ?? jadwal?.dinas[0] ?? null;

  const rincian = useMemo(() => {
    if (!jadwal || !dinasTerpilih) return null;
    const daftar = perjalananDinas(jadwal, dinasTerpilih.mulai, dinasTerpilih.selesai);
    const perLin = daftar.reduce(
      (a, t) => {
        a[t.lin] = (a[t.lin] ?? 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    );
    const menit =
      Number(dinasTerpilih.selesai.split('.')[0]) * 60 +
      Number(dinasTerpilih.selesai.split('.')[1]) -
      (Number(dinasTerpilih.mulai.split('.')[0]) * 60 +
        Number(dinasTerpilih.mulai.split('.')[1]));
    const lama = menit <= 0 ? menit + 24 * 60 : menit;
    return {
      daftar,
      perLin,
      menit: lama,
      keandalan: ringkasKeandalan(daftar),
      headway: daftar.length > 1 ? Math.round((lama * 60) / daftar.length) : 0,
    };
  }, [jadwal, dinasTerpilih]);

  return (
    <div className="flex min-h-screen flex-col">
      <KepalaPapan />

      <main className="grid flex-1 grid-cols-1 gap-px bg-panel-line lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-px bg-panel-line">
          {/* Pemilihan stasiun */}
          <Modul
            label="Wilayah pengaturan"
            className="border-0"
            kanan={
              <span className="font-mono text-2xs text-vdu-dim">
                {DAFTAR_STASIUN.length} stasiun tersedia
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-px bg-panel-line sm:grid-cols-2 xl:grid-cols-3">
              {DAFTAR_STASIUN.map((s) => {
                const aktif = s.kode === stasiun;
                return (
                  <button
                    key={s.kode}
                    type="button"
                    onClick={() => {
                      setDipilih(null);
                      void pilihStasiun(s.kode);
                    }}
                    aria-pressed={aktif}
                    className={`flex flex-col gap-1.5 px-3 py-2.5 text-left transition-colors ${
                      aktif ? 'bg-panel-rail' : 'bg-panel-base hover:bg-panel-raised'
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span
                        className="border px-1 font-mono text-2xs font-semibold tracking-[0.14em]"
                        style={{
                          color: aktif ? '#ffb302' : '#8fa7b3',
                          borderColor: aktif ? '#ffb302' : '#1e3039',
                        }}
                      >
                        {s.kode}
                      </span>
                      <span
                        className={`font-mono text-sm font-semibold tracking-wide ${
                          aktif ? 'text-vdu-primary' : 'text-vdu-muted'
                        }`}
                      >
                        {s.nama}
                      </span>
                    </span>
                    <span className="font-mono text-2xs text-vdu-dim">{s.daop}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs tabular-nums text-vdu-dim">
                      <span>{s.jumlahSepur} sepur</span>
                      <span className="text-panel-line">│</span>
                      <span>{s.jumlahLintas} lintas</span>
                      <span className="text-panel-line">│</span>
                      <span>{s.jumlahPerjalanan} KA/hari</span>
                      {s.bertingkat && (
                        <>
                          <span className="text-panel-line">│</span>
                          <span>bertingkat</span>
                        </>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="border px-1 font-mono text-2xs uppercase tracking-[0.1em]"
                        style={{
                          color: WARNA_KESULITAN[s.tingkatKesulitan],
                          borderColor: WARNA_KESULITAN[s.tingkatKesulitan],
                        }}
                      >
                        {LABEL_KESULITAN[s.tingkatKesulitan]}
                      </span>
                      <span className="font-mono text-2xs text-vdu-dim">
                        puncak {s.puncakPerJam} KA/jam
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Modul>

          {/* Pemilihan dinas */}
          <Modul
            label={`Pemilihan dinas — ${ringkas?.nama ?? stasiun}`}
            className="border-0"
          >
            {galatMuat && (
              <div className="p-3">
                <Warta tingkat="bahaya">
                  Data stasiun tidak dapat dimuat: {galatMuat}
                </Warta>
              </div>
            )}
            {memuat && !galatMuat && (
              <div className="px-3 py-6 font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">
                Memuat emplasemen dan jadwal…
              </div>
            )}
            {jadwal && !memuat && (
              <div className="divide-y divide-panel-line">
                {jadwal.dinas.map((d) => {
                  const aktif = d.id === dinasTerpilih?.id;
                  const jumlah = perjalananDinas(jadwal, d.mulai, d.selesai).length;
                  const warna =
                    d.tingkatKesulitan === 'PADAT'
                      ? '#e02b1d'
                      : d.tingkatKesulitan === 'MENENGAH'
                        ? '#e9a51b'
                        : '#1fb85a';
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDipilih(d.id)}
                      aria-pressed={aktif}
                      className={`flex w-full items-start gap-4 px-3 py-3 text-left transition-colors ${
                        aktif ? 'bg-panel-rail' : 'hover:bg-panel-raised'
                      }`}
                    >
                      <span
                        className="mt-0.5 h-full w-1 shrink-0 self-stretch"
                        style={{ backgroundColor: aktif ? '#ffb302' : '#1e3039' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono text-sm font-semibold tracking-wide text-vdu-primary">
                            {d.nama}
                          </span>
                          <span className="font-mono text-xs tabular-nums text-signal-aspect-yellow">
                            {d.mulai} – {d.selesai}
                          </span>
                          <span
                            className="border px-1 font-mono text-2xs uppercase tracking-[0.12em]"
                            style={{ color: warna, borderColor: warna }}
                          >
                            {d.tingkatKesulitan}
                          </span>
                          <span className="font-mono text-2xs text-vdu-dim">
                            {jumlah} perjalanan
                          </span>
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-vdu-muted">
                          {d.keterangan}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Modul>

          {dinasTerpilih && rincian && (
            <Modul
              label={`Keterangan dinas — ${dinasTerpilih.nama}`}
              className="border-0"
              kanan={
                <Link
                  href="/dispatch"
                  className="tombol-panel tombol-panel-aktif"
                  onClick={() => mulaiDinas(dinasTerpilih.id)}
                >
                  Mulai dinas ▸
                </Link>
              }
            >
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-2 gap-px bg-panel-line sm:grid-cols-4">
                  <Petak
                    label="Lama dinas"
                    nilai={`${Math.floor(rincian.menit / 60)}j ${rincian.menit % 60}m`}
                  />
                  <Petak label="Perjalanan" nilai={rincian.daftar.length} satuan="KA" />
                  <Petak
                    label="Rerata selang"
                    nilai={Math.round(rincian.headway / 60)}
                    satuan="menit/KA"
                  />
                  <Petak
                    label="Peluang gangguan"
                    nilai={dinasTerpilih.peluangGangguanPerJam.toFixed(2)}
                    satuan="per jam"
                  />
                </div>

                <div>
                  <div className="mb-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                    Sebaran layanan
                  </div>
                  <div className="space-y-1">
                    {Object.entries(rincian.perLin).map(([lin, n]) => {
                      const bagian = (n / rincian.daftar.length) * 100;
                      return (
                        <div key={lin} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 font-mono text-2xs text-vdu-muted">
                            {NAMA_LIN[lin as KodeLin] ?? lin}
                          </span>
                          <span className="h-3 flex-1 border border-panel-line bg-panel-sunken">
                            <span
                              className="block h-full"
                              style={{
                                width: `${bagian}%`,
                                backgroundColor: WARNA_LIN[lin as KodeLin] ?? '#6f8794',
                              }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-vdu-muted">
                            {n}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-panel-line pt-2">
                  <span className="font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                    Keandalan baris jadwal
                  </span>
                  {Object.entries(rincian.keandalan).map(([k, n]) => (
                    <span key={k} className="flex items-center gap-1">
                      <TandaKeandalan nilai={k} />
                      <span className="font-mono text-2xs tabular-nums text-vdu-muted">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Modul>
          )}
        </div>

        {/* Kolom kanan: pengantar & keterangan data */}
        <div className="flex flex-col gap-px bg-panel-line">
          <Modul label="Pengantar dinas" className="border-0">
            <div className="space-y-2.5 p-3 text-xs leading-relaxed text-vdu-muted">
              <p>
                Petugas bertindak sebagai Pengatur Perjalanan Kereta Api pada wilayah pengaturan
                Stasiun {ringkas?.nama ?? '—'}. Tugas dinas meliputi penetapan jalur bagi setiap
                perjalanan yang masuk, pelayanan rute masuk dan rute keluar, penjagaan headway pada
                tiap petak jalan, serta penanganan gangguan peralatan dan kejadian luar biasa.
              </p>
              {ringkas && <p>{ringkas.keterangan}</p>}

              {/* Peruntukan jalur dibaca dari berkas emplasemen stasiun ini,
                  bukan ditulis di dalam kode, supaya tidak pernah berbeda
                  dengan denah yang benar-benar dilayani. */}
              {emplasemen && (
                <div className="grid grid-cols-1 gap-px bg-panel-line sm:grid-cols-2">
                  {emplasemen.sepur.map((sp) => (
                    <div key={sp.id} className="bg-panel-sunken px-2 py-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="font-mono text-2xs font-semibold tracking-[0.1em]"
                          style={{
                            color:
                              WARNA_LIN[sp.linDilayani[0] as KodeLin] ??
                              (sp.peronId ? '#8fa7b3' : '#728d9b'),
                          }}
                        >
                          {sp.label}
                        </span>
                        {sp.level === 'LAYANG' && (
                          <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-vdu-dim">
                            layang
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[0.65rem] leading-snug text-vdu-dim">
                        {sp.keterangan || (sp.peronId ? 'Berperon.' : 'Tanpa peron.')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p>
                Rangkaian yang belum memperoleh rute akan berhenti di muka sinyal masuk pada
                Semboyan 7. Keterlambatan yang terjadi menular ke perjalanan berikutnya pada petak
                jalan yang sama.
              </p>
            </div>
          </Modul>

          <Modul label="Asal data" className="border-0">
            <div className="space-y-2 p-3">
              {jadwalDiimpor && (
                <Warta tingkat="perhatian">
                  Papan sedang memakai berkas jadwal hasil impor, bukan berkas bawaan.
                </Warta>
              )}
              <div className="space-y-1 font-mono text-2xs text-vdu-muted">
                <div>
                  <span className="text-vdu-dim">Edisi: </span>
                  {jadwal?.gapeka ?? '—'}
                </div>
                <div>
                  <span className="text-vdu-dim">Berkas disusun: </span>
                  {jadwal?.tanggalDibuat ?? '—'}
                </div>
                <div>
                  <span className="text-vdu-dim">Acuan emplasemen: </span>
                  {emplasemen?.acuan.tanggalAcuan ?? '—'}
                </div>
                {ringkas && (
                  <div>
                    <span className="text-vdu-dim">Denah: </span>
                    {LABEL_SUMBER_DENAH[ringkas.sumberDenah]}
                  </div>
                )}
              </div>
              <p className="text-[0.65rem] leading-relaxed text-vdu-dim">
                {jadwal?.catatanKeakuratan}
              </p>
              <ul className="space-y-0.5 border-t border-panel-line pt-2 font-mono text-[0.6rem] leading-relaxed text-vdu-dim">
                {(jadwal?.sumber ?? []).map((s) => (
                  <li key={s} className="truncate" title={s}>
                    · {s}
                  </li>
                ))}
              </ul>
              <Link href="/data" className="tombol-panel inline-block">
                Periksa &amp; ganti berkas jadwal
              </Link>
            </div>
          </Modul>
        </div>
      </main>

      <footer className="shrink-0 border-t border-panel-line bg-panel-rail px-3 py-1.5 font-mono text-2xs text-vdu-dim">
        Simulasi untuk keperluan latihan dan pengenalan. Bukan perangkat pelayanan persinyalan, dan
        tidak boleh dipakai untuk pengaturan perjalanan kereta api sesungguhnya.
      </footer>
    </div>
  );
}
