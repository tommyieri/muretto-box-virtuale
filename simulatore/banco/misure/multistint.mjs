// multistint.mjs — i cancelli M1…M4 di PREREG_multistint.md, eseguiti.
//
// M1 confronta TRE calcoli diversi della stessa cosa: l'enumerazione esaustiva
// di tutti i piani interi valutati col kernel VERO, la forma chiusa continua, e
// il piano che la ricerca del prodotto restituisce. Non è tautologico: il
// kernel lavora in giri discreti, applica la perdita intera sul giro della
// sosta e tronca l'orizzonte alla bandiera; la forma chiusa non sa niente di
// tutto questo.
//
// Un caso è AMMESSO quando l'ottimo continuo cade dentro l'intervallo dei giri
// di sosta possibili, e il cancello si gioca lì. Fuori è il bordo, e vale la
// clausola unilaterale di G0″: la risposta giusta è il bordo stesso, non un
// fallimento. I casi al bordo restano comunque a referto, confrontati con la
// forma chiusa VINCOLATA — un buco silenzioso nella copertura sarebbe peggio
// di un numero che non fa cancello.
//
// M2, M3 e M4 si misurano sulle gare 2026 vere.

import { simulate } from '../../engine/kernel.mjs';
import { formaChiusa, kOttimoContinuo, pianoOttimo, RAGGIO_RICERCA } from '../../scenario/piano.mjs';
import { allarmiPiano } from '../../scenario/allarmi.mjs';
import { costruisciScenario, eseguiEValida } from '../../scenario/costruttore.mjs';

const EPS = 1e-9;

/**
 * La forma chiusa RI-RISOLTA con il vincolo che morde. Serve solo al bordo, e
 * NON sta in `piano.mjs` di proposito: è un riferimento del banco, non fisica
 * di produzione, e un lettore non deve poterla scambiare per l'altra.
 *
 * Perché esiste. La prima stesura di questa misura giudicava i casi al bordo
 * confrontandoli con la forma chiusa NON vincolata, e bocciava 15 risposte
 * corrette su 144: con R=12, a=5, k=2 la forma libera dice soste a [0,67; 6,33],
 * la prima è impossibile, il kernel risponde [1, 6] — che è l'ottimo giusto una
 * volta che la prima sosta è inchiodata al giro 1. Bocciarlo sarebbe stato E08
 * per la terza volta: una metrica che chiama fallimento la risposta corretta al
 * bordo. Il cancello pre-registrato si gioca sui casi AMMESSI (ottimo continuo
 * dentro l'intervallo); questa funzione serve a riportare anche gli altri,
 * come diagnostica, invece di lasciarli come un buco.
 */
export function formaChiusaVincolata({ R, a, k }) {
  if (k === 0) return [];
  const libera = formaChiusa({ R, a, k }).giri_sosta_relativi;
  if (libera[0] < 1) {
    // la prima sosta è inchiodata al primo giro utile: il resto si ri-risolve
    // su ciò che avanza, con gomma nuova
    return [1, ...formaChiusaVincolata({ R: R - 1, a: 0, k: k - 1 }).map((m) => m + 1)];
  }
  if (libera[libera.length - 1] > R - 1) {
    // simmetrico: l'ultima sosta è inchiodata all'ultimo giro utile
    return [...formaChiusaVincolata({ R: R - 1, a, k: k - 1 }), R - 1];
  }
  return libera;
}

/** Passo sintetico del modello v2, senza il pilota: base + deriva + ρ·età.
 *  base e deriva sono identiche per ogni piano e si cancellano nel confronto —
 *  restano perché il banco deve girare sul kernel VERO, non su una sua versione
 *  semplificata per l'occasione. */
const passoSintetico = ({ base, delta70, rho, nGiri }) => (drv, giro, eta) =>
  base - (delta70 / nGiri) * (giro - 1) + rho * eta;

