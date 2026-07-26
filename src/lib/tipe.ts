/**
 * Definisi tipe inti PPKA Simulator: Manggarai.
 *
 * Penamaan mengikuti istilah dinas perkeretaapian Indonesia (emplasemen, sepur,
 * wesel, blok, semboyan, warta) supaya struktur data terbaca sama oleh
 * petugas dan oleh pengembang.
 */

/* ------------------------------------------------------------------ */
/* Waktu                                                               */
/* ------------------------------------------------------------------ */

/** Detik sejak pukul 00.00.00 pada hari dinas berjalan. */
export type DetikHari = number;

/** Faktor percepatan jam dinas. */
export type KecepatanJam = 1 | 2 | 4;

/**
 * Tingkat bantuan pelayanan rute.
 *
 * MATI   — seluruh rute dilayani petugas.
 * SARAN  — papan menghitung usul penetapan jalur, pelayanan tetap di tangan petugas.
 * PENUH  — rute dibentuk sendiri oleh papan, petugas mengawasi dan boleh menyela.
 */
export type ModeOtomatis = 'MATI' | 'SARAN' | 'PENUH';

/* ------------------------------------------------------------------ */
/* Emplasemen — topologi                                               */
/* ------------------------------------------------------------------ */

/** Lantai emplasemen Stasiun Manggarai. */
export type Level = 'DASAR' | 'LAYANG';

export type JenisSimpul =
  /** Batas emplasemen menuju petak jalan (arah masuk/keluar). */
  | 'BATAS'
  /** Titik wesel. */
  | 'WESEL'
  /** Sambungan biasa antar-ruas. */
  | 'SAMBUNG'
  /** Ujung sepur badug / penghalang. */
  | 'UJUNG';

export interface Simpul {
  id: string;
  jenis: JenisSimpul;
  level: Level;
  /** Koordinat papan (satuan internal diagram, bukan piksel layar). */
  x: number;
  y: number;
}

export type JenisRuas =
  /** Ruas bersandar peron — tempat kereta berhenti melayani penumpang. */
  | 'SEPUR_PERON'
  /** Ruas emplasemen tanpa peron (sepur simpan / sepur raya lintas). */
  | 'SEPUR_EMPLASEMEN'
  /** Ruas penghubung antar-wesel. */
  | 'PENGHUBUNG'
  /** Ruas petak jalan di luar batas emplasemen (potongan pendek untuk diagram). */
  | 'PETAK_JALAN';

export interface Ruas {
  id: string;
  jenis: JenisRuas;
  dari: string;
  ke: string;
  /** Blok deteksi sarana yang menaungi ruas ini. */
  blokId: string;
  /** Panjang sesungguhnya (meter) — dipakai untuk perhitungan waktu jalan. */
  panjangM: number;
  /** Diisi bila ruas ini merupakan badan sepur bernomor. */
  sepurId?: string;
  /**
   * Titik belok tambahan pada gambar (di luar simpul pangkal & ujung).
   * Kosong berarti ruas digambar sebagai garis lurus.
   */
  titikBelok?: Array<{ x: number; y: number }>;
}

export type KedudukanWesel = 'LURUS' | 'BELOK';

export interface Wesel {
  id: string;
  /** Nomor wesel sebagaimana tertera di emplasemen. */
  nomor: string;
  level: Level;
  /** Simpul tempat wesel berada. */
  simpulId: string;
  /** Ruas pangkal (kaki tunggal). */
  ruasPangkal: string;
  /** Ruas pada kedudukan sepur lurus. */
  ruasLurus: string;
  /** Ruas pada kedudukan sepur belok. */
  ruasBelok: string;
  /** Kedudukan normal (kedudukan istirahat). */
  kedudukanNormal: KedudukanWesel;
  /** Lama balik wesel dalam detik dinas. */
  waktuBalikDetik: number;
}

export type JenisSinyal =
  | 'MASUK'
  | 'KELUAR'
  | 'BLOK'
  | 'MUKA'
  | 'LANGSIR';

