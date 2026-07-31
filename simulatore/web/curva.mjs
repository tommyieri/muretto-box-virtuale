// curva.mjs — LA CURVA DEL QUANDO, l'elemento centrale della pagina.
//
// Asse dei giri, delta in secondi, minimo evidenziato, banda visibile SOLO dove
// i coefficienti sono prior. Non calcola: legge `curva` e `minimo` dalla vista.
//
// La banda merita una parola: dove tutti i candidati sono in verde NON c'è
// banda, e non per pigrizia — la perdita ai box è la stessa per ogni candidato e
// si cancella nella differenza, quindi la forma della curva non dipende da quel
// prior (verificato da s17 raddoppiando la perdita). Mostrare una banda dove non
// esiste incertezza sarebbe una bugia prudente, che resta una bugia.

import { el, txt, num, creaTarghetta } from './targhette.mjs';

const LARGHEZZA = 720;
const ALTEZZA = 260;
const MARGINE = { alto: 16, basso: 34, sinistro: 44, destro: 12 };

const targhettaDelta = (data) => creaTarghetta({
  natura: 'MODELLO_DICHIARATO',
  testo: 'tempo perso rispetto al giro di sosta migliore, al medesimo giro finale; il minimo vale zero per costruzione',
  data,
});
const targhettaGiro = (data) => creaTarghetta({
  natura: 'MISURATO_QUESTA_GARA',
  testo: 'numero di giro di questa gara',
  data,
});

export function curva(vista, s) {
  const data = vista._targhetta.data;
  if (!s.curva || s.curva.length === 0) {
    return el('section', { classe: 'curva vuota' },
      el('h2', {}, txt('Quando conviene fermarsi')),
      el('p', { classe: 'soppressione' },
        txt('Curva non disponibile per questo scenario: nessun giro di sosta candidato ha superato il Director.')));
  }

  const giri = s.curva.map((p) => p.giroPit);
  const delte = s.curva.map((p) => p.delta_s);
  const xMin = Math.min(...giri);
  const xMax = Math.max(...giri);
  const yMax = Math.max(...delte, 1);
  const larghezzaUtile = LARGHEZZA - MARGINE.sinistro - MARGINE.destro;
  const altezzaUtile = ALTEZZA - MARGINE.alto - MARGINE.basso;
  const X = (g) => MARGINE.sinistro + (xMax === xMin ? 0 : ((g - xMin) / (xMax - xMin)) * larghezzaUtile);
  const Y = (d) => MARGINE.alto + altezzaUtile - (d / yMax) * altezzaUtile;

  const linea = s.curva.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.giroPit).toFixed(1)},${Y(p.delta_s).toFixed(1)}`).join(' ');

  // banda: solo se i candidati toccano un coefficiente prior con banda
  const banda = s.banda_presente && s.curva.every((p) => Array.isArray(p.banda))
    ? el('path', {
      classe: 'banda',
      d: [
        ...s.curva.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.giroPit).toFixed(1)},${Y(p.banda[0]).toFixed(1)}`),
        ...[...s.curva].reverse().map((p) => `L${X(p.giroPit).toFixed(1)},${Y(p.banda[1]).toFixed(1)}`),
        'Z',
      ].join(' '),
    })
    : null;

  const tacche = [];
  const passo = Math.max(1, Math.round((xMax - xMin) / 8));
  for (let g = xMin; g <= xMax; g += passo) {
    tacche.push(el('g', { classe: 'tacca', trasla: `${X(g).toFixed(1)},${ALTEZZA - MARGINE.basso}` },
      el('line', { y2: 5 }),
      el('text', { y: 18, ancora: 'middle' }, num(g, { formato: 'intero', targhetta: targhettaGiro(data) }))));
  }
  const tacchePerdita = [0, yMax / 2, yMax].map((d) => el('g', { classe: 'tacca-y', trasla: `${MARGINE.sinistro},${Y(d).toFixed(1)}` },
    el('line', { x2: -5 }),
    el('text', { x: -9, y: 4, ancora: 'end' }, num(d, { unita: 's', formato: 'secondi', targhetta: targhettaDelta(data) }))));

  return el('section', { classe: 'curva' },
    el('h2', {}, txt('Quando conviene fermarsi')),
    el('svg', { viewBox: `0 0 ${LARGHEZZA} ${ALTEZZA}`, classe: 'grafico', etichetta: 'curva del quando conviene fermarsi' },
      banda,
      el('path', { classe: 'linea', d: linea }),
      // il minimo EVIDENZIATO: è la risposta della curva
      el('g', { classe: 'minimo', trasla: `${X(s.minimo.giroPit).toFixed(1)},${Y(s.minimo.delta_s).toFixed(1)}` },
        el('circle', { r: 6 }),
        el('line', { y1: 0, y2: (ALTEZZA - MARGINE.basso - Y(s.minimo.delta_s)).toFixed(1) })),
      ...tacche, ...tacchePerdita),
    el('p', { classe: 'lettura' },
      txt('Il minimo cade al giro '),
      num(s.minimo.giroPit, { formato: 'intero', targhetta: targhettaGiro(data) }),
      txt('. Fermarsi al primo giro utile costa '),
      num(s.curva[0].delta_s, { unita: 's', formato: 'secondi', targhetta: targhettaDelta(data) }),
      txt(' in più.')),
    el('p', { classe: 'nota' }, txt(s.nota_banda ?? '')));
}
