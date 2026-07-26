'use client';

import { useEffect } from 'react';
import { hapusImpor } from '@/lib/impor';

/**
 * Jalan keluar bila berkas jadwal hasil impor membuat halaman gagal dirender.
 * Tanpa ini, berkas rusak yang tersimpan di peramban dapat membuntukan
 * mekanisme pembaruan jadwal secara permanen.
 */
export default function GalatBerkasJadwal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Halaman berkas jadwal gagal dirender:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel-void p-6">
      <div className="w-full max-w-xl border border-signal-aspect-red bg-panel-base">
        <div className="border-b border-panel-line bg-panel-rail px-3 py-2">
          <h1 className="font-mono text-sm font-semibold tracking-[0.08em] text-signal-aspect-red">
            HALAMAN BERKAS JADWAL GAGAL DIMUAT
          </h1>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-vdu-muted">
            Berkas jadwal yang sedang terpasang tidak dapat ditampilkan. Penyebab yang paling
            lazim adalah berkas hasil impor yang susunannya tidak sesuai. Buang berkas impor itu
            untuk kembali memakai berkas jadwal bawaan.
          </p>
          <pre className="max-h-40 overflow-auto border border-panel-line bg-panel-sunken p-2 font-mono text-[0.6rem] leading-relaxed text-vdu-dim">
            {error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="tombol-panel tombol-panel-aktif"
              onClick={() => {
                hapusImpor();
                window.location.reload();
              }}
            >
              Buang berkas impor dan muat ulang
            </button>
            <button type="button" className="tombol-panel" onClick={reset}>
              Coba tampilkan lagi
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
