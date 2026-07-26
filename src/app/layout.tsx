import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PPKA Simulator: Manggarai — Papan Pelayanan Perjalanan Kereta Api',
  description:
    'Simulasi dinas Pengatur Perjalanan Kereta Api Stasiun Manggarai (MRI): pelayanan rute, kedudukan wesel, aspek sinyal, dan pengaturan jalur pada dua lantai emplasemen.',
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
