// misure_congelamento.mjs — il REGISTRO di tutto ciò che nel repo dichiara di
// essere "calcolato al congelamento Lf" (regola 5, E15).
//
// Ogni voce qui dentro viene eseguita da s14 su byLap INTERO e su byLap
// TRONCATO a Lf, e i due risultati devono essere identici. È la definizione
// operativa di "non sbircia il futuro", ed è la classe di test che nel vecchio
// repo ha beccato una fuga reale: la misura del gradino a congelamento leggeva
// fino a 6 giri dopo Lf.
//
// IL REGISTRO NON È DECORATIVO. s14 rifiuta la suite se in engine/ o scenario/
// esiste una funzione esportata con un parametro di congelamento (`freezeLap`,
// `finoA`) che non compare qui: aggiungere una misura a congelamento senza
// registrarla è il modo in cui E15 tornerebbe.
//
// Il lato "verità" delle metriche (il cum reale con cui ci si confronta) legge
// il futuro per costruzione: la regola vincola il lato PREVISIONE, ed è quello
// che sta qui.

import { simulate, statoAlCongelamento } from '../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../engine/passo_v2.mjs';
import { osservazioniVerdi, indicizza } from '../provenienza/gare_2026.mjs';
import { costruisciScenario, doveRientri, curvaDelQuando } from '../scenario/costruttore.mjs';
import { creaPiano, valutaPiano, pianoOttimo } from '../scenario/piano.mjs';
import { calibraDegrado } from '../live/calibrazione.mjs';
import { feedDaGara } from '../live/feed_archivio.mjs';

// Contesto minimo per le funzioni di scenario: la gara si ricostruisce dalle
// righe che la sentinella passa (intere o troncate), cosi' il troncamento
// arriva davvero fino in fondo invece di essere aggirato da una rilettura.
const contestoDa = (righe, ctx) => ({
  gare: { [ctx.nomeGara]: indicizza(righe) },
  // la distanza di gara è nota al congelamento e NON si deduce dalle righe
  // troncate: si passa esplicitamente (vedi costruisciScenario)
  nGiriGara: ctx.nGiri,
  modello: ctx.modello,
  prior: ctx.prior,
  costantiDirector: ctx.costantiDirector,
});
const pilotaDeterministico = (righe, Lf) =>
  [...new Set(righe.filter((r) => r.lap === Lf).map((r) => r.drv))].sort()[0];

