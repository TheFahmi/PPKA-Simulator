import type { Config } from 'tailwindcss';

/**
 * Design token panel kendali perjalanan kereta api.
 *
 * Palet diturunkan dari konvensi VDU (Visual Display Unit) papan pelayanan
 * persinyalan: latar gelap non-reflektif, indikator okupansi berkontras tinggi,
 * dan aspek sinyal mengikuti warna semboyan sinyal utama.
 *
 * Palet bawaan Tailwind sengaja TIDAK dipakai (kecuali transparent/current)
 * agar tidak ada warna dekoratif yang menyusup ke papan.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // Palet ditulis ulang total — bukan extend.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      /* ---- Badan panel / kabinet ---- */
      panel: {
        void: '#04070a', // latar terluar ruang kendali
        base: '#0a1116', // badan modul
        raised: '#101b22', // modul yang diangkat
        sunken: '#060b0e', // area diagram / cekungan
        rail: '#16242d', // bilah kepala modul
        line: '#1e3039', // garis pembatas antar-modul
        'line-bright': '#33505f', // pembatas modul aktif
      },

      /* ---- Teks papan ---- */
      /*
       * Nilai terang teks dipilih agar rasio kontras terhadap seluruh latar
       * panel yang dipakai (panel.void, panel.base, panel.sunken, panel.rail)
       * tetap di atas 4,5:1 — ambang WCAG AA untuk teks kecil, dan papan ini
       * memang penuh teks 10-11 piksel.
       */
      vdu: {
        primary: '#d6e6ee', // teks utama
        muted: '#8fa7b3', // label sekunder — 6,3:1 di atas panel.rail
        dim: '#728d9b', // teks nonaktif — 4,5:1 di atas panel.rail
        invert: '#04070a',
      },

      /* ---- Okupansi sepur / blok (indikator utama papan) ---- */
      track: {
        clear: '#1fb85a', // blok bebas
        occupied: '#e02b1d', // blok diduduki sarana
        reserved: '#e9a51b', // rute terbentuk & terkunci, belum diduduki
        locked: '#8f6bd6', // blok diblokir / dikunci petugas
        idle: '#33474f', // sepur di luar dinas / tanpa deteksi
        fault: '#ff5cc8', // deteksi sarana gagal / gangguan
      },

      /* ---- Aspek sinyal (semboyan sinyal utama) ---- */
      'signal-aspect': {
        red: '#ff2a1c', // Semboyan 7 — berhenti
        yellow: '#ffb302', // Semboyan 6 — berjalan hati-hati
        green: '#22e05f', // Semboyan 5 — berjalan
        white: '#e6f1f6', // Semboyan 45 — langsir boleh
        dark: '#2a3a43', // padam / tidak berdinas
      },

      /* ---- Kedudukan wesel ---- */
      wesel: {
        lurus: '#8fd4ea', // kedudukan sepur lurus
        belok: '#ffcf4d', // kedudukan sepur belok
        balik: '#ff8a1f', // sedang membalik
        gagal: '#ff5cc8', // gangguan wesel
      },

      /* ---- Identitas layanan ---- */
      lin: {
        bogor: '#d43b2f', // Lin Bogor
        cikarang: '#1b7fc4', // Lin Cikarang
        loop: '#12a89a', // Lin Lingkar Cikarang
        kajj: '#c9a227', // KA antarkota
        klb: '#a97bff', // Kereta Luar Biasa
        langsir: '#6f8794', // langsiran / dinasan kosong
      },

      /* ---- Status pewartaan / notifikasi dinas ---- */
      warta: {
        normal: '#1fb85a',
        perhatian: '#e9a51b',
        bahaya: '#e02b1d',
        info: '#4aa8d8',
      },

      /* ---- Ketepatan waktu ---- */
      otp: {
        tepat: '#1fb85a',
        lambat: '#e9a51b',
        'lambat-berat': '#e02b1d',
        awal: '#4aa8d8',
      },
    },

    /* Panel kendali tidak memakai sudut membulat seragam. */
    borderRadius: {
      none: '0px',
      DEFAULT: '0px',
      px: '1px',
      lampu: '9999px', // hanya untuk lensa lampu sinyal
    },

    fontFamily: {
      mono: [
        'ui-monospace',
        'JetBrains Mono',
        'IBM Plex Mono',
        'Cascadia Mono',
        'Consolas',
        'Menlo',
        'monospace',
      ],
      sans: [
        'Inter',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'sans-serif',
      ],
    },

    extend: {
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.08em' }],
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
        nomor: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.04em' }],
        jam: ['1.75rem', { lineHeight: '2rem', letterSpacing: '0.02em' }],
      },
      boxShadow: {
        // Bukan drop-shadow lembut ala kartu; ini pendar fosfor indikator.
        lampu: '0 0 6px 0 currentColor',
        'lampu-kuat': '0 0 12px 1px currentColor',
        modul: 'inset 0 0 0 1px #1e3039',
      },
      spacing: {
        modul: '0.375rem',
      },
      keyframes: {
        kedip: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.15' },
        },
        'kedip-lambat': {
          '0%, 59%': { opacity: '1' },
          '60%, 100%': { opacity: '0.3' },
        },
        pindai: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        kedip: 'kedip 1s steps(1, end) infinite',
        'kedip-lambat': 'kedip-lambat 1.6s steps(1, end) infinite',
        pindai: 'pindai 7s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