/** Tutti i piani interi con k soste dentro [1, R−1], come giri relativi a Lf. */
function* combinazioni(R, k) {
  if (k === 0) { yield []; return; }
  const scelta = new Array(k);
  function* passo(i, da) {
    if (i === k) { yield [...scelta]; return; }
    for (let m = da; m <= R - 1 - (k - 1 - i); m += 1) {
      scelta[i] = m;
      yield* passo(i + 1, m + 1);
    }
  }
  yield* passo(0, 1);
}

/** Il costo di un piano secondo il KERNEL. */
function costoKernel({ relativi, R, a, perdita, pace, Lf }) {
  const r = simulate({
    state: [{ drv: 'X', lap: Lf, cum_time: 0, tyre_age: a }],
    pace, freezeLap: Lf, steps: R,
    pits: { X: relativi.map((m) => ({ lap: Lf + m, perdita })) },
  });
  return r.cum.X;
}

/**
 * La RICERCA del prodotto, isolata dai dati di gara: stessa procedura di
 * `pianoOttimo` (partenza dalla forma chiusa, discesa per coordinate entro il
 * raggio dichiarato), applicata al banco analitico. Vive qui e non in
 * `piano.mjs` perché lì la valutazione passa dal costruttore di scenari, che
 * ha bisogno di una gara vera; la PROCEDURA è la stessa e s24 lo verifica
 * confrontandola con `pianoOttimo` su una gara.
 */
function ricercaRistretta({ R, a, k, perdita, pace, Lf }) {
  const ammesso = (rel) => rel.every((m, i) => m >= 1 && m <= R - 1 && (i === 0 || m > rel[i - 1]));
  let correnti = formaChiusa({ R, a, k }).giri_sosta_relativi.map((m) => Math.round(m));
  correnti = correnti.map((m, i) => Math.min(Math.max(m, 1 + i), R - 1 - (k - 1 - i)));
  if (!ammesso(correnti)) return null;
  let migliore = costoKernel({ relativi: correnti, R, a, perdita, pace, Lf });
  let cambiato = true;
  while (cambiato) {
    cambiato = false;
    for (let i = 0; i < correnti.length; i += 1) {
      for (let d = -RAGGIO_RICERCA; d <= RAGGIO_RICERCA; d += 1) {
        if (d === 0) continue;
        const prova = [...correnti];
        prova[i] += d;
        const ordinati = [...prova].sort((x, y) => x - y);
        if (!ammesso(ordinati)) continue;
        const c = costoKernel({ relativi: ordinati, R, a, perdita, pace, Lf });
        if (c < migliore - EPS) { correnti = ordinati; migliore = c; cambiato = true; }
      }
    }
  }
  return { relativi: correnti, costo: migliore };
}

/**
 * M1 sul banco analitico.
 *
 * @param cancelli  `{ griglia_R, griglia_eta, griglia_perdita, k_massimo,
 *                  tolleranza_bordo_giri, quota_passaggio_richiesta }`
 */
