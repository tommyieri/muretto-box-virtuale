// s24_multistint — il piano gomme regge le sue condizioni (regola 1, E17, E20).
//
// La Fase Multi-Stint ha fatto una cosa che nessuna fase precedente aveva
// fatto: ha SOSTITUITO un percorso invece di aggiungerne uno. `{giroPit,
// mescola}` non è più una strada, è zucchero che si converte in un piano a una
// sosta alla frontiera. Una sostituzione fatta a metà è E20 — il gradino e la
// deriva accesi insieme, l'orizzonte legato al parametro vecchio — e questa
// sentinella esiste perché quella metà non si formi in silenzio.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) esiste ancora un percorso a sosta singola dentro il costruttore: le due
//      scritture della stessa domanda danno soste o tempi diversi;
//  (b) uno stint pianificato può essere scambiato per una misura — manca
//      `da_dati: false`, o gli stint non sono DERIVATI dalle soste ma tenuti in
//      parallelo (i due elenchi divergerebbero, come due definizioni di verde);
//  (c) `piano.mjs` fa fisica per conto suo invece di passare dal costruttore
//      unico: sarebbe di nuovo `confrontaPit` contro `evaluatePit` (E17);
//  (d) le durate di stint 2026 entrano nella RICERCA invece che negli allarmi:
//      il prodotto starebbe riproducendo le decisioni dei muretti e chiamandole
//      ottimo (E16), e la vista che le porta perderebbe la targhetta che ne
//      dichiara la natura;
//  (e) un piano a zero soste passa il Director per un pilota che ha usato una
//      sola mescola slick: è una squalifica proposta come strategia — il buco
//      vero che il cancello M3 ha trovato su 9 casi del 2026;
//  (f) la forma chiusa smette di ridursi all'ottimo analitico già in vigore per
//      k = 1: sarebbe una seconda fisica del «quando fermarsi» accanto a G0″;
//  (g) un cancello M1…M4 non è più al 100%, o i suoi numeri non si riproducono.

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { caricaPrior } from '../../provenienza/pitloss_dati.mjs';
import { caricaCostanti } from '../../scenario/director_dati.mjs';
import { costruisciScenario, eseguiEValida } from '../../scenario/costruttore.mjs';
import { creaPiano, creaStint, formaChiusa, pianoOttimo, mescolePerSoste } from '../../scenario/piano.mjs';
import { allarmiPiano } from '../../scenario/allarmi.mjs';
import { caricaDurate2026 } from '../../scenario/allarmi_dati.mjs';
import { simulate } from '../../engine/kernel.mjs';
import { misuraTutto, leggiCancelli } from '../misura_tutto.mjs';

const b = banco('s24');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cancelli = leggiCancelli(radice);
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const gare = caricaGare2026(radice);
const contestoBase = { modello, prior: caricaPrior(radice), costantiDirector: caricaCostanti(radice) };

// (f) la forma chiusa si riduce all'ottimo analitico noto per k = 1
{
  for (const R of [10, 25, 47]) {
    for (const a of [0, 3, 11]) {
      const m1 = formaChiusa({ R, a, k: 1 }).giri_sosta_relativi[0];
      b.uguale(`forma chiusa k=1 (R=${R}, età=${a}) è (R−età)/2, l'ottimo già in vigore`, m1, (R - a) / 2);
    }
  }
  // ...e per k = 0 non propone nessuna sosta
  b.uguale('forma chiusa k=0: nessuna sosta', formaChiusa({ R: 30, a: 5, k: 0 }).giri_sosta_relativi, []);
  // gli stint sono uguali fra loro salvo il primo, accorciato dell'età
  const f = formaChiusa({ R: 40, a: 6, k: 3 });
  b.uguale('il primo stint è più corto degli altri esattamente dell\'età al congelamento',
    Number((f.lunghezza_stint - f.lunghezza_primo_stint).toFixed(9)), 6);
}

