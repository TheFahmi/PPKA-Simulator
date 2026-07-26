import emplasemenMentah from '../../data/emplasemen-manggarai.json';
import jadwalMentah from '../../data/jadwal-manggarai.json';
import type { Emplasemen, Schedule, Trip } from './tipe';
import { indeksEmplasemen, type IndeksEmplasemen } from './emplasemen';
import { keDetik, keDetikDinas, rentangDinas } from './waktu';

/**
 * Pemuatan berkas data.
 *
 * Berkas jadwal dan emplasemen sengaja berada di luar direktori komponen
 * (folder `data/`) supaya dapat diperbarui saat GAPEKA direvisi tanpa
 * menyentuh kode. Pemuatan selalu melewati pemeriksaan keutuhan di bawah;
 * berkas yang cacat harus gagal dengan pesan jelas, bukan diam-diam dipakai.
 */

export const EMPLASEMEN = emplasemenMentah as unknown as Emplasemen;
export const JADWAL_BAWAAN = jadwalMentah as unknown as Schedule;

let indeksTersimpan: IndeksEmplasemen | null = null;

export function indeks(): IndeksEmplasemen {
  if (!indeksTersimpan) indeksTersimpan = indeksEmplasemen(EMPLASEMEN);
  return indeksTersimpan;
}

export interface TemuanPeriksa {
  tingkat: 'GALAT' | 'PERINGATAN';
  baris: string;
  pesan: string;
}

const POLA_JAM = /^([01]\d|2[0-3])[.:][0-5]\d([.:][0-5]\d)?$/;

/**
 * Periksa satu berkas jadwal terhadap emplasemen yang dimuat.
 * Dipakai baik oleh pemuat bawaan maupun oleh menu impor.
 */
export function periksaJadwal(
  jadwal: Schedule,
  emplasemen: Emplasemen = EMPLASEMEN,
): TemuanPeriksa[] {
  const temuan: TemuanPeriksa[] = [];
  const idBatas = new Set(emplasemen.batas.map((b) => b.id));
  const idSepur = new Set(emplasemen.sepur.map((s) => s.id));
  const kodeLayanan = new Set(jadwal.layanan?.map((l) => l.kode) ?? []);
  const idTerpakai = new Set<string>();

  if (!Array.isArray(jadwal.perjalanan) || jadwal.perjalanan.length === 0) {
    temuan.push({
      tingkat: 'GALAT',
      baris: '(berkas)',
      pesan: 'Berkas tidak memuat satu pun perjalanan.',
    });
    return temuan;
  }

  let urutan = 0;
  for (const t of jadwal.perjalanan) {
    urutan += 1;
    if (typeof t !== 'object' || t === null || Array.isArray(t)) {
      temuan.push({
        tingkat: 'GALAT',
        baris: `entri ke-${urutan}`,
        pesan: 'Entri perjalanan bukan objek.',
      });
      continue;
    }
    const baris = t.nomorKA ? `KA ${t.nomorKA}` : (t.id ?? `entri ke-${urutan}`);

    for (const kolom of ['nomorKA', 'lin', 'asal', 'tujuan', 'batasMasukId'] as const) {
      if (typeof t[kolom] !== 'string') {
        temuan.push({
          tingkat: 'GALAT',
          baris,
          pesan: `Kolom ${kolom} kosong atau bukan teks.`,
        });
      }
    }
    if (t.sepurLazim !== undefined && !Array.isArray(t.sepurLazim)) {
      temuan.push({
        tingkat: 'GALAT',
        baris,
        pesan: 'Kolom sepurLazim harus berupa larik id sepur.',
      });
    }

    if (!t.id) {
      temuan.push({ tingkat: 'GALAT', baris, pesan: 'Kolom id kosong.' });
    } else if (idTerpakai.has(t.id)) {
      temuan.push({ tingkat: 'GALAT', baris, pesan: `Id perjalanan ${t.id} ganda.` });
    } else {
      idTerpakai.add(t.id);
    }

    if (!POLA_JAM.test(t.jamDatang ?? '')) {
      temuan.push({
        tingkat: 'GALAT',
        baris,
        pesan: `Jam datang "${t.jamDatang}" tidak sesuai bentuk HH.MM atau HH.MM.SS.`,
      });
    }
    if (!POLA_JAM.test(t.jamBerangkat ?? '')) {
      temuan.push({
        tingkat: 'GALAT',
        baris,
        pesan: `Jam berangkat "${t.jamBerangkat}" tidak sesuai bentuk HH.MM atau HH.MM.SS.`,
      });
    }
    if (POLA_JAM.test(t.jamDatang ?? '') && POLA_JAM.test(t.jamBerangkat ?? '')) {
      if (keDetik(t.jamBerangkat) < keDetik(t.jamDatang)) {
        temuan.push({
          tingkat: 'GALAT',
          baris,
          pesan: 'Jam berangkat mendahului jam datang.',
        });
      }
    }

    if (!idBatas.has(t.batasMasukId)) {
      temuan.push({
        tingkat: 'GALAT',
        baris,
        pesan: `Batas masuk "${t.batasMasukId}" tidak dikenal pada emplasemen ${emplasemen.kodeStasiun}.`,
      });
    }
    if (t.batasKeluarId !== null && !idBatas.has(t.batasKeluarId)) {
      temuan.push({
        tingkat: 'GALAT',
        baris,
        pesan: `Batas keluar "${t.batasKeluarId}" tidak dikenal.`,
      });
    }
    for (const sp of Array.isArray(t.sepurLazim) ? t.sepurLazim : []) {
      if (!idSepur.has(sp)) {
        temuan.push({
          tingkat: 'PERINGATAN',
          baris,
          pesan: `Sepur lazim "${sp}" tidak ada di emplasemen; usulan sepur diabaikan.`,
        });
      }
    }
    if (kodeLayanan.size > 0 && !kodeLayanan.has(t.lin)) {
      temuan.push({
        tingkat: 'PERINGATAN',
        baris,
        pesan: `Lin "${t.lin}" tidak terdaftar pada bagian layanan.`,
      });
    }
    if (!['RESMI', 'REKONSTRUKSI_POLA', 'CONTOH'].includes(t.keandalanData)) {
      temuan.push({
        tingkat: 'PERINGATAN',
        baris,
        pesan:
          'Kolom keandalanData kosong atau tidak dikenal. Isi RESMI, REKONSTRUKSI_POLA, atau CONTOH agar asal-usul data terbaca petugas.',
      });
    }
  }

  return temuan;
}

