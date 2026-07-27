'use client';

import { create } from 'zustand';
import { indeksUntuk, periksaJadwalAman, perjalananDinas } from '@/lib/muat-data';
import { hapusImpor, muatImpor, simpanImpor } from '@/lib/impor';
import {
  kodeStasiunSah,
  muatStasiun,
  ringkasStasiun,
  STASIUN_BAWAAN,
  type KodeStasiun,
  type RingkasStasiun,
} from '@/lib/stasiun';
import type { IndeksEmplasemen, ModeGambar } from '@/lib/emplasemen';
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
import type {
  Dinas,
  Emplasemen,
  KecepatanJam,
  Level,
  ModeOtomatis,
  Schedule,
} from '@/lib/tipe';

export type TampilanLevel = 'DASAR' | 'LAYANG' | 'KEDUA';

interface Papan {
  /**
   * Stasiun yang sedang didinasi. Emplasemen, jadwal, dan indeks grafnya
   * selalu dipasang bersamaan sehingga ketiganya tidak pernah berasal dari
   * stasiun yang berlainan — keadaan yang akan membuat rute terbentuk di atas
   * graf yang keliru tanpa satu pun pesan galat.
   */
  stasiun: KodeStasiun;
  ringkas: RingkasStasiun | null;
  emplasemen: Emplasemen | null;
  ix: IndeksEmplasemen | null;
  memuatStasiun: boolean;
  galatMuat: string | null;
  modeGambar: ModeGambar;

  jadwal: Schedule | null;
  jadwalDiimpor: boolean;
  sim: KeadaanSimulasi | null;
  hasil: RincianSkor | null;
  dinasTerpilih: Dinas | null;
  tampilanLevel: TampilanLevel;
  levelSorot: Level;
  keretaTerpilih: string | null;
  sisaWaktuNyata: number;

  pilihStasiun: (kode: string) => Promise<void>;
  aturModeGambar: (m: ModeGambar) => void;

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
  stasiun: STASIUN_BAWAAN,
  ringkas: ringkasStasiun(STASIUN_BAWAAN) ?? null,
  emplasemen: null,
  ix: null,
  memuatStasiun: false,
  galatMuat: null,
  modeGambar: 'DENAH',

  jadwal: null,
  jadwalDiimpor: false,
  sim: null,
  hasil: null,
  dinasTerpilih: null,
  tampilanLevel: 'KEDUA',
  levelSorot: 'LAYANG',
  keretaTerpilih: null,
  sisaWaktuNyata: 0,

  pilihStasiun: async (kode) => {
    const sah = kodeStasiunSah(kode);
    const { stasiun, emplasemen, memuatStasiun } = get();
    if (sah === stasiun && (emplasemen || memuatStasiun)) return;

    // Dinas yang sedang berjalan selalu dihentikan: melanjutkannya di atas
    // emplasemen lain tidak berarti apa-apa.
    set({
      stasiun: sah,
      ringkas: ringkasStasiun(sah) ?? null,
      memuatStasiun: true,
      galatMuat: null,
      emplasemen: null,
      ix: null,
      jadwal: null,
      jadwalDiimpor: false,
      sim: null,
      hasil: null,
      dinasTerpilih: null,
      keretaTerpilih: null,
      modeGambar: 'DENAH',
    });

    try {
      const data = await muatStasiun(sah);
      // Pemilihan berikutnya bisa mendahului selesainya pemuatan ini; hasil
      // yang telanjur kedaluwarsa dibuang, bukan dipasang menimpa yang baru.
      if (get().stasiun !== sah) return;

      const ix = indeksUntuk(data.emplasemen);
      const tersimpan = muatImpor(sah, data.jadwal);
      const pakaiImpor =
        tersimpan !== null &&
        !periksaJadwalAman(tersimpan, data.emplasemen).some((t) => t.tingkat === 'GALAT');
      if (tersimpan && !pakaiImpor) hapusImpor(sah);

      // Stasiun berlantai satu tidak punya kanvas layang; papan langsung
      // disetel ke lantai dasar supaya tidak ada tombol lantai yang kosong.
      const bertingkat = Boolean(data.emplasemen.kanvas.LAYANG);
      set({
        emplasemen: data.emplasemen,
        ix,
        jadwal: pakaiImpor ? (tersimpan as Schedule) : data.jadwal,
        jadwalDiimpor: pakaiImpor,
        memuatStasiun: false,
        tampilanLevel: bertingkat ? 'KEDUA' : 'DASAR',
        levelSorot: bertingkat ? 'LAYANG' : 'DASAR',
      });
    } catch (e) {
      if (get().stasiun !== sah) return;
      set({ memuatStasiun: false, galatMuat: (e as Error).message });
    }
  },

