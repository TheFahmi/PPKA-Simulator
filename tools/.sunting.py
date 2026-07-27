import io

def edit(p, pasangan):
    s = io.open(p, encoding='utf-8').read()
    for a, b in pasangan:
        if a not in s:
            raise SystemExit('TIDAK KETEMU di %s:\n%s' % (p, a[:160]))
        s = s.replace(a, b, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('ok', p)


edit('src/app/data/page.tsx', [
("""import { EMPLASEMEN, periksaJadwalAman, type TemuanPeriksa } from '@/lib/muat-data';""",
 """import { periksaJadwalAman, type TemuanPeriksa } from '@/lib/muat-data';"""),

("""export default function BerkasJadwal() {
  const jadwal = usePapan((s) => s.jadwal);
  const jadwalDiimpor = usePapan((s) => s.jadwalDiimpor);
  const gantiJadwal = usePapan((s) => s.gantiJadwal);
  const kembalikan = usePapan((s) => s.kembalikanJadwalBawaan);
  const segarkan = usePapan((s) => s.segarkanJadwalTersimpan);
""",
 """export default function BerkasJadwal() {
  const stasiun = usePapan((s) => s.stasiun);
  const emplasemen = usePapan((s) => s.emplasemen);
  const memuat = usePapan((s) => s.memuatStasiun);
  const pilihStasiun = usePapan((s) => s.pilihStasiun);
  const jadwal = usePapan((s) => s.jadwal);
  const jadwalDiimpor = usePapan((s) => s.jadwalDiimpor);
  const gantiJadwal = usePapan((s) => s.gantiJadwal);
  const kembalikan = usePapan((s) => s.kembalikanJadwalBawaan);
  const segarkan = usePapan((s) => s.segarkanJadwalTersimpan);
"""),

("""  useEffect(() => {
    segarkan();
  }, [segarkan]);

  const temuan = useMemo<TemuanPeriksa[]>(() => periksaJadwalAman(jadwal), [jadwal]);
  const galat = temuan.filter((t) => t.tingkat === 'GALAT');
  const peringatan = temuan.filter((t) => t.tingkat === 'PERINGATAN');

  const perjalanan = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return jadwal.perjalanan.filter((t) => {
      if (saringLin !== 'SEMUA' && t.lin !== saringLin) return false;
      if (!q) return true;
      const cocok = (n: unknown) => typeof n === 'string' && n.toLowerCase().includes(q);
      return cocok(t.nomorKA) || cocok(t.relasi) || cocok(t.asal) || cocok(t.tujuan);
    });
  }, [jadwal.perjalanan, saringLin, cari]);

  const perLin = useMemo(
    () =>
      jadwal.perjalanan.reduce(
        (a, t) => {
          a[t.lin] = (a[t.lin] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
    [jadwal.perjalanan],
  );
""",
 """  // Halaman ini bisa dibuka langsung tanpa melewati briefing; data stasiun
  // yang sedang dipilih dimuat di sini juga supaya tidak tampil kosong.
  useEffect(() => {
    void pilihStasiun(stasiun);
  }, [pilihStasiun, stasiun]);

  useEffect(() => {
    segarkan();
  }, [segarkan]);

  const temuan = useMemo<TemuanPeriksa[]>(
    () => (jadwal && emplasemen ? periksaJadwalAman(jadwal, emplasemen) : []),
    [jadwal, emplasemen],
  );
  const galat = temuan.filter((t) => t.tingkat === 'GALAT');
  const peringatan = temuan.filter((t) => t.tingkat === 'PERINGATAN');

  const perjalanan = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (jadwal?.perjalanan ?? []).filter((t) => {
      if (saringLin !== 'SEMUA' && t.lin !== saringLin) return false;
      if (!q) return true;
      const cocok = (n: unknown) => typeof n === 'string' && n.toLowerCase().includes(q);
      return cocok(t.nomorKA) || cocok(t.relasi) || cocok(t.asal) || cocok(t.tujuan);
    });
  }, [jadwal, saringLin, cari]);

  const perLin = useMemo(
    () =>
      (jadwal?.perjalanan ?? []).reduce(
        (a, t) => {
          a[t.lin] = (a[t.lin] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      ),
    [jadwal],
  );
"""),

("""  const prosesTeks = (nama: string, teks: string) => {
    let hasil: HasilImpor;""",
 """  const prosesTeks = (nama: string, teks: string) => {
    if (!jadwal || !emplasemen) return;
    let hasil: HasilImpor;"""),

("""    const galatBaru = periksaJadwalAman(hasil.jadwal).filter((t) => t.tingkat === 'GALAT');""",
 """    const galatBaru = periksaJadwalAman(hasil.jadwal, emplasemen).filter(
      (t) => t.tingkat === 'GALAT',
    );"""),

("""  const unduhCsv = () => {
    const blob = new Blob([keCsv(jadwal)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal-manggarai-${jadwal.tanggalDibuat}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };""",
 """  const unduhCsv = () => {
    if (!jadwal) return;
    const blob = new Blob([keCsv(jadwal)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jadwal-${stasiun.toLowerCase()}-${jadwal.tanggalDibuat}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!jadwal || !emplasemen) {
    return (
      <div className="flex min-h-screen flex-col">
        <KepalaPapan />
        <main className="flex flex-1 items-center justify-center p-6">
          <Warta tingkat={memuat ? 'biasa' : 'perhatian'}>
            {memuat
              ? `Memuat berkas emplasemen dan jadwal Stasiun ${stasiun}\u2026`
              : 'Berkas stasiun belum termuat. Kembali ke halaman briefing untuk memilih wilayah pengaturan.'}
          </Warta>
        </main>
      </div>
    );
  }"""),
])
