'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KepalaPapan } from '@/components/KepalaPapan';
import { Modul, Petak, Warta } from '@/components/panel';
import { indeks } from '@/lib/muat-data';
import { NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import { KETERANGAN_PERINGKAT } from '@/lib/skor';
import { golonganDeviasi, keDeviasi, keDeviasiPanjang, keJam } from '@/lib/waktu';
import { usePapan } from '@/store/papan';

const WARNA_PERINGKAT: Record<string, string> = {
  A: '#1fb85a',
  B: '#22e05f',
  C: '#e9a51b',
  D: '#ff8a1f',
  E: '#e02b1d',
};

export default function LaporanAkhirDinas() {
  const router = useRouter();
  const sim = usePapan((s) => s.sim);
  const hasil = usePapan((s) => s.hasil);
  const mulaiDinas = usePapan((s) => s.mulaiDinas);

  if (!sim || !hasil) {
    return (
      <div className="flex min-h-screen flex-col">
        <KepalaPapan />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-3">
            <Warta tingkat="perhatian">
              Belum ada laporan akhir dinas. Laporan disusun setelah sesi dinas ditutup.
            </Warta>
            <Link href="/" className="tombol-panel tombol-panel-aktif inline-block">
              ◂ Kembali ke pemilihan dinas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const ix = indeks();
  const adaRealisasi = hasil.keretaDilayani.length > 0;
  const keretaOtomatis = sim.kereta.filter((k) => k.dilayaniOtomatis).length;
  const dilayani = [...hasil.keretaDilayani].sort((a, b) => a.jadwalBerangkat - b.jadwalBerangkat);
  const belumDilayani = sim.kereta.filter((k) => k.aktualBerangkat === null);
  const pemakaian = Object.values(sim.pemakaianSepur).filter((p) => p.jumlahKereta > 0);
  const puncakPemakaian = Math.max(1, ...pemakaian.map((p) => p.jumlahKereta));

  return (
    <div className="flex min-h-screen flex-col">
      <KepalaPapan
        tautan={false}
        kanan={
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="tombol-panel"
              onClick={() => {
                mulaiDinas(sim.dinas.id);
                router.push('/dispatch');
              }}
            >
              Ulangi dinas ini
            </button>
            <Link href="/" className="tombol-panel tombol-panel-aktif">
              Pilih dinas lain
            </Link>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-modul p-modul">
        {/* Kepala laporan */}
        <section className="border border-panel-line-bright bg-panel-base">
          <div className="border-b border-panel-line bg-panel-rail px-3 py-2">
            <h1 className="font-mono text-sm font-semibold tracking-[0.08em] text-vdu-primary">
              LAPORAN AKHIR DINAS PENGATUR PERJALANAN KERETA API
            </h1>
            <p className="font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">
              Stasiun Manggarai (MRI) · Daop 1 Jakarta
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-panel-line md:grid-cols-5">
            {[
              ['Sesi dinas', sim.dinas.nama],
              ['Jam dinas', `${sim.dinas.mulai} – ${sim.dinas.selesai}`],
              ['Dinas ditutup pukul', keJam(sim.waktu)],
              ['Perjalanan termuat', `${sim.kereta.length} KA`],
              [
                'Pelayanan rute',
                sim.ruteOtomatis === 0
                  ? 'Seluruhnya oleh petugas'
                  : `${sim.ruteOtomatis} rute oleh papan, ${keretaOtomatis} KA terbantu`,
              ],
            ].map(([l, v]) => (
              <div key={l} className="bg-panel-base px-3 py-2">
                <div className="font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">{l}</div>
                <div className="mt-0.5 font-mono text-sm text-vdu-primary">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Penilaian */}
        <section className="grid grid-cols-1 gap-modul lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex flex-col justify-center border border-panel-line bg-panel-base p-4 text-center">
            <div className="font-mono text-2xs uppercase tracking-[0.18em] text-vdu-dim">
              Nilai pelaksanaan dinas
            </div>
            <div
              className="mt-1 font-mono text-6xl font-bold leading-none tabular-nums"
              style={{ color: WARNA_PERINGKAT[hasil.peringkat] }}
            >
              {hasil.peringkat}
            </div>
            <div className="mt-2 font-mono text-2xl tabular-nums text-vdu-primary">
              {hasil.nilaiAkhir}
              <span className="text-sm text-vdu-dim"> / 1000</span>
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-vdu-muted">
              {KETERANGAN_PERINGKAT[hasil.peringkat]}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px self-start bg-panel-line md:grid-cols-4">
            <Petak
              label="Ketepatan waktu"
              nilai={(hasil.ketepatanWaktu * 100).toFixed(1)}
              satuan="%"
              warna={hasil.ketepatanWaktu >= 0.85 ? '#1fb85a' : hasil.ketepatanWaktu >= 0.6 ? '#e9a51b' : '#e02b1d'}
            />
            <Petak
              label="Rerata deviasi"
              nilai={adaRealisasi ? keDeviasi(hasil.rerataDeviasiDetik) : '—'}
              warna={hasil.rerataDeviasiDetik <= 180 ? '#1fb85a' : '#e9a51b'}
            />
            <Petak
              label="Deviasi terburuk"
              nilai={adaRealisasi ? keDeviasi(hasil.deviasiTerburukDetik) : '—'}
              warna="#e9a51b"
            />
            <Petak
              label="Efisiensi peron"
              nilai={(hasil.efisiensiPeron * 100).toFixed(0)}
              satuan="% sesuai peruntukan"
            />
            <Petak label="KA diberangkatkan" nilai={hasil.keretaDilayani.length} satuan={`dari ${hasil.keretaTotal}`} />
            <Petak label="KA selesai lintas" nilai={hasil.keretaSelesai} />
            <Petak
              label="Kelancaran"
              nilai={(hasil.kelancaran * 100).toFixed(0)}
              satuan="% tanpa tertahan"
              warna={hasil.kelancaran >= 0.9 ? '#1fb85a' : hasil.kelancaran >= 0.7 ? '#e9a51b' : '#e02b1d'}
            />
            <Petak
              label="Pelanggaran"
              nilai={hasil.pelanggaran}
              satuan={`−${hasil.potonganPelanggaran} nilai`}
              warna={hasil.pelanggaran === 0 ? '#1fb85a' : '#e02b1d'}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-modul xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Realisasi perjalanan */}
          <Modul label="Realisasi perjalanan">
            <div className="max-h-[30rem] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0">
                  <tr>
                    <th className="kepala-kolom w-[5rem]">No. KA</th>
                    <th className="kepala-kolom">Relasi</th>
                    <th className="kepala-kolom w-[3.5rem] text-center">Jalur</th>
                    <th className="kepala-kolom w-[5rem] text-right">Jadwal</th>
                    <th className="kepala-kolom w-[5rem] text-right">Realisasi</th>
                    <th className="kepala-kolom w-[4rem] text-right">Deviasi</th>
                    <th className="kepala-kolom w-[4rem] text-right">Tertahan</th>
                  </tr>
                </thead>
                <tbody>
                  {dilayani.map((k) => {
                    const gol = golonganDeviasi(k.deviasiDetik);
                    const warna =
                      gol === 'LAMBAT_BERAT'
                        ? '#e02b1d'
                        : gol === 'LAMBAT'
                          ? '#e9a51b'
                          : gol === 'AWAL'
                            ? '#4aa8d8'
                            : '#1fb85a';
                    return (
                      <tr key={k.id}>
                        <td className="sel-data font-semibold" style={{ color: WARNA_LIN[k.lin] }}>
                          {k.nomorKA}
                        </td>
                        <td className="sel-data text-vdu-muted">
                          <span className="text-2xs uppercase tracking-wider text-vdu-dim">
                            {NAMA_LIN[k.lin]}
                          </span>{' '}
                          {k.relasi}
                        </td>
                        <td className="sel-data text-center text-vdu-muted">
                          {k.sepurLazimTerpakai === false ? (
                            <span className="text-signal-aspect-yellow" title="Di luar peruntukan lazim">
                              {ix.data.sepur.find((s) => s.id === k.sepurId)?.nomor ?? '—'}*
                            </span>
                          ) : (
                            (ix.data.sepur.find((s) => s.id === k.sepurId)?.nomor ?? '—')
                          )}
                        </td>
                        <td className="sel-data text-right text-vdu-muted">
                          {keJam(k.jadwalBerangkat, false)}
                        </td>
                        <td className="sel-data text-right">
                          {k.aktualBerangkat !== null ? keJam(k.aktualBerangkat, false) : '—'}
                        </td>
                        <td className="sel-data text-right" style={{ color: warna }}>
                          {keDeviasi(k.deviasiDetik)}
                        </td>
                        <td className="sel-data text-right text-vdu-dim">
                          {k.totalTertahanDetik > 0 ? `${Math.round(k.totalTertahanDetik / 60)}′` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-panel-line px-3 py-2 font-mono text-2xs text-vdu-dim">
              Tanda * menunjukkan jalur di luar peruntukan lazim relasi tersebut. Total waktu
              rangkaian tertahan di muka sinyal masuk pada dinas ini{' '}
              {Math.round(hasil.totalTertahanDetik / 60)} menit.
            </div>
          </Modul>

          <div className="space-y-modul">
            {/* Andil keterlambatan */}
            <Modul label="Andil keterlambatan">
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-3 gap-px bg-panel-line">
                  {[
                    ['Tepat waktu', hasil.keretaTepat, '#1fb85a'],
                    ['Terlambat', hasil.keretaLambat, '#e9a51b'],
                    ['Terlambat berat', hasil.keretaLambatBerat, '#e02b1d'],
                  ].map(([l, n, w]) => (
                    <div key={String(l)} className="bg-panel-sunken px-2 py-2 text-center">
                      <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: String(w) }}>
                        {n as number}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-vdu-dim">
                        {l as string}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-2xs leading-relaxed text-vdu-muted">
                  Batas toleransi ketepatan waktu ditetapkan 3 menit terhadap jam berangkat menurut
                  jadwal. Keterlambatan di atas 10 menit digolongkan terlambat berat. Peralatan
                  persinyalan menolak {hasil.konflikDicegah} kali permintaan pembentukan rute pada
                  dinas ini; penolakan itu mencegah konflik jalur, tetapi juga menandakan rencana
                  pelayanan yang perlu dikoreksi, sehingga tidak menambah nilai.
                </p>
                {belumDilayani.length > 0 && (
                  <Warta tingkat="perhatian">
                    {belumDilayani.length} perjalanan belum diberangkatkan sampai dinas ditutup:{' '}
                    {belumDilayani
                      .slice(0, 8)
                      .map((k) => `KA ${k.nomorKA}`)
                      .join(', ')}
                    {belumDilayani.length > 8 ? ', dan lainnya.' : '.'}
                  </Warta>
                )}
              </div>
            </Modul>

            {/* Pemakaian sepur */}
            <Modul label="Pemakaian sepur">
              <div className="space-y-1 p-3">
                {pemakaian.map((p) => {
                  const sp = ix.data.sepur.find((s) => s.id === p.sepurId);
                  if (!sp) return null;
                  return (
                    <div key={p.sepurId} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 font-mono text-2xs text-vdu-muted">
                        Jalur {sp.nomor}
                      </span>
                      <span className="h-3 flex-1 border border-panel-line bg-panel-sunken">
                        <span
                          className="block h-full bg-track-clear"
                          style={{ width: `${(p.jumlahKereta / puncakPemakaian) * 100}%` }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-2xs tabular-nums text-vdu-dim">
                        {p.jumlahKereta} KA · {Math.round(p.totalDetikDiduduki / 60)}′
                      </span>
                    </div>
                  );
                })}
                {pemakaian.length === 0 && (
                  <p className="font-mono text-2xs text-vdu-dim">
                    Tidak ada sepur yang diduduki pada dinas ini.
                  </p>
                )}
              </div>
            </Modul>

            {/* Catatan pelanggaran & gangguan */}
            <Modul label="Catatan pelanggaran dan gangguan">
              <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                {sim.pelanggaran.length === 0 && sim.gangguan.length === 0 && (
                  <p className="font-mono text-2xs text-vdu-dim">
                    Tidak ada pelanggaran maupun gangguan tercatat pada dinas ini.
                  </p>
                )}
                {sim.pelanggaran.map((p) => (
                  <div
                    key={p.id}
                    className="border-l-2 border-signal-aspect-red bg-panel-sunken px-2 py-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 font-mono text-2xs text-vdu-dim">
                      <span>{keJam(p.waktu)}</span>
                      <span className="text-signal-aspect-red">
                        {p.jenis.replace(/_/g, ' ')} · −{p.bobot}
                      </span>
                    </div>
                    <p className="mt-0.5 text-2xs leading-snug text-vdu-muted">{p.keterangan}</p>
                  </div>
                ))}
                {sim.gangguan.map((g) => (
                  <div
                    key={g.id}
                    className="border-l-2 border-signal-aspect-yellow bg-panel-sunken px-2 py-1.5"
                  >
                    <div className="flex items-baseline justify-between gap-2 font-mono text-2xs text-vdu-dim">
                      <span>{keJam(g.mulai)}</span>
                      <span className="text-signal-aspect-yellow">
                        {g.jenis.replace(/_/g, ' ')} · {g.teratasi ? 'teratasi' : 'belum teratasi'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-2xs leading-snug text-vdu-muted">{g.keterangan}</p>
                  </div>
                ))}
              </div>
            </Modul>
          </div>
        </div>

        {/* Penutup laporan */}
        <section className="border border-panel-line bg-panel-base px-3 py-3">
          <p className="text-xs leading-relaxed text-vdu-muted">
            Demikian laporan pelaksanaan dinas {sim.dinas.nama} pada Stasiun Manggarai. Dari{' '}
            {hasil.keretaTotal} perjalanan yang termuat,{' '}
            {adaRealisasi ? (
              <>
                {hasil.keretaDilayani.length} perjalanan telah diberangkatkan dengan rerata
                keberangkatan {keDeviasiPanjang(hasil.rerataDeviasiDetik)}.
              </>
            ) : (
              <>
                tidak ada satu pun perjalanan yang diberangkatkan karena dinas ditutup sebelum
                pelayanan rute dilaksanakan.
              </>
            )}{' '}
            Tercatat {hasil.konflikDicegah} penolakan pembentukan rute oleh peralatan persinyalan
            dan {hasil.pelanggaran} catatan pelanggaran tata cara pelayanan.{' '}
            {sim.ruteOtomatis === 0
              ? 'Seluruh rute pada dinas ini dilayani petugas.'
              : `Sebanyak ${sim.ruteOtomatis} rute dibentuk oleh pelayanan otomatis papan, menyentuh ${keretaOtomatis} perjalanan; nilai di atas karenanya tidak seluruhnya mencerminkan pelayanan petugas.`}
          </p>
        </section>
      </main>

      <footer className="shrink-0 border-t border-panel-line bg-panel-rail px-3 py-1.5 font-mono text-2xs text-vdu-dim">
        Laporan ini merupakan keluaran simulasi latihan, bukan dokumen dinas PT Kereta Api Indonesia.
      </footer>
    </div>
  );
}
