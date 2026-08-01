// esiti_reali.mjs — «a chi era nella tua situazione, com'e' finita?»
//
//     node ai_lab/casi/esiti_reali.mjs [--json]
//
// PERCHE' E' UNA COSA DIVERSA, e non un altro termine da tarare.
//
// Il motore chiede: «se ti fermi al giro 22, dove rientri?». Per rispondere deve
// simulare tre cose — il passo, i duelli, la reazione dei rivali — e due su tre
// dichiara di non saperle fare: «due auto possono attraversarsi», e i rivali non
// reagiscono. Su una pista dove sorpassare e' difficile quella non e'
// un'approssimazione, e' l'errore dominante. Misurato altrove nel repo: il collo
// di bottiglia sono 11,7 s di rumore di gara, di cui 8,17 s di traffico.
//
// Questa domanda non ha bisogno di nessuna delle tre. I duelli ci sono gia'
// dentro perche' sono SUCCESSI. La reazione dei rivali c'e' gia' dentro. Il
// rumore di gara non e' un errore da correggere: E' la distribuzione, ed e'
// esattamente cio' che va mostrato.
//
// Nessun passo, nessun kernel, nessun Director. Solo soste vere e posizioni vere.
//
// LA CARTA DELLE ERE VALE ANCHE QUI (ai_lab/casi/CARTA_DELLE_ERE.md): il guadagno
// di una sosta dipende dai SORPASSI, e nel 2026 il DRS non esiste. Quindi il fondo
// e' CONTESTO e non evidenza, e le due ere si riportano separate — mai mediate.
//
// NON SCRIVE NIENTE su disco.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { regimeDiCella } from '../../simulatore/provenienza/definizioni.mjs';
import { MESCOLE_BAGNATO } from '../../simulatore/provenienza/vocabolario.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.resolve(QUI, '..', '..', 'simulatore');
const ORIZZONTE = 10;      // dieci giri dopo la sosta: l'orizzonte che il prodotto usa
const MIN_CASI = 20;

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

/** Le soste vere di una gara, con la SITUAZIONE prima e l'ESITO dopo. */
function sosteDi(perPilota, nGiri, gara, era, fuori) {
  // posizione per giro, fra chi ha cum a quel giro
  const posDi = new Map();
  for (let l = 1; l <= nGiri; l += 1) {
    const v = [];
    for (const [drv, celle] of perPilota) {
      const c = celle.get(l);
      if (c && typeof c.cum_time === 'number') v.push({ drv, cum: c.cum_time });
    }
    v.sort((a, b) => a.cum - b.cum);
    v.forEach((x, i) => posDi.set(`${x.drv}|${l}`, { pos: i + 1, cum: x.cum, su: v.length }));
  }

  for (const [drv, celle] of perPilota) {
    for (const [lap, c] of celle) {
      if (c.in_lap !== true) continue;
      const prima = posDi.get(`${drv}|${lap - 1}`);
      const dopo = posDi.get(`${drv}|${lap + ORIZZONTE}`);
      if (!prima || !dopo) continue;
      if (c.tyre_age === null || c.tyre_age === undefined) continue;
      // il distacco da chi era davanti, al giro prima della sosta
      const davanti = [...perPilota.keys()]
        .map((d) => ({ d, p: posDi.get(`${d}|${lap - 1}`) }))
        .filter((x) => x.p && x.p.pos === prima.pos - 1)[0];
      const gapDavanti = davanti ? prima.cum - davanti.p.cum : null;
      let regime = null; try { regime = regimeDiCella(c); } catch { regime = null; }
      fuori.push({
        era, gara, drv, lap,
        posizione: prima.pos, su: prima.su,
        gap_davanti: gapDavanti === null ? null : Number(gapDavanti.toFixed(2)),
        eta: c.tyre_age,
        frazione: Number((lap / nGiri).toFixed(3)),
        regime,
        // L'ESITO: quante posizioni hai guadagnato (negativo) o perso (positivo)
        delta_posizioni: dopo.pos - prima.pos,
      });
    }
  }
}

const casi = [];
{
  const base = path.join(SIM, 'data', 'fondo');
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try { ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` })); } catch { continue; }
      if (righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound))) continue;
      const perPilota = new Map(); let nGiri = 0;
      for (const { drv, lap, cella } of righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
        if (lap > nGiri) nGiri = lap;
      }
      sosteDi(perPilota, nGiri, `${anno}/${gara}`, 'fondo', casi);
    }
  }
}
{
  const gare = caricaGare2026(SIM);
  for (const [nome, g] of Object.entries(gare)) sosteDi(g.perPilota, g.nGiri, nome, '2026', casi);
}

/** La risposta per casi: la DISTRIBUZIONE, non la media. */
function distribuzione(v) {
  if (v.length < MIN_CASI) return { sa: false, n: v.length };
  const d = v.map((x) => x.delta_posizioni);
  return {
    sa: true, n: v.length, n_gare: new Set(v.map((x) => x.gara)).size,
    mediana: mediana(d),
    p10: quant(d, 0.10), p90: quant(d, 0.90),
    guadagna: Number((100 * d.filter((x) => x < 0).length / d.length).toFixed(1)),
    invariata: Number((100 * d.filter((x) => x === 0).length / d.length).toFixed(1)),
    perde: Number((100 * d.filter((x) => x > 0).length / d.length).toFixed(1)),
  };
}

const tagli = [
  ['tutte le soste', () => true],
  ['in VERDE', (x) => x.regime === null],
  ['sotto neutralizzazione', (x) => x.regime !== null],
  ['con chi davanti VICINO (< 2 s)', (x) => x.gap_davanti !== null && x.gap_davanti < 2],
  ['con chi davanti LONTANO (> 10 s)', (x) => x.gap_davanti !== null && x.gap_davanti > 10],
  ['nel primo terzo di gara', (x) => x.frazione <= 0.33],
  ['nell\'ultimo terzo', (x) => x.frazione > 0.66],
];

const esito = tagli.map(([nome, f]) => ({
  nome,
  fondo: distribuzione(casi.filter((x) => x.era === 'fondo' && f(x))),
  d2026: distribuzione(casi.filter((x) => x.era === '2026' && f(x))),
}));

if (process.argv.includes('--json')) { console.log(JSON.stringify({ n_casi: casi.length, esito }, null, 2)); process.exit(0); }

const riga = (d) => (d.sa
  ? `n=${String(d.n).padStart(5)} (${String(d.n_gare).padStart(3)} gare) · mediana ${d.mediana >= 0 ? '+' : ''}${d.mediana} · p10..p90 ${d.p10 >= 0 ? '+' : ''}${d.p10}..${d.p90 >= 0 ? '+' : ''}${d.p90} · guadagna ${d.guadagna}% · pari ${d.invariata}% · perde ${d.perde}%`
  : `NON LO SO — solo ${d.n} casi`);

console.log('COM\'E\' FINITA DAVVERO — soste vere, posizioni vere, nessun modello');
console.log(`  ${casi.length} soste con esito misurabile · orizzonte ${ORIZZONTE} giri dopo la sosta`);
console.log('  delta_posizioni: NEGATIVO = ha guadagnato posizioni, POSITIVO = le ha perse');
console.log('  le due ere restano SEPARATE: il guadagno di una sosta dipende dai sorpassi, e nel 2026 il DRS non esiste');
for (const t of esito) {
  console.log(`\n  ${t.nome}`);
  console.log(`    fondo 2018-2025 : ${riga(t.fondo)}`);
  console.log(`    2026            : ${riga(t.d2026)}`);
}
