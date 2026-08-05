#!/usr/bin/env node
// s38_tetto — il tetto al movimento e' ACCESO, e chi misura deve poterlo spegnere.
//
// Prereg: ai_lab/sorpasso/PREREG_soglia_sorpasso.md · esito dell'accensione:
// ai_lab/sorpasso/ESITO_aggancio_tetto.json
//
// PERCHE' ESISTE, E NON DUPLICA s34. s34 prova che il VINCOLO fa quello che dice dentro il
// kernel (pavimento, sorpasso sopra soglia, niente sotto, spento = bit-identico). Questa
// prova un'altra cosa, che il 04/08/2026 e' diventata la piu' fragile: come il vincolo
// ARRIVA al kernel.
//
// Il guasto da cui nasce e' vero e recente. `cancelli_vita.mjs` scriveva un parametro in
// `modello.vita_mescola` mentre il costruttore leggeva `contesto.vitaMescola ?? modello...`:
// dal giorno dell'accensione l'override era inerte, i due bracci di un confronto appaiato
// ricevevano lo stesso parametro, e il cancello usciva 0-0 con 167 pari — incapace di
// fallire, e verde. E22.
//
// Il tetto ha ESATTAMENTE la stessa forma di rischio, e ora e' acceso in produzione:
// qualunque banco che confronti «con vincolo» e «senza» deve poter ottenere il senza. Se
// `false` smettesse di spegnere, tutti gli A/B diventerebbero A/A in silenzio.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) `contesto.tetto === false` NON spegne — il braccio «senza vincolo» di ogni banco
//      diventa una copia del braccio «con»;
//  (b) un oggetto passato a mano NON ha la precedenza sul sigillo — chi misura non comanda;
//  (c) il sigillo acceso NON produce un tetto, o lo produce uguale per tutti i circuiti —
//      Monaco deve avere la sua soglia, o la misura non e' arrivata al motore;
//  (d) un circuito ASSENTE dal sigillo non prende la soglia comune (regola 6 al contrario:
//      qui l'assenza HA una risposta misurata, ed e' la comune);
//  (e) il sigillo SPENTO non e' indistinguibile dal non averlo.
import { risolviTetto } from '../../scenario/costruttore.mjs';
import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s38');
const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGILLO = JSON.parse(readFileSync(path.join(RADICE, 'data', 'modelli', 'soglia_sorpasso.json'), 'utf8'));

// ── (a) `false` spegne, anche col sigillo acceso ────────────────────────────
{
  const ctx = { sogliaSorpasso: SIGILLO, tetto: false };
  b.verifica('contesto.tetto === false spegne il tetto anche col sigillo ACCESO'
    + ' — senza questo, ogni banco A/B diventa A/A in silenzio (E22)',
  risolviTetto(ctx, 'Monaco') === null);
}

// ── (b) un oggetto imposto vince sul sigillo ────────────────────────────────
{
  const mio = { minGap: 9, sogliaSorpasso: 9, costoDuello: 9, costoSubito: 9 };
  const t = risolviTetto({ sogliaSorpasso: SIGILLO, tetto: mio }, 'Monaco');
  b.uguale('un tetto passato a mano ha la precedenza sul sigillo: chi misura comanda',
    JSON.stringify(t), JSON.stringify(mio));
}

// ── (c) il sigillo acceso arriva, e Monaco e' diverso dagli altri ───────────
{
  const monaco = risolviTetto({ sogliaSorpasso: SIGILLO }, 'Monaco');
  const spagna = risolviTetto({ sogliaSorpasso: SIGILLO }, 'Spagna');
  b.verifica('il sigillo acceso produce un tetto', monaco !== null && spagna !== null);
  b.verifica(`Monaco ha una soglia PROPRIA e piu' alta di tutte le altre`
    + ` (${monaco?.sogliaSorpasso} contro ${spagna?.sogliaSorpasso})`
    + ' — se fossero uguali, il ramo «due livelli» dell\'esito non sarebbe arrivato al motore',
  monaco !== null && spagna !== null && monaco.sogliaSorpasso > spagna.sogliaSorpasso);
  b.verifica('i tre parametri non misurati viaggiano col sigillo (la produzione non legge da ai_lab/)',
    monaco !== null && [monaco.minGap, monaco.costoDuello, monaco.costoSubito].every((v) => typeof v === 'number' && Number.isFinite(v)));
}

// ── (d) un circuito ignoto prende la soglia COMUNE, non zero e non uno ──────
{
  const ignoto = risolviTetto({ sogliaSorpasso: SIGILLO }, 'Zandvoort');
  b.uguale('un circuito assente dal sigillo prende la soglia comune — e\' la misura, non un ripiego',
    ignoto?.sogliaSorpasso, SIGILLO.soglia_comune);
}

// ── (e) spento e' come non averlo ───────────────────────────────────────────
for (const spento of [{ ...SIGILLO, attivo: false }, null, undefined, {}]) {
  b.verifica(`sigillo ${spento === null ? 'null' : spento === undefined ? 'undefined' : (spento.attivo === false ? 'attivo:false' : 'vuoto')}: nessun tetto`,
    risolviTetto({ sogliaSorpasso: spento }, 'Monaco') === null);
}

b.chiudi();
