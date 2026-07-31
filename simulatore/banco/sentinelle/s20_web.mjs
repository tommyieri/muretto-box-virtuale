// s20_web — il cancello P08: nessun numero senza targhetta, e l'animazione non
// può contraddire il pannello.
//
// L'audit NON è un grep sui sorgenti: esegue i componenti VERI su ogni scenario
// demo e cammina il loro albero di output. Un numero senza targhetta, o un
// numero travestito da parola, viene trovato lì dove finirebbe in pagina.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un componente emette una quantità senza targhetta, o con una targhetta
//      malformata, su uno qualunque degli scenari demo (regola 2);
//  (b) un componente scrive un numero dentro un testo, aggirando la targhetta:
//      "rientri P14" come stringa passerebbe inosservato senza questo controllo;
//  (c) L'INVARIANTE: la posizione che la mappa calcola ordinando i punti da
//      disegnare, al giro di rientro, differisce da quella del pannello. È il
//      377/377 del vecchio repo: l'animazione non può contraddire il numero;
//  (d) il selettore Wet non è visibile, o è visibile e ATTIVO, o è spento senza
//      targhetta che dica perché (§Cosa non costruire al giorno 1);
//  (e) un gap non quantificabile sotto neutralizzazione esce come numero (o
//      come zero) invece di essere soppresso col motivo;
//  (f) la pagina calcola: un modulo del browser importa il kernel, il modello o
//      i coefficienti, o fa aritmetica su tempi sul giro (regola 8, E17);
//  (g) `creaTarghetta` accetta una targhetta invalida — se la guardia non
//      mordesse, tutto il resto di questa sentinella sarebbe teatro.

import { banco } from '../asserzioni.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { auditaAlbero, raccogliNumeri, creaTarghetta, num, formatta } from '../../web/targhette.mjs';
import { pannello } from '../../web/pannello.mjs';
import { curva } from '../../web/curva.mjs';
import { mappa, posizioneDallaMappa, ordineDelloStrato, statoMappa } from '../../web/mappa.mjs';
import { costruisciVistaDemo } from '../../web/genera_vista.mjs';

const b = banco('s20');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const vista = JSON.parse(readFileSync(path.join(radice, 'web', 'vista', 'demo.json'), 'utf8'));

b.verifica('la vista demo contiene scenari', Array.isArray(vista.scenari) && vista.scenari.length > 0);

// (g) la guardia delle targhette morde
b.esplode('natura sconosciuta: rifiutata', () => creaTarghetta({ natura: 'A_OCCHIO', testo: 'x', data: '2026-07-29' }));
b.esplode('targhetta senza data: rifiutata (regola 2)', () => creaTarghetta({ natura: 'MISURATO_FONDO', testo: 'x' }));
b.esplode('targhetta senza testo: rifiutata', () => creaTarghetta({ natura: 'MISURATO_FONDO', testo: '  ', data: '2026-07-29' }));
b.esplode('banda finta [null,null]: rifiutata', () => creaTarghetta({ natura: 'MISURATO_FONDO', testo: 'x', data: '2026-07-29', banda: [null, null] }));
b.esplode('numero senza targhetta: rifiutato', () => num(12.3, { unita: 's' }));
b.esplode('valore soppresso senza motivo: rifiutato', () => num(null, {
  targhetta: creaTarghetta({ natura: 'MODELLO_DICHIARATO', testo: 'x', data: '2026-07-29' }),
}));

// (a) + (b) l'audit su OGNI scenario demo, per OGNI componente
let quantitaTotali = 0;
for (const s of vista.scenari) {
  for (const [nome, componente] of [['pannello', pannello], ['curva', curva], ['mappa', mappa]]) {
    const albero = componente(vista, s);
    const violazioni = auditaAlbero(albero, `${nome}@${s.gara}`);
    b.verifica(
      `${s.gara}/${nome}: nessun numero senza targhetta${violazioni.length ? ` — ${violazioni.slice(0, 3).map((v) => `${v.tipo} in ${v.percorso}: ${v.dettaglio}`).join(' | ')}` : ''}`,
      violazioni.length === 0,
    );
    const numeri = raccogliNumeri(albero);
    quantitaTotali += numeri.length;
    for (const n of numeri) {
      b.verifica(`${s.gara}/${nome}: la targhetta dichiara la data`, typeof n.targhetta.data === 'string' && n.targhetta.data.length > 0);
      b.verifica(`${s.gara}/${nome}: la targhetta si può leggere`, typeof formatta(n) === 'string');
    }
  }
}
b.verifica(`l'audit ha davvero guardato delle quantità (${quantitaTotali})`, quantitaTotali > 100);

