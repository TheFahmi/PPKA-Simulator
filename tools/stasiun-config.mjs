/**
 * Tetapan per stasiun untuk membangun berkas emplasemen dari geometri OSM.
 *
 * Yang ada di sini HANYA hal yang tidak dapat diambil dari OSM: koordinat pusat
 * stasiun, jari-jari wilayah pengaturan, cara membaca lantai dari tag, dan
 * pemetaan nama lintas OSM ke kode lintas pada berkas sumber stasiun.
 * Peruntukan jalur dan daftar lintas TIDAK ditulis di sini — keduanya dibaca
 * dari tools/sumber/<KODE>.json hasil penarikan.
 */

export const STASIUN = {
  MRI: {
    kode: 'MRI',
    nama: 'Manggarai',
    daop: 'Daop 1 Jakarta',
    pusat: { lat: -6.2101704, lon: 106.849935 },
    /*
     * Dek layang Manggarai tidak tersambung ke lantai dasar di dalam
     * emplasemen, dan ramp penghubungnya berada di luar 700 m. Pada 700 m dek
     * itu terputus menjadi serpihan dan jalur 9-12 hilang; pada 900 m keduabelas
     * jalur terbaca utuh, sementara jalur bernomor milik Stasiun Matraman yang
     * berjarak 1.038 m masih di luar jangkauan.
     */
    radius: 900,
    tinggiKanvas: 620,
    level: (tags) => (Number(tags.layer) >= 3 || Number(tags.level) >= 3 ? 'LAYANG' : 'DASAR'),
    lintasDariNama: [
      ['Jakarta Kota–Bogor', 'CKI'],
      ['Tanah Abang–Manggarai', 'SUD'],
      ['Manggarai–Jatinegara', 'MTR'],
      ['Depo Bukitduri', 'BY'],
    ],
    keterangan:
      'Simpul transit tersibuk Jabodetabek, bertingkat sejak Switch Over ke-7. Lantai layang melayani Lin Bogor, lantai dasar melayani Lin Cikarang, KA bandara, dan lintasan KA jarak jauh.',
    ciri: ['Dua lantai', '12 jalur bernomor', 'KA jarak jauh berjalan langsung'],
  },

  KYA: {
    kode: 'KYA',
    nama: 'Kroya',
    daop: 'Daop 5 Purwokerto',
    pusat: { lat: -7.6299479, lon: 109.2540488 },
    radius: 700,
    tinggiKanvas: 560,
    level: () => 'DASAR',
    lintasDariNama: [
      ['Kroya–Kutoarjo', 'KTA'],
      ['Prupuk–Kroya', 'PWT'],
      ['Cilacap–Kroya', 'MA'],
      ['Kroya–Cilacap', 'MA'],
    ],
    keterangan:
      'Pertemuan tiga lintas dengan satu di antaranya masih jalur tunggal, sehingga persilangan dan penyusulan menjadi keputusan dinas sehari-hari.',
    ciri: ['Jalur tunggal arah Maos', 'Jalur 1, 3, 6 untuk persilangan', 'Sub depo lokomotif'],
  },

  SLO: {
    kode: 'SLO',
    nama: 'Solo Balapan',
    daop: 'Daop 6 Yogyakarta',
    pusat: { lat: -7.5561, lon: 110.8213 },
    radius: 800,
    tinggiKanvas: 640,
    level: () => 'DASAR',
    lintasDariNama: [
      ['Yogyakarta', 'YK'],
      ['Solo Jebres', 'SK'],
      ['Gundih', 'GD'],
      ['Bandara', 'BDR'],
      ['Adi Soemarmo', 'BDR'],
    ],
    keterangan:
      'Empat arah lintas bertemu dengan segitiga pembalik di sisi timur dan emplasemen utara yang terpisah peruntukannya.',
    ciri: ['Empat arah lintas', 'Segitiga pembalik', 'Dua emplasemen'],
  },

  JNG: {
    kode: 'JNG',
    nama: 'Jatinegara',
    daop: 'Daop 1 Jakarta',
    pusat: { lat: -6.2149, lon: 106.8703 },
    radius: 700,
    tinggiKanvas: 560,
    level: (tags) => (Number(tags.layer) >= 2 ? 'LAYANG' : 'DASAR'),
    lintasDariNama: [
      ['Manggarai–Jatinegara', 'MRI'],
      ['Pasar Senen', 'PSE'],
      ['Jatinegara–Bekasi', 'BKS'],
      ['Bekasi', 'BKS'],
    ],
    keterangan:
      'Percabangan tiga lintas: rute keluar menentukan lintas mana yang ditempuh, bukan sekadar peron mana yang dipakai.',
    ciri: ['Tiga lintas bertemu', 'KA jarak jauh berhenti', 'Depo Lokomotif Cipinang'],
  },

  LPN: {
    kode: 'LPN',
    nama: 'Lempuyangan',
    daop: 'Daop 6 Yogyakarta',
    pusat: { lat: -7.7896, lon: 110.3733 },
    radius: 700,
    tinggiKanvas: 620,
    level: () => 'DASAR',
    lintasDariNama: [
      ['Yogyakarta', 'YK'],
      ['Solo', 'SLO'],
      ['Klaten', 'SLO'],
    ],
    keterangan:
      'Sebelas jalur dengan akses langsung ke Balai Yasa Yogyakarta, bengkel lokomotif utama Pulau Jawa.',
    ciri: ['11 jalur', 'Akses Balai Yasa', 'Sepur kembar ke Yogyakarta'],
  },

  BD: {
    kode: 'BD',
    nama: 'Bandung',
    daop: 'Daop 2 Bandung',
    pusat: { lat: -6.9147, lon: 107.6021 },
    radius: 800,
    tinggiKanvas: 600,
    level: () => 'DASAR',
    lintasDariNama: [
      ['Padalarang', 'PDL'],
      ['Cicalengka', 'KAC'],
      ['Kiaracondong', 'KAC'],
      ['Ciroyom', 'PDL'],
    ],
    keterangan:
      'Seluruh KA antarkota berhenti, tanpa satu pun berjalan langsung. Langsiran menjadi kegiatan utama, bukan sampingan.',
    ciri: ['Nol KA langsung', 'Langsir sebagai kegiatan utama', 'Meja putar dan depo'],
  },
};
