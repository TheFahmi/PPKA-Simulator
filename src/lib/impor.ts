import type { KeandalanData, KodeLin, JenisSarana, Schedule, Trip } from './tipe';

/**
 * Pemasukan berkas jadwal dari luar (CSV atau JSON).
 *
 * Tujuannya agar berkas jadwal dapat diganti setiap kali GAPEKA direvisi tanpa
 * menyentuh kode. Berkas yang dimasukkan disimpan pada penyimpanan lokal
 * peramban dan dipakai menggantikan berkas bawaan sampai dikembalikan.
 */

/**
 * Kunci penyimpanan peramban, DIPISAH PER STASIUN. Berkas impor Kroya tidak
 * boleh terpakai di Jatinegara: id batas dan id sepurnya berbeda, sehingga
 * seluruh barisnya akan ditolak pemeriksa dan papan tampak rusak tanpa sebab.
 */
export function kunciSimpanan(kodeStasiun: string): string {
  return `ppka:jadwal-impor:${kodeStasiun}`;
}

export const KOLOM_CSV = [
  'nomorKA',
  'lin',
  'jenisSarana',
  'asal',
  'tujuan',
  'batasMasukId',
  'batasKeluarId',
  'jamDatang',
  'jamBerangkat',
  'sepurLazim',
  'waktuBerhentiMinimumDetik',
  'langsung',
  'keandalanData',
  'catatan',
] as const;

export const CONTOH_BARIS_CSV =
  'nomorKA,lin,jenisSarana,asal,tujuan,batasMasukId,batasKeluarId,jamDatang,jamBerangkat,sepurLazim,waktuBerhentiMinimumDetik,langsung,keandalanData,catatan\n' +
  '1157,LIN_BOGOR,KRL_12,Bogor,Jakarta Kota,BTS-TBT-D,BTS-CKI-K,05.04.00,05.06.00,SP-L9|SP-L10,100,false,RESMI,';

export interface HasilImpor {
  jadwal: Schedule | null;
  galat: string[];
}

/** Pembaca CSV sederhana yang menghormati tanda kutip ganda. */
function belahBaris(baris: string): string[] {
  const hasil: string[] = [];
  let kini = '';
  let dalamKutip = false;
  for (let i = 0; i < baris.length; i += 1) {
    const c = baris[i];
    if (dalamKutip) {
      if (c === '"') {
        if (baris[i + 1] === '"') {
          kini += '"';
          i += 1;
        } else {
          dalamKutip = false;
        }
      } else {
        kini += c;
      }
    } else if (c === '"') {
      dalamKutip = true;
    } else if (c === ',') {
      hasil.push(kini);
      kini = '';
    } else {
      kini += c;
    }
  }
  hasil.push(kini);
  return hasil.map((s) => s.trim());
}

function normalkanJam(nilai: string): string {
  const bersih = nilai.replace(/:/g, '.').trim();
  const bagian = bersih.split('.');
  if (bagian.length === 2) return `${bagian[0]}.${bagian[1]}.00`;
  return bersih;
}

export function baacaCsv(teks: string, kerangka: Schedule): HasilImpor {
  const galat: string[] = [];
  const baris = teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && !b.startsWith('#'));

  if (baris.length < 2) {
    return { jadwal: null, galat: ['Berkas CSV kosong atau hanya berisi kepala kolom.'] };
  }

  const kepala = belahBaris(baris[0] as string).map((k) => k.trim());
  const wajib = [
    'nomorKA',
    'lin',
    'asal',
    'tujuan',
    'batasMasukId',
    'jamDatang',
    'jamBerangkat',
  ];
  for (const k of wajib) {
    if (!kepala.includes(k)) galat.push(`Kolom wajib "${k}" tidak ada pada kepala CSV.`);
  }
  if (galat.length > 0) return { jadwal: null, galat };

  const perjalanan: Trip[] = [];
  for (let i = 1; i < baris.length; i += 1) {
    const sel = belahBaris(baris[i] as string);
    const ambil = (nama: string): string => {
      const idx = kepala.indexOf(nama);
      return idx >= 0 ? (sel[idx] ?? '') : '';
    };

    const nomorKA = ambil('nomorKA');
    if (!nomorKA) {
      galat.push(`Baris ${i + 1}: kolom nomorKA kosong.`);
      continue;
    }

    const batasKeluar = ambil('batasKeluarId');
    perjalanan.push({
      id: `TRIP-${nomorKA}`,
      nomorKA,
      lin: (ambil('lin') || 'LIN_BOGOR') as KodeLin,
      jenisSarana: (ambil('jenisSarana') || 'KRL_12') as JenisSarana,
      relasi: `${ambil('asal')} - ${ambil('tujuan')}`,
      asal: ambil('asal'),
      tujuan: ambil('tujuan'),
      batasMasukId: ambil('batasMasukId'),
      batasKeluarId: batasKeluar === '' || batasKeluar === '-' ? null : batasKeluar,
      jamDatang: normalkanJam(ambil('jamDatang')),
      jamBerangkat: normalkanJam(ambil('jamBerangkat')),
      sepurLazim: ambil('sepurLazim')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean),
      waktuBerhentiMinimumDetik:
        Number.parseInt(ambil('waktuBerhentiMinimumDetik'), 10) || 100,
      langsung: ambil('langsung').toLowerCase() === 'true',
      keandalanData: (ambil('keandalanData') || 'CONTOH') as KeandalanData,
      ...(ambil('catatan') ? { catatan: ambil('catatan') } : {}),
    });
  }

  if (perjalanan.length === 0) {
    return { jadwal: null, galat: [...galat, 'Tidak ada baris perjalanan yang terbaca.'] };
  }

  return {
    jadwal: {
      ...kerangka,
      versi: `${kerangka.versi}+impor-csv`,
      // Berkas impor tidak mewarisi label edisi maupun daftar sumber bawaan.
      gapeka: 'Tidak dinyatakan pada berkas impor',
      sumber: ['(berkas impor CSV tidak menyertakan sumber)'],
      tanggalDibuat: tanggalHariIni(),
      catatanKeakuratan:
        'Berkas ini dimasukkan pengguna melalui menu impor CSV. Keandalan tiap baris mengikuti kolom keandalanData pada berkas asal; asal-usulnya tidak diperiksa aplikasi.',
      perjalanan,
    },
    galat,
  };
}