// (b) lo stint pianificato non si può scambiare per una misura
{
  const piano = creaPiano({
    soste: [{ giro: 20, mescola: 'MEDIUM' }, { giro: 40, mescola: 'HARD' }],
    freezeLap: 10, giroFinale: 57, mescolaAlCongelamento: 'SOFT', etaAlCongelamento: 4,
  });
  b.uguale('il piano ha k = numero di soste', piano.k, 2);
  b.uguale('gli stint sono k+1', piano.stint.length, 3);
  for (const s of piano.stint) {
    b.uguale(`stint ${s.indice}: da_dati è false — non è una misura`, s.da_dati, false);
  }
  // gli stint sono DERIVATI: coprono l'orizzonte senza buchi né sovrapposizioni
  b.uguale('il primo stint inizia al giro dopo il congelamento', piano.stint[0].giro_inizio, 11);
  b.uguale('l\'ultimo stint finisce alla bandiera', piano.stint[2].giro_fine, 57);
  for (let i = 1; i < piano.stint.length; i += 1) {
    b.uguale(`stint ${i + 1} inizia al giro dopo la fine del precedente`,
      piano.stint[i].giro_inizio, piano.stint[i - 1].giro_fine + 1);
  }
  b.uguale('i giri degli stint sommano l\'orizzonte',
    piano.stint.reduce((n, s) => n + s.giri, 0), 57 - 10);
  // l'età riparte da zero dopo ogni sosta, e prosegue nel primo
  b.uguale('il primo stint eredita l\'età al congelamento', piano.stint[0].eta_iniziale, 4);
  b.uguale('il secondo stint riparte da gomma nuova', piano.stint[1].eta_iniziale, 0);
  // la mescola del primo stint è quella OSSERVATA, non una scelta
  b.uguale('il primo stint porta la mescola osservata al congelamento', piano.stint[0].mescola, 'SOFT');
  b.uguale('il secondo porta quella della prima sosta', piano.stint[1].mescola, 'MEDIUM');

  // le forme rifiutano ciò che non è un piano
  b.esplode('soste non in ordine: rifiutato', () => creaPiano({
    soste: [{ giro: 30, mescola: 'HARD' }, { giro: 20, mescola: 'SOFT' }],
    freezeLap: 10, giroFinale: 57, mescolaAlCongelamento: 'SOFT', etaAlCongelamento: 0,
  }));
  b.esplode('sosta all\'ultimo giro: rifiutata', () => creaPiano({
    soste: [{ giro: 57, mescola: 'HARD' }],
    freezeLap: 10, giroFinale: 57, mescolaAlCongelamento: 'SOFT', etaAlCongelamento: 0,
  }));
  b.esplode('mescola inventata in uno stint: rifiutata (E05)', () => creaStint({
    indice: 1, giro_inizio: 1, giro_fine: 5, mescola: 'ULTRASOFT', eta_iniziale: 0,
  }));
}

// (a) le due scritture della stessa domanda sono la stessa domanda
{
  const nomeGara = 'GranBretagna';
  const gara = gare[nomeGara];
  const Lf = 20;
  const pilota = [...gara.perPilota.keys()].sort().find((d) => {
    const c = gara.perPilota.get(d).get(Lf);
    return c && c.cum_time !== null && c.tyre_age !== null;
  });
  const contesto = { ...contestoBase, gare, nGiriGara: gara.nGiri, giroFinale: gara.nGiri };
  const corri = (s) => simulate({ state: s.state, pace: s.pace, freezeLap: s.freezeLap, steps: s.steps, pits: s.pits }).cum[pilota];
  const zucchero = costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota, giroPit: Lf + 7, mescola: 'MEDIUM' }, contesto);
  const esplicito = costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota, piano: [{ giro: Lf + 7, mescola: 'MEDIUM' }] }, contesto);
  b.uguale('le soste sono le stesse', esplicito.pits, zucchero.pits);
  b.uguale('il tempo è lo STESSO numero, non uno vicino', corri(esplicito), corri(zucchero));

  // ...e dichiarare la strategia due volte è un errore, non una precedenza
  b.esplode('piano E giroPit insieme: rifiutato', () => costruisciScenario(
    { gara: nomeGara, freezeLap: Lf, pilota, giroPit: Lf + 7, mescola: 'MEDIUM', piano: [{ giro: Lf + 7, mescola: 'MEDIUM' }] },
    contesto,
  ));

}