// (c) L'INVARIANTE animazione ↔ pannello, su tutte le gare demo
{
  let conMappa = 0;
  for (const s of vista.scenari) {
    if (!s.mappa.giri || s.mappa.giri.length === 0) continue;
    conMappa += 1;
    const dallaMappa = posizioneDallaMappa(s);
    b.uguale(
      `${s.gara}: la posizione della MAPPA al giro ${s.pannello.giro_di_rientro} è quella del PANNELLO`,
      dallaMappa, s.pannello.posizione,
    );
    // lo strato reale esiste sempre: la mappa non si spegne mai
    const ordineReale = ordineDelloStrato(s, s.pannello.giro_di_rientro, 'reale');
    b.verifica(`${s.gara}: lo strato reale esiste al giro di rientro (la mappa non si spegne)`, Array.isArray(ordineReale) && ordineReale.length > 0);
    // e il fantasma sta SOPRA il reale, non al posto: entrambi gli strati hanno punti
    const stato = statoMappa(s, s.pannello.giro_di_rientro);
    b.verifica(`${s.gara}: entrambi gli strati sono disegnati`,
      stato.punti.some((p) => p.strato === 'reale') && stato.punti.some((p) => p.strato === 'fantasma'));
    // la sosta si vede: al giro di ingresso il mio pilota è in corsia
    const giroIngresso = s.freeze_lap + 1;
    const frameIngresso = statoMappa(s, giroIngresso);
    b.verifica(`${s.gara}: al giro ${giroIngresso} il pilota è in corsia box (la sosta si vede)`,
      frameIngresso.in_corsia.includes(s.pilota));
  }
  b.verifica(`l'invariante è stato provato su abbastanza gare demo (${conMappa})`, conMappa >= 11);
}

// (d) il selettore Wet: visibile, spento, con targhetta
{
  const bagnate = vista.mescole.filter((m) => ['INTERMEDIATE', 'WET'].includes(m.codice));
  b.uguale('le mescole da bagnato sono VISIBILI nel selettore', bagnate.length, 2);
  for (const m of bagnate) {
    b.uguale(`${m.codice} è spenta`, m.attiva, false);
    b.verifica(`${m.codice} dichiara perché è spenta`, /non ancora misurato/.test(m.motivo ?? ''));
  }
  for (const m of vista.mescole.filter((x) => ['SOFT', 'MEDIUM', 'HARD'].includes(x.codice))) {
    b.uguale(`${m.codice} è attiva`, m.attiva, true);
  }
  // e l'albero del pannello le disegna tutte, con la spenta disabilitata
  const s = vista.scenari[0];
  const albero = pannello(vista, s);
  const bottoni = [];
  const cerca = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(cerca); return; }
    if (n.attributi?.valore) bottoni.push(n);
    (n.figli ?? []).forEach(cerca);
  };
  cerca(albero);
  b.uguale('il pannello disegna cinque mescole', bottoni.length, 5);
  b.verifica('le bagnate sono disabilitate con il motivo nel titolo',
    bottoni.filter((x) => ['INTERMEDIATE', 'WET'].includes(x.attributi.valore))
      .every((x) => x.attributi.disabilitato === true && typeof x.attributi.titolo === 'string'));
}

// (e) gap soppressi sotto neutralizzazione: motivo, non zero
{
  const sotto = vista.scenari.filter((s) => s.regime !== null);
  b.verifica('il demo contiene almeno uno scenario sotto neutralizzazione', sotto.length > 0);
  for (const s of sotto) {
    b.verifica(`${s.gara}@${s.freeze_lap} (${s.regime}): i gap sono soppressi con motivo`,
      typeof s.pannello.gap_soppressi === 'string' && s.pannello.gap_soppressi.length > 0);
    for (const v of [s.pannello.davanti, s.pannello.dietro]) {
      if (v === null) continue;
      b.uguale(`${s.gara}: il gap è null, non uno zero che sembra un risultato`, v.gap_s, null);
      b.verifica(`${s.gara}: il gap null porta il motivo`, typeof v.motivo_soppressione === 'string');
    }
    // In pagina la quantità soppressa DEVE esistere come soppressa. Cercare solo
    // fra i null sarebbe un buco: se il gap diventasse uno 0, di null non ce ne
    // sarebbero e il controllo non guarderebbe niente (E09). Quindi prima si
    // pretende che la soppressione ci sia.
    const numeri = raccogliNumeri(pannello(vista, s));
    const soppresse = numeri.filter((x) => x.numero === null);
    const haVicini = s.pannello.davanti !== null || s.pannello.dietro !== null;
    if (haVicini) {
      b.verifica(`${s.gara}: il gap non quantificabile compare in pagina COME SOPPRESSO, non come numero`, soppresse.length > 0);
      b.verifica(`${s.gara}: nessun gap è stato mostrato come zero`,
        !numeri.some((x) => x.numero === 0 && x.unita === 's'));
    }
    for (const n of soppresse) {
      b.verifica(`${s.gara}: la quantità soppressa non si formatta come zero`, formatta(n) !== '0,0' && formatta(n) !== '0');
      b.verifica(`${s.gara}: la quantità soppressa porta il motivo`, typeof n.motivo_soppressione === 'string' && n.motivo_soppressione.length > 0);
    }
  }
}

