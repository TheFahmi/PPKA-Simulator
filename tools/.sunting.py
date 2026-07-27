import io

p = 'tools/uji-mesin.cjs'
s = io.open(p, encoding='utf-8').read()

a = """  await usePapan.getState().pilihStasiun('MRI');
  p = usePapan.getState();
  periksa('dapat kembali ke stasiun semula', p.emplasemen.kodeStasiun === 'MRI');
}"""

b = """  await usePapan.getState().pilihStasiun('MRI');
  p = usePapan.getState();
  periksa('dapat kembali ke stasiun semula', p.emplasemen.kodeStasiun === 'MRI');

  /*
   * Bagian yang paling menentukan bagi stasiun baru: emplasemen yang lolos
   * pemeriksaan bentuk belum tentu dapat DIDINASI. Tiap stasiun karena itu
   * dijalankan satu dinas penuh dengan pelayanan otomatis, dan seluruh
   * perjalanannya harus benar-benar diberangkatkan.
   */
  console.log('\\n== 13. Satu dinas penuh pada tiap stasiun ==');
  for (const r of DAFTAR_STASIUN) {
    const data = await muatStasiun(r.kode);
    const ixS = indeksEmplasemen(data.emplasemen);
    // Dinas terpadat yang bukan satu hari penuh, supaya ujinya berat tetapi
    // tetap selesai dalam waktu yang wajar.
    const kandidat = data.jadwal.dinas.filter((d) => !/SEHARI/.test(d.id));
    const dinas = kandidat.reduce(
      (a2, d) =>
        perjalananDinasUmum(data.jadwal, d.mulai, d.selesai).length >
        perjalananDinasUmum(data.jadwal, a2.mulai, a2.selesai).length
          ? d
          : a2,
      kandidat[0],
    );
    const daftar = perjalananDinasUmum(data.jadwal, dinas.mulai, dinas.selesai);
    const K = buatKeadaanAwal(ixS, dinas, daftar);
    K.modeOtomatis = 'PENUH';

    let detik = 0;
    while (!K.dinasSelesai && detik < 20 * 3600) {
      jalankanOtomatis(K, ixS);
      majuSatuDetik(K, ixS);
      detik += 1;
    }
    const skor = hitungSkor(K);
    periksa(`${r.kode}: dinas ${dinas.nama} dapat diselesaikan`, K.dinasSelesai, `berhenti di detik ${detik}`);
    periksa(
      `${r.kode}: seluruh perjalanan diberangkatkan`,
      skor.keretaDilayani.length === skor.keretaTotal,
      `${skor.keretaTotal - skor.keretaDilayani.length} dari ${skor.keretaTotal} tidak berangkat`,
    );
    periksa(
      `${r.kode}: tidak ada pelanggaran keselamatan`,
      skor.pelanggaran.length === 0,
      skor.pelanggaran.slice(0, 2).map((v) => v.keterangan || v.jenis).join(' | '),
    );
    console.log(
      `   ${r.kode.padEnd(4)} ${dinas.nama.padEnd(16)} ${String(daftar.length).padStart(3)} perjalanan · ` +
        `ketepatan ${(skor.ketepatanWaktu * 100).toFixed(1)} % · nilai ${skor.nilaiAkhir} (${skor.peringkat})`,
    );
  }
}"""

if a not in s:
    raise SystemExit('TIDAK KETEMU')
s = s.replace(a, b, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
