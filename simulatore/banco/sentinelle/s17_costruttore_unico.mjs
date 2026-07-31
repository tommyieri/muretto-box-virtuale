// s17_costruttore_unico — due risposte, UNA fisica (E17), e l'orizzonte legato
// al modello (E20).
//
// Nel vecchio repo `confrontaPit` rispondeva senza SC e senza deriva mentre
// `evaluatePit` rispondeva con: due risposte adiacenti che si contraddicevano.
// Qui si prova che non può succedere, perché le due risposte generano
// letteralmente lo stesso ingresso del kernel.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) "dove rientri" e "quando fermarti", sullo STESSO scenario, generano
//      soste diverse: sarebbe E17 che rinasce, con due fisiche per due
//      domande adiacenti;
//  (b) il minimo della curva non coincide con l'ottimo del banco G0″ sulla gara
//      di riferimento: il prodotto consiglierebbe un giro diverso da quello che
//      il banco misura come ottimo, e nessuno dei due saprebbe di essere in
//      disaccordo con l'altro;
//  (c) l'orizzonte non è legato al modello: se il modello dichiara di essere
//      validato fino a N giri e lo scenario ne proietta di più senza metterlo a
//      referto, l'assunzione sparisce dalla vista (E20);
//  (d) l'assunzione sulle soste dei rivali sotto neutralizzazione non è
//      dichiarata col suo conteggio, o viene applicata anche in verde;
//  (e) la forma della curva dipende dalla perdita ai box in verde: NON deve,
//      perché è la stessa per tutti i candidati e si cancella nella differenza.
//      Qui si verifica invece di affermarlo;
//  (f) una risposta esce senza passare dal Director, o esce con un numero
//      quando il Director l'ha respinta (deve uscire null — regola 6).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { caricaPrior } from '../../provenienza/pitloss.mjs';
import { caricaCostanti } from '../../scenario/director.mjs';
import { costruisciScenario, doveRientri, curvaDelQuando } from '../../scenario/costruttore.mjs';
import { misuraG0 } from '../misure/g0.mjs';

const b = banco('s17');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const cancelli = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'cancelli_banco.json'), 'utf8'));
const gare = caricaGare2026(radice);

// Scenario di riferimento: gara vera, congelamento in verde.
const GARA = 'Ungheria';
const LF = 30;
const PILOTA = 'ALB';
const MESCOLA = 'HARD';
const GIRO_PIT = 35;

const contesto = {
  gare, modello,
  // la distanza di gara e' un INGRESSO dichiarato, non si deduce (vedi s14)
  nGiriGara: gare[GARA].nGiri,
  prior: caricaPrior(radice),
  costantiDirector: caricaCostanti(radice),
};

// (a) STESSA FISICA: le due risposte generano le stesse soste
{
  const scenario = costruisciScenario({ gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA }, contesto);
  const rientro = doveRientri({ gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA }, contesto);
  b.uguale('"dove rientri" genera le soste del costruttore', rientro.pits, scenario.pits);

  // la curva costruisce lo stesso scenario per il candidato corrispondente
  const dalCostruttore = costruisciScenario(
    { gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA },
    { ...contesto, giroFinale: gare[GARA].nGiri },
  );
  b.uguale('"quando fermarti" e "dove rientri" pagano la stessa perdita allo stesso giro',
    dalCostruttore.pits, rientro.pits);
  b.verifica('la perdita porta la sua targhetta', typeof rientro.perdita.targhetta === 'string' && rientro.perdita.targhetta.length > 0);
}

// (b) il minimo della curva coincide con l'ottimo del banco G0″
{
  const curva = curvaDelQuando({ gara: GARA, freezeLap: LF, pilota: PILOTA, mescola: MESCOLA }, contesto);
  b.verifica('la curva è approvata', curva.approvato === true);
  b.verifica('la curva ha un minimo', curva.minimo !== null);
  b.uguale('il minimo della curva vale 0 (è la differenza dal migliore)', curva.minimo.delta_s, 0);

  const g0 = misuraG0({ [GARA]: gare[GARA] }, {
    rho: modello.rho.valore,
    delta70: modello.delta_70.scelto,
    prior: contesto.prior,
    cancelli: { ...cancelli.g0_secondo, congelamenti: [LF] },
  });
  const caso = g0.casi.find((c) => c.drv === PILOTA && c.Lf === LF);
  b.verifica(`il banco G0″ ha un caso per ${PILOTA}@${LF}`, caso !== undefined);
  if (caso) {
    const giriOttimiDelBanco = caso.argmin.map((k) => LF + k);
    b.verifica(
      `il minimo della curva (giro ${curva.minimo.giroPit}) è l'ottimo del banco (giri ${giriOttimiDelBanco})`,
      giriOttimiDelBanco.includes(curva.minimo.giroPit),
    );
    b.verifica('il caso del banco passa G0″', caso.passa === true);
  }

  // (c) l'orizzonte è legato al modello e l'eccedenza è a referto
  b.uguale('il giro finale della curva è la fine della gara', curva.orizzonte.giroFinale, gare[GARA].nGiri);
  b.uguale('l\'orizzonte validato viene dal modello', curva.orizzonte.orizzonte_validato,
    Math.max(...modello.delta_70.decisione.orizzonti_validati));
  b.verifica('proiettare oltre il validato è dichiarato', curva.orizzonte.oltre_il_validato === true);
  b.verifica('...e messo a referto fra le assunzioni',
    curva.assunzioni.some((a) => a.codice === 'OLTRE_ORIZZONTE_VALIDATO' && a.conteggio > 0));

  // (e) la forma della curva NON dipende dalla perdita ai box in verde
  const priorAlterato = JSON.parse(JSON.stringify(contesto.prior));
  priorAlterato.circuiti._fallback.mediana_green_s = 45;
  for (const c of Object.values(priorAlterato.circuiti)) if (c.mediana_green_s !== undefined) c.mediana_green_s = 45;
  const conAltraPerdita = curvaDelQuando({ gara: GARA, freezeLap: LF, pilota: PILOTA, mescola: MESCOLA }, { ...contesto, prior: priorAlterato });
  b.uguale('raddoppiando la perdita ai box in verde la curva non cambia di forma',
    conAltraPerdita.curva.map((p) => p.delta_s), curva.curva.map((p) => p.delta_s));
  b.verifica('...e la nota lo dichiara', /si cancella nella differenza/.test(curva.nota_banda));
  b.uguale('senza candidati neutralizzati non c\'è banda', curva.banda_presente, false);
}

