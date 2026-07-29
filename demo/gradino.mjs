// gradino.mjs — IL GRADINO DI SOSTA, misurato dalla gara che sta correndo.
//
// PERCHE' ESISTE. Il kernel congelato (demo/engine.mjs::simulate) somma `pit.loss` al tempo
// cumulato e prosegue con LO STESSO passo, su una gomma che continua a invecchiare. Cioe':
// fermarsi e' SOLO perdita, e il guadagno da gomma nuova vale zero. Misurato sul motore di
// produzione il 22/07/2026:
//
//     pitto al giro 12 -> A = 1102.000000000
//     pitto al giro 18 -> A = 1102.000000000
//     DIFFERENZA        = 0.000000000000 s      (anche col gancio degrado acceso)
//
// L'undercut non era incerto: era IMPOSSIBILE PER COSTRUZIONE. Questo modulo aggiunge il
// pezzo mancante SENZA toccare il kernel, chiamandolo un giro alla volta (steps=1) come fa
// gia' degrado_hook.mjs. A gradino nullo il risultato e' bit-identico a oggi.
//
// PERCHE' UN SOLO NUMERO AGGREGATO E NON UNA SCOMPOSIZIONE. Il salto post-sosta contiene
// insieme carburante bruciato, gomma fresca, cambio mescola ed evoluzione pista. Quelle
// quattro cose sono CONFUSE fra loro e nessuna, presa da sola, si stima bene: il rho del
// degrado cambia segno fra gare (Canada 24% di pendenze positive, Austria 98%). Aggregato
// invece si misura benissimo, perche' la sosta e' una DISCONTINUITA': un esperimento
// naturale. Misurato su 150 soste verdi / 682 giri post-sosta / 10 gare 2026:
//
//     gradino grezzo   -1,04 s/giro (negativo nel 93% delle soste)
//     gradino netto    -1,41 s/giro (depurato col campo che non si e' fermato)
//     quanto ne modella il motore oggi   0,00
//
// Sostituendo il passo piatto con passo+gradino nei 5 giri dopo la sosta, sempre e solo con
// le soste GIA' AVVENUTE prima del caso valutato: MAE 1,129 -> 0,550 e BIAS +1,063 -> +0,253,
// con vittoria in 9 gare su 10 (perde solo Monaco, gia' dichiarato CID_NO_DEGRADO).
//
// ONESTA' SULLA NATURA DEL NUMERO. Quando i coefficienti vengono dalla gara in corso il
// criterio e' in-sample PER QUELLA GARA. Non e' «me la sono guadagnata», e' «so ricostruire
// questa gara». Per un prodotto live e' legittimo — non stiamo prevedendo una gara futura —
// ma va detto, e chi mostra questi numeri deve mostrare anche `n` (su quante soste).
//
// SICURO PER ASSENZA: meno di MIN_SOSTE soste osservate -> gradino null -> comportamento
// identico a oggi. Meglio un effetto visibilmente assente che una forma applicata di nascosto.
import { simulate } from './engine.mjs';

export const MIN_SOSTE = 2;      // sotto questa soglia non si stima niente
const W = 5;                     // finestra di giri prima/dopo la sosta
const MIN_GIRI = 3;              // giri verdi minimi per avere un passo di stint
const COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'];

const verde = (c) => c && c.lap_time != null && !c.neutralized && !c.in_lap && !c.out_lap
  && COMPOUNDS.includes(c.compound);

