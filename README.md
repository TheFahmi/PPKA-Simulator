# PPKA Simulator: Manggarai

Simulasi dinas **Pengatur Perjalanan Kereta Api (PPKA)** pada wilayah pengaturan
Stasiun Manggarai (MRI). Pemain melayani rute masuk dan rute keluar, menetapkan
jalur bagi tiap perjalanan, menjaga headway petak jalan, dan menangani gangguan
peralatan sampai satu sesi dinas ditutup dengan laporan akhir dinas.

Antarmuka mengikuti tata papan pelayanan (VDU) persinyalan: diagram jalur
berbentuk garis, indikator okupansi blok, aspek sinyal sesuai semboyan, dan
bahasa dinas sebagaimana dipakai dalam dokumen perkeretaapian Indonesia.

```bash
npm install
npm run dev      # papan pelayanan di http://localhost:3000
```

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan papan pada mode pengembangan |
| `npm run build` | Membangun berkas produksi |
| `npm run uji` | Uji mesin, store, pelayanan otomatis, dan lapisan impor tanpa peramban (123 pemeriksaan) |
| `npm run data` | Membangun ulang `data/emplasemen-manggarai.json` dan `data/jadwal-manggarai.json` |
| `npm run typecheck` | Pemeriksaan tipe |

## Halaman

| Rute | Isi |
| --- | --- |
| `/` | Briefing dinas: pemilihan sesi, pengantar tata letak emplasemen, asal data |
| `/dispatch` | Papan pelayanan: diagram jalur dua lantai, papan dinas, panel rute, buku kejadian |
| `/dispatch/summary` | Laporan akhir dinas |
| `/data` | Pemeriksaan dan penggantian berkas jadwal (mode pengembang) |

## Pelayanan rute otomatis

Bilah jam memuat pilihan tingkat bantuan pelayanan:

| Mode | Perilaku |
| --- | --- |
| **Manual** | Seluruh rute dilayani petugas. Papan tidak membentuk rute apa pun. |
| **Saran** | Papan menghitung usul penetapan jalur beserta alasannya. Usul ditandai `USUL` pada tombol jalur dan didaftar pada panel pelayanan; pembentukan rute tetap di tangan petugas. |
| **Otomatis** | Papan melayani sendiri rute masuk dan rute keluar. Petugas tetap boleh menyela dengan membentuk rute lain. |

Kedua mode memakai penalaran yang sama (`src/lib/otomatis.ts`), sehingga usul
yang ditampilkan persis sama dengan yang akan dikerjakan papan. Kaidahnya
meniru kebiasaan dinas, bukan sekadar mengambil pilihan pertama yang tersedia:

1. Perjalanan yang sudah tertahan di muka sinyal dilayani lebih dahulu.
2. Jalur diambil dari peruntukan lazim relasinya; di antara jalur lazim yang
   bebas dipilih yang paling jarang terpakai, sehingga kedua jalur satu pasang
   terpakai berselang-seling seperti pengaturan sesungguhnya.
3. Jalur di luar peruntukan **tidak** diambil selama rangkaian belum tertahan —
   menahan sebentar lebih baik daripada menurunkan penumpang di peron yang
   salah. Jalur tanpa peron aktif tidak pernah dipakai untuk KA berpenumpang.
4. Rute keluar hanya dibentuk menuju batas emplasemen sesuai jadwal perjalanan.
5. Rute keluar disiapkan menjelang waktu berangkat, bukan jauh sebelumnya, agar
   tidak mengunci wesel yang masih dibutuhkan perjalanan lain.

Laporan akhir dinas **menyatakan** berapa rute yang dibentuk papan dan berapa
perjalanan yang terbantu, supaya nilai sesi tidak terbaca seolah seluruhnya
hasil kerja petugas.

Pada dinas 05.00–09.00, pelayanan otomatis menyelesaikan seluruh 140 perjalanan
dengan ketepatan waktu 98,6 % dan pemakaian peron yang merata (jalur 9:16
lawan 10:16, 11:17 lawan 12:16). Papan yang ditinggalkan tanpa pelayanan sama
sekali memperoleh nilai 0. Angka-angka itu diperiksa ulang setiap kali
`npm run uji` dijalankan.

