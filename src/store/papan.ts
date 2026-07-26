'use client';

import { create } from 'zustand';
import { indeks, JADWAL_BAWAAN, periksaJadwalAman, perjalananDinas } from '@/lib/muat-data';
import { hapusImpor, muatImpor, simpanImpor } from '@/lib/impor';
import {
  balikWesel as balikWeselMesin,
  bebaskanRute as bebaskanRuteMesin,
  bentukRute as bentukRuteMesin,
  buatKeadaanAwal,
  majuSatuDetik,
  type KeadaanSimulasi,
} from '@/lib/simulasi';
import { jalankanOtomatis } from '@/lib/otomatis';
import { hitungSkor, type RincianSkor } from '@/lib/skor';
import type { Dinas, KecepatanJam, Level, ModeOtomatis, Schedule } from '@/lib/tipe';

export type TampilanLevel = 'DASAR' | 'LAYANG' | 'KEDUA';

interface Papan {
  jadwal: Schedule;
  jadwalDiimpor: boolean;
  sim: KeadaanSimulasi | null;
  hasil: RincianSkor | null;
  dinasTerpilih: Dinas | null;
  tampilanLevel: TampilanLevel;
  levelSorot: Level;
  keretaTerpilih: string | null;
  sisaWaktuNyata: number;

  gantiJadwal: (jadwal: Schedule) => void;
  kembalikanJadwalBawaan: () => void;
  segarkanJadwalTersimpan: () => void;

  mulaiDinas: (dinasId: string) => void;
  hentikanDinas: () => void;
  aturJalan: (berjalan: boolean) => void;
  aturKecepatan: (k: KecepatanJam) => void;
  aturModeOtomatis: (m: ModeOtomatis) => void;
  majuWaktu: (deltaMs: number) => void;
  lompatKeDepan: (detik: number) => void;

  pilihKereta: (id: string | null) => void;
  aturTampilanLevel: (t: TampilanLevel) => void;
  aturLevelSorot: (l: Level) => void;

  layaniRuteMasuk: (keretaId: string, sepurId: string) => string | null;
  layaniRuteKeluar: (keretaId: string, batasId: string) => string | null;
  batalkanRute: (ruteId: string) => void;
  layaniWesel: (weselId: string) => string | null;

  tutupDinas: () => void;
}

/** Jumlah maksimum detik simulasi yang diproses dalam satu bingkai. */
const BATAS_LANGKAH_PER_BINGKAI = 24;