/** Aspek sinyal utama sesuai semboyan sinyal PT KAI. */
export type AspekSinyal =
  /** Semboyan 7 — berhenti. */
  | 'MERAH'
  /** Semboyan 6 — berjalan hati-hati, berhenti di sinyal berikutnya. */
  | 'KUNING'
  /** Semboyan 5 — berjalan. */
  | 'HIJAU'
  /** Semboyan 45 — langsir boleh berjalan. */
  | 'PUTIH'
  /** Sinyal padam / tidak berdinas. */
  | 'PADAM';

export interface Sinyal {
  id: string;
  /** Penamaan sinyal di lapangan, mis. "J12" atau "MRI-A". */
  nama: string;
  jenis: JenisSinyal;
  level: Level;
  /** Simpul tempat sinyal berdiri (menghadap arah jalan kereta). */
  simpulId: string;
  /** Ruas yang dilindungi sinyal ini (ruas pertama setelah sinyal). */
  ruasDilindungi: string;
  /** Arah hadap pada gambar: 1 = ke kanan papan, -1 = ke kiri papan. */
  hadap: 1 | -1;
  /** Offset gambar terhadap sepur (negatif = di atas garis). */
  offsetY: number;
  /** Pergeseran mendatar gambar terhadap simpul. */
  offsetX: number;
}

export interface Blok {
  id: string;
  nama: string;
  level: Level;
  /** Blok di dalam emplasemen atau di petak jalan. */
  wilayah: 'EMPLASEMEN' | 'PETAK_JALAN';
}

export type JenisSepur =
  /** Sepur lurus utama untuk KA langsung. */
  | 'RAYA'
  /** Sepur belok untuk persilangan/penyusulan. */
  | 'BELOK'
  /** Sepur simpan / stabling. */
  | 'SIMPAN'
  /** Sepur badug (buntu). */
  | 'BADUG';

export interface Sepur {
  id: string;
  /**
   * Nomor jalur sebagaimana diumumkan ke penumpang. Sepur lintas yang tidak
   * melayani naik-turun penumpang memakai kode pendek, bukan nomor peron.
   */
  nomor: string;
  /** Sebutan lengkap sepur pada teks dinas, mis. "Jalur 9" atau "Sepur lintas hulu". */
  label: string;
  level: Level;
  jenis: JenisSepur;
  peronId: string | null;
  /** Panjang peron efektif (meter). */
  panjangPeronM: number;
  /** Layanan yang lazim memakai sepur ini. */
  linDilayani: KodeLin[];
  /** Ruas badan sepur. */
  ruasId: string;
  /** Keterangan dinas singkat. */
  keterangan: string;
}

export interface Peron {
  id: string;
  nomor: string;
  nama: string;
  level: Level;
  jenis: 'PULAU' | 'SISI';
  sepurIds: string[];
  geometri: { x: number; y: number; lebar: number; tinggi: number };
}

export interface BatasEmplasemen {
  id: string;
  /** Nama arah sebagaimana disebut dalam warta, mis. "arah Tebet". */
  nama: string;
  singkatan: string;
  level: Level;
  simpulId: string;
  /** Sisi papan tempat batas ini digambar. */
  sisi: 'KIRI' | 'KANAN';
  /** Stasiun tetangga pada petak jalan tersebut. */
  stasiunTetangga: string;
  /** Lin yang lazim melalui batas ini. */
  linDilayani: KodeLin[];
  /** Headway minimum yang wajib dijaga pada petak jalan ini (detik). */
  headwayMinimumDetik: number;
}

export interface Emplasemen {
  kodeStasiun: string;
  namaStasiun: string;
  /** Keterangan sumber & tanggal acuan tata letak. */
  acuan: {
    keterangan: string;
    tanggalAcuan: string;
    sumber: string[];
    catatanVerifikasi: string;
  };
  /** Ukuran kanvas diagram dalam satuan internal. */
  kanvas: Record<Level, { lebar: number; tinggi: number }>;
  simpul: Simpul[];
  ruas: Ruas[];
  wesel: Wesel[];
  sinyal: Sinyal[];
  blok: Blok[];
  sepur: Sepur[];
  peron: Peron[];
  batas: BatasEmplasemen[];
}

