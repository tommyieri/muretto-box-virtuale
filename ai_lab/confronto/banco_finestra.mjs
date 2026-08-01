// banco_finestra.mjs — quanto e' FERMO il giro raccomandato dalla curva del «quando».
//
//     node ai_lab/confronto/banco_finestra.mjs [--passo N] [--json]
//
// Il PO ha deciso: finestra sempre, mai piu' un giro secco. Questo banco non decide
// quella domanda — e' chiusa. Misura QUANTO LARGA dev'essere la finestra.
//
// Protocollo: ai_lab/confronto/PREREG_finestra.md, scritta prima.
//
// SI PERTURBA DENTRO L'INCERTEZZA CHE IL MODELLO DICHIARA DI SE', non dentro una
// inventata per l'occasione: rho e delta70 agli estremi del loro IC95, il pit-loss
// agli estremi gia' stampati in targhetta, e L +/- 1 perche' il congelamento non e'
// un istante esatto. La finestra e' l'inviluppo dei giri raccomandati.
//
// LA SONDA OBBLIGATORIA: a perturbazione nulla il banco deve riprodurre ESATTAMENTE
// la curva che il prodotto pubblica. Un banco che non riproduce il punto di partenza
// non misura la distanza da li'.
//
// NON SCRIVE NIENTE su disco.

import { gare, garaNuova, garaSimDi, contestoNuovo, modelloDaDisco } from './banco.mjs';
import { curvaDelQuando } from '../../simulatore/scenario/costruttore.mjs';
import { mescolaAlGiro } from '../../simulatore/scenario/risposta.mjs';

const iPasso = process.argv.indexOf('--passo');
const PASSO = iPasso >= 0 ? Number(process.argv[iPasso + 1]) : 7;
const MODELLO = modelloDaDisco();

const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, n = 2) => (x === null || !Number.isFinite(x) ? '  —  ' : x.toFixed(n));

// ── le perturbazioni, ognuna da una targhetta che esiste gia' ────────────────
const [rhoLo, rhoHi] = MODELLO.rho.ic95;
const [d70Lo, d70Hi] = MODELLO.delta_70.ic95;
const conModello = (rho, d70) => ({ ...MODELLO, rho: { ...MODELLO.rho, valore: rho }, delta_70: { ...MODELLO.delta_70, scelto: d70 } });

const PERTURBAZIONI = [
  { nome: 'nulla', modello: MODELLO, dL: 0, pit: 1 },
  { nome: 'rho basso', modello: conModello(rhoLo, MODELLO.delta_70.scelto), dL: 0, pit: 1 },
  { nome: 'rho alto', modello: conModello(rhoHi, MODELLO.delta_70.scelto), dL: 0, pit: 1 },
  { nome: 'delta70 basso', modello: conModello(MODELLO.rho.valore, d70Lo), dL: 0, pit: 1 },
  { nome: 'delta70 alto', modello: conModello(MODELLO.rho.valore, d70Hi), dL: 0, pit: 1 },
  { nome: 'pit-loss -10%', modello: MODELLO, dL: 0, pit: 0.9 },
  { nome: 'pit-loss +10%', modello: MODELLO, dL: 0, pit: 1.1 },
  { nome: 'L-1', modello: MODELLO, dL: -1, pit: 1 },
  { nome: 'L+1', modello: MODELLO, dL: 1, pit: 1 },
];

function contestoPerturbato(nomeSito, p) {
  const base = contestoNuovo(nomeSito);
  if (p.pit === 1) return { ...base, modello: p.modello };
  // il pit-loss si scala alla frontiera del prior: e' l'unico posto in cui il
  // numero entra, quindi non c'e' un secondo percorso da tenere allineato
  const circuiti = {};
  for (const [k, v] of Object.entries(base.prior.circuiti)) circuiti[k] = { ...v, mediana_green_s: v.mediana_green_s * p.pit };
  const interna = base.prior.misura_interna
    ? { ...base.prior.misura_interna, circuiti: Object.fromEntries(Object.entries(base.prior.misura_interna.circuiti ?? {})
        .map(([k, v]) => [k, { ...v, mediana_green_s: v.mediana_green_s * p.pit }])) }
    : base.prior.misura_interna;
  return { ...base, modello: p.modello, prior: { ...base.prior, circuiti, misura_interna: interna } };
}

