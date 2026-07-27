'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { KepalaPapan } from '@/components/KepalaPapan';
import { Modul, Petak, TandaKeandalan, Warta } from '@/components/panel';
import { bacaBerkas, CONTOH_BARIS_CSV, keCsv, type HasilImpor } from '@/lib/impor';
import { periksaJadwalAman, type TemuanPeriksa } from '@/lib/muat-data';
import { NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import type { KodeLin } from '@/lib/tipe';
import { usePapan } from '@/store/papan';

/**
 * Mode pengembang: memeriksa berkas jadwal yang sedang dimuat dan menggantinya
 * dengan berkas terbaru saat GAPEKA direvisi, tanpa menyentuh kode.
 */
export default function BerkasJadwal() {
  const stasiun = usePapan((s) => s.stasiun);
  const emplasemen = usePapan((s) => s.emplasemen);
  const memuat = usePapan((s) => s.memuatStasiun);
  const pilihStasiun = usePapan((s) => s.pilihStasiun);
  const jadwal = usePapan((s) => s.jadwal);
  const jadwalDiimpor = usePapan((s) => s.jadwalDiimpor);
  const gantiJadwal = usePapan((s) => s.gantiJadwal);
  const kembalikan = usePapan((s) => s.kembalikanJadwalBawaan);
  const segarkan = usePapan((s) => s.segarkanJadwalTersimpan);

  const [saringLin, setSaringLin] = useState<string>('SEMUA');
  const [cari, setCari] = useState('');
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);
  const [tempel, setTempel] = useState('');
  const berkasRef = useRef<HTMLInputElement>(null);

  // Halaman ini bisa dibuka langsung tanpa melewati briefing; data stasiun
  // yang sedang dipilih dimuat di sini juga supaya tidak tampil kosong.
  useEffect(() => {
    void pilihStasiun(stasiun);
  }, [pilihStasiun, stasiun]);

  useEffect(() => {
    segarkan();
  }, [segarkan]);

  const temuan = useMemo<TemuanPeriksa[]>(
    () => (jadwal && emplasemen ? periksaJadwalAman(jadwal, emplasemen) : []),
    [jadwal, emplasemen],
  );
  const galat = temuan.filter((t) => t.tingkat === 'GALAT');
  const peringatan = temuan.filter((t) => t.tingkat === 'PERINGATAN');

  const perjalanan = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (jadwal?.perjalanan ?? []).filter((t) => {
      if (saringLin !== 'SEMUA' && t.lin !== saringLin) return false;
      if (!q) return true;
      const cocok = (n: unknown) => typeof n === 'string' && n.toLowerCase().includes(q);
      return cocok(t.nomorKA) || cocok(t.relasi) || cocok(t.asal) || cocok(t.tujuan);
    });
  }, [jadwal, saringLin, cari]);

  const perLin = useMemo(
    () =>
      (jadwal?.perjalanan ?? []).reduce(
        (a, t) => {
          a[t.lin] = (a[t.lin] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
    [jadwal],
  );

  const prosesTeks = (nama: string, teks: string) => {
    if (!jadwal || !emplasemen) return;
    let hasil: HasilImpor;
    try {
      hasil = bacaBerkas(nama, teks, jadwal);
    } catch (e) {
      setHasilImpor({
        jadwal: null,
        galat: [`Berkas tidak dapat dibaca: ${(e as Error).message}`],
      });
      return;
    }

    if (!hasil.jadwal) {
      setHasilImpor(hasil);
      return;
    }

    const galatBaru = periksaJadwalAman(hasil.jadwal, emplasemen).filter(
      (t) => t.tingkat === 'GALAT',
    );
    if (galatBaru.length > 0) {
      setHasilImpor({
        jadwal: null,
        galat: [
          ...hasil.galat,
          ...galatBaru.slice(0, 12).map((t) => `${t.baris}: ${t.pesan}`),
          ...(galatBaru.length > 12 ? [`dan ${galatBaru.length - 12} galat lain.`] : []),
        ],
      });
      return;
    }
    setHasilImpor(hasil);
  };

  const unduhCsv = () => {
    if (!jadwal) return;
    const blob = new Blob([keCsv(jadwal)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal-${stasiun.toLowerCase()}-${jadwal.tanggalDibuat}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!jadwal || !emplasemen) {
    return (
      <div className="flex min-h-screen flex-col">
        <KepalaPapan />
        <main className="flex flex-1 items-center justify-center p-6">
          <Warta tingkat={memuat ? 'info' : 'perhatian'}>
            {memuat
              ? `Memuat berkas emplasemen dan jadwal Stasiun ${stasiun}…`
              : 'Berkas stasiun belum termuat. Kembali ke halaman briefing untuk memilih wilayah pengaturan.'}
          </Warta>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <KepalaPapan />

      <main className="grid flex-1 grid-cols-1 gap-modul p-modul xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="space-y-modul">
          <Modul
            label="Berkas jadwal termuat"
            kanan={
              <div className="flex items-center gap-1">
                <button type="button" className="tombol-panel" onClick={unduhCsv}>
                  Unduh CSV
                </button>
                {jadwalDiimpor && (
                  <button type="button" className="tombol-panel tombol-panel-bahaya" onClick={kembalikan}>
                    Kembalikan berkas bawaan
                  </button>
                )}
              </div>
            }
          >
            <div className="space-y-3 p-3">
              {jadwalDiimpor && (
                <Warta tingkat="perhatian">
                  Papan memakai berkas hasil impor yang tersimpan di peramban ini, bukan berkas
                  bawaan aplikasi.
                </Warta>
              )}

              <div className="grid grid-cols-2 gap-px bg-panel-line md:grid-cols-4">
                <Petak label="Perjalanan" nilai={jadwal.perjalanan.length} satuan="baris" />
                <Petak label="Sesi dinas" nilai={jadwal.dinas.length} />
                <Petak
                  label="Galat"
                  nilai={galat.length}
                  warna={galat.length === 0 ? '#1fb85a' : '#e02b1d'}
                />
                <Petak
                  label="Peringatan"
                  nilai={peringatan.length}
                  warna={peringatan.length === 0 ? '#1fb85a' : '#e9a51b'}
                />
              </div>

              <div className="space-y-1 font-mono text-2xs text-vdu-muted">
                <div>
                  <span className="text-vdu-dim">Versi berkas: </span>
                  {jadwal.versi}
                </div>
                <div>
                  <span className="text-vdu-dim">Edisi jadwal: </span>
                  {jadwal.gapeka}
                </div>
                <div>
                  <span className="text-vdu-dim">Disusun: </span>
                  {jadwal.tanggalDibuat}
                </div>
              </div>

              <p className="border-l-2 border-panel-line-bright bg-panel-sunken px-3 py-2 text-2xs leading-relaxed text-vdu-muted">
                {jadwal.catatanKeakuratan}
              </p>

              {(galat.length > 0 || peringatan.length > 0) && (
                <div className="max-h-40 space-y-1 overflow-y-auto border border-panel-line bg-panel-sunken p-2">
                  {[...galat, ...peringatan].slice(0, 40).map((t, i) => (
                    <div key={`${t.baris}-${i}`} className="font-mono text-2xs">
                      <span
                        className="mr-1.5"
                        style={{ color: t.tingkat === 'GALAT' ? '#e02b1d' : '#e9a51b' }}
                      >
                        [{t.tingkat}]
                      </span>
                      <span className="text-vdu-dim">{t.baris}</span>{' '}
                      <span className="text-vdu-muted">{t.pesan}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Modul>

          <Modul
            label={`Daftar perjalanan (${perjalanan.length} dari ${jadwal.perjalanan.length})`}
            kanan={
              <div className="flex items-center gap-1">
                <input
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                  placeholder="Cari nomor KA / relasi"
                  className="w-48 border border-panel-line bg-panel-sunken px-2 py-1 font-mono text-2xs text-vdu-primary placeholder:text-vdu-dim"
                />
                <select
                  value={saringLin}
                  onChange={(e) => setSaringLin(e.target.value)}
                  className="border border-panel-line bg-panel-sunken px-1.5 py-1 font-mono text-2xs text-vdu-primary"
                >
                  <option value="SEMUA">Seluruh lin</option>
                  {Object.keys(perLin).map((l) => (
                    <option key={l} value={l}>
                      {NAMA_LIN[l as KodeLin] ?? l} ({perLin[l]})
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            <div className="max-h-[38rem] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0">
                  <tr>
                    <th className="kepala-kolom w-[4.5rem]">No. KA</th>
                    <th className="kepala-kolom w-[5.5rem]">Lin</th>
                    <th className="kepala-kolom">Relasi</th>
                    <th className="kepala-kolom w-[5rem]">Masuk</th>
                    <th className="kepala-kolom w-[5rem]">Keluar</th>
                    <th className="kepala-kolom w-[4.5rem] text-right">Datang</th>
                    <th className="kepala-kolom w-[4.5rem] text-right">Berangkat</th>
                    <th className="kepala-kolom w-[6rem]">Jalur lazim</th>
                    <th className="kepala-kolom w-[5rem]">Keandalan</th>
                  </tr>
                </thead>
                <tbody>
                  {perjalanan.map((t) => (
                    <tr key={t.id} className="hover:bg-panel-raised" title={t.catatan ?? undefined}>
                      <td className="sel-data font-semibold" style={{ color: WARNA_LIN[t.lin] }}>
                        {t.nomorKA}
                      </td>
                      <td className="sel-data text-2xs uppercase tracking-wider text-vdu-dim">
                        {NAMA_LIN[t.lin] ?? t.lin}
                      </td>
                      <td className="sel-data text-vdu-muted">{t.relasi}</td>
                      <td className="sel-data text-2xs text-vdu-dim">
                        {emplasemen.batas.find((b) => b.id === t.batasMasukId)?.singkatan ?? t.batasMasukId}
                      </td>
                      <td className="sel-data text-2xs text-vdu-dim">
                        {t.batasKeluarId
                          ? (emplasemen.batas.find((b) => b.id === t.batasKeluarId)?.singkatan ??
                            t.batasKeluarId)
                          : '—'}
                      </td>
                      <td className="sel-data text-right text-vdu-muted">{t.jamDatang}</td>
                      <td className="sel-data text-right">{t.jamBerangkat}</td>
                      <td className="sel-data text-2xs text-vdu-dim">
                        {(t.sepurLazim ?? [])
                          .map((s) => emplasemen.sepur.find((x) => x.id === s)?.nomor ?? s)
                          .join(', ') || '—'}
                      </td>
                      <td className="sel-data">
                        <TandaKeandalan nilai={t.keandalanData} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modul>
        </div>

        {/* Kolom impor */}
        <div className="space-y-modul">
          <Modul label="Impor berkas jadwal">
            <div className="space-y-3 p-3">
              <p className="text-2xs leading-relaxed text-vdu-muted">
                Berkas jadwal dapat diganti tanpa mengubah kode agar papan tetap sesuai saat GAPEKA
                direvisi. Berkas yang diterima berbentuk CSV atau JSON dengan susunan yang sama
                seperti berkas bawaan. Berkas diperiksa lebih dulu terhadap emplasemen yang dimuat;
                berkas yang mengandung galat tidak akan dipasang.
              </p>

              <input
                ref={berkasRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="block w-full border border-panel-line bg-panel-sunken p-2 font-mono text-2xs text-vdu-muted
                           file:mr-2 file:border file:border-panel-line-bright file:bg-panel-raised file:px-2 file:py-1
                           file:font-mono file:text-2xs file:uppercase file:tracking-wider file:text-vdu-primary"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  prosesTeks(f.name, await f.text());
                }}
              />

              <div>
                <label
                  htmlFor="tempel"
                  className="mb-1 block font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim"
                >
                  Atau tempelkan isi berkas
                </label>
                <textarea
                  id="tempel"
                  value={tempel}
                  onChange={(e) => setTempel(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={CONTOH_BARIS_CSV}
                  className="w-full border border-panel-line bg-panel-sunken p-2 font-mono text-[0.6rem] leading-relaxed
                             text-vdu-primary placeholder:text-vdu-dim"
                />
                <button
                  type="button"
                  className="tombol-panel mt-1"
                  disabled={tempel.trim().length === 0}
                  onClick={() => prosesTeks(tempel.trimStart().startsWith('{') ? 'x.json' : 'x.csv', tempel)}
                >
                  Periksa isi tempelan
                </button>
              </div>

              {hasilImpor && (
                <div className="space-y-2 border border-panel-line-bright bg-panel-sunken p-2">
                  {hasilImpor.jadwal ? (
                    <>
                      <div className="font-mono text-2xs text-track-clear">
                        Berkas terbaca: {hasilImpor.jadwal.perjalanan.length} perjalanan
                        {hasilImpor.galat.length === 0
                          ? ', tanpa galat.'
                          : `, ${hasilImpor.galat.length} baris dilewati.`}
                      </div>
                      {hasilImpor.galat.length > 0 && (
                        <ul className="space-y-0.5 font-mono text-[0.6rem] text-signal-aspect-yellow">
                          {hasilImpor.galat.slice(0, 8).map((g, i) => (
                            <li key={i}>· {g}</li>
                          ))}
                          {hasilImpor.galat.length > 8 && (
                            <li>· dan {hasilImpor.galat.length - 8} baris lain.</li>
                          )}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="tombol-panel tombol-panel-aktif"
                        onClick={() => {
                          if (hasilImpor.jadwal) gantiJadwal(hasilImpor.jadwal);
                          setHasilImpor(null);
                          setTempel('');
                          if (berkasRef.current) berkasRef.current.value = '';
                        }}
                      >
                        Pasang berkas ini
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="font-mono text-2xs text-signal-aspect-red">
                        Berkas ditolak.
                      </div>
                      <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[0.6rem] text-vdu-muted">
                        {hasilImpor.galat.map((g, i) => (
                          <li key={i}>· {g}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </Modul>

          <Modul label="Susunan kolom CSV">
            <div className="space-y-2 p-3">
              <p className="text-2xs leading-relaxed text-vdu-muted">
                Kolom wajib: <code className="text-vdu-primary">nomorKA</code>,{' '}
                <code className="text-vdu-primary">lin</code>,{' '}
                <code className="text-vdu-primary">asal</code>,{' '}
                <code className="text-vdu-primary">tujuan</code>,{' '}
                <code className="text-vdu-primary">batasMasukId</code>,{' '}
                <code className="text-vdu-primary">jamDatang</code>,{' '}
                <code className="text-vdu-primary">jamBerangkat</code>. Jam ditulis HH.MM atau
                HH.MM.SS. Beberapa jalur lazim dipisah tanda |.
              </p>
              <div className="border border-panel-line bg-panel-sunken p-2">
                <div className="mb-1 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                  Kode batas emplasemen
                </div>
                <div className="grid grid-cols-1 gap-px bg-panel-line">
                  {emplasemen.batas.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-baseline justify-between gap-2 bg-panel-sunken px-1.5 py-1 font-mono text-[0.6rem]"
                    >
                      <span className="text-vdu-primary">{b.id}</span>
                      <span className="text-vdu-dim">
                        {b.nama} · {b.level === 'DASAR' ? 'lantai dasar' : 'lantai layang'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-panel-line bg-panel-sunken p-2">
                <div className="mb-1 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                  Kode sepur
                </div>
                <div className="grid grid-cols-2 gap-px bg-panel-line">
                  {emplasemen.sepur.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-baseline justify-between gap-1 bg-panel-sunken px-1.5 py-1 font-mono text-[0.6rem]"
                    >
                      <span className="text-vdu-primary">{s.id}</span>
                      <span className="text-vdu-dim">Jalur {s.nomor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modul>

          <Modul label="Acuan tata letak emplasemen">
            <div className="space-y-2 p-3 text-2xs leading-relaxed text-vdu-muted">
              <p>{emplasemen.acuan.keterangan}</p>
              <p className="border-l-2 border-signal-aspect-yellow bg-panel-sunken px-2 py-1.5 text-vdu-dim">
                {emplasemen.acuan.catatanVerifikasi}
              </p>
              <ul className="space-y-0.5 font-mono text-[0.6rem] text-vdu-dim">
                {emplasemen.acuan.sumber.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            </div>
          </Modul>
        </div>
      </main>
    </div>
  );
}