/* ------------------------------------------------------------------ */
/* Layanan & jadwal                                                    */
/* ------------------------------------------------------------------ */

export type KodeLin =
  | 'LIN_BOGOR'
  | 'LIN_CIKARANG'
  | 'LIN_LINGKAR'
  | 'KAJJ'
  | 'BANDARA'
  | 'KLB'
  | 'LANGSIR';

/** Golongan sarana — menentukan panjang rangkaian & perilaku jalan. */
export type JenisSarana = 'KRL_8' | 'KRL_10' | 'KRL_12' | 'KA_ANTARKOTA' | 'LOKOMOTIF';

export interface TrainService {
  /** Kode layanan, mis. "LIN_BOGOR". */
  kode: KodeLin;
  nama: string;
  /** Warna identitas lin pada papan (token Tailwind). */
  tokenWarna: string;
  operator: string;
  keterangan: string;
}

export interface Trip {
  /** Identitas unik perjalanan pada hari dinas. */
  id: string;
  /** Nomor KA sesuai GAPEKA / pola perjalanan. */
  nomorKA: string;
  lin: KodeLin;
  jenisSarana: JenisSarana;
  /** Relasi lengkap perjalanan, mis. "Bogor - Jakarta Kota". */
  relasi: string;
  asal: string;
  tujuan: string;
  /** Batas emplasemen tempat kereta masuk. */
  batasMasukId: string;
  /** Batas emplasemen tempat kereta keluar (null bila berakhir di Manggarai). */
  batasKeluarId: string | null;
  /** Waktu datang terjadwal di Manggarai (HH.MM.SS). */
  jamDatang: string;
  /** Waktu berangkat terjadwal dari Manggarai (HH.MM.SS). */
  jamBerangkat: string;
  /** Sepur yang lazim dipakai menurut pola operasi (usulan, bukan paksaan). */
  sepurLazim: string[];
  /** Lama berhenti minimum untuk naik-turun penumpang (detik). */
  waktuBerhentiMinimumDetik: number;
  /** true bila KA langsung (tidak berhenti) di Manggarai. */
  langsung: boolean;
  /** Tingkat keandalan data: dari GAPEKA resmi atau rekonstruksi pola. */
  keandalanData: KeandalanData;
  catatan?: string;
}

/**
 * Penanda asal-usul tiap baris jadwal.
 * Wajib diisi jujur — papan menampilkannya agar pemain tahu mana data resmi
 * dan mana pola rekonstruksi.
 */
export type KeandalanData =
  /** Diverifikasi dari GAPEKA / kanal resmi KAI-KCI. */
  | 'RESMI'
  /** Pola perjalanan nyata (relasi, arah, headway) dengan menit direkonstruksi. */
  | 'REKONSTRUKSI_POLA'
  /** Data contoh untuk pengujian mekanik permainan. */
  | 'CONTOH';

export interface Dinas {
  id: string;
  nama: string;
  keterangan: string;
  /** Jam mulai dinas (HH.MM). */
  mulai: string;
  /** Jam selesai dinas (HH.MM). */
  selesai: string;
  tingkatKesulitan: 'DASAR' | 'MENENGAH' | 'PADAT';
  /** Peluang kejadian luar biasa per jam dinas. */
  peluangGangguanPerJam: number;
}

export interface Schedule {
  versi: string;
  /** Edisi GAPEKA yang dijadikan acuan. */
  gapeka: string;
  stasiun: string;
  tanggalDibuat: string;
  sumber: string[];
  catatanKeakuratan: string;
  layanan: TrainService[];
  dinas: Dinas[];
  perjalanan: Trip[];
}

/* ------------------------------------------------------------------ */
/* Keadaan simulasi                                                    */
/* ------------------------------------------------------------------ */

export type KeadaanBlok =
  | 'BEBAS'
  | 'DIDUDUKI'
  | 'RESERVASI'
  | 'DIBLOKIR'
  | 'GANGGUAN';

export interface StatusBlok {
  blokId: string;
  keadaan: KeadaanBlok;
  keretaId: string | null;
  ruteId: string | null;
}

