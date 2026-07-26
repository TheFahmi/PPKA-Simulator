'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KepalaPapan } from '@/components/KepalaPapan';
import { Modul, Petak, TandaKeandalan, Warta } from '@/components/panel';
import { EMPLASEMEN, perjalananDinas, ringkasKeandalan } from '@/lib/muat-data';
import { NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import type { KodeLin } from '@/lib/tipe';
import { usePapan } from '@/store/papan';

export default function Briefing() {
  const jadwal = usePapan((s) => s.jadwal);
  const jadwalDiimpor = usePapan((s) => s.jadwalDiimpor);
  const segarkan = usePapan((s) => s.segarkanJadwalTersimpan);
  const mulaiDinas = usePapan((s) => s.mulaiDinas);
  const [dipilih, setDipilih] = useState<string | null>(null);

  useEffect(() => {
    segarkan();
  }, [segarkan]);

  const dinasTerpilih = jadwal.dinas.find((d) => d.id === dipilih) ?? jadwal.dinas[0] ?? null;

  const rincian = useMemo(() => {
    if (!dinasTerpilih) return null;
    const daftar = perjalananDinas(jadwal, dinasTerpilih.mulai, dinasTerpilih.selesai);
    const perLin = daftar.reduce(
      (a, t) => {
        a[t.lin] = (a[t.lin] ?? 0) + 1;
        return a;
      },
      {} as Record<string, number>,
    );
    const menit =
      (Number(dinasTerpilih.selesai.split('.')[0]) * 60 +
        Number(dinasTerpilih.selesai.split('.')[1])) -
      (Number(dinasTerpilih.mulai.split('.')[0]) * 60 +
        Number(dinasTerpilih.mulai.split('.')[1]));
    return {
      daftar,
      perLin,
      menit,
      keandalan: ringkasKeandalan(daftar),
      headway: daftar.length > 1 ? Math.round((menit * 60) / daftar.length) : 0,
    };
  }, [jadwal, dinasTerpilih]);

  return (
    <div className="flex min-h-screen flex-col">
      <KepalaPapan />

      <main className="grid flex-1 grid-cols-1 gap-px bg-panel-line lg:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Kolom kiri: pemilihan dinas */}
        <div className="flex flex-col gap-px bg-panel-line">
          <Modul label="Pemilihan dinas" className="border-0">
            <div className="divide-y divide-panel-line">
              {jadwal.dinas.map((d) => {
                const aktif = d.id === dinasTerpilih?.id;
                const jumlah = perjalananDinas(jadwal, d.mulai, d.selesai).length;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDipilih(d.id)}
                    className={`flex w-full items-start gap-4 px-3 py-3 text-left transition-colors ${
                      aktif ? 'bg-panel-rail' : 'hover:bg-panel-raised'
                    }`}
                  >
                    <span
                      className="mt-0.5 h-full w-1 shrink-0 self-stretch"
                      style={{
                        backgroundColor: aktif ? '#ffb302' : '#1e3039',
                      }}
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
                          style={{
                            color:
                              d.tingkatKesulitan === 'PADAT'
                                ? '#e02b1d'
                                : d.tingkatKesulitan === 'MENENGAH'
                                  ? '#e9a51b'
                                  : '#1fb85a',
                            borderColor:
                              d.tingkatKesulitan === 'PADAT'
                                ? '#e02b1d'
                                : d.tingkatKesulitan === 'MENENGAH'
                                  ? '#e9a51b'
                                  : '#1fb85a',
                          }}
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
                  <Petak label="Lama dinas" nilai={`${Math.floor(rincian.menit / 60)}j ${rincian.menit % 60}m`} />
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
                Stasiun Manggarai. Tugas dinas meliputi penetapan jalur bagi setiap perjalanan yang
                masuk, pelayanan rute masuk dan rute keluar, penjagaan headway pada tiap petak
                jalan, serta penanganan gangguan peralatan dan kejadian luar biasa.
              </p>
              <p>
                Emplasemen Manggarai bertingkat. Lantai layang memuat jalur 9 sampai 12 untuk
                Commuter Line Bogor; lantai dasar memuat jalur 1 sampai 8 untuk Commuter Line
                Cikarang, kereta barang beserta KLB, dan Commuter Line Basoetta. Susunan ini berlaku
                sejak Switch Over ke-7 pada 20 Desember 2023.
              </p>
              <div className="grid grid-cols-2 gap-px bg-panel-line">
                {[
                  ['Jalur 9–10', 'Lin Bogor arah Jakarta Kota (Cikini)', WARNA_LIN.LIN_BOGOR],
                  ['Jalur 11–12', 'Lin Bogor arah Bogor/Nambo (Tebet)', WARNA_LIN.LIN_BOGOR],
                  ['Jalur 1–2', 'Lin Cikarang arah Sudirman, Angke, Kampung Bandan', WARNA_LIN.LIN_CIKARANG],
                  ['Jalur 3–4', 'Lin Cikarang arah Matraman, Bekasi, Cikarang', WARNA_LIN.LIN_CIKARANG],
                  ['Jalur 5–6', 'Sepur simpan dan penyusulan; KA barang dan KLB, peron inaktif', WARNA_LIN.KLB],
                  ['Sepur lintas', 'KA jarak jauh relasi Gambir — berjalan langsung, tanpa berhenti', WARNA_LIN.KAJJ],
                  ['Jalur 7–8', 'Commuter Line Basoetta arah BNI City', WARNA_LIN.BANDARA],
                ].map(([jalur, guna, warna]) => (
                  <div key={jalur} className="bg-panel-sunken px-2 py-1.5">
                    <div
                      className="font-mono text-2xs font-semibold tracking-[0.1em]"
                      style={{ color: warna }}
                    >
                      {jalur}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] leading-snug text-vdu-dim">{guna}</div>
                  </div>
                ))}
              </div>
              <p>
                KA jarak jauh relasi Stasiun Gambir melintas Manggarai tanpa berhenti. Rute yang
                dibentuk baginya membentang utuh dari batas masuk sampai batas keluar; jalur 5 dan 6
                tersedia bila KA tersebut perlu disusul. Tidak ada KA jarak jauh yang melayani
                naik-turun penumpang di Manggarai.
              </p>
              <p>
                Rangkaian yang belum memperoleh rute akan berhenti di muka sinyal masuk pada
                Semboyan 7. Keterlambatan yang terjadi menular ke perjalanan berikutnya pada petak
                jalan yang sama.
              </p>
            </div>
          </Modul>

          <Modul label="Asal data jadwal" className="border-0">
            <div className="space-y-2 p-3">
              {jadwalDiimpor && (
                <Warta tingkat="perhatian">
                  Papan sedang memakai berkas jadwal hasil impor, bukan berkas bawaan.
                </Warta>
              )}
              <div className="space-y-1 font-mono text-2xs text-vdu-muted">
                <div>
                  <span className="text-vdu-dim">Edisi: </span>
                  {jadwal.gapeka}
                </div>
                <div>
                  <span className="text-vdu-dim">Berkas disusun: </span>
                  {jadwal.tanggalDibuat}
                </div>
                <div>
                  <span className="text-vdu-dim">Acuan emplasemen: </span>
                  {EMPLASEMEN.acuan.tanggalAcuan}
                </div>
              </div>
              <p className="text-[0.65rem] leading-relaxed text-vdu-dim">
                {jadwal.catatanKeakuratan}
              </p>
              <ul className="space-y-0.5 border-t border-panel-line pt-2 font-mono text-[0.6rem] leading-relaxed text-vdu-dim">
                {jadwal.sumber.map((s) => (
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
