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

import { passoUtilizzabile, regimeDiCella, regimeNeutralizzato } from '../../provenienza/definizioni.mjs';
import { simboliStatus } from '../../provenienza/vocabolario.mjs';
import { osservazioniVerdi } from '../../provenienza/gare_indice.mjs';
import { simulate } from '../../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../../engine/passo_v2.mjs';
import { perditaBox } from '../../provenienza/pitloss.mjs';
import { mediana } from './bias.mjs';

const rango = (elenco, chiave, drv) =>
  [...elenco].sort((a, b) => chiave(a) - chiave(b) || (a.drv < b.drv ? -1 : 1)).findIndex((x) => x.drv === drv) + 1;

/** SC ha la precedenza su VSC quando lo status li porta entrambi. */
// IL REGIME SI LEGGE AL CONGELAMENTO, non al giro della sosta (corretto il
// 01/08/2026, trovato dal confronto fra i due motori).
//
// Questa funzione guardava i giri L e L+1, cioe' il FUTURO rispetto al
// congelamento Lf = L-1. La banda usciva percio' calibrata su un'informazione
// che il prodotto NON ha nel momento in cui risponde: e' E14 del catalogo — la
// tabella di neutralizzazione che veniva dal futuro — annidata nella
// calibrazione invece che nel motore, dove nessuna sentinella di troncamento
// poteva vederla (s14 verifica il motore, non il banco).
//
// Il prezzo: la banda dichiarava di coprire l'88,5% e sul metro del prodotto ne
// copriva il 67,3%, con 9 gare su 11 sotto il livello dichiarato. Il divario si
// spiega senza residuo: dove il regime al giro della sosta e' gia' quello che si
// vede al congelamento la copertura e' l'84,2%; dove la neutralizzazione esce
// DOPO, il 32,9%. La banda era brava a coprire un mondo in cui si sa il futuro.
//
// Ora si chiede la stessa cosa che chiede il motore, allo stesso modo e allo
// stesso modulo (`regimeDiCella` di provenienza/definizioni.mjs): se la
// copertura scende, e' la copertura vera che scende — prima era il metro a
// essere generoso.

export function misuraRientro(gare, { rho, delta70, rodaggio = null, prior, cancelli }) {
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
          basiPerLf.set(Lf, stimaBasi(osservazioni, { delta70, rho, nGiri: gara.nGiri, finoA: Lf, minGiri: minGiriBase, rodaggio }));
        }
        const basi = basiPerLf.get(Lf);
        const regime = regimeDiCella(alCongelamento);
        const perdita = perditaBox(prior, nomeGara, regime);
        if (perdita.fallback) gareFallback.add(nomeGara);

        const r = simulate({
          state: confrontabili.map(({ drv: d, cum_time, tyre_age }) => ({ drv: d, lap: Lf, cum_time, tyre_age })),
          pace: creaPasso({ delta70, rho, nGiri: gara.nGiri, basi, rodaggio }),
          freezeLap: Lf,
          steps: STEPS,
          pits: { [drv]: [{ lap: L, perdita: perdita.perdita }] },
        });
        // Solo chi ha un cum PREVISTO numerico entra nel confronto: chi esce
        // con null non riceve una posizione inventata (regola 6).
        const insieme = confrontabili.filter((c) => r.cum[c.drv] !== null);
        if (!insieme.some((c) => c.drv === drv)) { scarta('il pilota non ha passo: previsione null, nessuna posizione'); continue; }
        if (insieme.length < minPiloti) { scarta(`meno di ${minPiloti} piloti confrontabili`); continue; }

        // LA POSIZIONE PREVISTA si conta nel campo del MOTORE (e' quella che il
        // pannello stampa). LA POSIZIONE VERA si conta nel campo VERO — tutte le
        // auto che a quel giro hanno un cumulato — perche' e' quella che l'utente
        // conta guardando la gara.
        //
        // Prima si contavano ENTRAMBE dentro il campo del motore, e la banda
        // copriva benissimo un errore che l'utente non vede: il motore lascia
        // fuori chi non ha un passo misurato (misurato: il suo campo e' ampio 17
        // dove il vero e' 20, e i mancanti sono quasi tutti DAVANTI), quindi
        // "P9 su 17" e "P9 su 20" non sono la stessa promessa. Il divario fra
        // l'88,5% dichiarato e il 67,3% misurato sul prodotto nasceva per meta'
        // qui e per meta' dal regime letto dal futuro (corretto sopra).
        //
        // Da ora la banda si tara su cio' che l'utente sperimenta. Se il numero
        // scende, e' perche' era il metro a essere gentile.
        const prevista = rango(insieme, (c) => r.cum[c.drv], drv);
        const campoVero = [];
        for (const [altro, altreCelle] of gara.perPilota) {
          const b = altreCelle.get(L + 1);
          if (b && b.cum_time !== null) campoVero.push({ drv: altro, cumReale: b.cum_time });
        }
        const reale = rango(campoVero, (c) => c.cumReale, drv);

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
