#!/usr/bin/env node
// s44_vita_vincolo — il vincolo della vita fa quello che dice, e SPENTO non esiste.
//
// (Nata come s40 sul branch scomposizione-errore-piano; rinumerata s44 al merge del
// 07/08/2026 perche' main aveva gia' assegnato s40 all'inventario del codice.)
//
// Prereg: ai_lab/pianificatore/PREREG_vita_vincolo.md · esito: ESITO_vita_vincolo.md
//
// I cancelli hanno detto RIPORTATO, NON SPEDITO — il vincolo lega (20 piani su 167) e vince
// dove lega (15-5, p = 0,041), ma riduce il sotto-fermarsi solo da 114 a 102 contro i 90
// richiesti. Quindi il ramo resta e resta SPENTO, e spento dev'essere indistinguibile dal
// non averlo scritto.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) `vitaMassima` null/undefined NON e' bit-identico a non passarlo — cioe' il valore di
//      riserva ha cambiato il motore di oggi;
//  (b) il vincolo guarda l'eta' SBAGLIATA: deve leggere `eta_finale`, non i giri dello
//      stint, perche' lo stint al congelamento parte da un'eta' gia' consumata;
//  (c) una mescola SCONOSCIUTA viene vincolata: un'assenza non diventa mai un muro
//      (regola 6), e inventare un limite per una gomma che non si sa quale sia e' peggio
//      che non averne;
//  (d) un vincolo malformato viene ignorato in silenzio invece di non legare.
import { creaPiano, pianoFattibile } from '../../scenario/piano.mjs';
import { banco } from '../asserzioni.mjs';

const b = banco('s44');

/** Un piano con lo stint al congelamento gia' vecchio di `eta`, e una sosta al giro `sosta`. */
const piano = (eta, sosta, mescolaDopo = 'SOFT', mescolaPrima = 'HARD') => creaPiano({
  soste: [{ giro: sosta, mescola: mescolaDopo }],
  freezeLap: 10, giroFinale: 50,
  mescolaAlCongelamento: mescolaPrima, etaAlCongelamento: eta,
});

// ── (a) SPENTO E' SPENTO ────────────────────────────────────────────────────
{
  const p = piano(5, 20);
  for (const spento of [null, undefined, false, 0, '']) {
    b.verifica(`vitaMassima = ${JSON.stringify(spento)}: nessun piano e' infattibile`,
      pianoFattibile(p, spento) === true);
  }
}

// ── (b) SI GUARDA L'ETA' FINALE, NON I GIRI DELLO STINT ─────────────────────
//
// E' il caso che separa un vincolo giusto da uno che sembra giusto. Lo stint 1 dura 10 giri
// (dal 11 al 20) ma la gomma ci arriva con 5 giri gia' addosso: finisce a 15, non a 10.
{
  const p = piano(5, 20);
  const s1 = p.stint[0];
  b.uguale('lo stint al congelamento dura 10 giri', s1.giri, 10);
  b.uguale('...ma la gomma ci arriva a 15 di eta\'', s1.eta_finale, 15);
  b.verifica('un tetto a 12 sulla HARD lo rende INFATTIBILE (guarda l\'eta\', non i giri)',
    !pianoFattibile(p, { HARD: 12 }));
  b.verifica('un tetto a 20 sulla HARD lo lascia fattibile', pianoFattibile(p, { HARD: 20 }));
  // e se guardasse i giri invece dell'eta', un tetto a 12 lo lascerebbe passare: e' proprio
  // quella la riga che questo caso esiste per bocciare.
}

// ── (c) MESCOLA SCONOSCIUTA: nessun muro ────────────────────────────────────
{
  const p = piano(5, 20, 'SOFT', null); // al congelamento non si sa che gomma monta
  b.verifica('mescola sconosciuta al congelamento: quello stint non e\' vincolato (regola 6)',
    pianoFattibile(p, { SOFT: 99, HARD: 1 }));
  b.verifica('...ma lo stint DOPO, che la mescola ce l\'ha, lo e\' eccome',
    !pianoFattibile(p, { SOFT: 5 }));
}

// ── (d) UN VINCOLO MALFORMATO NON LEGA, e non esplode ───────────────────────
{
  const p = piano(5, 20);
  for (const rotto of [{ HARD: 'dodici' }, { HARD: null }, { HARD: NaN }, { ALTRO: 1 }]) {
    b.verifica(`vincolo malformato ${JSON.stringify(rotto)}: non lega invece di legare a caso`,
      pianoFattibile(p, rotto) === true);
  }
}

b.chiudi();