// (d) l'assunzione sui rivali: dichiarata col conteggio, e solo sotto regime
{
  const inVerde = costruisciScenario({ gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA }, contesto);
  b.verifica('in verde non si assumono soste dei rivali',
    !inVerde.assunzioni.some((a) => a.codice === 'SOSTE_RIVALI_SC'));
  b.uguale('in verde la sosta è una sola: la mia', Object.keys(inVerde.pits), [PILOTA]);

  // un congelamento realmente sotto neutralizzazione, cercato nel grezzo
  let trovato = null;
  for (const [nomeGara, gara] of Object.entries(gare)) {
    for (const [drv, celle] of gara.perPilota) {
      for (const [lap, cella] of celle) {
        if (trovato || lap < 10 || lap > gara.nGiri - 5) continue;
        if (cella.status !== null && /[46]/.test(cella.status) && cella.cum_time !== null && cella.tyre_age !== null) {
          trovato = { nomeGara, drv, lap };
        }
      }
    }
  }
  b.verifica('nel grezzo esiste un congelamento sotto neutralizzazione da provare', trovato !== null);
  if (trovato) {
    const sotto = costruisciScenario(
      { gara: trovato.nomeGara, freezeLap: trovato.lap, pilota: trovato.drv, giroPit: trovato.lap + 1, mescola: MESCOLA },
      { ...contesto, nGiriGara: gare[trovato.nomeGara].nGiri },
    );
    const assunzione = sotto.assunzioni.find((a) => a.codice === 'SOSTE_RIVALI_SC');
    b.verifica(`${trovato.nomeGara}@${trovato.lap}: l'assunzione sui rivali è dichiarata`, assunzione !== undefined);
    if (assunzione) {
      b.verifica('...col conteggio di quanti rivali coinvolge', Number.isInteger(assunzione.conteggio));
      b.uguale('...e le soste generate sono tante quante il conteggio più la mia',
        Object.keys(sotto.pits).length, assunzione.conteggio + 1);
      b.verifica('...e ogni rivale assunto è ancora al primo stint',
        Object.keys(sotto.pits).every((d) => d === trovato.drv || sotto._interno.celleAlCongelamento.get(d).stint === 1));
    }
    b.verifica('il fattore di neutralizzazione è dichiarato come prior CON BANDA',
      sotto.assunzioni.some((a) => a.codice === 'FATTORE_NEUTRALIZZAZIONE' && /BANDA/.test(a.targhetta)));
    b.verifica('la perdita sotto regime è minore di quella verde',
      sotto.perdita.perdita < sotto.perdita.perdita_verde);
  }
}

// (f) ogni risposta passa dal Director, e una risposta respinta esce null
{
  const rientro = doveRientri({ gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA }, contesto);
  b.verifica('"dove rientri" porta l\'esito del Director', typeof rientro.direttore?.approved === 'boolean');
  b.verifica('...ed è approvato sullo scenario di riferimento', rientro.approvato === true);
  b.verifica('...e la posizione è un numero', Number.isInteger(rientro.posizione));

  // Director reso impossibile da soddisfare: la risposta deve uscire NULL
  const costantiAssurde = JSON.parse(JSON.stringify(contesto.costantiDirector));
  costantiAssurde.limiti.margine_pavimento_s.valore = -1000; // pavimento sopra ogni tempo reale
  const respinta = doveRientri({ gara: GARA, freezeLap: LF, pilota: PILOTA, giroPit: GIRO_PIT, mescola: MESCOLA },
    { ...contesto, costantiDirector: costantiAssurde });
  b.verifica('con un Director impossibile la risposta è respinta', respinta.approvato === false);
  b.uguale('...e la posizione è null, non un numero (regola 6)', respinta.posizione, null);
  b.verifica('...con le violazioni a referto', respinta.direttore.violazioni.length > 0);
}

b.chiudi();
