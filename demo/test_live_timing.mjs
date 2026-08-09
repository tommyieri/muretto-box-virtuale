// test_live_timing.mjs — collaudo del riduttore della torre timing su
// FORME EVENTO REALI del collettore (snapshot, driver_list,
// timing_update). Gira in Node: `node demo/test_live_timing.mjs`.
// Verifica ordinamento per posizione, gap dal leader, ultimo giro, pit.
// Non tocca il DOM (usa creaStatoTiming, il riduttore puro).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { creaStatoTiming } from './live_timing.mjs';

function caso(nome, fn) {
  fn();
  console.log('  ok  ' + nome);
}

// 1) snapshot -> classifica iniziale ordinata, leader senza gap
caso('snapshot: ordine per posizione e leader senza gap', () => {
  const s = creaStatoTiming();
  s.applica({
    type: 'snapshot',
    driver_list: {
      '1': { sigla: 'VER', colore: '#3671C6' },
      '16': { sigla: 'LEC', colore: '#E8002D' },
      '44': { sigla: 'HAM', colore: '#E8002D' },
    },
    cars: {
      '1': { x: 10, y: 20, pos: 1, gap: '', last_lap: '1:16.482', in_pit: false },
      '16': { x: 30, y: 40, pos: 2, gap: '+0.221', last_lap: '1:16.703' },
      '44': { x: 50, y: 60, pos: 3, gap: '+0.512', last_lap: '1:16.994' },
    },
  });
  const r = s.righe();
  assert.deepEqual(r.map(x => x.sigla), ['VER', 'LEC', 'HAM']);
  assert.equal(r[0].gap, '');            // leader: "" (reso "LEADER" in UI)
  assert.equal(r[1].gap, '+0.221');
  assert.equal(r[0].last_lap, '1:16.482');
});

// 2) timing_update diff -> aggiorna gap e posizioni (undercut in quali)
caso('timing_update: i diff riordinano la classifica', () => {
  const s = creaStatoTiming();
  s.applica({
    type: 'snapshot',
    driver_list: { '1': { sigla: 'VER', colore: '#3671C6' },
      '16': { sigla: 'LEC', colore: '#E8002D' },
      '44': { sigla: 'HAM', colore: '#E8002D' } },
    cars: { '1': { pos: 1, gap: '' }, '16': { pos: 2, gap: '+0.221' },
      '44': { pos: 3, gap: '+0.512' } },
  });
  // HAM migliora e scavalca LEC
  s.applica({ type: 'timing_update', cars: { '44': { pos: 2, gap: '+0.180' },
    '16': { pos: 3, gap: '+0.350' } } });
  const r = s.righe();
  assert.deepEqual(r.map(x => x.sigla), ['VER', 'HAM', 'LEC']);
  assert.equal(r[1].gap, '+0.180');
  assert.equal(r[2].gap, '+0.350');
});

// 3) driver_list additivo (pilota che entra dopo) + ultimo giro nuovo
caso('driver_list additivo + last_lap arriva dopo', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'snapshot', driver_list: { '1': { sigla: 'VER', colore: '#3671C6' } },
    cars: { '1': { pos: 1, gap: '' } } });
  s.applica({ type: 'driver_list', cars: { '81': { sigla: 'PIA', colore: '#F58020' } } });
  s.applica({ type: 'timing_update', cars: { '81': { pos: 2, gap: '+0.900', last_lap: '1:17.001' } } });
  const r = s.righe();
  assert.deepEqual(r.map(x => x.sigla), ['VER', 'PIA']);
  assert.equal(r[1].last_lap, '1:17.001');
  assert.equal(r[1].colore, '#F58020');
});

// 4) in_pit -> flag; posizione ignota -> in fondo
caso('in_pit e posizione ignota', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'snapshot', driver_list: { '1': { sigla: 'VER' }, '18': { sigla: 'STR' } },
    cars: { '1': { pos: 1, gap: '' }, '18': { in_pit: true } } });
  const r = s.righe();
  assert.equal(r[0].sigla, 'VER');
  assert.equal(r[1].sigla, 'STR');       // pos ignota -> in fondo
  assert.equal(r[1].pos, null);
  assert.equal(r[1].in_pit, true);
});

// 5) uno snapshot successivo RIALLINEA (riconnessione): niente residui
caso('snapshot successivo riallinea tutto', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'snapshot', driver_list: { '1': { sigla: 'VER' }, '16': { sigla: 'LEC' } },
    cars: { '1': { pos: 1, gap: '' }, '16': { pos: 2, gap: '+0.2' } } });
  s.applica({ type: 'snapshot', driver_list: { '44': { sigla: 'HAM' } },
    cars: { '44': { pos: 1, gap: '' } } });
  const r = s.righe();
  assert.deepEqual(r.map(x => x.sigla), ['HAM']);   // nessun residuo di VER/LEC
});

// 6) R2: settori, micro-settori, best lap, interval passano nel riduttore
caso('R2: sectors/micro/best_lap/interval', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'snapshot',
    driver_list: { '1': { sigla: 'VER', colore: '#3671C6' } },
    cars: { '1': { pos: 1, gap: '' } } });
  s.applica({ type: 'timing_update', cars: { '1': {
    best_lap: '1:41.234', interval: null,
    sectors: [{ t: '29.512', best: 'o' }, { t: '38.104', best: 'p' }, { t: null, best: null }],
    micro: [[2049, 2051, 2048], [2049, 2049], [0, 0, 0]] } } });
  const r = s.righe()[0];
  assert.equal(r.best_lap, '1:41.234');
  assert.equal(r.sectors.length, 3);
  assert.equal(r.sectors[0].best, 'o');
  assert.deepEqual(r.micro[0], [2049, 2051, 2048]);
});

