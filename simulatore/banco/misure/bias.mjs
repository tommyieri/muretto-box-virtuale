// bias.mjs — l'UNICA implementazione della misura di bias sui tempi assoluti
// (regola 1). La usa l'esperimento su δ e la usa la corsa notturna: se
// esistessero due copie, il numero pubblicato e il numero sorvegliato
// potrebbero divergere senza che nessuno se ne accorga.
//
// Campione (PREREG_delta.md / PREREG_banco.md): finestre in cui TUTTI i giri
// sono verdi. Niente soste, niente neutralizzazioni, niente giri cancellati:
// si misura l'errore del TEMPO SUL GIRO, non il pit-loss né la capacità di
// indovinare una Safety Car. Di conseguenza `pits` è vuoto.

import { passoUtilizzabile } from '../../provenienza/definizioni.mjs';
import { osservazioniVerdi } from '../../provenienza/gare_2026.mjs';
import { simulate } from '../../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../../engine/passo_v2.mjs';

export const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Piloti ammessi a (gara, Lf, H). Non dipende da δ: i bracci sono appaiati. */
export function ammessiBias(gara, Lf, H, { minGiriBase }) {
  const dentro = [];
  for (const [drv, celle] of gara.perPilota) {
    const alCongelamento = celle.get(Lf);
    if (!alCongelamento || alCongelamento.cum_time === null || alCongelamento.tyre_age === null) continue;
    let verdiPrima = 0;
    for (const [lap, c] of celle) if (lap <= Lf && passoUtilizzabile(c) && c.tyre_age !== null) verdiPrima += 1;
    if (verdiPrima < minGiriBase) continue;
    let pulita = true;
    for (let l = Lf + 1; l <= Lf + H; l += 1) {
      const c = celle.get(l);
      if (!c || !passoUtilizzabile(c)) { pulita = false; break; }
    }
    if (!pulita) continue;
    const arrivo = celle.get(Lf + H);
    if (!arrivo || arrivo.cum_time === null) continue;
    dentro.push({ drv, cum_time: alCongelamento.cum_time, tyre_age: alCongelamento.tyre_age, cumReale: arrivo.cum_time });
  }
  return dentro;
}

export function biasDiGara(gara, Lf, H, piloti, { delta70, rho, minGiriBase, minPiloti }) {
  const basi = stimaBasi(osservazioniVerdi(gara.righe), {
    delta70, rho, nGiri: gara.nGiri, finoA: Lf, minGiri: minGiriBase,
  });
  const r = simulate({
    state: piloti.map((p) => ({ drv: p.drv, lap: Lf, cum_time: p.cum_time, tyre_age: p.tyre_age })),
    pace: creaPasso({ delta70, rho, nGiri: gara.nGiri, basi }),
    freezeLap: Lf,
    steps: H,
    pits: {},
  });
  const residui = [];
  for (const p of piloti) {
    if (r.cum[p.drv] === null) continue; // base assente: null, non un numero (regola 6)
    residui.push((r.cum[p.drv] - p.cumReale) / H);
  }
  if (residui.length < minPiloti) return null;
  return residui.reduce((a, b) => a + b, 0) / residui.length;
}

/**
 * @param delta70Di  (gara) => δ₇₀ da usare per quella gara (un braccio, o il
 *                   valore scelto). Passarlo come funzione permette il
 *                   leave-one-race-out senza una seconda implementazione.
 */
export function misuraBias(gare, { delta70Di, rho, cancelli }) {
  const { congelamenti, orizzonti, min_giri_base: minGiriBase, min_piloti_gara: minPiloti, min_gare_orizzonte: minGare } = cancelli;
  const perOrizzonte = {};
  const dettaglio = [];
  for (const H of orizzonti) {
    const valori = [];
    const gareUsate = new Set();
    for (const Lf of congelamenti) {
      for (const [nome, gara] of Object.entries(gare)) {
        if (Lf + H > gara.nGiri) continue;
        const piloti = ammessiBias(gara, Lf, H, { minGiriBase });
        if (piloti.length < minPiloti) continue;
        const b = biasDiGara(gara, Lf, H, piloti, { delta70: delta70Di(nome), rho, minGiriBase, minPiloti });
        if (b === null) continue;
        valori.push(b);
        gareUsate.add(nome);
        dettaglio.push({ gara: nome, Lf, H, n_piloti: piloti.length, bias: Number(b.toFixed(6)) });
      }
    }
    perOrizzonte[H] = {
      n_finestre: valori.length,
      n_gare: gareUsate.size,
      giudicabile: gareUsate.size >= minGare,
      bias: valori.length ? Number(mediana(valori).toFixed(6)) : null,
    };
  }
  return { perOrizzonte, dettaglio };
}
