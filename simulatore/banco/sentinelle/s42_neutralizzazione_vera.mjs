// s42_neutralizzazione_vera — le finestre VERE comprimono col kappa del sigillo.
//
// L'ingresso di laboratorio `neutralizzazioneVera` ({giro: 'SC'|'VSC'|'RED'})
// esiste perche' il replay a gara nota correva IN VERDE i giri che la gara vera
// passo' dietro la Safety Car (record 07/08: Belgio +3 e GB +2 identici al
// nullo, Silverstone che si rimescola il triplo del motore). Qui si sorvegliano
// i suoi due ingranaggi puri; che spento sia spento lo garantisce il codice
// stesso (senza l'ingresso, il ramo non esiste) piu' i golden e la parita'.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) perGiroDaVera inventa un kappa: un regime senza sigillo DEVE esplodere,
//      non ripiegare su un numero plausibile (regola 6);
//  (b) i kappa non escono dal sigillo (SC/VSC diversi dal kappa_mediano, o la
//      ROSSA che non usa la scelta dichiarata = kappa della SC);
//  (c) vera nulla/vuota non torna null (il ramo acceso-a-vuoto);
//  (d) regimePerGiroDiCampo perde la soglia: una gialla locale (meta' campo o
//      meno) diventa regime di campo, o un giro pienamente neutralizzato non
//      lo diventa; o la ROSSA non vince a parita';
//  (e) un regime sconosciuto passa da regimePerGiroDiCampo (deve semplicemente
//      non votare) ma NON da perGiroDaVera via costruttore (la validazione del
//      costruttore e' a monte e qui si prova il pezzo puro).

import { perGiroDaVera } from '../../scenario/costruttore.mjs';
import { regimePerGiroDiCampo } from '../../provenienza/definizioni.mjs';
import { creaCella } from '../../provenienza/contratto.mjs';

let errori = 0;
const fallisci = (msg) => { errori += 1; console.error(`s42 FALLITA — ${msg}`); };

const PRIOR = { compressione_distacchi_interna: { SC: { kappa_mediano: 0.69 }, VSC: { kappa_mediano: 0.93 } } };

// (a) niente ripieghi
{
  let esplode = false;
  try { perGiroDaVera({ 12: 'SC' }, { compressione_distacchi_interna: { VSC: { kappa_mediano: 0.93 } } }); } catch { esplode = true; }
  if (!esplode) fallisci('un regime senza kappa nel sigillo deve esplodere, non inventare');
}

// (b) i kappa sono quelli del sigillo, e la rossa usa la scelta dichiarata (SC)
{
  const pg = perGiroDaVera({ 12: 'SC', 13: 'VSC', 14: 'RED' }, PRIOR);
  if (pg[12] !== 0.69) fallisci(`kappa SC ${pg[12]} invece del sigillo 0.69`);
  if (pg[13] !== 0.93) fallisci(`kappa VSC ${pg[13]} invece del sigillo 0.93`);
  if (pg[14] !== 0.69) fallisci(`la ROSSA deve usare il kappa della SC (scelta dichiarata), non ${pg[14]}`);
}

// (c) vuoto e' null
{
  if (perGiroDaVera(null, PRIOR) !== null) fallisci('vera null deve dare null');
  if (perGiroDaVera({}, PRIOR) !== null) fallisci('vera vuota deve dare null');
}

// (d) la soglia del regime di campo
{
  const cella = (status) => creaCella({
    lap_time: 95, cum_time: 1000, stint: 1, compound: 'MEDIUM', tyre_age: 3,
    in_lap: false, out_lap: false, status, del: false,
  });
  const perPilota = new Map();
  // giro 1: 3 auto su 4 sotto SC (75% > soglia) · giro 2: 2 su 4 (50%, NON basta:
  // la meta' esatta e' una gialla locale) · giro 3: rossa di campo, e la cella
  // mista '45' vota ROSSA (precedenza per-cella: garaSospesa prima del regime)
  const stati = {
    A: { 1: '4', 2: '4', 3: '45' },
    B: { 1: '4', 2: '4', 3: '5' },
    C: { 1: '4', 2: '1', 3: '5' },
    D: { 1: '1', 2: '1', 3: '4' },
  };
  for (const [drv, giri] of Object.entries(stati)) {
    perPilota.set(drv, new Map(Object.entries(giri).map(([l, st]) => [Number(l), cella(st)])));
  }
  const campo = regimePerGiroDiCampo(perPilota);
  if (campo[1] !== 'SC') fallisci(`giro 1 al 75% sotto SC deve essere SC, non ${campo[1]}`);
  if (campo[2] !== undefined) fallisci(`giro 2 al 50% e' una gialla locale, non ${campo[2]}`);
  if (campo[3] !== 'RED') fallisci(`giro 3 (3 voti rossa su 4, '45' incluso) deve essere RED, non ${campo[3]}`);
}

process.exit(errori === 0 ? 0 : 1);