export const usePapan = create<Papan>((set, get) => ({
  jadwal: JADWAL_BAWAAN,
  jadwalDiimpor: false,
  sim: null,
  hasil: null,
  dinasTerpilih: null,
  tampilanLevel: 'KEDUA',
  levelSorot: 'LAYANG',
  keretaTerpilih: null,
  sisaWaktuNyata: 0,

  gantiJadwal: (jadwal) => {
    simpanImpor(jadwal);
    set({ jadwal, jadwalDiimpor: true, sim: null, hasil: null, dinasTerpilih: null });
  },

  kembalikanJadwalBawaan: () => {
    hapusImpor();
    set({
      jadwal: JADWAL_BAWAAN,
      jadwalDiimpor: false,
      sim: null,
      hasil: null,
      dinasTerpilih: null,
    });
  },

  segarkanJadwalTersimpan: () => {
    const tersimpan = muatImpor(JADWAL_BAWAAN);
    if (!tersimpan) return;
    // Berkas tersimpan diperiksa ulang sebelum dipakai. Berkas yang cacat
    // dibuang, bukan dipasang — supaya papan tidak dapat terkunci pada berkas
    // rusak yang tersimpan di peramban.
    if (periksaJadwalAman(tersimpan).some((t) => t.tingkat === 'GALAT')) {
      hapusImpor();
      return;
    }
    set({ jadwal: tersimpan, jadwalDiimpor: true });
  },

  mulaiDinas: (dinasId) => {
    const { jadwal } = get();
    const dinas = jadwal.dinas.find((d) => d.id === dinasId);
    if (!dinas) return;
    const daftar = perjalananDinas(jadwal, dinas.mulai, dinas.selesai);
    const sim = buatKeadaanAwal(indeks(), dinas, daftar);
    sim.berjalan = false;
    set({
      sim,
      dinasTerpilih: dinas,
      hasil: null,
      keretaTerpilih: null,
      sisaWaktuNyata: 0,
    });
  },

  hentikanDinas: () => set({ sim: null, hasil: null, dinasTerpilih: null }),

  aturJalan: (berjalan) => {
    const { sim } = get();
    if (!sim || sim.dinasSelesai) return;
    sim.berjalan = berjalan;
    set({ sim: { ...sim } });
  },

  aturKecepatan: (k) => {
    const { sim } = get();
    if (!sim) return;
    sim.kecepatan = k;
    set({ sim: { ...sim } });
  },

  aturModeOtomatis: (m) => {
    const { sim } = get();
    if (!sim) return;
    sim.modeOtomatis = m;
    // Pada mode PENUH, rute yang sudah menunggu dilayani seketika supaya
    // peralihan mode tidak menyisakan rangkaian tertahan tanpa perlu.
    if (m === 'PENUH') jalankanOtomatis(sim, indeks());
    set({ sim: { ...sim } });
  },

  majuWaktu: (deltaMs) => {
    const { sim, sisaWaktuNyata } = get();
    if (!sim || !sim.berjalan || sim.dinasSelesai) return;

    const total = sisaWaktuNyata + (deltaMs / 1000) * sim.kecepatan;
    let langkah = Math.floor(total);
    const sisa = total - langkah;
    if (langkah <= 0) {
      set({ sisaWaktuNyata: sisa });
      return;
    }
    if (langkah > BATAS_LANGKAH_PER_BINGKAI) langkah = BATAS_LANGKAH_PER_BINGKAI;

    const ix = indeks();
    for (let i = 0; i < langkah; i += 1) {
      if (sim.modeOtomatis === 'PENUH') jalankanOtomatis(sim, ix);
      majuSatuDetik(sim, ix);
      if (sim.dinasSelesai) break;
    }

    const perubahan: Partial<Papan> = { sim: { ...sim }, sisaWaktuNyata: sisa };
    if (sim.dinasSelesai) perubahan.hasil = hitungSkor(sim);
    set(perubahan as Papan);
  },

  lompatKeDepan: (detik) => {
    const { sim } = get();
    if (!sim || sim.dinasSelesai) return;
    const ix = indeks();
    for (let i = 0; i < detik; i += 1) {
      if (sim.modeOtomatis === 'PENUH') jalankanOtomatis(sim, ix);
      majuSatuDetik(sim, ix);
      if (sim.dinasSelesai) break;
    }
    const perubahan: Partial<Papan> = { sim: { ...sim } };
    if (sim.dinasSelesai) perubahan.hasil = hitungSkor(sim);
    set(perubahan as Papan);
  },

  pilihKereta: (id) => set({ keretaTerpilih: id }),
  aturTampilanLevel: (t) => set({ tampilanLevel: t }),
  aturLevelSorot: (l) => set({ levelSorot: l }),

  layaniRuteMasuk: (keretaId, sepurId) => {
    const { sim } = get();
    if (!sim) return 'dinas belum dimulai';
    const galat = bentukRuteMesin(sim, indeks(), keretaId, 'MASUK', sepurId);
    set({ sim: { ...sim } });
    return galat;
  },

  layaniRuteKeluar: (keretaId, batasId) => {
    const { sim } = get();
    if (!sim) return 'dinas belum dimulai';
    const galat = bentukRuteMesin(sim, indeks(), keretaId, 'KELUAR', batasId);
    set({ sim: { ...sim } });
    return galat;
  },

  batalkanRute: (ruteId) => {
    const { sim } = get();
    if (!sim) return;
    bebaskanRuteMesin(sim, indeks(), ruteId);
    set({ sim: { ...sim } });
  },

  layaniWesel: (weselId) => {
    const { sim } = get();
    if (!sim) return 'dinas belum dimulai';
    const galat = balikWeselMesin(sim, indeks(), weselId);
    set({ sim: { ...sim } });
    return galat;
  },

  tutupDinas: () => {
    const { sim } = get();
    if (!sim) return;
    sim.dinasSelesai = true;
    sim.berjalan = false;
    set({ sim: { ...sim }, hasil: hitungSkor(sim) });
  },
}));