// (f) la pagina NON calcola
{
  // Leggere un coefficiente dalla vista per MOSTRARLO è formattare; farci
  // aritmetica è modellare. Il divieto è sul secondo.
  const VIETATI = [
    [/from '\.\.\/(engine|scenario|provenienza|live)\//, 'importa dall\'albero della fisica: i numeri arrivano dalla vista (regola 8, E17)'],
    [/\b(rho|delta_?70)\s*[*/+-]\s*[\w(]/, 'fa aritmetica su un coefficiente del modello: la pagina formatta, non modella'],
    [/[\w)]\s*[*/]\s*\b(rho|delta_?70)\b/, 'fa aritmetica su un coefficiente del modello'],
    [/\b(lap_time|cum_time)\s*[*/+-]/, 'fa aritmetica sui tempi grezzi: quelli restano dietro la vista'],
  ];
  const DELBROWSER = ['pannello.mjs', 'curva.mjs', 'mappa.mjs', 'render.mjs', 'app.mjs', 'targhette.mjs'];
  for (const file of readdirSync(path.join(radice, 'web')).filter((f) => DELBROWSER.includes(f))) {
    const testo = readFileSync(path.join(radice, 'web', file), 'utf8')
      .split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');
    for (const [vietato, perche] of VIETATI) {
      b.verifica(`web/${file} ${perche}`, !vietato.test(testo));
    }
  }
  // e il generatore della vista, che invece PUÒ calcolare, lo fa passando dal Director
  const generatore = readFileSync(path.join(radice, 'web', 'genera_vista.mjs'), 'utf8');
  b.verifica('genera_vista.mjs prende i numeri da scenario/ (Director compreso)', /from '\.\.\/scenario\/costruttore\.mjs'/.test(generatore));

  // La mappa fa aritmetica sui cumulati per la GEOMETRIA (dove sta il pallino),
  // e questo è legittimo. Il vincolo forte è che nessuna quantità MOSTRATA dalla
  // mappa nasca da quell'aritmetica: ogni numero in pagina deve venire dalla
  // vista, o essere la posizione — che l'invariante inchioda al pannello.
  for (const s of vista.scenari) {
    if (!s.mappa.giri || s.mappa.giri.length === 0) continue;
    const ammessi = new Set([s.pannello.giro_di_rientro, s.stazionario_prior_s, s.pannello.posizione]);
    for (const n of raccogliNumeri(mappa(vista, s))) {
      if (n.numero === null) continue;
      b.verifica(
        `${s.gara}/mappa: la quantità mostrata ${n.numero} viene dalla vista o è la posizione (mai dall'aritmetica della pagina)`,
        ammessi.has(n.numero),
      );
    }
  }

  // la vista committata è quella che il generatore produce oggi (E22)
  const rigenerata = costruisciVistaDemo(radice);
  b.uguale('la vista committata coincide con quella rigenerata oggi',
    rigenerata.scenari.map((s) => ({ gara: s.gara, pos: s.pannello.posizione, min: s.minimo?.giroPit ?? null })),
    vista.scenari.map((s) => ({ gara: s.gara, pos: s.pannello.posizione, min: s.minimo?.giroPit ?? null })));
  // ...compreso il selettore mescole. Confrontare solo gli scenari lasciava un
  // buco reale: MESCOLE_SLICK si è allargata alle mescole 2018 per LEGGERE il
  // fondo, e il selettore ha continuato a mostrarne cinque solo perché la vista
  // committata era vecchia. Il controllo di freschezza vale su ciò che si
  // rigenera, non su una parte scelta.
  b.uguale('...e il selettore mescole è quello che il generatore produce oggi',
    rigenerata.mescole, vista.mescole);
}

b.chiudi();
