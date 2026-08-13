// profilo_giro.mjs — DOVE SEI SUL NASTRO, dato QUANTO TEMPO del giro hai fatto.
//
// IL PROBLEMA. Il replay disegna i pallini dove il GPS dice che erano. La scena del BOX ORA
// non puo': quella gara non e' mai stata corsa, e del contro-fattuale esistono solo i
// cumulati per giro. Da li' si ricava la frazione di TEMPO del giro, e fino al 13/08/2026 la
// si usava come frazione di DISTANZA — cioe' si assumeva velocita' uniforme. Ma un'auto in
// curva va a un terzo che in rettilineo, e le due frazioni non coincidono: MISURATO sui giri
// verdi dell'Ungheria, **250 m di scarto mediano e 363 al novantesimo percentile**. Nel
// momento in cui premevi BOX ORA i pallini saltavano di quella distanza, tutti insieme.
//
// LA RISPOSTA. Il rapporto fra le due frazioni si MISURA dal GPS della gara stessa: per ogni
// giro pulito di ogni pilota si guarda, a ogni passo del tempo, che frazione di giro era
// stata percorsa. La media e' il profilo φ(τ) di QUEL circuito. La scena lo applica e i suoi
// pallini rallentano dove rallentano le auto vere.
//
// QUANTO VALE, misurato (mediana / p90 dello scarto contro il GPS, per giro pulito):
//     Ungheria   250 → 10 m   |   363 → 45 m
//     Belgio      75 → 10 m   |   273 → 26 m
//     Miami       60 →  6 m   |   282 → 23 m
//     Spagna     137 →  5 m   |   266 → 16 m
//     Austria     90 →  5 m   |   159 → 17 m
//     Australia  132 →  7 m   |   244 → 27 m
//
// E IL PLACEBO, che e' la ragione per cui il profilo si tiene. Dando a una gara il profilo di
// UN'ALTRA pista lo scarto NON migliora — Belgio sull'Ungheria 234 m contro i 250 di partenza,
// Ungheria sul Belgio 350 contro 75 — quindi il profilo cattura la forma di quel circuito e
// non una proprieta' generica delle automobili. Due sole piste fanno eccezione, Austria e
// Australia, che col profilo l'una dell'altra restano intorno al punto di partenza (100 e 119
// contro 90 e 132): hanno profili simili, e su quelle il placebo non separa. Detto, non nascosto.
//
// COSA RESTA E NON SI PUO' TOGLIERE. La coda: sull'Ungheria il 99esimo percentile resta a
// ~700 m. NON e' il profilo — la mediana e' fra 2 e 16 m a ogni frazione di giro, e il
// residuo alto si concentra su singoli piloti (BOT 976 m al p99, che ha corso quattordici
// giri). E' rumore del GPS su giri singoli, e un profilo medio non puo' ne' deve inseguirlo.
//
// L'ASSENZA E' ASSENZA (regola 6). Senza replay GPS — Monaco — non c'e' profilo: si torna
// alla velocita' uniforme, e i pallini restano vuoti come gia' fa il replay per dire che
// quella posizione e' ricostruita.

/** Un giro e' "pulito" se non contiene un transito ai box e dura come gli altri: sotto
 *  Safety Car, o con una sosta dentro, il tempo non si spende come in un giro normale e il
 *  campione racconterebbe un'altra cosa. */
function giriPuliti(replay, byLap, nLaps, maxGiri) {
  const out = [];
  for (const sig of replay.piloti) {
    const suoi = [];
    for (let L = 2; L <= nLaps; L += 1) {
      const a = byLap[L - 1]?.[sig]?.cum_time, b = byLap[L]?.[sig]?.cum_time;
      if (typeof a !== 'number' || typeof b !== 'number' || b <= a) continue;
      suoi.push({ sig, L, t0: a, t1: b, dur: b - a });
    }
    if (!suoi.length) continue;
    const med = suoi.map((x) => x.dur).sort((x, y) => x - y)[suoi.length >> 1];
    for (const x of suoi) {
      const c = byLap[x.L]?.[sig];
      if (c?.in_lap || c?.out_lap) continue;
      if (x.dur > med * 1.06 || x.dur < med * 0.94) continue;
      out.push(x);
    }
  }
  // un tetto ai campioni: il profilo converge molto prima, e il boot non deve pagarlo
  if (out.length > maxGiri) {
    const passo = out.length / maxGiri;
    return Array.from({ length: maxGiri }, (_, i) => out[Math.floor(i * passo)]);
  }
  return out;
}

/**
 * @param replay  istanza di replay_vero.mjs (o null: senza GPS non c'e' profilo)
 * @param byLap   {giro: {sigla: cella}} — per i confini di giro di ogni pilota
 * @returns {{frazione:(tau:number)=>number, campioni:number}|null}
 */
export function creaProfiloGiro({ replay, byLap, nLaps, bin = 40, maxGiri = 400 }) {
  if (!replay || !replay.piloti?.length) return null;
  const giri = giriPuliti(replay, byLap, nLaps, maxGiri);
  if (giri.length < 30) return null;             // troppo pochi per una media: meglio niente

  const somma = new Float64Array(bin + 1), conta = new Float64Array(bin + 1);
  for (const g of giri) {
    const arco = g.t1 - g.t0;
    for (let k = 1; k < bin; k += 1) {
      const tau = k / bin;
      const q = replay.posizioneDi(g.sig, g.t0 + tau * arco);
      if (!q) continue;
      // ANCORAGGIO A τ prima di mediare: il nastro e' un anello, e un campione letto a
      // frazione 0,02 quando τ vale 0,9 non e' un'auto rimasta indietro — e' un'auto che ha
      // gia' passato il traguardo (i confini del giro nei cumulati e nel GPS non coincidono
      // al millesimo). Sommandolo com'e' scaverebbe una fossa nel profilo in fondo al giro.
      let u = q.f;
      if (u - tau > 0.5) u -= 1; else if (u - tau < -0.5) u += 1;
      somma[k] += u; conta[k] += 1;
    }
  }

  const phi = new Float64Array(bin + 1);
  phi[0] = 0; phi[bin] = 1;
  for (let k = 1; k < bin; k += 1) {
    phi[k] = conta[k] ? (((somma[k] / conta[k]) % 1) + 1) % 1 : k / bin;
  }
  // MONOTONIA. Un profilo che torna indietro farebbe indietreggiare i pallini, e un pallino
  // che indietreggia e' peggio di un pallino impreciso: contraddice la classifica accanto.
  for (let k = 1; k <= bin; k += 1) if (phi[k] < phi[k - 1]) phi[k] = phi[k - 1];

  return {
    campioni: giri.length,
    /** τ = frazione di TEMPO del giro → frazione di DISTANZA sul nastro. */
    frazione(tau) {
      const x = Math.min(1, Math.max(0, tau)) * bin;
      const i = Math.min(bin - 1, Math.floor(x)), t = x - i;
      return phi[i] + (phi[i + 1] - phi[i]) * t;
    },
  };
}
