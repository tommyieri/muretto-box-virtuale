// s45_basi_kpi — le linee di base dei KPI hanno UNA sorgente, e le somme non sono a mano.
//
// La pagella l'aveva scritto: «le linee di base dei KPI derivano in silenzio quando il
// motore cambia», e i due numeri piu' citati del progetto (36-12 e 44-27) erano copiati
// a mano in almeno nove file — il 44-27 non era stampato da nessuno script (lo confessa
// la testa di bandiera.mjs). Dal 07/08 l'autorita' e' ai_lab/confronto/basi_kpi.json:
// i lettori di codice lo importano, i referti firmati restano come storia.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) basi_kpi.json manca, o non ha le chiavi che i lettori usano;
//  (b) LE SOMME NON TORNANO: i terzili non sommano a n, il basso_medio non e' la
//      somma dei primi due terzili, il due-giri non somma a n — cioe' la somma
//      «a mano» e' tornata a mano;
//  (c) UNA COPIA CABLATA RICOMPARE nei lettori: cancelli_tetto_uniforme.mjs o
//      banco_regole.mjs contengono di nuovo i numeri come letterali di codice
//      invece di leggere la sorgente;
//  (d) la deriva rimisurata sparisce dal file: il blocco che dichiara come i
//      numeri si sono mossi al cambio del motore e' parte della sorgente, non
//      un optional;
//  (e) il controllo di coerenza ha perso il potere di fallire (elenco fabbricato).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s45 FALLITA — ${msg}`); };

const qui = path.dirname(fileURLToPath(import.meta.url));
const radice = path.join(qui, '..', '..', '..');
const dove = path.join(radice, 'ai_lab', 'confronto', 'basi_kpi.json');

/** La coerenza interna, pura perche' (e) possa provarla su un oggetto fabbricato. */
export const problemiDi = (b) => {
  const p = [];
  if (!b?.bandiera || !b?.due_giri) { p.push('mancano bandiera o due_giri'); return p; }
  const t = b.bandiera.terzili ?? [];
  if (t.length !== 3) p.push(`terzili: ${t.length} invece di 3`);
  const sommaN = t.reduce((a, x) => a + (x.n ?? 0), 0);
  if (sommaN !== b.bandiera.n) p.push(`i terzili sommano a ${sommaN}, non a n = ${b.bandiera.n}`);
  const bm = b.bandiera.basso_medio ?? {};
  const vinceAtteso = (t[0]?.vince ?? 0) + (t[1]?.vince ?? 0);
  const perdeAtteso = (t[0]?.perde ?? 0) + (t[1]?.perde ?? 0);
  if (bm.vince !== vinceAtteso || bm.perde !== perdeAtteso) {
    p.push(`basso_medio ${bm.vince}-${bm.perde} non e' la somma dei primi due terzili (${vinceAtteso}-${perdeAtteso})`);
  }
  if ((t[0]?.n ?? 0) + (t[1]?.n ?? 0) !== bm.n) p.push(`basso_medio.n ${bm.n} non somma i primi due terzili`);
  const a = b.bandiera.alto ?? {};
  if (a.vince !== t[2]?.vince || a.perde !== t[2]?.perde) p.push('alto non coincide col terzo terzile');
  const d = b.due_giri;
  if ((d.vinceA ?? 0) + (d.vinceB ?? 0) + (d.pari ?? 0) !== d.n) p.push(`due_giri: ${d.vinceA}+${d.vinceB}+${d.pari} ≠ n = ${d.n}`);
  if (!b.deriva_dichiarata?.rimisurate_il) p.push('manca la deriva dichiarata (rimisurate_il)');
  return p;
};

// (a) + (b) + (d) — la sorgente vera
let basi = null;
try { basi = JSON.parse(readFileSync(dove, 'utf8')); } catch (e) { fallisci(`basi_kpi.json illeggibile: ${e.message}`); }
if (basi) for (const p of problemiDi(basi)) fallisci(p);

// (c) — niente copie cablate nei lettori
for (const rel of ['ai_lab/confronto/cancelli_tetto_uniforme.mjs', 'ai_lab/confronto/banco_regole.mjs']) {
  const testo = readFileSync(path.join(radice, rel), 'utf8')
    .split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');
  if (!/basi_kpi\.json/.test(testo)) fallisci(`${rel} non legge piu' la sorgente unica`);
  for (const cablata of [/vince:\s*13\s*,\s*perde:\s*28/, /vince:\s*44\s*,\s*perde:\s*27/, /vinceA:\s*36\s*,\s*vinceB:\s*12/]) {
    if (cablata.test(testo)) fallisci(`${rel} ha di nuovo una copia cablata (${cablata})`);
  }
}

// (e) — potere di fallire, su un oggetto fabbricato
{
  const rotto = {
    due_giri: { n: 10, vinceA: 3, vinceB: 3, pari: 3 },   // somma 9 ≠ 10
    bandiera: {
      n: 6,
      terzili: [{ n: 2, vince: 1, perde: 1 }, { n: 2, vince: 1, perde: 0 }, { n: 2, vince: 0, perde: 2 }],
      alto: { vince: 0, perde: 2 },
      basso_medio: { n: 4, vince: 9, perde: 9 },          // non e' la somma
    },
    deriva_dichiarata: { rimisurate_il: 'x' },
  };
  const p = problemiDi(rotto);
  if (!p.some((x) => /due_giri/.test(x)) || !p.some((x) => /basso_medio/.test(x))) {
    fallisci(`il controllo di coerenza ha perso il potere di fallire: ${JSON.stringify(p)}`);
  }
}

process.exit(errori === 0 ? 0 : 1);
