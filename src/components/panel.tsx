import type { ReactNode } from 'react';

/**
 * Rangka modul panel kendali.
 *
 * Setiap modul punya bilah kepala bergaris, sudut tegas, dan pembatas 1 piksel
 * terhadap modul sebelahnya — mengikuti cara papan pelayanan sungguhan
 * memisahkan blok fungsi, bukan kartu melayang.
 */
export function Modul({
  label,
  kanan,
  children,
  className = '',
  isiClassName = '',
}: {
  label: string;
  kanan?: ReactNode;
  children: ReactNode;
  className?: string;
  isiClassName?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col border border-panel-line bg-panel-base ${className}`}>
      <header className="kepala-modul shrink-0">
        <h2 className="label-modul">{label}</h2>
        {kanan ? <div className="flex items-center gap-2">{kanan}</div> : null}
      </header>
      <div className={`min-h-0 flex-1 ${isiClassName}`}>{children}</div>
    </section>
  );
}

/** Lampu indikator bundar dengan pendar fosfor. */
export function Lampu({
  warna,
  menyala = true,
  kedip = false,
  ukuran = 8,
}: {
  warna: string;
  menyala?: boolean;
  kedip?: boolean;
  ukuran?: number;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-lampu ${kedip ? 'animate-kedip' : ''}`}
      style={{
        width: ukuran,
        height: ukuran,
        backgroundColor: menyala ? warna : '#2a3a43',
        boxShadow: menyala ? `0 0 6px 0 ${warna}` : 'none',
      }}
    />
  );
}

/** Pasangan label-nilai bergaya papan data. */
export function Petak({
  label,
  nilai,
  satuan,
  warna,
  lebar = '',
}: {
  label: string;
  nilai: ReactNode;
  satuan?: string;
  warna?: string;
  lebar?: string;
}) {
  return (
    <div className={`border border-panel-line bg-panel-sunken px-2 py-1.5 ${lebar}`}>
      <div className="font-mono text-2xs uppercase tracking-[0.14em] text-vdu-dim">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="font-mono text-base font-semibold tabular-nums"
          style={warna ? { color: warna } : undefined}
        >
          {nilai}
        </span>
        {satuan ? <span className="font-mono text-2xs text-vdu-dim">{satuan}</span> : null}
      </div>
    </div>
  );
}

/** Bilah pemberitahuan bergaris tebal di sisi kiri. */
export function Warta({
  tingkat,
  children,
}: {
  tingkat: 'info' | 'perhatian' | 'bahaya';
  children: ReactNode;
}) {
  const warna =
    tingkat === 'bahaya' ? '#e02b1d' : tingkat === 'perhatian' ? '#e9a51b' : '#4aa8d8';
  return (
    <div
      className="border border-panel-line bg-panel-sunken px-3 py-2 text-xs leading-relaxed text-vdu-muted"
      style={{ borderLeftWidth: 3, borderLeftColor: warna }}
    >
      {children}
    </div>
  );
}

/** Penanda keandalan data jadwal. */
export function TandaKeandalan({ nilai }: { nilai: string }) {
  const peta: Record<string, { teks: string; warna: string }> = {
    RESMI: { teks: 'RESMI', warna: '#1fb85a' },
    REKONSTRUKSI_POLA: { teks: 'REKONS.', warna: '#e9a51b' },
    CONTOH: { teks: 'CONTOH', warna: '#8f6bd6' },
  };
  const t = peta[nilai] ?? { teks: nilai, warna: '#4d6673' };
  return (
    <span
      className="border px-1 font-mono text-2xs tracking-[0.1em]"
      style={{ color: t.warna, borderColor: t.warna }}
      title={
        nilai === 'RESMI'
          ? 'Nomor KA, jam, dan relasi diambil dari kanal resmi KAI Commuter.'
          : nilai === 'REKONSTRUKSI_POLA'
            ? 'Pola perjalanan terverifikasi, sebagian rincian direkonstruksi. Lihat catatan pada berkas jadwal.'
            : 'Data contoh untuk pengujian mekanik permainan.'
      }
    >
      {t.teks}
    </span>
  );
}
