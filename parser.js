/* Lettore .xlsx senza librerie + estrazione dati Fantacatt */
const FC = (() => {
  const TEAMS = ['Buscaglia','Fall','Ghizzoni','Laamiri','Laffranchi','Necchi','Foffano','Ficara','Veneruso','Zaccaro'];
  const ALIAS = {Piccolo:'Foffano', Scaramuzza:'Ficara', Mago:'Ficara'};
  const canon = n => { if (typeof n !== 'string') return null; n = n.trim(); return ALIAS[n] || (TEAMS.includes(n) ? n : null); };

  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  async function unzip(buf) {
    const b = new Uint8Array(buf), dv = new DataView(buf);
    let e = b.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Il file non è un .xlsx valido');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const files = {}, td = new TextDecoder();
    for (let i = 0; i < n; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = td.decode(b.subarray(p + 46, p + 46 + nl));
      files[name] = {method, csize, off};
      p += 46 + nl + xl + cl;
    }
    const read = async name => {
      const f = files[name]; if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      const raw = b.subarray(start, start + f.csize);
      return td.decode(f.method === 8 ? await inflate(raw) : raw);
    };
    return read;
  }
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');
  const tags = (node, t) => Array.from(node.getElementsByTagName(t));
  const colNum = s => { let n = 0; for (const ch of s) n = n * 26 + ch.charCodeAt(0) - 64; return n; };

  async function readXlsx(buf) {
    const read = await unzip(buf);
    const ssx = await read('xl/sharedStrings.xml');
    const ss = ssx ? tags(xml(ssx), 'si').map(si => tags(si, 't').map(t => t.textContent).join('')) : [];
    const wb = xml(await read('xl/workbook.xml'));
    const rels = xml(await read('xl/_rels/workbook.xml.rels'));
    const target = {};
    tags(rels, 'Relationship').forEach(r => target[r.getAttribute('Id')] = r.getAttribute('Target'));
    const sheets = {};
    for (const s of tags(wb, 'sheet')) {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let t = target[rid]; if (!t) continue;
      t = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
      const sx = await read(t); if (!sx) continue;
      const g = new Map();
      for (const c of tags(xml(sx), 'c')) {
        const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute('r') || ''); if (!m) continue;
        const ty = c.getAttribute('t'); const v = c.getElementsByTagName('v')[0];
        let val = null;
        if (ty === 's') val = v ? ss[+v.textContent] : null;
        else if (ty === 'inlineStr') val = tags(c, 't').map(t => t.textContent).join('');
        else if (ty === 'str' || ty === 'e') val = v ? v.textContent : null;
        else if (ty === 'b') val = v ? v.textContent === '1' : null;
        else if (v) val = parseFloat(v.textContent);
        if (val !== null && val !== '') g.set(+m[2] + ',' + colNum(m[1]), val);
      }
      sheets[s.getAttribute('name')] = g;
    }
    return sheets;
  }

  const num = v => typeof v === 'number' && isFinite(v) ? Math.round(v * 1e4) / 1e4 : null;
  const str = v => typeof v === 'string' ? v.trim() : (v == null ? null : String(v));
  const serial = v => new Date(Date.UTC(1899, 11, 30) + v * 864e5);
  const year = v => typeof v === 'number' && v > 20000 ? serial(v).getUTCFullYear() : null;
  const ddmm = v => { if (typeof v === 'number' && v > 20000) { const d = serial(v); return String(d.getUTCDate()).padStart(2,'0') + '/' + String(d.getUTCMonth()+1).padStart(2,'0'); } return str(v); };
  const cleanPen = v => { v = str(v); if (!v || /^\.+$/.test(v)) return null; return v.replace(/^\.+/, '').replace(/\.+$/, '').trim() || null; };

  function team(g, id) {
    const get = (r, c) => g.get(r + ',' + c) ?? null;
    let hr = 0, hc = 0, maxR = 0;
    for (const k of g.keys()) { const [r, c] = k.split(',').map(Number); if (r > maxR) maxR = r; if (!hr && r <= 15 && get(r, c) === 'Cartellino') { hr = r; hc = c; } }
    if (!hr) throw new Error('Struttura non riconosciuta nel foglio ' + id);
    const nc = hc - 1, pc = hc - 2, players = [], loans = []; let inLoan = false, sec = null;
    const SEC = {Portieri: 'P', Difensori: 'D', Centrocampisti: 'C', Attaccanti: 'A'};
    for (let r = hr + 1; r <= maxR; r++) {
      let p = str(get(r, pc)); const n = str(get(r, nc));
      if (n === 'Prestiti') { inLoan = true; continue; }
      if (n === 'Legenda') break;
      if (n && SEC[n]) { sec = SEC[n]; continue; }
      if (inLoan && n) { loans.push(n); continue; }
      // ruolo vuoto (giocatore non più nel listone): si usa la sezione, se c'è un cartellino
      if (!['P','D','C','A'].includes(p) && n && sec && typeof get(r, hc) === 'number') p = sec;
      if (['P','D','C','A'].includes(p) && n)
        players.push({r: p, n, c: num(get(r, hc)), i: num(get(r, hc + 1)), s: year(get(r, hc + 2)), a: num(get(r, hc + 3)), g: num(get(r, hc + 4))});
    }
    const gcols = []; for (let c = hc; c < hc + 30; c++) if (get(hr, c) === 'Giocatore') gcols.push(c);
    const mv = k => { const gc = gcols[k], out = []; if (!gc) return out;
      for (let r = hr + 1; r < hr + 45; r++) { const n = str(get(r, gc)); if (n) out.push({n, v: num(get(r, gc + 1)), d: ddmm(get(r, gc - 3)), f: str(get(r, gc - 2)), t: str(get(r, gc - 1))}); }
      return out; };
    const lab = {};
    const from = (gcols[gcols.length - 1] || hc + 10) + 2;
    for (let r = 1; r <= 30; r++) for (let c = from; c < from + 15; c++) {
      const l = str(get(r, c)); if (l && !(l in lab)) lab[l] = get(r, c + 1);
    }
    const L = k => num(lab[k]);
    const saldo = L('Bilancio Attivo') ?? L('Bilancio Passivo');
    return {
      id, players, loans, in: mv(0), out: mv(1), totIn: num(get(hr - 1, gcols[0] + 1)), totOut: num(get(hr - 1, gcols[1] + 1)),
      monte: L('Monte ingaggi finale') ?? L('Monte ingaggi'), m1: L('Monte ingaggi 1° semestre'), m2: L('Monte ingaggi 2° semestre'),
      cap: L('Salary Cap'), extra: L('Extra Salary Cap'), flat: L('Flat Tax') || 0,
      fin: L('Finanziamento annuale'), ris: L('Riserva economica'), mp: L('Montepremi'), premi: L('Premi individuali'),
      pass: L('Passività'), att: L('Attività'), saldo, perc: L('Percentuale Positiva') ?? L('Percentuale Negativa'),
      penNow: cleanPen(get(5, nc + 1)), penNext: saldo < 0 ? cleanPen(lab['Penalità']) : null
    };
  }

  function byTeamRows(g) { // righe con etichetta in B e squadre in intestazione
    const get = (r, c) => g.get(r + ',' + c) ?? null; let hr = 0; const cols = {};
    for (const k of g.keys()) { const [r, c] = k.split(',').map(Number); if (!hr && canon(get(r, c)) === 'Buscaglia') hr = r; }
    if (!hr) return {};
    for (let c = 1; c < 30; c++) { const t = canon(get(hr, c)); if (t) cols[t] = c; }
    const res = {}; let maxR = 0; for (const k of g.keys()) maxR = Math.max(maxR, +k.split(',')[0]);
    for (let r = hr + 1; r <= maxR; r++) { const l = str(get(r, 2)); if (!l) continue;
      for (const t in cols) { const v = get(r, cols[t]); if (v == null) continue; (res[t] ??= {})[l] = typeof v === 'number' ? num(v) : (/€\s*0,00/.test(v) ? 0 : v); } }
    return res;
  }

  function extract(S) {
    const sheetOf = t => S[t] ? S[t] : (Object.keys(S).filter(k => ALIAS[k.trim()] === t).map(k => S[k])[0]);
    const teams = TEAMS.filter(t => sheetOf(t)).map(t => team(sheetOf(t), t));
    if (!teams.length) throw new Error('Nessun foglio squadra trovato');
    const G = (s, r, c) => S[s]?.get(r + ',' + c) ?? null;
    const sc = S['Salary Cap'] ? byTeamRows(S['Salary Cap']) : {};
    const prev = S['Previsione Montepremi 2028'] ? byTeamRows(S['Previsione Montepremi 2028']) : {};
    const prize = []; let prizeTot = null;
    if (S['Montepremi 2026_27']) { prizeTot = num(G('Montepremi 2026_27', 4, 3));
      for (let r = 7; r < 60; r++) { const l = str(G('Montepremi 2026_27', r, 2)); if (l) prize.push({l, v: num(G('Montepremi 2026_27', r, 3)), b: num(G('Montepremi 2026_27', r, 4)), p: num(G('Montepremi 2026_27', r, 5))}); } }
    const albo = []; for (let r = 5; r < 60; r++) { const y = num(G('Albo doro', r, 8)); if (y) albo.push({y, c: str(G('Albo doro', r, 2)), l: str(G('Albo doro', r, 4)), s: str(G('Albo doro', r, 6))}); }
    const draft = [], draftPool = [];
    for (let r = 5; r < 40; r++) { const t = str(G('Draft Serie B', r, 3)); if (t && num(G('Draft Serie B', r, 2))) draft.push({o: num(G('Draft Serie B', r, 2)), t: canon(t) || t, a: num(G('Draft Serie B', r, 4)), b: num(G('Draft Serie B', r, 5)), f: num(G('Draft Serie B', r, 6)), p: num(G('Draft Serie B', r, 8))});
      const j = str(G('Draft Serie B', r, 10)); if (j) draftPool.push(j); }
    const pay = []; for (let r = 5; r < 30; r++) { const t = str(G('Saldo versamento 2025-26', r, 5)); if (t) pay.push({t: canon(t) || t, due: num(G('Saldo versamento 2025-26', r, 9)), paid: num(G('Saldo versamento 2025-26', r, 10)) || 0, tot: num(G('Saldo versamento 2025-26', r, 11))}); }
    // listone
    const db = [];
    const A = S['Algoritmo'], Lst = S['Listone_2309'];
    if (A) { const hdr = {}; for (let c = 1; c < 30; c++) { const h = str(A.get('2,' + c)); if (h) hdr[h] = c; }
      const fvm = {}; if (Lst) for (let r = 2; r < 2000; r++) { const id = Lst.get(r + ',1'); if (id == null) continue; fvm[id] = num(Lst.get(r + ',12')); }
      for (let r = 3; r < 3000; r++) { const id = A.get(r + ',' + hdr['Id']); const n = str(A.get(r + ',' + hdr['Nome'])); if (id == null || !n) continue;
        db.push([str(A.get(r + ',' + hdr['R'])), n, str(A.get(r + ',' + hdr['Squadra'])), num(A.get(r + ',' + hdr['Qt.A'])), num(A.get(r + ',' + hdr['Qt.I'])), num(A.get(r + ',' + hdr['ALGO'])), num(A.get(r + ',' + hdr['Età'])), fvm[id] ?? null]); } }
    return {teams, cap: num(G('Salary Cap', 9, 3)), capNext: num(G('Salary Cap', 10, 3)), sc, prev, prize, prizeTot, albo, draft, draftPool, pay, db};
  }

  return {readXlsx, extract, TEAMS};
})();
