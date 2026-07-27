/**
 * Tetapan per stasiun untuk membangun berkas emplasemen dari geometri OSM.
 *
 * Yang ada di sini HANYA hal yang tidak dapat diambil dari OSM: koordinat pusat
 * stasiun, jari-jari wilayah pengaturan, cara membaca lantai dari tag, dan
 * pemetaan nama lintas OSM ke kode lintas pada berkas sumber stasiun.
 * Peruntukan jalur dan daftar lintas TIDAK ditulis di sini — keduanya dibaca
 * dari tools/sumber/<KODE>.json hasil penarikan.
 *
 * Bentuk `lintasDariNama`: [petunjukNama, sisi, kodeLintas].
 * Sisi diperlukan karena satu nama lintas di OSM kerap membentang menembus
 * stasiun dan muncul di kedua sisinya — "Jalur Kereta Api Jakarta Kota-Cikampek"
 * di Jatinegara misalnya, yang di sisi barat menuju Pasar Senen dan di sisi
 * timur menuju Bekasi. Nilai '*' berarti sisi mana pun.
 */

export const STASIUN = {
  /*
   * MANGGARAI TIDAK MEMAKAI HASIL ALAT INI.
   *
   * Alat ini memutar emplasemen ke arah sumbu utamanya (analisis komponen
   * utama) supaya terbaca mendatar. Cara itu benar untuk stasiun yang berada
   * pada satu koridor, dan itulah lima stasiun lainnya. Manggarai bukan:
   * di sana koridor Jakarta Kota-Bogor dan koridor Tanah Abang-Jatinegara
   * berpotongan hampir tegak lurus, sehingga tidak ada satu sumbu yang benar.
   * Sumbu yang terpilih (-48,1 derajat) membuat kedua ujung lintas Bogor
   * jatuh di sisi yang sama, 34 dari 43 batas tidak terkenali lintasnya, dan
   * kanvas membengkak menjadi 1.489 satuan. Karena itu Manggarai tetap memakai
   * data/emplasemen-manggarai.json yang disusun dari dokumen tata letak resmi
   * dan sudah terverifikasi, dan tetapan di bawah ini disimpan hanya sebagai
   * catatan percobaan — kodenya sengaja tidak didaftarkan pada DIBANGUN.
   */
  MRI: {
    kode: 'MRI',
    nama: 'Manggarai',
    daop: 'Daop 1 Jakarta',
    pusat: { lat: -6.2101704, lon: 106.849935 },
    radius: 900,
    level: (tags) => (Number(tags.layer) >= 3 || Number(tags.level) >= 3 ? 'LAYANG' : 'DASAR'),
    lintasDariNama: [
      ['Jakarta Kota–Bogor', '*', 'BGR'],
      ['Tanah Abang–Manggarai', '*', 'SUD'],
      ['Manggarai–Jatinegara', '*', 'MTR'],
      ['Depo Bukitduri', '*', 'BY'],
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
    /*
     * Lintas Maos baru memisahkan diri dari lintas Purwokerto di luar 700 m
     * (wesel pemisah Kasugihan). Pada 700 m keduanya masih satu koridor
     * sehingga arah Maos tidak muncul sebagai batas tersendiri; pada 1.100 m ke
     * atas ia muncul sebagai SATU batas — sedangkan Purwokerto dan Kutoarjo
     * masing-masing dua. Geometri survei dengan sendirinya membenarkan bahwa
     * lintas Maos berjalur tunggal.
     */
    radius: 1200,
    level: () => 'DASAR',
    lintasDariNama: [
      ['Maos–Kroya', 'KIRI', 'MA'],
      ['Prupuk–Kroya', 'KIRI', 'PWT'],
      ['Kroya–Kutoarjo', 'KANAN', 'KTA'],
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
    level: () => 'DASAR',
    lintasDariNama: [
      ['Kutoarjo–Solo Balapan', 'KIRI', 'YK'],
      ['Solo Balapan–Kertosono', 'KANAN', 'SGU'],
      ['Gundih–Solo Balapan', 'KANAN', 'SMT'],
      ['Segitiga Pembalik', '*', 'SGT'],
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
    level: (tags) => (Number(tags.layer) >= 2 ? 'LAYANG' : 'DASAR'),
    lintasDariNama: [
      ['Manggarai–Jatinegara', 'KIRI', 'MRI'],
      ['Jakarta Kota–Cikampek', 'KIRI', 'PSE'],
      ['Jakarta Kota–Cikampek', 'KANAN', 'BKS'],
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
    level: () => 'DASAR',
    lintasDariNama: [
      ['Kutoarjo–Solo Balapan', 'KIRI', 'YK'],
      ['Kutoarjo–Solo Balapan', 'KANAN', 'MGW'],
      ['Balai Yasa', '*', 'BY'],
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
    level: () => 'DASAR',
    lintasDariNama: [
      ['Padalarang–Kasugihan', 'KIRI', 'PDL'],
      ['Bandung–Ciroyom–Andir', 'KIRI', 'PDL'],
      ['Padalarang–Kasugihan', 'KANAN', 'KAC'],
    ],
    keterangan:
      'Seluruh KA antarkota berhenti, tanpa satu pun berjalan langsung. Langsiran menjadi kegiatan utama, bukan sampingan.',
    ciri: ['Nol KA langsung', 'Langsir sebagai kegiatan utama', 'Meja putar dan depo'],
  },
};

/** Stasiun yang emplasemennya memang dibangun dari geometri OSM. */
export const DIBANGUN = ['KYA', 'SLO', 'JNG', 'LPN', 'BD'];
