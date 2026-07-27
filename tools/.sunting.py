import io

p = 'tools/bangun-emplasemen-osm.mjs'
s = io.open(p, encoding='utf-8').read()

def sub(a, b):
    global s
    if a not in s:
        raise SystemExit('TIDAK KETEMU:\n' + a[:200])
    s = s.replace(a, b, 1)

# tetapkanLajur juga mengembalikan pemetaan y -> lajur untuk penempatan peron.
sub("""  const lajurSimpul = new Map();
  if (simpulMilik.length === 0) return lajurSimpul;""",
"""  const lajurSimpul = new Map();
  if (simpulMilik.length === 0) return { lajurSimpul, keLajur: () => 0 };""")

sub("""  return lajurSimpul;
}""",
"""  return { lajurSimpul, keLajur: terdekat };
}""")

sub("""  const lajurSimpul = new Map();
  for (const lv of tingkat) {
    for (const [id, l] of tetapkanLajur(graf.ruas, graf.simpul, lv)) {
      lajurSimpul.set(id, l);
    }
  }""",
"""  const lajurSimpul = new Map();
  const keLajurLevel = {};
  for (const lv of tingkat) {
    const hasil = tetapkanLajur(graf.ruas, graf.simpul, lv);
    keLajurLevel[lv] = hasil.keLajur;
    for (const [id, l] of hasil.lajurSimpul) lajurSimpul.set(id, l);
  }""")

sub("""  const keGambarSimpul = (n) => ({
    x: Math.round((n.x - minX) * skalaX + TEPI_X),
    y: Math.round((lajurSimpul.get(n.id) ?? 0) * RENGGANG + kanvasY[n.level].geser),
  });""",
"""  const keX = (x) => Math.round((x - minX) * skalaX + TEPI_X);
  const keGambarSimpul = (n) => ({
    x: keX(n.x),
    y: Math.round((lajurSimpul.get(n.id) ?? 0) * RENGGANG + kanvasY[n.level].geser),
  });
  /** Kedudukan tegak sebuah kedudukan melintang nyata, untuk peron. */
  const keYLajur = (y, level) =>
    Math.round(keLajurLevel[level](y) * RENGGANG + kanvasY[level].geser);""")

sub("""  const simpul = graf.simpul.map((s) => {
    const lv = levelSimpul.get(s.id) ?? 'DASAR';
    const g = keGambar({ x: s.x, y: s.y }, lv);
    return { id: `S${s.id}`, jenis: s.jenis, level: lv, x: g.x, y: g.y, osm: keOsm(s) };
  });""",
"""  const simpul = graf.simpul.map((s) => {
    const lv = levelSimpul.get(s.id) ?? 'DASAR';
    const g = keGambarSimpul(s);
    return { id: `S${s.id}`, jenis: s.jenis, level: lv, x: g.x, y: g.y, osm: keOsm(s) };
  });""")

sub("""  const ruas = graf.ruas.map((r) => {
    const lv = r.level;
    const titik = r.titik.map((t) => keGambar(t, lv));""",
"""  const ruas = graf.ruas.map((r) => {
    const lv = r.level;""")

sub("""      _titik: titik,""", """      _titik: null,""")

# Peron: bidangnya mengikuti lajur sepur yang dilayaninya, bukan lengkung nyata.
sub("""    const lv = sepur.find((s) => sepurIds.includes(s.id))?.level ?? 'DASAR';
    const g = p.titik.map((t) => keGambar(t, lv));
    const x1 = Math.min(...g.map((t) => t.x));
    const x2 = Math.max(...g.map((t) => t.x));
    const y1 = Math.min(...g.map((t) => t.y));
    const y2 = Math.max(...g.map((t) => t.y));""",
"""    const lv = sepur.find((s) => sepurIds.includes(s.id))?.level ?? 'DASAR';
    const x1 = Math.min(...p.titik.map((t) => keX(t.x)));
    const x2 = Math.max(...p.titik.map((t) => keX(t.x)));
    /*
     * Bidang peron dibentangkan pada lajur sepur yang dilayaninya. Memakai
     * kedudukan nyata peron akan meleset dari sepurnya di papan, sebab papan
     * membulatkan kedudukan melintang ke lajur.
     */
    const yLajur = sepurIds
      .map((id) => simpulPeta.get(`S${(graf.ruas.find((r) => `R${r.id.replace(/[^0-9A-Za-z-]/g, '')}` === (sepur.find((x) => x.id === id) || {}).ruasId) || {}).dari}`))
      .filter(Boolean)
      .map((n) => n.y);
    const yPeron = yLajur.length
      ? yLajur
      : p.titik.map((t) => keYLajur(t.y, lv));
    const y1 = Math.min(...yPeron);
    const y2 = Math.max(...yPeron);""")

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