## Asal data

Bagian ini adalah inti kejujuran proyek. Tiap baris jadwal membawa penanda
keandalannya sendiri dan penanda itu ditampilkan di papan.

### Tata letak emplasemen

Peruntukan jalur mengikuti hasil **Switch Over ke-7 (SO-7)**, dieksekusi
17 Desember 2023 dan berlaku bagi penumpang sejak 20 Desember 2023. Emplasemen
terdiri atas 12 jalur bernomor ditambah satu jalur akses Balai Yasa, dengan
tujuh peron (enam peron pulau dan satu peron sisi).

| Lantai | Jalur | Peruntukan |
| --- | --- | --- |
| Layang (2) | 9, 10 | Commuter Line Bogor arah Jakarta Kota, lewat Cikini |
| Layang (2) | 11, 12 | Commuter Line Bogor arah Bogor/Nambo, lewat Tebet |
| Dasar | 1, 2 | Commuter Line Cikarang arah Sudirman, Angke, Kampung Bandan |
| Dasar | 3, 4 | Commuter Line Cikarang arah Matraman, Bekasi, Cikarang |
| Dasar | 5, 6 | Sepur simpan dan penyusulan; KA barang dan KLB kirim rangkaian, peron pulau berstatus inaktif |
| Dasar | sepur lintas hulu & hilir | KA jarak jauh relasi Gambir — berjalan langsung, tidak bernomor peron |
| Dasar | 7, 8 | Commuter Line Basoetta dari/tujuan Bandara Soekarno-Hatta, lewat BNI City |

Sumber: tabel tata letak peron Stasiun Manggarai pada Wikipedia bahasa Indonesia
(revisi 18 Juli 2026) yang menyitir Kompas.com 18 Desember 2023 "Daftar
Perubahan Jalur Transit di Stasiun Manggarai Mulai 20 Desember 2023", serta
siaran KAI Commuter mengenai switch over Stasiun Manggarai.

**Yang bukan hasil verifikasi.** Susunan wesel, penomoran wesel, penamaan
sinyal, panjang peron, dan panjang ruas dalam meter adalah asumsi pemodelan —
gambar teknis emplasemen Manggarai tidak dipublikasikan. Bentuk emplasemen di
sini dibuat konsisten secara operasional dengan peruntukan jalur resmi, bukan
salinan gambar sepur milik KAI. Catatan ini juga tercantum di dalam berkas data
dan ditampilkan pada halaman `/data`.

### Jadwal

155 perjalanan pada rentang 05.00–09.00 di Stasiun Manggarai.

| Layanan | Baris | Keandalan | Sumber |
| --- | --- | --- | --- |
| Commuter Line Bogor | 65 | `RESMI` | API jadwal resmi KAI Commuter, `kci.id/api/krl/schedules?stationid=MRI` |
| Commuter Line Cikarang | 62 | `RESMI` | Berkas resmi "Jadwal Commuter Line Jabodetabek — Update 22 Juni 2026" (PDF, kci.id), disusun atas GAPEKA 2025 |
| Commuter Line Basoetta | 14 | `REKONSTRUKSI_POLA` | Pola operasi terverifikasi; penomoran per keberangkatan tidak |
| KA jarak jauh (berjalan langsung) | 14 | `RESMI` | GAPEKA 2025 Jawa, Lampiran II "Daftar Waktu KA Antar Kota" (KP-DJKA 224 Tahun 2024), berkas PDF DJKA |

Catatan pemodelan yang harus dibaca sebagai bukan-data-resmi:

- Jadwal publik hanya memuat **satu** jam per stasiun. Jam itu dipakai sebagai
  jam berangkat; jam datang di Manggarai diturunkan dengan mengurangi dua menit.
- Perjalanan yang berdinas mulai atau berakhir di Manggarai dimodelkan masuk
  atau keluar sebagai langsiran; penyiapan dan penarikan rangkaian tidak
  tercantum pada jadwal publik.
