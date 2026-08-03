// s33_cliff — il cliff SPENTO non esiste, e non è una promessa: è un'asserzione.
//
// Il file passo_v2.mjs ha dichiarato per un anno «niente cliff di fine vita». Dal
// 03/08/2026 il termine c'è, opzionale e spento di default. Una frase come «spento =
// bit-identico a prima» vale zero se nessuno la verifica: questa sentinella la verifica.
//
// COSA LA FA FALLIRE:
//  (a) `cliff: null`, `undefined` o `{kappa: 0}` cambiano anche un solo bit del passo
//      rispetto a non passare affatto il parametro — cioè il termine "spento" pesa;
//  (b) la REGOLA 10 è rotta: `stimaBasi` e `creaPasso` non usano lo STESSO termine.
//      Si misura nel modo in cui il difetto si manifesterebbe davvero — sottrarre in
//      un posto e non ri-aggiungere nell'altro — e si pretende che il passo ricostruito
//      torni al tempo osservato. È E02 applicato a questo termine: il carburante
//      sottratto e mai restituito costava −1,48 s/giro;
//  (c) un κ malformato (negativo, NaN, stringa) NON esplode: un parametro sbagliato
//      che scivola dentro in silenzio è peggio di uno che ferma tutto (E07);
//  (d) il termine non è quadratico: q(2η) ≠ 4·q(η).
import { banco } from '../asserzioni.mjs';
import { creaCliff, creaPasso, stimaBasi } from '../../engine/passo_v2.mjs';

const b = banco('s33');

// ── (a) spento è spento ──────────────────────────────────────────────────────
const ARG = { delta70: 2.2, rho: 0.030776, nGiri: 60, basi: { AAA: 90 } };
const senza = creaPasso({ ...ARG });
for (const [nome, cliff] of [['null', null], ['undefined', undefined], ['kappa 0', { kappa: 0 }]]) {
  const con = creaPasso({ ...ARG, cliff });
  let uguali = true;
  for (let giro = 1; giro <= 60 && uguali; giro += 1) {
    for (let eta = 0; eta <= 45; eta += 1) {
      // confronto sui BIT, non su una tolleranza: "bit-identico" è ciò che è stato
      // promesso, e Object.is distingue anche +0 da -0.
      if (!Object.is(senza('AAA', giro, eta), con('AAA', giro, eta))) { uguali = false; break; }
    }
  }
  b.verifica(`cliff ${nome}: il passo è bit-identico a non passarlo affatto (2.760 coppie giro×età)`, uguali);
}

// ── (d) il termine è quadratico ──────────────────────────────────────────────
{
  const q = creaCliff({ kappa: 0.0011 });
  const eta = 12;
  b.verifica('q(2η) = 4·q(η): il termine è quadratico',
    Math.abs(q(2 * eta) - 4 * q(eta)) < 1e-12);
  b.verifica('q(0) = 0: gomma nuova non paga cliff', q(0) === 0);
}

// ── (b) la regola 10 regge, e si vede cosa costerebbe romperla ───────────────
{
  const KAPPA = 0.0011;
  const cliff = { kappa: KAPPA };
  const opts = { delta70: 2.2, rho: 0.030776, nGiri: 60, finoA: 20, minGiri: 4 };
  // osservazioni sintetiche: un passo VERO che contiene il cliff. Se la catena
  // sottrai-e-ri-aggiungi è integra, il passo ricostruito ci torna sopra esatto.
  const BASE = 90;
  const deriva = -opts.delta70 / opts.nGiri;
  const oss = [];
  for (let lap = 1; lap <= 20; lap += 1) {
    const eta = lap;
    oss.push({ drv: 'AAA', lap, eta, t: BASE + deriva * (lap - 1) + opts.rho * eta + KAPPA * eta * eta });
  }

  const basiOk = stimaBasi(oss, { ...opts, cliff });
  b.verifica(`regola 10: con il cliff sottratto la base torna quella vera (${basiOk.AAA?.toFixed(6)} contro ${BASE})`,
    Math.abs(basiOk.AAA - BASE) < 1e-9);

  const paceOk = creaPasso({ delta70: opts.delta70, rho: opts.rho, nGiri: opts.nGiri, basi: basiOk, cliff });
  let maxErr = 0;
  for (const o of oss) maxErr = Math.max(maxErr, Math.abs(paceOk('AAA', o.lap, o.eta) - o.t));
  b.verifica(`regola 10: il passo ricostruito riproduce il tempo osservato (errore max ${maxErr.toExponential(1)} s)`,
    maxErr < 1e-9);

  // LO SCOLLEGAMENTO, misurato: sottrarre nella stima e NON ri-aggiungere nel passo.
  // È il difetto che questa sentinella esiste per rendere impossibile in silenzio.
  const paceRotto = creaPasso({ delta70: opts.delta70, rho: opts.rho, nGiri: opts.nGiri, basi: basiOk, cliff: null });
  let biasRotto = 0;
  for (const o of oss) biasRotto += paceRotto('AAA', o.lap, o.eta) - o.t;
  biasRotto /= oss.length;
  b.verifica(`scollegare i due lati costerebbe ${biasRotto.toFixed(3)} s/giro di bias: la rottura è misurabile, non teorica`,
    Math.abs(biasRotto) > 0.1);
}

// ── (c) i parametri malformati esplodono ─────────────────────────────────────
b.esplode('cliff.kappa negativo: rifiutato', () => creaCliff({ kappa: -0.001 }));
b.esplode('cliff.kappa NaN: rifiutato', () => creaCliff({ kappa: NaN }));
b.esplode('cliff.kappa stringa: rifiutato', () => creaCliff({ kappa: '0.001' }));
b.esplode('cliff non oggetto: rifiutato', () => creaCliff(0.001));

b.chiudi();