function teksAtau(nilai: unknown, bawaan = ''): string {
  return typeof nilai === 'string' ? nilai : bawaan;
}

/**
 * Ubah satu entri JSON mentah menjadi `Trip` yang utuh.
 *
 * Entri JSON tidak boleh dipercaya begitu saja: berkas dari luar bisa
 * kehilangan kolom, memuat tipe yang keliru, atau berisi entri bukan objek.
 * Semua dinormalkan di sini supaya lapisan lain — pemeriksa, papan, dan mesin —
 * tidak pernah menerima bentuk yang cacat.
 */
function normalkanPerjalanan(
  mentah: unknown,
  urutan: number,
  galat: string[],
): Trip | null {
  if (typeof mentah !== 'object' || mentah === null || Array.isArray(mentah)) {
    galat.push(`Entri perjalanan ke-${urutan + 1} bukan objek.`);
    return null;
  }
  const m = mentah as Record<string, unknown>;
  const nomorKA = teksAtau(m.nomorKA);
  if (!nomorKA) {
    galat.push(`Entri perjalanan ke-${urutan + 1}: kolom nomorKA kosong atau bukan teks.`);
    return null;
  }

  const asal = teksAtau(m.asal);
  const tujuan = teksAtau(m.tujuan);
  const batasKeluar = m.batasKeluarId;

  return {
    id: teksAtau(m.id) || `TRIP-${nomorKA}`,
    nomorKA,
    lin: (teksAtau(m.lin) || 'LIN_BOGOR') as KodeLin,
    jenisSarana: (teksAtau(m.jenisSarana) || 'KRL_12') as JenisSarana,
    relasi: teksAtau(m.relasi) || `${asal} - ${tujuan}`,
    asal,
    tujuan,
    batasMasukId: teksAtau(m.batasMasukId),
    batasKeluarId: typeof batasKeluar === 'string' && batasKeluar !== '' ? batasKeluar : null,
    jamDatang: normalkanJam(teksAtau(m.jamDatang)),
    jamBerangkat: normalkanJam(teksAtau(m.jamBerangkat)),
    sepurLazim: Array.isArray(m.sepurLazim)
      ? m.sepurLazim.filter((s): s is string => typeof s === 'string')
      : [],
    waktuBerhentiMinimumDetik:
      typeof m.waktuBerhentiMinimumDetik === 'number' &&
      Number.isFinite(m.waktuBerhentiMinimumDetik)
        ? m.waktuBerhentiMinimumDetik
        : 100,
    langsung: m.langsung === true,
    keandalanData: (teksAtau(m.keandalanData) || 'CONTOH') as KeandalanData,
    ...(teksAtau(m.catatan) ? { catatan: teksAtau(m.catatan) } : {}),
  };
}