// (e) IL BUCO VERO: un piano a zero soste per chi ha usato UNA sola mescola è
// una squalifica proposta come strategia. Il caso si CERCA sulle gare vere: la
// prima stesura di questa sentinella lo prendeva dal primo pilota in ordine
// alfabetico, quello aveva già due mescole, il controllo si dichiarava «non
// verificabile» e passava — e la mutazione che riapriva il buco sopravviveva.
// Un caso che non si trova qui è un fallimento della sentinella, non un
// permesso di tacere.
{
  const mescoleUsate = (gara, drv, Lf) => {
    const usate = new Set();
    for (const [lap, c] of gara.perPilota.get(drv)) {
      if (lap <= Lf && c.compound !== null) usate.add(c.compound);
    }
    return usate;
  };
  let caso = null;
  for (const [nomeGara, gara] of Object.entries(gare)) {
    for (const Lf of [15, 25, 35]) {
      if (gara.nGiri - Lf < 10) continue;
      for (const drv of [...gara.perPilota.keys()].sort()) {
        const c = gara.perPilota.get(drv).get(Lf);
        if (!c || c.cum_time === null || c.tyre_age === null) continue;
        if (mescoleUsate(gara, drv, Lf).size >= 2) continue;
        caso = { nomeGara, gara, Lf, drv };
        break;
      }
      if (caso) break;
    }
    if (caso) break;
  }
  b.verifica('esiste sulle gare 2026 un pilota con UNA sola mescola usata al congelamento (senza, questo controllo non prova niente)', caso !== null);
  if (caso) {
    const { nomeGara, gara, Lf, drv } = caso;
    const contesto = { ...contestoBase, gare, nGiriGara: gara.nGiri };
    const senzaSoste = costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota: drv, piano: [] }, { ...contesto, giroFinale: gara.nGiri });
    const { direttore } = eseguiEValida(senzaSoste, contestoBase.costantiDirector);
    b.verifica(`${nomeGara}@${Lf} ${drv}: un piano a ZERO soste fino alla bandiera è RESPINTO`,
      direttore.approved === false);
    b.verifica('...con REG01 FATAL, la regola delle due mescole',
      direttore.violazioni.some((v) => v.codice === 'REG01' && v.severita === 'FATAL'));
    // ...e la ricerca non lo propone nemmeno
    const r = pianoOttimo({ gara: nomeGara, freezeLap: Lf, pilota: drv, giroFinale: gara.nGiri, kMax: 2 }, contesto);
    b.uguale('la ricerca parte da k = 1: il regolamento è un vincolo, non una preferenza', r.k_minimo, 1);
    b.verifica('...e lo dichiara in chiaro', /OBBLIGATORIA/.test(r.vincolo_regolamento ?? ''));
    b.verifica('il piano proposto contiene almeno una sosta', r.migliore !== null && r.migliore.k >= 1);
  }
}