- Golongan sarana (jumlah kereta per rangkaian) adalah asumsi pemodelan.
- Penetapan sepur per perjalanan **tidak** diambil dari data mana pun — pemilihan
  jalur adalah keputusan PPKA, dan itulah inti permainan ini. Kolom `sepurLazim`
  hanya menyatakan peruntukan resmi kelompok jalur.

**KA jarak jauh dimuat sebagai KA berjalan langsung, bukan sebagai
pemberhentian.** Tidak ada KA jarak jauh yang berhenti melayani penumpang di
Manggarai; pemindahan layanan dari Stasiun Gambir masih berstatus rencana tanpa
tanggal operasional. Yang dimuat adalah 14 KA relasi Stasiun Gambir yang
melintas Manggarai pada 05.00–09.00. GAPEKA mencantumkan Manggarai pada setiap
perjalanan KA jarak jauh dengan tanda `Ls` pada kolom Datang — berjalan langsung
— dan jam pada kolom Berangkat adalah jam melintasnya; jam itulah yang dipakai
apa adanya, jadi **tidak diperkirakan maupun dihitung sendiri**.

KA relasi **Pasar Senen tidak dimuat** karena rutenya memang tidak melewati
Manggarai (Jatinegara – Pondok Jati – Kramat – Gang Sentiong – Pasar Senen).

Satu peringatan: angka yang dipakai berasal dari GAPEKA 2025 versi dasar yang
berlaku 1 Februari 2025. Dokumen revisi per 18 Juni 2026 tidak berhasil
diperoleh, sehingga perjalanan yang berubah pada revisi itu berpotensi berbeda.
Peringatan ini juga tercantum pada catatan tiap baris KA jarak jauh dan terbaca
di papan.

Penempatan sepur lintas KA jarak jauh **adalah pemodelan, bukan fakta
terdokumentasi**: tabel tata letak resmi Stasiun Manggarai membatasi diri pada
layanan kereta komuter dan tidak menyatakan jalur mana yang dilalui KA jarak
jauh. Yang dimodelkan di sini adalah sepasang sepur lintas tanpa nomor peron —
konsisten dengan tidak adanya alokasi jalur bernomor bagi KA jarak jauh dan
dengan kenyataan bahwa KA tersebut tidak melayani naik-turun penumpang.

**KLB tidak dijadwalkan** karena menurut sifatnya Kereta Luar Biasa berada di
luar GAPEKA. KLB kirim rangkaian dari Balai Yasa Manggarai dibangkitkan sebagai
kejadian saat dinas berjalan.

## Memperbarui jadwal saat GAPEKA direvisi

Tidak perlu menyentuh kode.

1. Buka `/data`.
2. Unggah berkas CSV atau JSON, atau tempelkan isinya. Halaman `/data` juga
   menyediakan tombol **Unduh CSV** untuk memperoleh berkas berjalan sebagai
   titik awal, lengkap dengan daftar kode batas emplasemen dan kode sepur.
3. Berkas diperiksa lebih dulu terhadap emplasemen yang dimuat — bentuk kolom,
   bentuk jam, id ganda, batas emplasemen yang tidak dikenal, dan sepur yang
   tidak ada. Berkas yang mengandung galat tidak akan dipasang, dan berkas
   tersimpan diperiksa ulang setiap kali dimuat sehingga berkas rusak tidak
   dapat membuntukan papan. Bila halaman tetap gagal dirender, tersedia jalan
   keluar untuk membuang berkas impor.
4. Berkas yang dipasang tersimpan pada peramban dan menggantikan berkas bawaan
   sampai dikembalikan lewat tombol **Kembalikan berkas bawaan**.

Berkas hasil impor **tidak** mewarisi label edisi GAPEKA maupun daftar sumber
berkas bawaan: berkas dari luar tidak boleh tampil seolah bersandar pada
terbitan resmi yang belum tentu menjadi asalnya. Kolom `keandalanData` tiap
baris tetap menentukan lencana yang ditampilkan papan.

Kolom CSV wajib: `nomorKA`, `lin`, `asal`, `tujuan`, `batasMasukId`,
`jamDatang`, `jamBerangkat`. Kolom pilihan: `jenisSarana`, `batasKeluarId`,
`sepurLazim` (dipisah `|`), `waktuBerhentiMinimumDetik`, `langsung`,
`keandalanData`, `catatan`. Jam ditulis `HH.MM` atau `HH.MM.SS`.