export function bacaJson(teks: string, kerangka: Schedule): HasilImpor {
  let obj: unknown;
  try {
    obj = JSON.parse(teks);
  } catch (e) {
    return {
      jadwal: null,
      galat: [`Berkas bukan JSON yang sah: ${(e as Error).message}`],
    };
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { jadwal: null, galat: ['Isi berkas JSON bukan objek jadwal.'] };
  }

  const kandidat = obj as Record<string, unknown>;
  if (!Array.isArray(kandidat.perjalanan)) {
    return {
      jadwal: null,
      galat: ['Berkas JSON tidak memuat larik "perjalanan".'],
    };
  }

  const galat: string[] = [];
  const perjalanan = kandidat.perjalanan
    .map((m, i) => normalkanPerjalanan(m, i, galat))
    .filter((t): t is Trip => t !== null);

  if (perjalanan.length === 0) {
    return {
      jadwal: null,
      galat: [...galat, 'Tidak ada entri perjalanan yang dapat dibaca.'],
    };
  }

  return {
    jadwal: {
      versi: teksAtau(kandidat.versi) || `${kerangka.versi}+impor-json`,
      // Label edisi dan daftar sumber TIDAK diwarisi dari berkas bawaan:
      // berkas hasil impor tidak boleh mengaku bersandar pada terbitan resmi
      // yang belum tentu menjadi asalnya.
      gapeka: teksAtau(kandidat.gapeka) || 'Tidak dinyatakan pada berkas impor',
      stasiun: teksAtau(kandidat.stasiun) || kerangka.stasiun,
      tanggalDibuat: teksAtau(kandidat.tanggalDibuat) || tanggalHariIni(),
      sumber: Array.isArray(kandidat.sumber)
        ? kandidat.sumber.filter((s): s is string => typeof s === 'string')
        : ['(berkas impor tidak menyertakan sumber)'],
      catatanKeakuratan:
        teksAtau(kandidat.catatanKeakuratan) ||
        'Berkas dimasukkan pengguna melalui menu impor JSON; berkas asal tidak menyertakan catatan keakuratan, sehingga asal-usul tiap baris tidak dapat dipastikan.',
      layanan: Array.isArray(kandidat.layanan)
        ? (kandidat.layanan as Schedule['layanan'])
        : kerangka.layanan,
      dinas: Array.isArray(kandidat.dinas) && kandidat.dinas.length > 0
        ? (kandidat.dinas as Schedule['dinas'])
        : kerangka.dinas,
      perjalanan,
    },
    galat,
  };
}

function tanggalHariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function bacaBerkas(namaBerkas: string, teks: string, kerangka: Schedule): HasilImpor {
  if (namaBerkas.toLowerCase().endsWith('.csv')) return baacaCsv(teks, kerangka);
  if (namaBerkas.toLowerCase().endsWith('.json')) return bacaJson(teks, kerangka);
  // Tebak dari isi bila berkas tanpa akhiran yang dikenal.
  return teks.trimStart().startsWith('{') ? bacaJson(teks, kerangka) : baacaCsv(teks, kerangka);
}

export function keCsv(jadwal: Schedule): string {
  const baris = [KOLOM_CSV.join(',')];
  const kutip = (n: string) =>
    /[",\n]/.test(n) ? `"${n.replace(/"/g, '""')}"` : n;
  for (const t of jadwal.perjalanan) {
    baris.push(
      [
        t.nomorKA,
        t.lin,
        t.jenisSarana,
        t.asal,
        t.tujuan,
        t.batasMasukId,
        t.batasKeluarId ?? '',
        t.jamDatang,
        t.jamBerangkat,
        (t.sepurLazim ?? []).join('|'),
        String(t.waktuBerhentiMinimumDetik),
        String(t.langsung),
        t.keandalanData,
        t.catatan ?? '',
      ]
        .map((n) => kutip(String(n)))
        .join(','),
    );
  }
  return baris.join('\n');
}

export function simpanImpor(kodeStasiun: string, jadwal: Schedule): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(kunciSimpanan(kodeStasiun), JSON.stringify(jadwal));
}

/**
 * Muat berkas impor yang tersimpan di peramban.
 *
 * Berkas tersimpan dibaca ulang lewat `bacaJson` — bukan dipercaya apa adanya —
 * supaya berkas yang telanjur rusak tidak pernah dapat membuntukan papan pada
 * pemuatan berikutnya.
 */
export function muatImpor(kodeStasiun: string, kerangka: Schedule): Schedule | null {
  if (typeof window === 'undefined') return null;
  const kunci = kunciSimpanan(kodeStasiun);
  const teks = window.localStorage.getItem(kunci);
  if (!teks) return null;
  const hasil = bacaJson(teks, kerangka);
  if (!hasil.jadwal) {
    window.localStorage.removeItem(kunci);
    return null;
  }
  return hasil.jadwal;
}

export function hapusImpor(kodeStasiun: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(kunciSimpanan(kodeStasiun));
}

/**
 * Buang berkas impor SELURUH stasiun.
 *
 * Dipakai halaman galat, yang justru terpanggil ketika papan tidak lagi dapat
 * dipercaya menyebut stasiun mana yang sedang dipilih. Karena itu jalan keluar
 * ini sengaja tidak bergantung pada keadaan papan.
 */
export function hapusSeluruhImpor(): void {
  if (typeof window === 'undefined') return;
  const awalan = kunciSimpanan('');
  const dibuang: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(awalan)) dibuang.push(k);
  }
  for (const k of dibuang) window.localStorage.removeItem(k);
}