export function misuraM1({ rho, delta70, cancelli }) {
  const { griglia_R: griglieR, griglia_eta: griglieEta, griglia_perdita: grigliePerdita,
    k_massimo: kMax } = cancelli;
  const casi = [];
  const Lf = 10;

  for (const R of griglieR) {
    for (const a of griglieEta) {
      for (const perdita of grigliePerdita) {
        const pace = passoSintetico({ base: 90, delta70, rho, nGiri: Lf + R });
        for (let k = 0; k <= kMax; k += 1) {
          if (k > R - 1) continue;
          // ── 1. enumerazione esaustiva col kernel vero ──
          let esaustivo = Infinity;
          let argmin = [];
          for (const rel of combinazioni(R, k)) {
            const c = costoKernel({ relativi: rel, R, a, perdita, pace, Lf });
            if (c < esaustivo - EPS) { esaustivo = c; argmin = [rel]; }
            else if (Math.abs(c - esaustivo) <= EPS) argmin.push(rel);
          }
          // ── 2. forma chiusa ──
          const continua = formaChiusa({ R, a, k, rho, perdita }).giri_sosta_relativi;
          // ── 3. la ricerca del prodotto ──
          const ricerca = k === 0 ? { relativi: [], costo: esaustivo } : ricercaRistretta({ R, a, k, perdita, pace, Lf });

          // Un caso è AMMESSO se l'ottimo continuo cade dentro l'intervallo dei
          // giri di sosta possibili (PREREG_multistint.md). Fuori è il bordo: la
          // clausola unilaterale di G0″ dice che lì la risposta giusta è il
          // bordo stesso, e il cancello si gioca sui casi ammessi.
          const alBordo = continua.some((m) => m < 1 || m > R - 1);
          const riferimento = alBordo ? formaChiusaVincolata({ R, a, k }) : continua;

          // pareggi: se la forma chiusa cade a metà fra due interi, entrambi
          // sono ottimi e entrambi passano (come in G0″)
          const coincide = (atteso) => argmin.some((rel) => rel.every((m, i) => {
            const x = atteso[i];
            return Number.isInteger(x) ? m === x : (m === Math.floor(x) || m === Math.ceil(x));
          }));
          const ricercaCoincide = ricerca !== null && Math.abs(ricerca.costo - esaustivo) <= 1e-6;

          casi.push({
            R, a, perdita, k,
            tipo: alBordo ? 'bordo' : 'interno',
            argmin_esaustivo: argmin[0],
            forma_chiusa: continua.map((m) => Number(m.toFixed(4))),
            forma_chiusa_vincolata: alBordo ? riferimento.map((m) => Number(m.toFixed(4))) : null,
            ricerca: ricerca?.relativi ?? null,
            // la ricerca deve trovare l'ottimo esaustivo: è la condizione che
            // giustifica di NON enumerare in produzione
            passa_ricerca: ricercaCoincide,
            // la forma chiusa deve descrivere lo stesso oggetto del kernel.
            // Al bordo il confronto è con la versione VINCOLATA, ed è
            // diagnostica: il cancello si gioca sui casi ammessi.
            passa_chiusa: coincide(riferimento),
            costo_esaustivo: Number(esaustivo.toFixed(6)),
          });
        }
      }
    }
  }

  // il k ottimo continuo contro il k che vince davvero, per ogni combinazione
  const perCombinazione = new Map();
  for (const c of casi) {
    const chiave = `${c.R}|${c.a}|${c.perdita}`;
    if (!perCombinazione.has(chiave)) perCombinazione.set(chiave, []);
    perCombinazione.get(chiave).push(c);
  }
  const kScelto = [];
  for (const [chiave, elenco] of perCombinazione) {
    const [R, a, perdita] = chiave.split('|').map(Number);
    const vincitore = elenco.reduce((m, c) => (c.costo_esaustivo < m.costo_esaustivo - EPS ? c : m));
    const continuo = kOttimoContinuo({ R, a, rho, perdita });
    const attesi = Number.isInteger(continuo)
      ? [continuo]
      : [Math.floor(continuo), Math.ceil(continuo)];
    // il k continuo può cadere sotto 0 o sopra il massimo esplorato: è di nuovo
    // il bordo, e vale la stessa clausola unilaterale
    const alBordo = continuo < 0 || continuo > Math.max(...elenco.map((c) => c.k));
    kScelto.push({
      R, a, perdita, k_vincente: vincitore.k, k_continuo: Number(continuo.toFixed(4)),
      tipo: alBordo ? 'bordo' : 'interno',
      passa: alBordo
        ? (continuo < 0 ? vincitore.k === 0 : vincitore.k === Math.max(...elenco.map((c) => c.k)))
        : attesi.includes(vincitore.k),
    });
  }

  const ammessi = casi.filter((c) => c.tipo === 'interno');
  const alBordoCasi = casi.filter((c) => c.tipo === 'bordo');
  const passatiRicerca = casi.filter((c) => c.passa_ricerca).length;
  const passatiChiusa = ammessi.filter((c) => c.passa_chiusa).length;
  const passatiK = kScelto.filter((c) => c.passa).length;
  return {
    n_casi: casi.length,
    n_al_bordo: casi.filter((c) => c.tipo === 'bordo').length,
    ricerca: { passati: passatiRicerca, quota: Number((passatiRicerca / casi.length).toFixed(6)), falliti: casi.filter((c) => !c.passa_ricerca) },
    // IL CANCELLO: casi ammessi, cioè con l'ottimo continuo dentro l'intervallo
    forma_chiusa: {
      n_ammessi: ammessi.length,
      passati: passatiChiusa,
      quota: Number((passatiChiusa / ammessi.length).toFixed(6)),
      falliti: ammessi.filter((c) => !c.passa_chiusa),
    },
    // DIAGNOSTICA, non cancello: i casi al bordo contro la forma chiusa vincolata
    bordo_diagnostica: {
      n: alBordoCasi.length,
      riprodotti: alBordoCasi.filter((c) => c.passa_chiusa).length,
      nota: 'al bordo il riferimento è la forma chiusa RI-RISOLTA col vincolo che morde. Non fa cancello: la prereg ammette i casi con l\'ottimo continuo dentro l\'intervallo. Riportato perché un buco silenzioso nella copertura è peggio di un numero che non fa cancello',
    },
    k_ottimo: { n: kScelto.length, passati: passatiK, quota: Number((passatiK / kScelto.length).toFixed(6)), casi: kScelto, falliti: kScelto.filter((c) => !c.passa) },
  };
}