function mediana(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Tutte le soste VERDI della gara fino a `finoAGiro` (escluso), con i due numeri che il
// prodotto consuma. `byLap` e' la stessa struttura che usa gia' evaluatePit.
export function soste(byLap, nLaps, finoAGiro = Infinity) {
  const out = [];
  for (let L = 2; L <= nLaps && L < finoAGiro; L++) {
    const cars = byLap[L];
    if (!cars) continue;
    for (const drv of Object.keys(cars)) {
      const c = cars[drv];
      if (!c || !c.in_lap) continue;
      const nx = byLap[L + 1] && byLap[L + 1][drv];
      if (!nx || !nx.out_lap) continue;
      if (c.neutralized || nx.neutralized) continue;            // sotto SC la perdita e' un'altra cosa
      if (!COMPOUNDS.includes(c.compound) || !COMPOUNDS.includes(nx.compound)) continue;
      const pre = [], post = [];
      for (let k = Math.max(1, L - W); k < L; k++) {
        const x = byLap[k] && byLap[k][drv];
        if (verde(x) && x.stint === c.stint) pre.push(x.lap_time);
      }
      for (let k = L + 2; k <= Math.min(nLaps, L + 1 + W); k++) {
        const x = byLap[k] && byLap[k][drv];
        if (verde(x) && x.stint === nx.stint) post.push(x.lap_time);
      }
      if (pre.length < MIN_GIRI || post.length < MIN_GIRI) continue;
      const tPre = mediana(pre), tPost = mediana(post);
      // perdita = extra rispetto a un giro normale, in ingresso e in uscita. Stessa
      // definizione di gen_pitloss_engine_ready.py:122, ma dai soli tempi sul giro.
      const perdita = (c.lap_time - tPre) + (nx.lap_time - tPost);
      out.push({
        drv, giro: L, team: c.team ?? null, da: c.compound, a: nx.compound,
        gradino: tPost - tPre,                                   // <0 = piu' veloce dopo
        perdita: (perdita > 5 && perdita < 60) ? perdita : null,  // fuori dominio -> non pervenuto
      });
    }
  }
  return out.sort((a, b) => a.giro - b.giro);
}

// I due numeri vivi della gara, allo stato del giro `finoAGiro`.
// Ritorna sempre la stessa forma: chi legge deve poter distinguere «non lo so» da «zero».
export function misura(byLap, nLaps, finoAGiro = Infinity) {
  const s = soste(byLap, nLaps, finoAGiro);
  const g = s.map(x => x.gradino);
  const p = s.map(x => x.perdita).filter(x => x != null);
  return {
    gradino: g.length >= MIN_SOSTE ? mediana(g) : null,
    n_gradino: g.length,
    perdita: p.length >= MIN_SOSTE ? mediana(p) : null,
    n_perdita: p.length,
    soste: s,
  };
}

// Il motore, un giro alla volta, col gradino applicato a chi si e' gia' fermato.
// gradino = null  ->  identico a simulate(steps) in un colpo solo (verificato in test).
// `pits` e' una LISTA: serve a rappresentare la RISPOSTA del rivale, che e' l'undercut.
// DERIVA (22/07/2026) — il pezzo che discende dal modo in cui il prodotto e' fatto.
//
// Il sistema instrada UNA macchina dentro la gara che sta succedendo: il resto del campo
// resta com'e' stato davvero. Quindi evoluzione pista e carburante bruciato sono GIA'
// DENTRO i tempi veri degli altri — non vanno modellati. Ma la mia auto, tenuta a passo
// piatto, contro un campo che accelera DERIVA: e' l'unica cosa che il prodotto misura.
//
// `deriva` (s/giro per ogni giro che passa, negativo = si va piu' forte) si applica SOLO
// al pilota instradato, e si misura dal campo stesso: mediana dei giri verdi di chi non e'
// ai box, pendenza sugli ultimi giri. Non separa carburante da evoluzione — non serve
// separarli, serve la loro SOMMA, e quella e' osservabile senza modello.
// Misurato sul 2026: -0,049 s/giro per giro (piu' forte nel primo terzo, -0,10; quasi nulla
// nell'ultimo). Seguirla riduce l'errore sul gap da 4,197 a 4,064 su 55 soste vere.
export function simulaConSoste({ state, pace, freezeLap, steps, pits = [], gradino = null,
                                 deriva = null, instradato = null,
                                 track = 1.0, ZONE = 1.5, STRENGTH = 1.0 }) {
  const drivers = Object.keys(state);
  let cum = {};
  for (const d of drivers) cum[d] = state[d].cum_time;
  const fermi = new Set();                       // chi ha gia' pittato: prende il gradino
  for (let s = 0; s < steps; s++) {
    const cur = freezeLap + s;
    const p = {};
    for (const d of drivers) {
      const b = pace[d];
      if (b == null) continue;
      // la deriva tocca SOLO la macchina instradata: gli altri sono gia' reali.
      // Se `instradato` non e' dichiarato si ricava dalle soste richieste.
      const mio = instradato ?? (pits.length ? pits[0].driver : null);
      p[d] = b + ((gradino != null && fermi.has(d)) ? gradino : 0)
               + ((deriva != null && d === mio) ? deriva * (s + 1) : 0);
    }
    const st1 = {};
    for (const d of drivers) st1[d] = { cum_time: cum[d] };
    // il kernel accetta UNA sosta per giro: le altre si iniettano qui, con la stessa semantica
    const diQuestoGiro = pits.filter(x => x.lap === cur);
    const primo = diQuestoGiro[0] ?? null;
    cum = simulate({ state: st1, pace: p, track, steps: 1, freezeLap: cur,
                     pit: primo, ZONE, STRENGTH });
    for (const x of diQuestoGiro.slice(1)) {
      if (cum[x.driver] != null) cum[x.driver] += x.loss;
    }
    for (const x of diQuestoGiro) fermi.add(x.driver);
  }
  return cum;
}