Untuk memperbarui berkas bawaan yang ikut terbangun, sunting sumber datanya di
`tools/bangun-jadwal.mjs` lalu jalankan `npm run data`. Berkas itu memuat tabel
jadwal apa adanya beserta catatan sumbernya, sehingga isinya dapat diperiksa
ulang terhadap terbitan KAI Commuter.

## Susunan berkas

```
data/
  emplasemen-manggarai.json   topologi emplasemen: simpul, ruas, wesel, sinyal, blok, sepur, peron
  jadwal-manggarai.json       layanan, sesi dinas, dan 139 perjalanan
src/
  app/                        halaman App Router
  components/                 modul panel dan diagram SVG
  lib/
    tipe.ts                   definisi tipe inti
    emplasemen.ts             pengindeksan graf dan pencarian rute
    simulasi.ts               mesin simulasi: rute, wesel, sinyal, pergerakan, kejadian
    skor.ts                   penilaian dinas
    otomatis.ts               kaidah pelayanan rute otomatis (dipakai mode saran & otomatis)
    impor.ts                  pembacaan CSV/JSON dan penyimpanan berkas impor
    semboyan.ts               istilah dinas, kalimat warta, arti aspek sinyal
  store/papan.ts              store Zustand yang menghubungkan mesin dengan antarmuka
tools/
  bangun-emplasemen.mjs       pembangkit berkas emplasemen (memeriksa keutuhan graf)
  bangun-jadwal.mjs           pembangkit berkas jadwal (memuat tabel sumber)
  uji-mesin.cjs               uji mesin dan store tanpa peramban
```

## Cara kerja mesin

Emplasemen dimodelkan sebagai graf: **simpul** (batas, wesel, sambungan, ujung)
dan **ruas** (potongan sepur). Rute dicari dengan penelusuran lebar yang tunduk
pada kekangan fisik wesel — dari kaki pangkal hanya boleh menuju kaki lurus atau
kaki belok, dan sebaliknya. Karena ujung sebuah sepur hanya punya satu jalan
keluar, jalur 9–10 memang hanya terjangkau dari arah Tebet dan jalur 11–12 hanya
dari arah Cikini, persis seperti peruntukan resminya.

Pembentukan rute mengunci wesel yang dituntutnya dan mereservasi blok di dalam
emplasemen. Petak jalan sengaja **tidak** ikut terkunci karena diatur dengan
pelayanan blok antar-stasiun; bila ikut terkunci, PPKA tidak akan pernah dapat
menyiapkan rute perjalanan berikutnya. Sinyal baru menunjukkan aspek aman
setelah wesel selesai membalik, dan kembali ke aspek merah setelah rangkaian
melewatinya — Semboyan 5 pada rute yang seluruhnya lurus, Semboyan 6 bila rute
melalui sepur belok.

Jam dinas berjalan atas dasar `requestAnimationFrame` dengan faktor percepatan
1×, 2×, atau 4×. Jam berhenti bila jendela peramban tidak tampil, sehingga sesi
dinas tidak berjalan tanpa pengawasan.

Penilaian dinas bersandar pada ketepatan waktu (500 nilai), ketertiban penetapan
jalur (200), kelengkapan pelayanan (200), dan kelancaran — bagian perjalanan yang
tidak pernah tertahan di muka sinyal masuk (100) — dikurangi bobot pelanggaran.
Banyaknya penolakan pembentukan rute oleh peralatan persinyalan dilaporkan
sebagai keterangan, tetapi sengaja **tidak** menambah nilai: penolakan memang
mencegah konflik jalur, namun sekaligus menandakan rencana pelayanan yang perlu
dikoreksi.

## Batasan

Simulasi ini dibuat untuk latihan dan pengenalan. Ia **bukan** perangkat
pelayanan persinyalan, tidak mereproduksi peralatan interlocking Stasiun
Manggarai, dan tidak boleh dipakai untuk pengaturan perjalanan kereta api
sesungguhnya. Laporan akhir dinas yang dihasilkan bukan dokumen dinas PT Kereta
Api Indonesia.