  aturModeGambar: (m) => set({ modeGambar: m }),

  gantiJadwal: (jadwal) => {
    simpanImpor(get().stasiun, jadwal);
    set({ jadwal, jadwalDiimpor: true, sim: null, hasil: null, dinasTerpilih: null });
  },

  kembalikanJadwalBawaan: () => {
    const { stasiun } = get();
    hapusImpor(stasiun);
    void muatStasiun(stasiun).then((data) => {
      if (get().stasiun !== stasiun) return;
      set({
        jadwal: data.jadwal,
        jadwalDiimpor: false,
        sim: null,
        hasil: null,
        dinasTerpilih: null,
      });
    });
  },

  segarkanJadwalTersimpan: () => {
    const { stasiun, jadwal, emplasemen } = get();
    if (!jadwal || !emplasemen) return;
    const tersimpan = muatImpor(stasiun, jadwal);
    if (!tersimpan) return;
    // Berkas tersimpan diperiksa ulang sebelum dipakai. Berkas yang cacat
    // dibuang, bukan dipasang — supaya papan tidak dapat terkunci pada berkas
    // rusak yang tersimpan di peramban.
    if (periksaJadwalAman(tersimpan, emplasemen).some((t) => t.tingkat === 'GALAT')) {
      hapusImpor(stasiun);
      return;
    }
    set({ jadwal: tersimpan, jadwalDiimpor: true });
  },

  mulaiDinas: (dinasId) => {
    const { jadwal, ix } = get();
    if (!jadwal || !ix) return;
    const dinas = jadwal.dinas.find((d) => d.id === dinasId);
    if (!dinas) return;
    const daftar = perjalananDinas(jadwal, dinas.mulai, dinas.selesai);
    const sim = buatKeadaanAwal(ix, dinas, daftar);
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
    const { sim, ix } = get();
    if (!sim) return;
    sim.modeOtomatis = m;
    // Pada mode PENUH, rute yang sudah menunggu dilayani seketika supaya
    // peralihan mode tidak menyisakan rangkaian tertahan tanpa perlu.
    if (m === 'PENUH' && ix) jalankanOtomatis(sim, ix);
    set({ sim: { ...sim } });
  },

  majuWaktu: (deltaMs) => {
    const { sim, sisaWaktuNyata, ix } = get();
    if (!sim || !ix || !sim.berjalan || sim.dinasSelesai) return;

    const total = sisaWaktuNyata + (deltaMs / 1000) * sim.kecepatan;
    let langkah = Math.floor(total);
    const sisa = total - langkah;
    if (langkah <= 0) {
      set({ sisaWaktuNyata: sisa });
      return;
    }
    if (langkah > BATAS_LANGKAH_PER_BINGKAI) langkah = BATAS_LANGKAH_PER_BINGKAI;

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
    const { sim, ix } = get();
    if (!sim || !ix || sim.dinasSelesai) return;
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
    const { sim, ix } = get();
    if (!sim || !ix) return 'dinas belum dimulai';
    const galat = bentukRuteMesin(sim, ix, keretaId, 'MASUK', sepurId);
    set({ sim: { ...sim } });
    return galat;
  },

  layaniRuteKeluar: (keretaId, batasId) => {
    const { sim, ix } = get();
    if (!sim || !ix) return 'dinas belum dimulai';
    const galat = bentukRuteMesin(sim, ix, keretaId, 'KELUAR', batasId);
    set({ sim: { ...sim } });
    return galat;
  },

  batalkanRute: (ruteId) => {
    const { sim, ix } = get();
    if (!sim || !ix) return;
    bebaskanRuteMesin(sim, ix, ruteId);
    set({ sim: { ...sim } });
  },

  layaniWesel: (weselId) => {
    const { sim, ix } = get();
    if (!sim || !ix) return 'dinas belum dimulai';
    const galat = balikWeselMesin(sim, ix, weselId);
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