export const MISURE_A_CONGELAMENTO = [
  {
    nome: 'statoAlCongelamento',
    modulo: 'engine/kernel.mjs',
    descrizione: 'lo stato di gara al giro Lf da cui parte ogni proiezione',
    esegui: (righe, Lf) => statoAlCongelamento(righe, Lf),
  },
  {
    nome: 'stimaBasi',
    modulo: 'engine/passo_v2.mjs',
    descrizione: 'la base per pilota, misurata togliendo δ e ρ ai giri ≤ Lf (regola 10)',
    esegui: (righe, Lf, ctx) => stimaBasi(osservazioniVerdi(righe), {
      delta70: ctx.delta70, rho: ctx.rho, nGiri: ctx.nGiri, finoA: Lf, minGiri: 8,
    }),
  },
  {
    nome: 'simulate',
    modulo: 'engine/kernel.mjs',
    descrizione: 'la proiezione del kernel dal congelamento, base compresa',
    esegui: (righe, Lf, ctx) => {
      const basi = stimaBasi(osservazioniVerdi(righe), {
        delta70: ctx.delta70, rho: ctx.rho, nGiri: ctx.nGiri, finoA: Lf, minGiri: 8,
      });
      return simulate({
        state: statoAlCongelamento(righe, Lf),
        pace: creaPasso({ delta70: ctx.delta70, rho: ctx.rho, nGiri: ctx.nGiri, basi }),
        freezeLap: Lf,
        steps: 10,
        pits: {},
      });
    },
  },
  {
    nome: 'costruisciScenario',
    modulo: 'scenario/costruttore.mjs',
    descrizione: 'l\'ingresso completo del kernel per uno scenario: soste, perdita, passo, orizzonte',
    esegui: (righe, Lf, ctx) => {
      const s = costruisciScenario(
        { gara: ctx.nomeGara, freezeLap: Lf, pilota: pilotaDeterministico(righe, Lf), giroPit: Lf + 2, mescola: 'HARD' },
        { ...contestoDa(righe, ctx), giroFinale: Lf + 6 },
      );
      // proiezione confrontabile: `pace` e `_interno` contengono funzioni e Map
      return { state: s.state, pits: s.pits, assunzioni: s.assunzioni, orizzonte: s.orizzonte, perdita: s.perdita };
    },
  },
  {
    nome: 'doveRientri',
    modulo: 'scenario/costruttore.mjs',
    descrizione: 'la posizione di rientro dopo la sosta',
    esegui: (righe, Lf, ctx) => {
      const r = doveRientri(
        { gara: ctx.nomeGara, freezeLap: Lf, pilota: pilotaDeterministico(righe, Lf), giroPit: Lf + 2, mescola: 'HARD' },
        contestoDa(righe, ctx),
      );
      return { approvato: r.approvato, posizione: r.posizione, su_quanti: r.su_quanti, pits: r.pits, davanti: r.davanti, dietro: r.dietro, gap_soppressi: r.gap_soppressi };
    },
  },
  {
    nome: 'curvaDelQuando',
    modulo: 'scenario/costruttore.mjs',
    descrizione: 'la curva del quando conviene fermarsi',
    esegui: (righe, Lf, ctx) => {
      const c = curvaDelQuando(
        { gara: ctx.nomeGara, freezeLap: Lf, pilota: pilotaDeterministico(righe, Lf), mescola: 'HARD' },
        { ...contestoDa(righe, ctx), giroFinale: Lf + 6 },
      );
      return { approvato: c.approvato, curva: c.curva, minimo: c.minimo };
    },
  },
  {
    nome: 'creaPiano',
    modulo: 'scenario/piano.mjs',
    descrizione: 'il piano gomme e i suoi stint, costruiti a partire dallo stato al congelamento',
    esegui: (righe, Lf, ctx) => {
      const drv = pilotaDeterministico(righe, Lf);
      const cella = indicizza(righe).perPilota.get(drv).get(Lf);
      return creaPiano({
        soste: [{ giro: Lf + 2, mescola: 'HARD' }, { giro: Lf + 4, mescola: 'MEDIUM' }],
        freezeLap: Lf, giroFinale: Lf + 6,
        mescolaAlCongelamento: cella.compound, etaAlCongelamento: cella.tyre_age ?? 0,
      });
    },
  },
  {
    nome: 'valutaPiano',
    modulo: 'scenario/piano.mjs',
    descrizione: 'quanto costa un piano: passa dal costruttore unico, quindi eredita il suo troncamento',
    esegui: (righe, Lf, ctx) => {
      const drv = pilotaDeterministico(righe, Lf);
      const cella = indicizza(righe).perPilota.get(drv).get(Lf);
      const piano = creaPiano({
        soste: [{ giro: Lf + 2, mescola: 'HARD' }],
        freezeLap: Lf, giroFinale: Lf + 6,
        mescolaAlCongelamento: cella.compound, etaAlCongelamento: cella.tyre_age ?? 0,
      });
      const v = valutaPiano({ gara: ctx.nomeGara, freezeLap: Lf, pilota: drv, piano }, contestoDa(righe, ctx));
      return { totale: v.totale, pits: v.scenario.pits };
    },
  },
  {
    nome: 'pianoOttimo',
    modulo: 'scenario/piano.mjs',
    descrizione: 'la RICERCA del piano migliore: se sbirciasse oltre Lf, il piano userebbe il futuro per scegliere il presente',
    esegui: (righe, Lf, ctx) => {
      const r = pianoOttimo(
        { gara: ctx.nomeGara, freezeLap: Lf, pilota: pilotaDeterministico(righe, Lf), giroFinale: Lf + 8, kMax: 2 },
        contestoDa(righe, ctx),
      );
      return { per_k: r.per_k, mescole_gia_usate: r.mescole_gia_usate, migliore: r.migliore ? { k: r.migliore.k, totale: r.migliore.totale, soste: r.migliore.piano.soste } : null };
    },
  },
  {
    nome: 'calibraDegrado',
    modulo: 'live/calibrazione.mjs',
    descrizione: 'il moltiplicatore di degrado live dai soli giri <= Lf — se sbircia oltre, G5 e\' un imbroglio',
    esegui: (righe, Lf, ctx) => calibraDegrado(righe, { finoA: Lf, rho: ctx.rho, delta70: ctx.delta70, nGiri: ctx.nGiri }),
  },
  {
    nome: 'feedDaGara',
    modulo: 'live/feed_archivio.mjs',
    descrizione: 'il feed d\'archivio troncato alla fonte: nessun record oltre Lf',
    esegui: (righe, Lf) => feedDaGara(indicizza(righe), { finoA: Lf }),
  },
];

/** I nomi registrati: s14 li confronta con ciò che i moduli esportano davvero. */
export const NOMI_REGISTRATI = new Set(MISURE_A_CONGELAMENTO.map((m) => m.nome));
