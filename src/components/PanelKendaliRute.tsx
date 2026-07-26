'use client';

import { useMemo, useState } from 'react';
import { Lampu, Warta } from '@/components/panel';
import type { IndeksEmplasemen } from '@/lib/emplasemen';
import { susunSaran, type SaranPelayanan } from '@/lib/otomatis';
import { ASPEK_SINYAL, NAMA_LIN, WARNA_LIN } from '@/lib/semboyan';
import {
  usulanRuteKeluar,
  usulanRuteMasuk,
  type KeadaanSimulasi,
  type UsulanRute,
} from '@/lib/simulasi';
import { labelFase, WARNA_FASE } from '@/lib/tampilan';
import { keDeviasi, keJam } from '@/lib/waktu';
import { usePapan } from '@/store/papan';

/**
 * Panel pelayanan rute.
 *
 * PPKA memilih perjalanan pada papan dinas, lalu melayani rute masuk (memilih
 * jalur) atau rute keluar (memilih batas emplasemen). Penolakan pembentukan
 * rute selalu disertai alasan teknisnya, sebagaimana penolakan pelayanan pada
 * papan persinyalan elektrik.
 */
export function PanelKendaliRute({ ix, sim }: { ix: IndeksEmplasemen; sim: KeadaanSimulasi }) {
  const keretaTerpilih = usePapan((s) => s.keretaTerpilih);
  const pilihKereta = usePapan((s) => s.pilihKereta);
  const layaniRuteMasuk = usePapan((s) => s.layaniRuteMasuk);
  const layaniRuteKeluar = usePapan((s) => s.layaniRuteKeluar);
  const batalkanRute = usePapan((s) => s.batalkanRute);
  const [pesan, setPesan] = useState<string | null>(null);

  const kereta = sim.kereta.find((k) => k.id === keretaTerpilih) ?? null;

  // Usul pelayanan dihitung dengan penalaran yang sama seperti mode otomatis,
  // supaya yang ditampilkan persis sama dengan yang akan dikerjakan papan.
  const saran = useMemo(
    () => (sim.modeOtomatis === 'MATI' ? [] : susunSaran(sim, ix)),
    [sim, ix],
  );
  const saranTerpilih = saran.find((s) => s.keretaId === kereta?.id) ?? null;

  const usulanMasuk = useMemo(
    () => (kereta ? usulanRuteMasuk(sim, ix, kereta) : []),
    [kereta, sim, ix],
  );
  const usulanKeluar = useMemo(
    () => (kereta ? usulanRuteKeluar(sim, ix, kereta) : []),
    [kereta, sim, ix],
  );

  // `sim.rute` dimutakhirkan di tempat oleh mesin, jadi dependensinya `sim` utuh.
  const ruteAktif = useMemo(
    () => Object.values(sim.rute).filter((r) => r.keretaId === kereta?.id),
    [sim, kereta?.id],
  );

  if (!kereta) {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
        {saran.length > 0 && (
          <div className="border border-panel-line-bright">
            <div className="kepala-modul">
              <span className="label-modul">
                Usul pelayanan · {saran.length} perjalanan
              </span>
            </div>
            <div className="divide-y divide-panel-line">
              {saran.map((s) => (
                <button
                  key={`${s.keretaId}-${s.jenis}`}
                  type="button"
                  onClick={() => pilihKereta(s.keretaId)}
                  className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left hover:bg-panel-raised"
                >
                  <Lampu warna={s.mendesak ? '#e02b1d' : '#4aa8d8'} ukuran={6} kedip={s.mendesak} />
                  <span className="font-mono text-xs font-semibold text-vdu-primary">
                    KA {s.nomorKA}
                  </span>
                  <span className="font-mono text-2xs text-vdu-muted">
                    rute {s.jenis.toLowerCase()} → {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Warta tingkat="info">
          Pilih satu perjalanan pada papan dinas atau pada diagram jalur untuk melayani rutenya.
        </Warta>
        <div className="space-y-2 border border-panel-line bg-panel-sunken p-3 font-mono text-2xs leading-relaxed text-vdu-dim">
          <p className="uppercase tracking-[0.14em] text-vdu-muted">Urutan pelayanan</p>
          <p>
            1. Rangkaian diwartakan dari stasiun tetangga dan berjalan di petak jalan.
          </p>
          <p>
            2. Bentuk rute masuk ke jalur yang dikehendaki sebelum rangkaian mencapai sinyal masuk.
            Wesel membalik lebih dulu, baru sinyal dapat diaman-kan.
          </p>
          <p>
            3. Setelah waktu berhenti terpenuhi, bentuk rute keluar menuju batas emplasemen sesuai
            jadwal perjalanan.
          </p>
          <p>
            Rangkaian yang belum memperoleh rute akan berhenti di muka sinyal masuk pada Semboyan 7
            dan keterlambatannya menular ke perjalanan di belakangnya.
          </p>
        </div>
      </div>
    );
  }

  const perluMasuk = kereta.fase === 'DIWARTAKAN' || kereta.fase === 'TERTAHAN_SINYAL';
  const perluKeluar = kereta.fase === 'BERHENTI' || kereta.fase === 'SIAP_BERANGKAT';
  const sepur = ix.data.sepur.find((s) => s.id === kereta.sepurId);

  const layani = (fn: () => string | null) => {
    const galat = fn();
    setPesan(galat);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Identitas perjalanan */}
      <div className="shrink-0 border-b border-panel-line bg-panel-sunken px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-lg font-bold tabular-nums"
              style={{ color: WARNA_LIN[kereta.lin] }}
            >
              KA {kereta.nomorKA}
            </span>
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-vdu-muted">
              {NAMA_LIN[kereta.lin]}
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.12em]">
            <Lampu warna={WARNA_FASE[kereta.fase]} ukuran={7} kedip={kereta.fase === 'TERTAHAN_SINYAL'} />
            <span style={{ color: WARNA_FASE[kereta.fase] }}>{labelFase(kereta)}</span>
          </span>
        </div>
        <div className="mt-1 font-mono text-xs text-vdu-muted">{kereta.relasi}</div>
        <div className="mt-2 grid grid-cols-4 gap-px border border-panel-line bg-panel-line font-mono text-2xs">
          {[
            ['Datang', keJam(kereta.jadwalDatang, false)],
            ['Berangkat', keJam(kereta.jadwalBerangkat, false)],
            ['Jalur', sepur ? sepur.nomor : '—'],
            ['Deviasi', keDeviasi(kereta.deviasiDetik)],
          ].map(([l, v]) => (
            <div key={l} className="bg-panel-base px-2 py-1">
              <div className="uppercase tracking-[0.12em] text-vdu-dim">{l}</div>
              <div className="mt-0.5 text-nomor font-semibold text-vdu-primary tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {kereta.catatan && (
          <p className="mt-2 text-2xs leading-relaxed text-vdu-dim">{kereta.catatan}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {pesan && <Warta tingkat="bahaya">Pelayanan ditolak: {pesan}</Warta>}

        {saranTerpilih && (
          <div className="border border-warta-info">
            <div className="kepala-modul">
              <span className="label-modul">Usul pelayanan</span>
              <button
                type="button"
                className="tombol-panel tombol-panel-aktif"
                onClick={() =>
                  layani(() =>
                    saranTerpilih.jenis === 'MASUK'
                      ? layaniRuteMasuk(saranTerpilih.keretaId, saranTerpilih.sasaranId)
                      : layaniRuteKeluar(saranTerpilih.keretaId, saranTerpilih.sasaranId),
                  )
                }
              >
                Layani usul
              </button>
            </div>
            <div className="space-y-1 px-3 py-2">
              <div className="font-mono text-xs text-vdu-primary">
                Rute {saranTerpilih.jenis.toLowerCase()} → {saranTerpilih.label}
              </div>
              <p className="text-2xs leading-relaxed text-vdu-muted">{saranTerpilih.alasan}</p>
            </div>
          </div>
        )}

        {/* Rute yang sedang dilayani */}
        {ruteAktif.length > 0 && (
          <div className="border border-panel-line-bright">
            <div className="kepala-modul">
              <span className="label-modul">Rute dilayani</span>
            </div>
            <div className="divide-y divide-panel-line">
              {ruteAktif.map((r) => {
                const sinyal = ix.data.sinyal.find((s) => s.id === r.sinyalId);
                const statusSinyal = sinyal ? sim.sinyal[sinyal.id] : undefined;
                const sasaran =
                  r.jenis === 'MASUK'
                    ? (ix.data.sepur.find((s) => s.id === r.sasaranId)?.label.toLowerCase() ?? '-')
                    : (ix.data.batas.find((b) => b.id === r.sasaranId)?.nama ?? '-');
                return (
                  <div key={r.id} className="space-y-1.5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-vdu-primary">
                        Rute {r.jenis.toLowerCase()} → {sasaran}
                      </span>
                      <button
                        type="button"
                        className="tombol-panel tombol-panel-bahaya"
                        disabled={r.keadaan === 'DIDUDUKI'}
                        title={
                          r.keadaan === 'DIDUDUKI'
                            ? 'Rute sedang diduduki sarana dan tidak dapat dibatalkan.'
                            : 'Bebaskan rute dan kembalikan sinyal ke aspek merah.'
                        }
                        onClick={() => batalkanRute(r.id)}
                      >
                        Batalkan
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs text-vdu-muted">
                      {r.berbalikArah && (
                        <span className="border border-signal-aspect-yellow px-1 text-signal-aspect-yellow">
                          BERBALIK ARAH
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Lampu
                          warna={r.keadaan === 'MEMBENTUK' ? '#ff8a1f' : '#1fb85a'}
                          kedip={r.keadaan === 'MEMBENTUK'}
                          ukuran={6}
                        />
                        {r.keadaan === 'MEMBENTUK'
                          ? 'Wesel sedang membalik'
                          : r.keadaan === 'TERKUNCI'
                            ? 'Rute terkunci'
                            : 'Rute diduduki sarana'}
                      </span>
                      {sinyal && statusSinyal && (
                        <span className="flex items-center gap-1.5">
                          <Lampu
                            warna={
                              statusSinyal.aspek === 'HIJAU'
                                ? '#22e05f'
                                : statusSinyal.aspek === 'KUNING'
                                  ? '#ffb302'
                                  : statusSinyal.aspek === 'PADAM'
                                    ? '#2a3a43'
                                    : '#ff2a1c'
                            }
                            ukuran={6}
                          />
                          Sinyal {sinyal.nama} — {ASPEK_SINYAL[statusSinyal.aspek].semboyan}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-2xs text-vdu-dim">
                      Wesel:{' '}
                      {r.kedudukanWesel.length === 0
                        ? 'tidak ada'
                        : r.kedudukanWesel
                            .map(
                              (w) =>
                                `${ix.wesel.get(w.weselId)?.nomor ?? '?'}${w.kedudukan === 'LURUS' ? 'L' : 'B'}`,
                            )
                            .join(' · ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {perluMasuk && (
          <DaftarUsulan
            judul="Pelayanan rute masuk — tetapkan jalur"
            usulan={usulanMasuk}
            ix={ix}
            kelompokLevel
            disarankanId={saranTerpilih?.jenis === 'MASUK' ? saranTerpilih.sasaranId : null}
            onPilih={(id) => layani(() => layaniRuteMasuk(kereta.id, id))}
          />
        )}

        {perluKeluar && (
          <DaftarUsulan
            judul="Pelayanan rute keluar — tetapkan batas emplasemen"
            usulan={usulanKeluar}
            ix={ix}
            disarankanId={saranTerpilih?.jenis === 'KELUAR' ? saranTerpilih.sasaranId : null}
            onPilih={(id) => layani(() => layaniRuteKeluar(kereta.id, id))}
          />
        )}

        {kereta.fase === 'BERHENTI' && kereta.sisaBerhentiDetik > 0 && (
          <Warta tingkat="info">
            Waktu berhenti minimum untuk naik-turun penumpang masih {kereta.sisaBerhentiDetik} detik.
            Rute keluar sudah boleh dibentuk lebih awal supaya sinyal keluar siap.
          </Warta>
        )}

        {(kereta.fase === 'MASUK' || kereta.fase === 'BERANGKAT') && (
          <Warta tingkat="info">
            Rangkaian sedang menduduki rute. Menempuh ruas {kereta.indeksRuas + 1} dari{' '}
            {kereta.jalurRuas.length}.
          </Warta>
        )}

        {kereta.fase === 'SELESAI' && (
          <Warta tingkat="info">
            Perjalanan sudah keluar batas emplasemen menuju {kereta.tujuan}. Deviasi keberangkatan{' '}
            {keDeviasi(kereta.deviasiDetik)}.
          </Warta>
        )}

        {kereta.fase === 'BELUM_DINAS' && (
          <Warta tingkat="info">
            Perjalanan belum diwartakan dari stasiun tetangga. Pewartaan dilakukan{' '}
            {Math.max(0, Math.round((kereta.diwartakanPada - sim.waktu) / 60))} menit lagi.
          </Warta>
        )}
      </div>
    </div>
  );
}

function DaftarUsulan({
  judul,
  usulan,
  ix,
  kelompokLevel = false,
  disarankanId = null,
  onPilih,
}: {
  judul: string;
  usulan: UsulanRute[];
  ix: IndeksEmplasemen;
  kelompokLevel?: boolean;
  /** Sasaran yang diusulkan pelayanan otomatis, bila mode saran menyala. */
  disarankanId?: string | null;
  onPilih: (sasaranId: string) => void;
}) {
  const kelompok = kelompokLevel
    ? [
        {
          nama: 'Lantai layang — jalur 9 s.d. 12',
          isi: usulan.filter(
            (u) => ix.data.sepur.find((s) => s.id === u.sasaranId)?.level === 'LAYANG',
          ),
        },
        {
          nama: 'Lantai dasar — jalur 1 s.d. 8',
          isi: usulan.filter(
            (u) => ix.data.sepur.find((s) => s.id === u.sasaranId)?.level === 'DASAR',
          ),
        },
      ]
    : [{ nama: '', isi: usulan }];

  return (
    <div className="border border-panel-line">
      <div className="kepala-modul">
        <span className="label-modul">{judul}</span>
      </div>
      <div className="space-y-3 p-2">
        {kelompok.map((g) => {
          const dapat = g.isi.filter((u) => !u.penghalang);
          if (g.isi.length === 0) return null;
          return (
            <div key={g.nama || 'tunggal'}>
              {g.nama && (
                <div className="mb-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">
                  {g.nama} · {dapat.length} dapat dilayani
                </div>
              )}
              <div className={kelompokLevel ? 'grid grid-cols-4 gap-1' : 'grid grid-cols-2 gap-1'}>
                {g.isi.map((u) => {
                  const disarankan = u.sasaranId === disarankanId;
                  return (
                    <button
                      key={u.sasaranId}
                      type="button"
                      disabled={Boolean(u.penghalang)}
                      onClick={() => onPilih(u.sasaranId)}
                      title={u.penghalang ?? u.peringatan ?? 'Rute dapat dibentuk.'}
                      className={`border px-2 py-1.5 text-left font-mono text-2xs transition-colors ${
                        u.penghalang
                          ? 'cursor-not-allowed border-panel-line bg-panel-sunken text-vdu-dim'
                          : u.lazim
                            ? 'border-track-clear bg-panel-raised text-track-clear hover:bg-track-clear hover:text-vdu-invert'
                            : 'border-track-reserved bg-panel-raised text-track-reserved hover:bg-track-reserved hover:text-vdu-invert'
                      } ${disarankan ? 'outline outline-1 -outline-offset-2 outline-warta-info' : ''}`}
                    >
                      <span className="flex items-baseline justify-between gap-1">
                        <span className="font-semibold">{u.label}</span>
                        {disarankan && (
                          <span className="text-[0.55rem] tracking-[0.1em] text-warta-info">
                            USUL
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.6rem] leading-tight opacity-80">
                        {u.penghalang
                          ? u.penghalang
                          : u.berbalikArah
                            ? 'berbalik arah'
                            : u.lazim
                              ? 'sesuai peruntukan'
                              : 'di luar peruntukan lazim'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
