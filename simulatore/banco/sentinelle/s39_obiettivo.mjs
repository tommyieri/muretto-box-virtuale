#!/usr/bin/env node
// s39_obiettivo — l'obiettivo del pianificatore fa quello che dice, e SPENTO non esiste.
//
// Prereg: ai_lab/pianificatore/PREREG_obiettivo_posizione.md · esito: ESITO_obiettivo_posizione.md
//
// Dal 04/08/2026 `pianoOttimo` accetta `obiettivo`: 'tempo' (quello di sempre) o
// 'posizione' (lessicografico posizione-poi-tempo). I cancelli hanno detto NON SI SPEDISCE
// — l'obiettivo nuovo cambia la scelta in 5 casi su 167, tutti a Monaco — quindi il ramo
// resta e resta SPENTO. Un ramo spento e' accettabile solo se spento e' indistinguibile
// dal non averlo scritto, e a dirlo dev'essere un'asserzione, non un commento.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il comparatore con 'tempo' non e' identico al confronto sul solo cumulato — cioe'
//      il valore di riserva ha cambiato il motore di oggi;
//  (b) con 'posizione' la posizione NON ha la precedenza sul tempo, o non c'e' il
//      pareggio-poi-tempo: allora non e' lessicografico, e' qualcos'altro;
//  (c) un piano non valutabile (totale null) vince un confronto — regola 6: un piano che
//      non si sa valutare non e' un piano veloce;
//  (d) un obiettivo sconosciuto viene accettato in silenzio invece di fermare la linea.
import { meglioDi, OBIETTIVI } from '../../scenario/piano.mjs';
import { banco } from '../asserzioni.mjs';

const b = banco('s39');

const P = (posizione, totale) => ({ posizione, totale, popolazione: 20 });

// ── (a) 'TEMPO' E' IL MOTORE DI OGGI, e non «quasi» ─────────────────────────
//
// Il confronto di prima era `x.totale < m.totale - 1e-9`. Si prova su una griglia che
// include la tolleranza: se il comparatore la perdesse, due piani a un nanosecondo di
// distanza comincerebbero a scambiarsi l'ordine e la scelta diventerebbe instabile.
{
  let diversi = 0; let coppie = 0;
  for (let ta = 100; ta <= 102; ta += 0.5) {
    for (let tb = 100; tb <= 102; tb += 0.5) {
      for (const pa of [1, 5, 20]) {
        for (const pb of [1, 5, 20]) {
          coppie += 1;
          const atteso = ta < tb - 1e-9;
          if (meglioDi(P(pa, ta), P(pb, tb), 'tempo') !== atteso) diversi += 1;
        }
      }
    }
  }
  b.uguale(`obiettivo 'tempo': identico al confronto sul solo cumulato su ${coppie} coppie`
    + ' — la posizione non deve entrarci per niente', diversi, 0);
  b.verifica('e la tolleranza di 1e-9 e\' ancora li\': due piani a 1e-12 non si scambiano',
    !meglioDi(P(1, 100), P(20, 100 + 1e-12), 'tempo'));
}

// ── (b) 'POSIZIONE' E' LESSICOGRAFICO, nei due versi ────────────────────────
{
  b.verifica('posizione migliore vince anche essendo PIU\' LENTA di dieci secondi',
    meglioDi(P(3, 110), P(4, 100), 'posizione'));
  b.verifica('posizione peggiore NON vince pur essendo piu\' veloce',
    !meglioDi(P(5, 100), P(4, 110), 'posizione'));
  b.verifica('a PARITA\' di posizione decide il tempo (piu\' veloce vince)',
    meglioDi(P(4, 100), P(4, 101), 'posizione'));
  b.verifica('a parita\' di posizione il piu\' lento NON vince',
    !meglioDi(P(4, 101), P(4, 100), 'posizione'));
  // se la posizione manca da un lato si ricade sul tempo: e' l'unico verso onesto, perche'
  // un rango assente non e' un rango peggiore
  b.verifica('posizione assente da un lato: decide il tempo, non si inventa un rango',
    meglioDi({ posizione: null, totale: 100 }, P(1, 101), 'posizione'));
}

// ── (c) UN PIANO NON VALUTABILE NON VINCE MAI (regola 6) ────────────────────
for (const ob of OBIETTIVI) {
  b.verifica(`${ob}: un piano con totale null non vince`, !meglioDi({ posizione: 1, totale: null }, P(20, 999), ob));
  b.verifica(`${ob}: null come candidato non vince`, !meglioDi(null, P(20, 999), ob));
  b.verifica(`${ob}: contro un migliore-corrente non valutabile vince il valutabile`, meglioDi(P(20, 999), null, ob));
}

// ── (d) UN OBIETTIVO SCONOSCIUTO NON PASSA IN SILENZIO ──────────────────────
//
// `meglioDi` con un obiettivo ignoto NON deve inventare: cade sul tempo. E' `pianoOttimo`
// a fermare la linea, e lo fa prima di valutare un solo piano. Qui si prova che il
// comparatore non ha un terzo comportamento nascosto.
b.verifica('obiettivo ignoto nel comparatore: si comporta come \'tempo\', non come una terza cosa',
  meglioDi(P(20, 100), P(1, 101), 'boh') === meglioDi(P(20, 100), P(1, 101), 'tempo'));

b.chiudi();
