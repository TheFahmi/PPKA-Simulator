import Link from 'next/link';

/**
 * Bilah kepala papan: identitas stasiun dan wilayah pengaturan, bukan
 * navigasi bergaya situs pemasaran.
 */
export function KepalaPapan({
  kanan,
  tautan = true,
}: {
  kanan?: React.ReactNode;
  tautan?: boolean;
}) {
  return (
    <header className="flex shrink-0 items-stretch justify-between border-b border-panel-line bg-panel-rail">
      <div className="flex items-center gap-3 px-3 py-2">
        <TandaStasiun />
        <div className="leading-tight">
          <div className="font-mono text-2xs uppercase tracking-[0.2em] text-vdu-dim">
            Daop 1 Jakarta · Wilayah pengaturan Manggarai
          </div>
          <div className="font-mono text-sm font-semibold tracking-[0.06em] text-vdu-primary">
            PAPAN PELAYANAN PERJALANAN KERETA API — STASIUN MANGGARAI (MRI)
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3">
        {tautan && (
          <nav className="flex items-center gap-1">
            <Link href="/" className="tombol-panel">
              Pengantar dinas
            </Link>
            <Link href="/dispatch" className="tombol-panel">
              Papan dinas
            </Link>
            <Link href="/data" className="tombol-panel">
              Berkas jadwal
            </Link>
          </nav>
        )}
        {kanan}
      </div>
    </header>
  );
}

/** Lambang stasiun berbentuk geometris — bukan ikon generik. */
function TandaStasiun() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="33" height="33" fill="#0a1116" stroke="#33505f" />
      {/* Dua lantai emplasemen sebagai garis sepur bertingkat */}
      <line x1="5" y1="10" x2="29" y2="10" stroke="#d43b2f" strokeWidth="2" />
      <line x1="5" y1="14" x2="29" y2="14" stroke="#d43b2f" strokeWidth="2" />
      <line x1="5" y1="21" x2="29" y2="21" stroke="#1b7fc4" strokeWidth="2" />
      <line x1="5" y1="25" x2="29" y2="25" stroke="#1b7fc4" strokeWidth="2" />
      {/* Wesel */}
      <path d="M 5 25 L 13 21" stroke="#1b7fc4" strokeWidth="2" fill="none" />
      <path d="M 29 10 L 21 14" stroke="#d43b2f" strokeWidth="2" fill="none" />
    </svg>
  );
}
