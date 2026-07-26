import { AMBANG_TEPAT_WAKTU, type KeadaanSimulasi } from './simulasi';
import type { KeretaAktif, Skor } from './tipe';

/**
 * Penilaian dinas.
 *
 * Bobot mengikuti prioritas dinas PPKA: ketepatan waktu lebih berat daripada
 * apa pun, disusul ketertiban penggunaan peron dan pencegahan konflik jalur.
 * Pelanggaran mengurangi nilai secara langsung.
 */

export interface RincianSkor extends Skor {
  /**
   * Kelancaran: bagian perjalanan yang tidak pernah tertahan di muka sinyal
   * masuk. Inilah ukuran konflik jalur yang benar-benar berhasil dihindari —
   * bukan banyaknya permintaan rute yang ditolak peralatan, karena penolakan
   * justru menandakan rencana pelayanan yang perlu dikoreksi.
   */
  kelancaran: number;
  keretaDilayani: KeretaAktif[];
  keretaTepat: number;
  keretaLambat: number;
  keretaLambatBerat: number;
  totalTertahanDetik: number;
  potonganPelanggaran: number;
}

export function hitungSkor(K: KeadaanSimulasi): RincianSkor {
  const dilayani = K.kereta.filter((k) => k.aktualBerangkat !== null);
  const total = K.kereta.length;
  const selesai = K.kereta.filter((k) => k.fase === 'SELESAI').length;

  const deviasi = dilayani.map((k) => k.deviasiDetik);
  const tepat = deviasi.filter((d) => d <= AMBANG_TEPAT_WAKTU).length;
  const lambat = deviasi.filter((d) => d > AMBANG_TEPAT_WAKTU && d <= 600).length;
  const lambatBerat = deviasi.filter((d) => d > 600).length;

  const ketepatanWaktu = dilayani.length > 0 ? tepat / dilayani.length : 0;
  const rerataDeviasiDetik =
    deviasi.length > 0 ? Math.round(deviasi.reduce((a, b) => a + b, 0) / deviasi.length) : 0;
  const deviasiTerburukDetik = deviasi.length > 0 ? Math.max(...deviasi) : 0;

  const denganPenetapan = K.kereta.filter((k) => k.sepurLazimTerpakai !== null);
  const efisiensiPeron =
    denganPenetapan.length > 0
      ? denganPenetapan.filter((k) => k.sepurLazimTerpakai).length / denganPenetapan.length
      : 0;

  const potonganPelanggaran = K.pelanggaran.reduce((a, p) => a + p.bobot, 0);
  const rasioSelesai = total > 0 ? selesai / total : 0;
  const kelancaran =
    dilayani.length > 0
      ? dilayani.filter((k) => k.totalTertahanDetik === 0).length / dilayani.length
      : 0;

  const dasar =
    500 * ketepatanWaktu + 200 * efisiensiPeron + 200 * rasioSelesai + 100 * kelancaran;

  const nilaiAkhir = Math.max(0, Math.min(1000, Math.round(dasar - potonganPelanggaran)));

  return {
    kelancaran,
    ketepatanWaktu,
    keretaSelesai: selesai,
    keretaTotal: total,
    rerataDeviasiDetik,
    deviasiTerburukDetik,
    konflikDicegah: K.konflikDicegah,
    pelanggaran: K.pelanggaran.length,
    efisiensiPeron,
    nilaiAkhir,
    peringkat: peringkatDari(nilaiAkhir),
    keretaDilayani: dilayani,
    keretaTepat: tepat,
    keretaLambat: lambat,
    keretaLambatBerat: lambatBerat,
    totalTertahanDetik: K.kereta.reduce((a, k) => a + k.totalTertahanDetik, 0),
    potonganPelanggaran,
  };
}

function peringkatDari(nilai: number): Skor['peringkat'] {
  if (nilai >= 850) return 'A';
  if (nilai >= 700) return 'B';
  if (nilai >= 550) return 'C';
  if (nilai >= 400) return 'D';
  return 'E';
}

export const KETERANGAN_PERINGKAT: Record<Skor['peringkat'], string> = {
  A: 'Pelaksanaan dinas tertib. Ketepatan waktu terjaga dan penetapan jalur sesuai peruntukan.',
  B: 'Pelaksanaan dinas baik dengan sebagian kecil perjalanan terlambat.',
  C: 'Pelaksanaan dinas cukup. Terdapat keterlambatan berantai yang perlu dievaluasi.',
  D: 'Pelaksanaan dinas kurang. Banyak rangkaian tertahan di muka sinyal masuk.',
  E: 'Pelaksanaan dinas tidak memenuhi ketentuan. Perlu pengulangan dinas latihan.',
};