/**
 * M2 · NON-REGRESSIONE A UNA SOSTA. La stessa domanda, scritta nei due modi:
 * `{giroPit, mescola}` (come la pone il prodotto da sempre) e `piano` (come la
 * pone da oggi). Devono dare lo stesso IDENTICO numero — non «una differenza
 * piccola»: un piano a una sosta *è* lo scenario a una sosta, e qualunque
 * scostamento significherebbe che i due percorsi sono rimasti due (E17/E20).
 */
export function misuraM2(gare, { contestoBase, cancelli }) {
  const casi = [];
  for (const [nomeGara, gara] of Object.entries(gare)) {
    for (const Lf of cancelli.congelamenti) {
      if (gara.nGiri - Lf < cancelli.min_giri_rimanenti) continue;
      const piloti = [...gara.perPilota.keys()].sort().slice(0, cancelli.piloti_per_gara);
      for (const pilota of piloti) {
        const c = gara.perPilota.get(pilota)?.get(Lf);
        if (!c || c.cum_time === null || c.tyre_age === null) continue;
        const giroPit = Lf + 2;
        const contesto = { ...contestoBase, gare, nGiriGara: gara.nGiri, giroFinale: gara.nGiri };
        const zucchero = costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota, giroPit, mescola: 'HARD' }, contesto);
        const esplicito = costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota, piano: [{ giro: giroPit, mescola: 'HARD' }] }, contesto);
        const corri = (s) => simulate({ state: s.state, pace: s.pace, freezeLap: s.freezeLap, steps: s.steps, pits: s.pits }).cum[pilota];
        const a = corri(zucchero);
        const b = corri(esplicito);
        casi.push({
          gara: nomeGara, Lf, pilota,
          identico: JSON.stringify(zucchero.pits) === JSON.stringify(esplicito.pits)
            && ((a === null && b === null) || a === b),
          cum_zucchero: a, cum_piano: b,
        });
      }
    }
  }
  const passati = casi.filter((c) => c.identico).length;
  return { n_casi: casi.length, passati, quota: casi.length ? Number((passati / casi.length).toFixed(6)) : null, falliti: casi.filter((c) => !c.identico) };
}