export interface StatusWesel {
  weselId: string;
  kedudukan: KedudukanWesel;
  /** Sedang membalik — belum boleh dilalui. */
  membalik: boolean;
  /** Detik dinas saat balik wesel selesai. */
  selesaiMembalikPada: DetikHari | null;
  /** Rute yang mengunci wesel ini. */
  terkunciOlehRute: string | null;
  /** Wesel mengalami gangguan dan tidak dapat dibalik dari panel. */
  gangguan: boolean;
}

export interface StatusSinyal {
  sinyalId: string;
  aspek: AspekSinyal;
  /** Sinyal padam karena gangguan; perlu perintah tertulis (MS/bentuk 84). */
  gangguan: boolean;
}

export type JenisRute =
  | 'MASUK'
  | 'KELUAR'
  /** Rute utuh dari batas masuk sampai batas keluar bagi KA berjalan langsung. */
  | 'LANGSUNG'
  | 'LANGSIR';

export type KeadaanRute =
  /** Wesel sedang dibalik. */
  | 'MEMBENTUK'
  /** Rute terbentuk, terkunci, sinyal sudah dapat diaman-kan. */
  | 'TERKUNCI'
  /** Kereta sedang menduduki rute. */
  | 'DIDUDUKI'
  /** Rute sudah dibebaskan. */
  | 'BEBAS';

export interface Rute {
  id: string;
  jenis: JenisRute;
  keretaId: string;
  /** Urutan ruas dari sinyal pelindung sampai sasaran. */
  ruasIds: string[];
  /** Kedudukan wesel yang dituntut rute ini. */
  kedudukanWesel: Array<{ weselId: string; kedudukan: KedudukanWesel }>;
  /** Sinyal yang melindungi rute. */
  sinyalId: string;
  /** Simpul tempat rangkaian memasuki ruas pertama rute — penentu arah jalan. */
  simpulAwal: string;
  /**
   * Rute keluar yang menuntut rangkaian berbalik arah lebih dulu, seperti pada
   * perjalanan yang berakhir di Manggarai dan pada sepur berujung penghalang.
   */
  berbalikArah: boolean;
  /** Sepur sasaran (rute masuk) atau batas keluar (rute keluar). */
  sasaranId: string;
  keadaan: KeadaanRute;
  dibentukPada: DetikHari;
  terkunciPada: DetikHari | null;
}

export type FaseKereta =
  /** Belum memasuki wilayah pewartaan. */
  | 'BELUM_DINAS'
  /** Sudah diwartakan dari stasiun tetangga, berjalan di petak jalan. */
  | 'DIWARTAKAN'
  /** Berhenti di muka sinyal masuk karena rute belum terbentuk. */
  | 'TERTAHAN_SINYAL'
  /** Berjalan masuk emplasemen di atas rute yang terbentuk. */
  | 'MASUK'
  /** Berhenti di sepur melayani naik-turun penumpang. */
  | 'BERHENTI'
  /** Waktu berhenti selesai, menunggu rute keluar & semboyan berangkat. */
  | 'SIAP_BERANGKAT'
  /** Berjalan keluar emplasemen. */
  | 'BERANGKAT'
  /** Sudah melewati batas emplasemen. */
  | 'SELESAI'
  /** Dibatalkan / diputus perjalanannya. */
  | 'BATAL';

