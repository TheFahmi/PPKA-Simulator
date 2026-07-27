'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DiagramEmplasemen } from '@/components/DiagramEmplasemen';
import { PanelJam, useJamDinas } from '@/components/JamDinas';
import { KepalaPapan } from '@/components/KepalaPapan';
import { LogKejadian } from '@/components/LogKejadian';
import { Modul, Warta } from '@/components/panel';
import { PanelKendaliRute } from '@/components/PanelKendaliRute';
import { PanelPeralatan } from '@/components/PanelPeralatan';
import { PapanDinas } from '@/components/PapanDinas';
import type { IndeksEmplasemen } from '@/lib/emplasemen';
import type { Level } from '@/lib/tipe';
import { usePapan, type TampilanLevel } from '@/store/papan';

export default function Dispatch() {
  useJamDinas();
  const router = useRouter();

  const sim = usePapan((s) => s.sim);
  const ix = usePapan((s) => s.ix);
  const ringkas = usePapan((s) => s.ringkas);
  const modeGambar = usePapan((s) => s.modeGambar);
  const aturModeGambar = usePapan((s) => s.aturModeGambar);
  const tampilanLevel = usePapan((s) => s.tampilanLevel);
  const aturTampilanLevel = usePapan((s) => s.aturTampilanLevel);
  const keretaTerpilih = usePapan((s) => s.keretaTerpilih);
  const pilihKereta = usePapan((s) => s.pilihKereta);
  const layaniWesel = usePapan((s) => s.layaniWesel);

  useEffect(() => {
    if (sim?.dinasSelesai) router.push('/dispatch/summary');
  }, [sim?.dinasSelesai, router]);

  if (!sim || !ix) {
    return (
      <div className="flex min-h-screen flex-col">
        <KepalaPapan />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg space-y-3">
            <Warta tingkat="perhatian">
              Belum ada sesi dinas yang dibuka. Pilih dinas pada halaman briefing sebelum papan
              pelayanan dapat digunakan.
            </Warta>
            <Link href="/" className="tombol-panel tombol-panel-aktif inline-block">
              ◂ Kembali ke pemilihan dinas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Lantai yang benar-benar ada pada emplasemen ini; stasiun berlantai satu
  // tidak menampilkan baris lantai layang yang kosong.
  const lantaiAda: Level[] = (['LAYANG', 'DASAR'] as Level[]).filter((lv) =>
    ix.data.sepur.some((sp) => sp.level === lv),
  );
  const levelTampil: Level[] =
    tampilanLevel === 'KEDUA'
      ? lantaiAda
      : lantaiAda.filter((lv) => lv === (tampilanLevel as Level));
  const bertingkat = lantaiAda.length > 1;
  const adaTampilanOsm = Boolean(ix.data.kanvasOsm);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <KepalaPapan tautan={false} kanan={<Link href="/" className="tombol-panel">Tinggalkan dinas</Link>} />

      <div className="shrink-0 p-modul pb-0">
        <PanelJam />
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-modul p-modul xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Papan diagram & papan dinas */}
        <div className="grid min-h-0 grid-rows-[minmax(0,1.35fr)_minmax(0,1fr)] gap-modul">
          <Modul
            label={`${
              modeGambar === 'OSM' ? 'Geometri sepur tersurvei' : 'Diagram jalur'
            } — emplasemen Stasiun ${ix.data.namaStasiun}`}
            isiClassName="overflow-auto bg-panel-sunken"
            kanan={
              <div className="flex items-center gap-3">
                {adaTampilanOsm && (
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                      Tampilan
                    </span>
                    {(
                      [
                        ['DENAH', 'Denah'],
                        ['OSM', 'Rel OSM'],
                      ] as Array<['DENAH' | 'OSM', string]>
                    ).map(([nilai, label]) => (
                      <button
                        key={nilai}
                        type="button"
                        aria-pressed={modeGambar === nilai}
                        className={`tombol-panel ${modeGambar === nilai ? 'tombol-panel-aktif' : ''}`}
                        onClick={() => aturModeGambar(nilai)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {bertingkat && (
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['KEDUA', 'Kedua lantai'],
                        ['LAYANG', 'Lantai layang'],
                        ['DASAR', 'Lantai dasar'],
                      ] as Array<[TampilanLevel, string]>
                    ).map(([nilai, label]) => (
                      <button
                        key={nilai}
                        type="button"
                        aria-pressed={tampilanLevel === nilai}
                        className={`tombol-panel ${tampilanLevel === nilai ? 'tombol-panel-aktif' : ''}`}
                        onClick={() => aturTampilanLevel(nilai)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-px bg-panel-line">
              {levelTampil.map((lv) => (
                <div key={lv} className="bg-panel-sunken">
                  <div className="flex items-baseline justify-between border-b border-panel-line px-2 py-1">
                    <span className="font-mono text-2xs uppercase tracking-[0.18em] text-vdu-muted">
                      {keteranganLantai(ix, lv, bertingkat)}
                    </span>
                    <span className="font-mono text-2xs text-vdu-dim">
                      {sim.kereta.filter((k) => k.sepurId && sepurLevel(ix, k.sepurId) === lv).length}{' '}
                      sepur diduduki
                    </span>
                  </div>
                  <div className="min-w-[900px] p-2">
                    <DiagramEmplasemen
                      ix={ix}
                      sim={sim}
                      level={lv}
                      keretaTerpilih={keretaTerpilih}
                      onPilihKereta={pilihKereta}
                      onPilihWesel={(id) => layaniWesel(id)}
                      gaya={modeGambar}
                    />
                  </div>
                </div>
              ))}
              <LegendaPapan
                modeGambar={modeGambar}
                meterPerSatuan={ix.data.kanvasOsm?.meterPerSatuan ?? null}
                sumberDenah={ringkas?.sumberDenah ?? null}
              />
            </div>
          </Modul>

          <Modul label="Papan dinas — daftar perjalanan" isiClassName="overflow-hidden">
            <PapanDinas ix={ix} sim={sim} terpilih={keretaTerpilih} onPilih={pilihKereta} />
          </Modul>
        </div>

        {/* Kolom pelayanan */}
        <div className="grid min-h-0 grid-rows-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-modul">
          <Modul label="Pelayanan rute" isiClassName="overflow-hidden">
            <PanelKendaliRute ix={ix} sim={sim} />
          </Modul>
          <Modul label="Keadaan peralatan" isiClassName="overflow-hidden">
            <PanelPeralatan ix={ix} sim={sim} />
          </Modul>
          <Modul label="Buku kejadian dinas" isiClassName="overflow-hidden">
            <LogKejadian sim={sim} />
          </Modul>
        </div>
      </main>
    </div>
  );
}

function sepurLevel(ix: IndeksEmplasemen, sepurId: string): Level | null {
  return ix.data.sepur.find((s) => s.id === sepurId)?.level ?? null;
}

/**
 * Keterangan baris lantai, disusun dari sepur yang benar-benar ada pada
 * emplasemen ini — bukan teks tetap milik satu stasiun.
 */
function keteranganLantai(ix: IndeksEmplasemen, lv: Level, bertingkat: boolean): string {
  const sepur = ix.data.sepur.filter((s) => s.level === lv);
  const berperon = sepur.filter((s) => s.peronId !== null).map((s) => s.nomor);
  const tanpaPeron = sepur.filter((s) => s.peronId === null).map((s) => s.nomor);
  const bagian: string[] = [];
  if (bertingkat) bagian.push(lv === 'LAYANG' ? 'Lantai 2 — layang' : 'Lantai dasar');
  if (berperon.length > 0) bagian.push(`jalur berperon ${berperon.join(', ')}`);
  if (tanpaPeron.length > 0) bagian.push(`sepur tanpa peron ${tanpaPeron.join(', ')}`);
  return bagian.join(' · ');
}

function LegendaPapan({
  modeGambar,
  meterPerSatuan,
  sumberDenah,
}: {
  modeGambar: 'DENAH' | 'OSM';
  meterPerSatuan: number | null;
  sumberDenah: string | null;
}) {
  const okupansi: Array<[string, string]> = [
    ['#1fb85a', 'Blok bebas'],
    ['#e9a51b', 'Rute terkunci / reservasi'],
    ['#e02b1d', 'Blok diduduki sarana'],
    ['#8f6bd6', 'Blok diblokir'],
    ['#ff5cc8', 'Gangguan deteksi'],
  ];
  const aspek: Array<[string, string]> = [
    ['#22e05f', 'Semboyan 5 — berjalan'],
    ['#ffb302', 'Semboyan 6 — hati-hati'],
    ['#ff2a1c', 'Semboyan 7 — berhenti'],
    ['#2a3a43', 'Sinyal padam'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-panel-base px-2 py-1.5">
      <span className="font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">Okupansi</span>
      {okupansi.map(([w, t]) => (
        <span key={t} className="flex items-center gap-1.5 font-mono text-2xs text-vdu-muted">
          <span className="inline-block h-0.5 w-5" style={{ backgroundColor: w }} />
          {t}
        </span>
      ))}
      <span className="ml-2 font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">Aspek</span>
      {aspek.map(([w, t]) => (
        <span key={t} className="flex items-center gap-1.5 font-mono text-2xs text-vdu-muted">
          <span
            className="inline-block h-2 w-2 rounded-lampu"
            style={{ backgroundColor: w, boxShadow: `0 0 5px 0 ${w}` }}
          />
          {t}
        </span>
      ))}
      <span className="ml-2 font-mono text-2xs uppercase tracking-[0.16em] text-vdu-dim">Wesel</span>
      <span className="font-mono text-2xs text-vdu-muted">
        <span className="text-wesel-lurus">L</span> lurus ·{' '}
        <span className="text-wesel-belok">B</span> belok ·{' '}
        <span className="text-wesel-balik">~</span> membalik ·{' '}
        <span className="text-wesel-gagal">!</span> gangguan
      </span>
      <span className="w-full font-mono text-2xs leading-relaxed text-vdu-dim">
        {modeGambar === 'OSM'
          ? 'Tampilan rel OSM: geometri sepur tersurvei, skala seragam pada kedua sumbu' +
            (meterPerSatuan ? ` (satu satuan gambar setara ${meterPerSatuan.toFixed(2)} m)` : '') +
            '. Bidang peron tidak digambar pada tampilan ini.'
          : sumberDenah === 'SURVEI_OSM'
            ? 'Tampilan denah: urutan sepur dan topologi mengikuti survei, tetapi renggang melintangnya diratakan menjadi lajur supaya terbaca. Bukan peta berskala.'
            : 'Tampilan denah, disusun dari dokumen tata letak resmi. Bukan peta berskala.'}
      </span>
    </div>
  );
}