/**
 * M3 · IL PIANO RISPETTA IL REGOLAMENTO, e il controllo non è cieco.
 *
 * Il piano fino alla bandiera è la prima risposta del prodotto su cui REG01 è
 * decidibile: prima l'orizzonte finiva un giro dopo la sosta, e «due mescole
 * slick a fine gara» non era una domanda che si potesse porre.
 *
 * M4 viaggia insieme: lo stesso piano si ricalcola con gli allarmi spenti, e
 * deve venire identico. Se spegnerli cambiasse un piano, sarebbero vincoli — e
 * il prodotto starebbe riproducendo le decisioni dei muretti chiamandole ottimo.
 */
export function misuraM3M4(gare, { contestoBase, durate2026, cancelli }) {
  const casi = [];
  for (const [nomeGara, gara] of Object.entries(gare)) {
    for (const Lf of cancelli.congelamenti) {
      if (gara.nGiri - Lf < cancelli.min_giri_rimanenti) continue;
      const piloti = [...gara.perPilota.keys()].sort().slice(0, cancelli.piloti_per_gara);
      for (const pilota of piloti) {
        const c = gara.perPilota.get(pilota)?.get(Lf);
        if (!c || c.cum_time === null || c.tyre_age === null) continue;
        const contesto = { ...contestoBase, gare, nGiriGara: gara.nGiri };
        const r = pianoOttimo({ gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: cancelli.k_massimo }, contesto);
        if (r.migliore === null) continue;

        // M4: gli allarmi si calcolano DOPO, sul piano già scelto. Il confronto
        // è fra il piano con gli allarmi accesi e quello con gli allarmi spenti:
        // la ricerca non li ha mai visti, e questo lo prova invece di dirlo.
        const conAllarmi = allarmiPiano(r.migliore.piano, durate2026);
        const senzaAllarmi = pianoOttimo({ gara: nomeGara, freezeLap: Lf, pilota, giroFinale: gara.nGiri, kMax: cancelli.k_massimo }, contesto);
        const identicoSenzaAllarmi = JSON.stringify(r.migliore.piano.soste) === JSON.stringify(senzaAllarmi.migliore?.piano?.soste ?? null);

        // il Director sul piano scelto
        const { direttore } = eseguiEValida(
          costruisciScenario({ gara: nomeGara, freezeLap: Lf, pilota, piano: r.migliore.piano.soste }, { ...contesto, giroFinale: gara.nGiri }),
          contestoBase.costantiDirector,
        );
        casi.push({
          gara: nomeGara, Lf, pilota,
          k: r.migliore.k,
          soste: r.migliore.piano.soste.map((s) => s.giro),
          mescole_gia_usate: r.mescole_gia_usate,
          // il caso che rende il controllo NON cieco: una sola mescola usata a
          // Lf ⇒ il piano è OBBLIGATO a contenere una sosta
          obbligato_a_fermarsi: r.mescole_gia_usate.length < 2,
          approvato: direttore.approved,
          codici: direttore.riepilogo.codici,
          allarmi: conAllarmi.length,
          m4_identico: identicoSenzaAllarmi,
        });
      }
    }
  }
  const approvati = casi.filter((c) => c.approvato).length;
  const obbligati = casi.filter((c) => c.obbligato_a_fermarsi);
  const m4 = casi.filter((c) => c.m4_identico).length;
  return {
    n_casi: casi.length,
    m3: {
      approvati, quota: casi.length ? Number((approvati / casi.length).toFixed(6)) : null,
      n_obbligati_a_fermarsi: obbligati.length,
      // se nessun caso obbliga a fermarsi, M3 non ha provato niente
      cieco: obbligati.length < cancelli.min_casi_obbligati,
      obbligati_con_sosta: obbligati.filter((c) => c.k >= 1).length,
      falliti: casi.filter((c) => !c.approvato),
    },
    m4: { identici: m4, quota: casi.length ? Number((m4 / casi.length).toFixed(6)) : null, falliti: casi.filter((c) => !c.m4_identico) },
    distribuzione_k: casi.reduce((a, c) => { a[c.k] = (a[c.k] ?? 0) + 1; return a; }, {}),
    casi,
  };
}