export interface KeretaAktif {
  id: string;
  tripId: string;
  nomorKA: string;
  lin: KodeLin;
  jenisSarana: JenisSarana;
  relasi: string;
  asal: string;
  tujuan: string;
  batasMasukId: string;
  batasKeluarId: string | null;
  fase: FaseKereta;
  /** Sepur tempat kereta berhenti (null bila belum masuk). */
  sepurId: string | null;
  /** Simpul tempat rangkaian memasuki badan sepur — penentu arah keluar. */
  simpulMasukSepur: string | null;
  /** Ruas yang sedang diduduki kepala rangkaian. */
  ruasId: string | null;
  /** Kemajuan pada ruas berjalan, 0..1. */
  kemajuan: number;
  /** Indeks ruas berjalan pada rute yang sedang diduduki. */
  indeksRuas: number;
  /** Urutan ruas rute yang sedang dijalani. */
  jalurRuas: string[];
  /** Simpul tempat rangkaian memasuki tiap ruas pada `jalurRuas`. */
  simpulMasukRuas: string[];
  ruteAktifId: string | null;
  /** Detik dinas saat rangkaian mencapai sinyal masuk. */
  tibaDiSinyalPada: DetikHari;
  /** Faktor kecepatan (1 = normal; 0,6 saat berjalan dengan Semboyan 6). */
  faktorKecepatan: number;
  /** Sepur yang ditetapkan termasuk peruntukan lazim lin ini. */
  sepurLazimTerpakai: boolean | null;
  /** Jadwal (detik hari). */
  jadwalDatang: DetikHari;
  jadwalBerangkat: DetikHari;
  /** Realisasi. */
  aktualDatang: DetikHari | null;
  aktualBerangkat: DetikHari | null;
  /** Detik dinas saat kereta mulai diwartakan (muncul di papan). */
  diwartakanPada: DetikHari;
  /** Akumulasi keterlambatan berjalan (detik, negatif = lebih awal). */
  deviasiDetik: number;
  /** Sisa waktu berhenti minimum (detik). */
  sisaBerhentiDetik: number;
  /** Waktu berhenti minimum untuk perjalanan ini (detik). */
  waktuBerhentiMinimumDetik: number;
  langsung: boolean;
  /** Penyebab tertahan terakhir untuk keperluan laporan. */
  sebabTertahan: string | null;
  /** Total detik tertahan di muka sinyal. */
  totalTertahanDetik: number;
  keandalanData: KeandalanData;
  /** Sedikitnya satu rute perjalanan ini dibentuk oleh pelayanan otomatis. */
  dilayaniOtomatis: boolean;
  /** Catatan asal-usul data perjalanan, disalin dari berkas jadwal. */
  catatan: string | null;
  sepurLazim: string[];
}

export type TingkatKejadian = 'INFO' | 'PERHATIAN' | 'BAHAYA' | 'NORMAL';

export interface Kejadian {
  id: string;
  waktu: DetikHari;
  tingkat: TingkatKejadian;
  /** Kode ringkas untuk kolom papan, mis. "WK-MSK". */
  kode: string;
  teks: string;
  keretaId?: string;
}

export type JenisGangguan =
  | 'WESEL_MACET'
  | 'SINYAL_PADAM'
  | 'KEPADATAN_PENUMPANG'
  | 'KLB'
  | 'PEMERIKSAAN_SARANA';

export interface Gangguan {
  id: string;
  jenis: JenisGangguan;
  mulai: DetikHari;
  selesai: DetikHari | null;
  sasaranId: string;
  keterangan: string;
  teratasi: boolean;
}

export interface Pelanggaran {
  id: string;
  waktu: DetikHari;
  jenis:
    | 'KONFLIK_SEPUR'
    | 'HEADWAY_KURANG'
    | 'RUTE_BERSILANG'
    | 'SEPUR_TIDAK_LAYAK'
    | 'KERETA_TERTAHAN'
    | 'PERON_SALAH';
  keterangan: string;
  keretaId?: string;
  /** Bobot pengurang nilai. */
  bobot: number;
}

export interface Skor {
  /** Ketepatan waktu: rasio KA berangkat dalam ambang toleransi. */
  ketepatanWaktu: number;
  /** Jumlah KA yang dilayani sampai selesai. */
  keretaSelesai: number;
  keretaTotal: number;
  /** Rerata deviasi keberangkatan (detik). */
  rerataDeviasiDetik: number;
  deviasiTerburukDetik: number;
  konflikDicegah: number;
  pelanggaran: number;
  /** Efisiensi peron: rasio pemakaian sepur terhadap kapasitas tersedia. */
  efisiensiPeron: number;
  /** Nilai akhir 0..1000. */
  nilaiAkhir: number;
  peringkat: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface PemakaianSepur {
  sepurId: string;
  jumlahKereta: number;
  totalDetikDiduduki: number;
}
