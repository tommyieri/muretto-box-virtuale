// rientro.mjs — accuratezza della posizione di rientro, sulle SOSTE VERE.
//
// È la promessa del prodotto messa alla prova: "se mi fermo ORA, dove esco?".
// Si misura dove il fenomeno esiste — su ogni sosta realmente avvenuta nel
// 2026 — e si divide in secchi invece di mediare (E16: il vecchio repo tarò il
// cap del traffico su finestre SENZA soste, cioè dove il fenomeno non c'era).
//
// Ai rivali NON si dicono le loro soste, di proposito: è la domanda che l'utente
// fa al congelamento, e il secco SOSTE_RIVALI serve a misurare quanto costa
// quell'ignoranza invece di nasconderla in una media.

import { regimeNeutralizzato, passoUtilizzabile } from '../../provenienza/definizioni.mjs';
import { simboliStatus } from '../../provenienza/vocabolario.mjs';
import { osservazioniVerdi } from '../../provenienza/gare_2026.mjs';
import { simulate } from '../../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../../engine/passo_v2.mjs';
import { perditaBox } from '../../provenienza/pitloss.mjs';
import { mediana } from './bias.mjs';

const rango = (elenco, chiave, drv) =>
  [...elenco].sort((a, b) => chiave(a) - chiave(b) || (a.drv < b.drv ? -1 : 1)).findIndex((x) => x.drv === drv) + 1;

/** SC ha la precedenza su VSC quando lo status li porta entrambi. */
function regimeDellaSosta(celle, L) {
  for (const lap of [L, L + 1]) {
    const c = celle.get(lap);
    if (!c || c.status === null || !regimeNeutralizzato(c)) continue;
    const simboli = simboliStatus(c.status);
    if (simboli.has('4')) return 'SC';
    if (simboli.has('6')) return 'VSC';
  }
  return null;
}

