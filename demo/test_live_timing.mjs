// test_live_timing.mjs — collaudo del riduttore della torre timing su
// FORME EVENTO REALI del collettore (snapshot, driver_list,
// timing_update). Gira in Node: `node demo/test_live_timing.mjs`.
// Verifica ordinamento per posizione, gap dal leader, ultimo giro, pit.
// Non tocca il DOM (usa creaStatoTiming, il riduttore puro).

import assert from 'node:assert/strict';
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

console.log('\nTUTTI I TEST OK (torre timing R2)');
