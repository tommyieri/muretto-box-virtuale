#!/usr/bin/env node
// scrivi_esito_multistint.mjs — mette a referto l'esito della Fase Multi-Stint.
//
// Non ricalcola niente: legge le misure da `misura_tutto.mjs`, che è l'unica
// implementazione dei cancelli (regola 1). Se questo file rifacesse i conti, il
// numero pubblicato e il numero sorvegliato potrebbero divergere in silenzio.
//
// Uso: node banco/scrivi_esito_multistint.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { misuraTutto, leggiCancelli } from './misura_tutto.mjs';

export const PERCORSO_ESITO = 'banco/prereg/ESITO_multistint.json';

export function costruisciEsito(radice) {
  const r = misuraTutto(radice);
  const m = r.multistint;
  const cancelli = leggiCancelli(radice).multistint;
  const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const q = cancelli.quota_passaggio_richiesta;
  const passa = m.m1.forma_chiusa.quota >= q && m.m1.ricerca.quota >= q && m.m1.k_ottimo.quota >= q
    && m.m2.quota >= q && m.m3.quota >= q && m.m3.cieco === false && m.m4.quota >= q;

  return {
    _targhetta: {
      tipo: 'ESITO di fase — cancelli M1…M4 eseguiti come pre-registrati',
      prereg: 'banco/prereg/PREREG_multistint.md',
      prodotto_da: 'banco/scrivi_esito_multistint.mjs, sulle misure di banco/misure/multistint.mjs',
      rho: modello.rho.valore,
      delta_70: modello.delta_70.scelto,
      data: '2026-07-30',
    },
    verdetto: passa ? 'PASSA — tutti e quattro i cancelli' : 'NON PASSA',
    M1: {
      domanda: 'la ricerca e la forma chiusa descrivono lo stesso oggetto del kernel?',
      n_casi: m.m1.n_casi,
      n_ammessi: m.m1.n_ammessi,
      n_al_bordo: m.m1.n_al_bordo,
      forma_chiusa: `${m.m1.forma_chiusa.passati}/${m.m1.n_ammessi}`,
      ricerca_ristretta: `${m.m1.ricerca.passati}/${m.m1.n_casi}`,
      k_ottimo: `${m.m1.k_ottimo.passati}/${m.m1.k_ottimo.n}`,
      bordo_diagnostica: m.m1.bordo_diagnostica,
      nota_ricerca: 'la ricerca del prodotto non enumera: parte dalla forma chiusa e raffina entro un raggio dichiarato. Il banco enumera TUTTI i piani interi e verifica che la restrizione non perda l\'ottimo — è ciò che autorizza a non enumerare in produzione',
    },
    M2: {
      domanda: 'il piano a una sosta è lo scenario a una sosta, o sono rimasti due percorsi?',
      n_casi: m.m2.n_casi,
      passati: m.m2.passati,
      nota: 'identità ESATTA fra la scrittura {giroPit, mescola} e il piano a una sosta: stesse soste, stesso cum. Non «differenza piccola»',
    },
    M3: {
      domanda: 'il piano rispetta il regolamento 2026, e il controllo non è cieco?',
      n_casi: m.n_casi_reali,
      approvati_dal_director: m.m3.approvati,
      obbligati_dal_regolamento: m.m3.n_obbligati_a_fermarsi,
      obbligati_con_sosta_nel_piano: m.m3.obbligati_con_sosta,
      cieco: m.m3.cieco,
      difetto_trovato: 'alla prima esecuzione M3 approvava 9 piani a ZERO soste per piloti che al congelamento avevano usato una sola mescola slick — cioè 9 squalifiche proposte come strategia. Il Director li lasciava passare perché `strategia_dichiarata` era legata a «ha almeno una sosta», e un piano a zero soste risultava «strategia non dichiarata»: la regola veniva saltata esattamente dove serviva. Corretti due punti: la strategia di chi fa la domanda è dichiarata sempre, e la ricerca tratta le due mescole come VINCOLO (k ≥ 1), non come preferenza',
    },
    M4: {
      domanda: 'le durate di stint 2026 sono allarmi, o sono diventate vincoli?',
      n_casi: m.n_casi_reali,
      piani_identici_a_allarmi_spenti: m.m4.identici,
      nota: 'spegnere il modulo degli allarmi non cambia un solo piano: le decisioni dei muretti non entrano nella ricerca',
    },
    distribuzione_soste_proposte: m.distribuzione_k,
    limite_dichiarato: {
      enunciato: 'il modello propone POCHE soste, e lo fa per una ragione strutturale, non per un difetto della ricerca',
      spiegazione: 'la forma chiusa dà (k+1)* = (R+a)·√(ρ/2P). Con ρ = 0,0308 s/giro·giro e una perdita ai box di 18-28 s, su una gara intera (R ≈ 57, a = 0) viene k* ≈ 0,5: zero o una sosta. La realtà ne fa una o due. La differenza non è un errore di calcolo: il modello v2 ha un degrado LINEARE e nessun cliff, quindi non sa che una gomma molto vecchia peggiora più che proporzionalmente — ed è proprio quel peggioramento che in gara giustifica la sosta in più',
      conseguenza: 'il piano proposto è l\'ottimo DI QUESTO MODELLO, non l\'ottimo della gara vera, e sbaglierà sempre nella stessa direzione: troppo poche soste. Va scritto accanto al piano, in pagina',
      cosa_lo_toglierebbe: 'una misura del cliff di fine vita, con la sua prereg e il suo cancello. §Cosa NON costruire al giorno 1 la esclude oggi, e questa fase non l\'ha introdotta di straforo per far tornare i numeri',
    },
    k_ottimo_continuo_per_combinazione: m.m1.k_ottimo.casi,
  };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const esito = costruisciEsito(radice);
  writeFileSync(path.join(radice, PERCORSO_ESITO), JSON.stringify(esito, null, 2) + '\n');
  console.log(`${esito.verdetto}\n`);
  console.log(`  M1 forma chiusa ${esito.M1.forma_chiusa} ammessi · ricerca ${esito.M1.ricerca_ristretta} · k ottimo ${esito.M1.k_ottimo}`);
  console.log(`  M2 ${esito.M2.passati}/${esito.M2.n_casi}   M3 ${esito.M3.approvati_dal_director}/${esito.M3.n_casi}   M4 ${esito.M4.piani_identici_a_allarmi_spenti}/${esito.M4.n_casi}`);
  console.log(`  soste proposte: ${Object.entries(esito.distribuzione_soste_proposte).map(([k, n]) => `k=${k}: ${n}`).join(' · ')}`);
  console.log(`\n  LIMITE: ${esito.limite_dichiarato.enunciato}`);
  console.log(`  → ${PERCORSO_ESITO}`);
}