export function misuraRientro(gare, { rho, delta70, prior, cancelli }) {
  const { min_giri_base: minGiriBase, min_piloti_confrontabili: minPiloti, orizzonte_giri: STEPS } = cancelli;
  const casi = [];
  const scarti = [];
  const gareFallback = new Set();

  for (const [nomeGara, gara] of Object.entries(gare)) {
    const osservazioni = osservazioniVerdi(gara.righe);
    const basiPerLf = new Map();

    for (const [drv, celle] of gara.perPilota) {
      for (const [L, cella] of celle) {
        if (!cella.in_lap) continue;
        const Lf = L - 1;
        const scarta = (motivo) => scarti.push({ gara: nomeGara, drv, lap: L, motivo });
        if (Lf < 1) { scarta('sosta al primo giro: nessun congelamento a monte'); continue; }

        const alCongelamento = celle.get(Lf);
        const arrivo = celle.get(L + 1);
        if (!alCongelamento || alCongelamento.cum_time === null || alCongelamento.tyre_age === null) { scarta('stato incompleto al congelamento'); continue; }
        if (!arrivo || arrivo.cum_time === null) { scarta('nessun cum reale all\'out-lap'); continue; }
        let verdiPrima = 0;
        for (const [l, c] of celle) if (l <= Lf && passoUtilizzabile(c) && c.tyre_age !== null) verdiPrima += 1;
        if (verdiPrima < minGiriBase) { scarta(`meno di ${minGiriBase} giri verdi prima del congelamento`); continue; }

        const confrontabili = [];
        for (const [altro, altreCelle] of gara.perPilota) {
          const a = altreCelle.get(Lf);
          const b = altreCelle.get(L + 1);
          if (!a || a.cum_time === null || a.tyre_age === null) continue;
          if (!b || b.cum_time === null) continue;
          confrontabili.push({ drv: altro, cum_time: a.cum_time, tyre_age: a.tyre_age, cumReale: b.cum_time });
        }
        if (!confrontabili.some((c) => c.drv === drv)) { scarta('il pilota stesso non è confrontabile'); continue; }

        if (!basiPerLf.has(Lf)) {
          basiPerLf.set(Lf, stimaBasi(osservazioni, { delta70, rho, nGiri: gara.nGiri, finoA: Lf, minGiri: minGiriBase }));
        }
        const basi = basiPerLf.get(Lf);
        const regime = regimeDellaSosta(celle, L);
        const perdita = perditaBox(prior, nomeGara, regime);
        if (perdita.fallback) gareFallback.add(nomeGara);

        const r = simulate({
          state: confrontabili.map(({ drv: d, cum_time, tyre_age }) => ({ drv: d, lap: Lf, cum_time, tyre_age })),
          pace: creaPasso({ delta70, rho, nGiri: gara.nGiri, basi }),
          freezeLap: Lf,
          steps: STEPS,
          pits: { [drv]: [{ lap: L, perdita: perdita.perdita }] },
        });
        // Solo chi ha un cum PREVISTO numerico entra nel confronto: chi esce
        // con null non riceve una posizione inventata (regola 6).
        const insieme = confrontabili.filter((c) => r.cum[c.drv] !== null);
        if (!insieme.some((c) => c.drv === drv)) { scarta('il pilota non ha passo: previsione null, nessuna posizione'); continue; }
        if (insieme.length < minPiloti) { scarta(`meno di ${minPiloti} piloti confrontabili`); continue; }

        const prevista = rango(insieme, (c) => r.cum[c.drv], drv);
        const reale = rango(insieme, (c) => c.cumReale, drv);

        let secco = 'PULITA';
        if (regime !== null) secco = 'NEUTRA';
        else if (insieme.some((c) => c.drv !== drv && [L - 1, L, L + 1].some((l) => gara.perPilota.get(c.drv).get(l)?.in_lap))) secco = 'SOSTE_RIVALI';

        // Quanta compagnia si PREVEDE di trovare al rientro. Sono distanze fra
        // cum PREVISTI, quindi disponibili al congelamento: nessuna informazione
        // dal futuro (E14). Si riportano GREZZE, senza soglie: le soglie le
        // fissa la prereg che le usa, non la misura che le produce.
        const gapPrevisti = insieme
          .filter((c) => c.drv !== drv)
          .map((c) => Number(Math.abs(r.cum[c.drv] - r.cum[drv]).toFixed(3)))
          .sort((a, b) => a - b);

        casi.push({
          gara: nomeGara, drv, lap: L, secco, regime,
          posizione_prevista: prevista, posizione_reale: reale, errore: prevista - reale,
          n_confrontabili: insieme.length, pitloss_fallback: perdita.fallback,
          gap_previsti_s: gapPrevisti,
        });
      }
    }
  }

  const secchi = {};
  for (const nome of cancelli.secchi) {
    const dentro = casi.filter((c) => c.secco === nome);
    secchi[nome] = {
      n: dentro.length,
      sufficiente: dentro.length >= cancelli.min_casi_secco,
      mediana_errore_assoluto: dentro.length ? Number(mediana(dentro.map((c) => Math.abs(c.errore))).toFixed(4)) : null,
      errore_medio_con_segno: dentro.length ? Number((dentro.reduce((a, c) => a + c.errore, 0) / dentro.length).toFixed(4)) : null,
      quota_entro_1: dentro.length ? Number((dentro.filter((c) => Math.abs(c.errore) <= 1).length / dentro.length).toFixed(4)) : null,
      quota_entro_2: dentro.length ? Number((dentro.filter((c) => Math.abs(c.errore) <= 2).length / dentro.length).toFixed(4)) : null,
    };
  }
  return {
    n_soste: casi.length,
    n_scarti: scarti.length,
    secchi,
    gare_con_pitloss_di_ripiego: [...gareFallback].sort(),
    motivi_scarto: [...new Set(scarti.map((s) => s.motivo))].sort(),
    casi,
  };
}