// 7) i diff di settore aggiornano solo cio' che cambia
caso('R2: diff parziale su un solo settore', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'snapshot', driver_list: { '1': { sigla: 'VER' } },
    cars: { '1': { pos: 1, gap: '', sectors: [{ t: '29.5', best: null }] } } });
  s.applica({ type: 'timing_update', cars: { '1': { last_lap: '1:41.9' } } });
  const r = s.righe()[0];
  assert.equal(r.last_lap, '1:41.9');
  assert.equal(r.sectors[0].t, '29.5');   // il settore precedente persiste
});

// 8) NIENTE DATO DEL FEED IN innerHTML SENZA ESCAPE.
// Questo test e' nato da un difetto vero, trovato dall'audit di pre-pubblicazione del
// 31/07/2026: nella riga della torre ogni campo passava da esc() TRANNE `pos`, che
// finiva grezzo in innerHTML. I dati di questa torre arrivano da un WebSocket — cioe'
// da fuori — e con l'override ?ws= (allora aperto a qualunque indirizzo) quella era la
// via per far eseguire codice sull'origine del sito.
//
// Il controllo e' sul SORGENTE e non sul DOM di proposito: la funzione che disegna gira
// dentro requestAnimationFrame e in Node non c'e' DOM, ma soprattutto un test sul DOM
// prova UN campo alla volta, mentre qui il difetto e' "uno dei campi e' stato
// dimenticato". Si guardano quindi tutte le interpolazioni dentro i template della riga
// e si pretende che ognuna sia esc(...) oppure una funzione che restituisce un colore da
// un elenco chiuso (colSet, COL_SEG), oppure un campo gia' ripulito a monte.
//
// COSA LO FA FALLIRE: qualcuno aggiunge un campo alla riga della torre e lo interpola
// senza esc(). Provato: togliendo esc() da `pos` questo test esce 1.
// R3) LA GOMMA ARRIVA FINO IN FONDO. compound/tyre_age viaggiavano gia' sul cavo
// (live/replay.py li mette nei diff di timing_update; stint_poller.py li ricava da OpenF1)
// ma il riduttore non li elencava fra i CAMPI e li buttava: in diretta la classifica non
// diceva su che gomma sei. Un campo che cade nel riduttore non fa rumore — la torre si
// disegna lo stesso, solo senza quella cosa. Questo caso e' il rumore.
caso('R3: compound e tyre_age sopravvivono al riduttore', () => {
  const s = creaStatoTiming();
  s.applica({ type: 'driver_list', cars: { '4': { sigla: 'NOR', colore: '#FF8000' } } });
  s.applica({ type: 'timing_update', cars: { '4': { pos: 1, gap: '', compound: 'MEDIUM', tyre_age: 14 } } });
  let r = s.righe()[0];
  assert.equal(r.compound, 'MEDIUM', 'la mescola deve arrivare in riga');
  assert.equal(r.tyre_age, 14, "l'eta gomma deve arrivare in riga");

  // eta 0 e' un'eta VALIDA (giro d'uscita dai box): non deve diventare null
  s.applica({ type: 'timing_update', cars: { '4': { compound: 'SOFT', tyre_age: 0 } } });
  r = s.righe()[0];
  assert.equal(r.compound, 'SOFT', 'il cambio mescola deve propagarsi');
  assert.strictEqual(r.tyre_age, 0, "tyre_age 0 e' un'eta, non un'assenza");

  // chi non ha mai avuto notizie di gomma resta a null, non a stringa vuota (regola 6)
  const v = creaStatoTiming();
  v.applica({ type: 'timing_update', cars: { '9': { pos: 1 } } });
  assert.strictEqual(v.righe()[0].compound, null, 'mescola ignota => null');
  assert.strictEqual(v.righe()[0].tyre_age, null, 'eta ignota => null');
});

caso('nessun campo del feed entra in innerHTML senza escape', () => {
  const sorgente = fs.readFileSync(new URL('./live_timing.mjs', import.meta.url), 'utf8');
  // le interpolazioni ${...} dentro i template letterali del modulo
  const interpolazioni = [...sorgente.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.ok(interpolazioni.length > 8, `poche interpolazioni trovate (${interpolazioni.length}): il controllo non sta guardando niente`);
  const AMMESSE = [
    /^esc\(/,                       // esplicitamente ripulito
    /^colSet\(/,                    // colore da elenco chiuso
    /^COL_SEG\[/,                   // idem
    /^g\.(txt|cls)$/,               // gap(): txt passa gia' da esc(), cls e' interno
    /^r\.in_pit \? /,               // due letterali fissi
    /^html$/, /^sec$/, /^mic$/,     // pezzi di html gia' costruiti qui dentro
    /^barraMicro\(/,
    /^s\.t \? esc\(s\.t\) : /,
    /^tempo \? esc\(tempo\) : /,
  ];
  const nude = interpolazioni.filter((x) => !AMMESSE.some((re) => re.test(x)));
  assert.deepEqual(nude, [], `interpolazioni senza escape nella torre: ${JSON.stringify(nude)}`);
});

console.log('\nTUTTI I TEST OK (torre timing R2)');
