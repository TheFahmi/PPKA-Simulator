import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Simulator PPKA — Papan Pelayanan Perjalanan Kereta Api',
  description:
    'Simulasi dinas Pengatur Perjalanan Kereta Api pada emplasemen Manggarai, Jatinegara, Kroya, Solo Balapan, Lempuyangan, dan Bandung: pelayanan rute, kedudukan wesel, aspek sinyal, dan penetapan jalur.',
};

export const viewport: Viewport = {
  themeColor: '#04070a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