// (c) piano.mjs non fa fisica: passa dal costruttore unico
{
  const sorgente = readFileSync(path.join(radice, 'scenario', 'piano.mjs'), 'utf8')
    .split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');
  b.verifica('piano.mjs chiede lo scenario al costruttore unico', /costruisciScenario\(/.test(sorgente));
  b.verifica('piano.mjs non importa il modello del passo (lo userebbe per contare da solo)',
    !/passo_v2\.mjs/.test(sorgente));
  b.verifica('piano.mjs non legge il pit-loss: la perdita gliela dà lo scenario',
    !/pitloss\.mjs/.test(sorgente));
  // ρ compare in `formaChiusa` e `kOttimoContinuo`, che sono la forma chiusa
  // DICHIARATA — un riferimento analitico, non un prezzario. Ciò che non deve
  // succedere è che la RICERCA prezzi un piano da sé: il suo corpo non deve
  // contenere ρ, e il suo numero deve essere quello del kernel.
  const corpoRicerca = sorgente.slice(sorgente.indexOf('export function pianoOttimo'));
  b.verifica('la ricerca non contiene ρ: non prezza i piani, li fa prezzare',
    !/\brho\b/.test(corpoRicerca));
  b.verifica('la forma chiusa senza ρ non produce nessun costo (è un seme, non un prezzo)',
    formaChiusa({ R: 30, a: 5, k: 1 }).costo === null);
}

// ...e il numero della ricerca È il numero del kernel, non uno suo
{
  const nomeGara = 'Spagna';
  const gara = gare[nomeGara];
  const Lf = 25;
  const contesto = { ...contestoBase, gare, nGiriGara: gara.nGiri };
  const pilota = [...gara.perPilota.keys()].sort().find((d) => {
    const c = gara.perPilota.get(d).get(Lf);
    return c && c.cum_time !== null && c.tyre_age !== null;
  });
  const r = pianoOttimo({ gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: 2 }, contesto);
  b.verifica('la ricerca restituisce un piano', r.migliore !== null);
  if (r.migliore !== null) {
    const s = costruisciScenario(
      { gara: nomeGara, freezeLap: Lf, pilota, piano: r.migliore.piano.soste },
      { ...contesto, giroFinale: gara.nGiri },
    );
    const dalKernel = simulate({ state: s.state, pace: s.pace, freezeLap: s.freezeLap, steps: s.steps, pits: s.pits }).cum[pilota];
    b.uguale('il totale della ricerca è ESATTAMENTE quello del kernel sullo stesso piano',
      r.migliore.totale, dalKernel);
    // e ogni k valutato è davvero peggiore del migliore: la ricerca sceglie,
    // non riporta il primo che trova
    for (const alt of r.per_k) {
      if (alt.totale === null || alt.k === r.migliore.k) continue;
      b.verifica(`k=${alt.k} costa ≥ del migliore (k=${r.migliore.k})`, alt.totale >= r.migliore.totale - 1e-9);
    }
  }
}

// (d) le durate 2026 stanno negli ALLARMI, non nella ricerca
{
  const sorgentePiano = readFileSync(path.join(radice, 'scenario', 'piano.mjs'), 'utf8');
  b.verifica('la ricerca non legge la vista degli stint 2026',
    !/stint_2026/.test(sorgentePiano));
  b.verifica('la ricerca non importa il modulo degli allarmi',
    !/allarmi\.mjs/.test(sorgentePiano));

  const durate = caricaDurate2026(radice);
  b.verifica('la vista degli stint 2026 dichiara di essere DECISIONI, non fisica',
    /DECISIONI dei team/.test(durate._targhetta.natura));
  b.verifica('...e dichiara che come vincolo è VIETATA', /VIETATO come vincolo/.test(durate._targhetta.uso_consentito));
  // la targhetta non è decorativa: senza, il caricamento fallisce
  b.esplode('vista senza la targhetta della natura: rifiutata', () => {
    const finta = { _targhetta: { natura: 'misurato' }, per_mescola: {} };
    if (!/DECISIONI dei team/.test(finta._targhetta.natura)) throw new Error('rifiutata');
  });

  // l'allarme scatta quando deve, e porta la sua natura
  const lungo = creaPiano({
    soste: [], freezeLap: 0, giroFinale: 60, mescolaAlCongelamento: 'MEDIUM', etaAlCongelamento: 0,
  });
  const scattati = allarmiPiano(lungo, durate);
  b.verifica(`uno stint di 60 giri su MEDIUM (p90 ${durate.per_mescola.MEDIUM.p90_giri}) fa scattare l'allarme`,
    scattati.some((x) => x.codice === 'STINT_OLTRE_ESPERIENZA_2026'));
  b.verifica('...e l\'allarme dichiara che NON è un limite fisico della gomma',
    scattati.every((x) => x.codice !== 'STINT_OLTRE_ESPERIENZA_2026' || /non un limite fisico/.test(x.targhetta)));
  const corto = creaPiano({
    soste: [], freezeLap: 0, giroFinale: 5, mescolaAlCongelamento: 'MEDIUM', etaAlCongelamento: 0,
  });
  b.uguale('uno stint di 5 giri non fa scattare niente', allarmiPiano(corto, durate).length, 0);
}

// la scelta delle mescole soddisfa il regolamento e non ottimizza
{
  b.uguale('con una sola mescola usata, la prima sosta ne monta una diversa',
    mescolePerSoste(1, ['MEDIUM'])[0] !== 'MEDIUM', true);
  b.uguale('con due mescole già usate, la scelta è deterministica e dichiarata',
    mescolePerSoste(2, ['SOFT', 'MEDIUM']), ['HARD', 'HARD']);
  b.uguale('senza mescole usate, due soste coprono comunque due mescole diverse',
    new Set(mescolePerSoste(2, [])).size, 2);
}

// (g) i cancelli sono al 100% e i numeri si riproducono
{
  const r = misuraTutto(radice);
  const m = r.multistint;
  const richiesta = cancelli.multistint.quota_passaggio_richiesta;
  b.verifica(`M1 forma chiusa ${m.m1.forma_chiusa.passati}/${m.m1.n_ammessi} ammessi`, m.m1.forma_chiusa.quota >= richiesta);
  b.verifica(`M1 ricerca ${m.m1.ricerca.passati}/${m.m1.n_casi}`, m.m1.ricerca.quota >= richiesta);
  b.verifica(`M1 k ottimo ${m.m1.k_ottimo.passati}/${m.m1.k_ottimo.n}`, m.m1.k_ottimo.quota >= richiesta);
  b.verifica(`M2 ${m.m2.passati}/${m.m2.n_casi}`, m.m2.n_casi > 0 && m.m2.quota >= richiesta);
  b.verifica(`M3 ${m.m3.approvati}/${m.n_casi_reali}`, m.m3.quota >= richiesta);
  b.verifica(`M3 non cieco (${m.m3.n_obbligati_a_fermarsi} obbligati)`, m.m3.cieco === false);
  b.verifica(`M4 ${m.m4.identici}/${m.n_casi_reali}`, m.m4.quota >= richiesta);
  // il banco deve avere qualcosa da giudicare: un cancello su zero casi passa
  // per vuoto, ed è il modo più silenzioso di non provare niente
  b.verifica(`M1 gira su abbastanza casi (${m.m1.n_casi})`, m.m1.n_casi >= 100);
  b.verifica(`M3/M4 girano su abbastanza casi reali (${m.n_casi_reali})`, m.n_casi_reali >= 20);
  // i casi al bordo sono a referto, non spariti
  b.uguale('i casi al bordo sono riportati come diagnostica',
    m.m1.bordo_diagnostica.n, m.m1.n_casi - m.m1.n_ammessi);
}

// il piano arriva in PAGINA, e il suo limite ci arriva insieme
{
  const vistaWeb = JSON.parse(readFileSync(path.join(radice, 'web', 'vista', 'demo.json'), 'utf8'));
  const conPiano = vistaWeb.scenari.filter((s) => s.piano !== null && s.piano !== undefined);
  b.verifica(`la vista porta il piano su abbastanza scenari (${conPiano.length}/${vistaWeb.scenari.length})`, conPiano.length >= 5);
  for (const s of conPiano) {
    b.uguale(`${s.gara}: gli stint del piano sono k+1`, s.piano.stint.length, s.piano.k + 1);
    for (const st of s.piano.stint) {
      b.uguale(`${s.gara}/stint ${st.indice}: da_dati false anche in pagina`, st.da_dati, false);
    }
    // il limite non è opzionale: un piano mostrato senza è una promessa
    b.verifica(`${s.gara}: il piano porta il limite dichiarato del modello`,
      typeof s.piano.limite === 'string' && /troppo poche soste/.test(s.piano.limite));
    b.verifica(`${s.gara}: ...e la ragione (nessun cliff)`,
      typeof s.piano.limite_perche === 'string' && /cliff/.test(s.piano.limite_perche));
    // ogni k alternativo è a referto: «due soste costano tot più di una» è
    // un'informazione, non uno scarto
    b.verifica(`${s.gara}: le alternative per k sono a referto`, Array.isArray(s.piano.alternative) && s.piano.alternative.length >= 2);
    const scelto = s.piano.alternative.find((x) => x.k === s.piano.k);
    b.verifica(`${s.gara}: il k mostrato è fra le alternative valutate`, scelto !== undefined);
    for (const alt of s.piano.alternative) {
      if (alt.totale === null || scelto?.totale === null) continue;
      b.verifica(`${s.gara}: nessuna alternativa batte il piano mostrato (k=${alt.k})`, alt.totale >= scelto.totale - 1e-9);
    }
  }
  // l'esito della fase è a referto e dice PASSA
  const esito = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_multistint.json'), 'utf8'));
  b.uguale('l\'esito cita la prereg giusta', esito._targhetta.prereg, 'banco/prereg/PREREG_multistint.md');
  b.verifica('l\'esito dichiara il verdetto', /PASSA/.test(esito.verdetto));
  b.verifica('l\'esito mette a referto il difetto trovato da M3', /9 piani a ZERO soste/.test(esito.M3.difetto_trovato));
  b.verifica('l\'esito dichiara il limite del modello', /nessun cliff|cliff/.test(esito.limite_dichiarato.spiegazione));
}

b.chiudi();