/**
 * Pemeriksaan yang tidak pernah melempar.
 * Dipakai pada jalur impor: berkas serusak apa pun harus menghasilkan daftar
 * temuan, bukan galat yang mematikan halaman.
 */
export function periksaJadwalAman(
  jadwal: Schedule,
  emplasemen: Emplasemen = EMPLASEMEN,
): TemuanPeriksa[] {
  try {
    return periksaJadwal(jadwal, emplasemen);
  } catch (e) {
    return [
      {
        tingkat: 'GALAT',
        baris: '(berkas)',
        pesan: `Berkas tidak dapat diperiksa: ${(e as Error).message}`,
      },
    ];
  }
}

/** Perjalanan yang termuat pada rentang satu dinas, terurut menurut jam datang. */
export function perjalananDinas(
  jadwal: Schedule,
  mulai: string,
  selesai: string,
): Trip[] {
  const { mulai: a, selesai: b } = rentangDinas(mulai, selesai);
  // Yang termuat adalah perjalanan yang DATANG dalam rentang dinas. Perjalanan
  // yang datang sebelum dinas dibuka menjadi tanggung jawab dinas sebelumnya;
  // yang berangkat setelah dinas ditutup tetap dilayani sampai selesai.
  // Dinas malam melewati tengah malam, jadi perbandingannya memakai skala
  // detik dinas, bukan detik hari.
  return jadwal.perjalanan
    .filter((t) => {
      const d = keDetikDinas(t.jamDatang, a);
      return d >= a && d <= b;
    })
    .sort((x, y) => keDetikDinas(x.jamDatang, a) - keDetikDinas(y.jamDatang, a));
}

export function ringkasKeandalan(daftar: Trip[]) {
  return daftar.reduce(
    (a, t) => {
      a[t.keandalanData] = (a[t.keandalanData] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );
}