// ── la misura ────────────────────────────────────────────────────────────────
const curve = [];
let senzaMinimo = 0; let respinte = 0;
for (const nomeSito of gare()) {
  const garaSim = garaSimDi(nomeSito);
  const g = garaNuova(nomeSito);
  for (let Lf = 6; Lf < g.nGiri - 4; Lf += PASSO) {
    for (const pilota of g.perPilota.keys()) {
      const giri = [];
      let minimoNullo = null; let deltaNullo = null; let saltata = false;
      for (const p of PERTURBAZIONI) {
        const L = Lf + p.dL;
        const mescola = mescolaAlGiro(g, L, pilota);
        if (mescola === null) { saltata = true; break; }
        let r;
        try {
          r = curvaDelQuando({ gara: garaSim, freezeLap: L, pilota, mescola },
            { ...contestoPerturbato(nomeSito, p), nGiriGara: g.nGiri });
        } catch { saltata = true; break; }
        if (!r?.approvato || !r.minimo) { if (p.nome === 'nulla') respinte += 1; saltata = true; break; }
        if (p.nome === 'nulla') { minimoNullo = r.minimo.giroPit; deltaNullo = mediana(r.curva.map((c) => c.delta_s)); }
        giri.push({ pert: p.nome, giro: r.minimo.giroPit, interno: r.minimo.giroPit > r.curva[0].giroPit });
      }
      if (saltata || giri.length !== PERTURBAZIONI.length) continue;
      const soli = giri.map((x) => x.giro);
      const larghezza = Math.max(...soli) - Math.min(...soli) + 1;
      if (!giri[0].interno) senzaMinimo += 1;
      // chi domina: quanto si muove il giro perturbando SOLO L, contro tutto il resto
      const soloModello = giri.filter((x) => !x.pert.startsWith('L')).map((x) => x.giro);
      const soloL = giri.filter((x) => x.pert === 'nulla' || x.pert.startsWith('L')).map((x) => x.giro);
      curve.push({
        gara: nomeSito, Lf, pilota, larghezza, minimoNullo, deltaNullo,
        interno: giri[0].interno,
        largh_modello: Math.max(...soloModello) - Math.min(...soloModello) + 1,
        largh_L: Math.max(...soloL) - Math.min(...soloL) + 1,
      });
    }
  }
}

const larghezze = curve.map((c) => c.larghezza);
const uno = curve.filter((c) => c.larghezza === 1).length;
const oltre5 = curve.filter((c) => c.larghezza > 5).length;
const interne = curve.filter((c) => c.interno).length;
const esito = {
  targhetta: { protocollo: 'ai_lab/confronto/PREREG_finestra.md', perturbazioni: PERTURBAZIONI.map((p) => p.nome), passo: PASSO, data: '2026-08-01' },
  n_curve: curve.length, respinte_dal_director: respinte,
  larghezza: { mediana: mediana(larghezze), p90: [...larghezze].sort((a, b) => a - b)[Math.floor(larghezze.length * 0.9)], max: Math.max(...larghezze),
               un_solo_giro: uno, oltre_5_giri: oltre5 },
  quota_minimo_interno: 100 * interne / curve.length,
  // le MEDIANE qui non discriminano (sono entrambe 1): la domanda e' quanto spesso
  // ciascuna sorgente allarga la finestra, non quanto la allarga tipicamente.
  dominanza: {
    solo_modello_media: media(curve.map((c) => c.largh_modello)),
    solo_L_media: media(curve.map((c) => c.largh_L)),
    allarga_il_modello: curve.filter((c) => c.largh_modello > 1).length,
    allarga_L: curve.filter((c) => c.largh_L > 1).length,
    allargano_entrambi: curve.filter((c) => c.largh_modello > 1 && c.largh_L > 1).length,
    nessuno_dei_due: curve.filter((c) => c.largh_modello === 1 && c.largh_L === 1).length,
  },
  guadagno_mediano_a_perturbazione_nulla: mediana(curve.map((c) => c.deltaNullo).filter((x) => x !== null)),
};
if (process.argv.includes('--json')) { console.log(JSON.stringify(esito, null, 2)); process.exit(0); }

console.log('BANCO DELLA FINESTRA — quanto e\' fermo il giro raccomandato');
console.log(`  ${curve.length} curve (un congelamento ogni ${PASSO} giri, tutti i piloti) · ${PERTURBAZIONI.length} perturbazioni ciascuna`);
console.log(`  curve col minimo INTERNO a perturbazione nulla: ${f(esito.quota_minimo_interno, 1)}%  (il prodotto oggi dichiara 56,9% — la SONDA)`);
console.log('');
console.log(`  LARGHEZZA DELLA FINESTRA (giri):  mediana ${esito.larghezza.mediana}  ·  p90 ${esito.larghezza.p90}  ·  max ${esito.larghezza.max}`);
console.log(`    un solo giro (il secco sarebbe stato onesto): ${uno} (${f(100 * uno / curve.length, 1)}%)`);
console.log(`    oltre 5 giri: ${oltre5} (${f(100 * oltre5 / curve.length, 1)}%)`);
console.log('');
const d = esito.dominanza;
console.log(`  CHI ALLARGA LA FINESTRA (su ${curve.length} curve)`);
console.log(`    solo l'incertezza del MODELLO (rho, delta70, pit-loss): ${d.allarga_il_modello} curve · larghezza media ${f(d.solo_modello_media)}`);
console.log(`    solo il congelamento (L±1)                            : ${d.allarga_L} curve · larghezza media ${f(d.solo_L_media)}`);
console.log(`    entrambi ${d.allargano_entrambi} · nessuno dei due ${d.nessuno_dei_due}`);
console.log(`    → ${d.allarga_L > d.allarga_il_modello
  ? 'domina DOVE SI CHIEDE: la finestra e\' larga perche\' il congelamento non e\' un istante, non perche\' il modello sia incerto'
  : 'domina l\'INCERTEZZA DEL MODELLO'}`);
console.log(`\n  guadagno mediano promesso dalla curva, a perturbazione nulla: ${f(esito.guadagno_mediano_a_perturbazione_nulla, 3)} s`);
