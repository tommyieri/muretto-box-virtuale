// regole.mjs — LE REGOLE DI REAZIONE DEI RIVALI, e le loro CONTROFIGURE.
//
// Non e' uno script: non stampa e non esegue niente all'import. Esiste perche' dal
// 03/08/2026 le regole servono a DUE consumatori — il banco che le giudica
// (`banco_regole.mjs`) e il placebo che decide se sono ammissibili (§F5 di
// `ai_lab/KPI_5_4_4.md`) — e una definizione che vive in due posti e' la regola 1 rotta.
//
// ── COS'E' UNA REGOLA ──────────────────────────────────────────────────────────
//
// Una funzione da (gara, congelamento) al comportamento dei rivali. Niente di piu': non
// vede il futuro del soggetto, non tocca il kernel, non cambia il passo. L'unica
// cucitura che il motore espone e' `pianiRivali`, quindi una regola qui e' cio' che
// produce quel piano.
//
// IL CONGELAMENTO E' NELLA FIRMA, e non e' un abbellimento: `corri` lo sceglie caso per
// caso e lo porta oltre il giro 5 in 49 casi su 193 (25,4%). Una regola interrogata una
// volta per gara vedrebbe le sue soste scartate in silenzio dal costruttore su un quarto
// del perimetro, e girerebbe li' come regola-identita' con l'etichetta sbagliata.
//
// ── COSA SONO LE CONTROFIGURE (F5) ────────────────────────────────────────────
//
// §F5 di KPI_5_4_4.md: «una regola vale solo se batte una regola FINTA che fermi gli
// stessi rivali lo stesso numero di volte, ma a giri scelti a caso». La ragione e'
// misurata, non teorica: fra regola-identita' (saldo −14) e oracolo (+2) ci sono 16 punti
// di divario, e una regola qualunque ne recupera una fetta SENZA AVER INDOVINATO NIENTE,
// solo perche' fa pagare il pit-loss anche ai rivali. Il placebo e' cio' che separa
// «ho indovinato quando si fermano» da «li ho fatti fermare».
//
// QUI CE NE SONO DUE, e la ragione e' scritta in REFERTO_mirrorplay_degenere.md §«cosa
// resterebbe misurabile»: i gradi di liberta' da spegnere sono due, non uno.
//
//   LIVELLO   — stessi rivali, stesso numero di soste, GIRI A CASO nell'intervallo
//               ammissibile. Smaschera «conta solo che si fermino».
//   POSIZIONE — stessi rivali, stesso numero di soste, ma i giri sono quelli che la
//               regola produrrebbe in UN'ALTRA GARA (riscalati sulla lunghezza di questa).
//               Smaschera «conta solo che ci sia un giro buono, non quale».
//
// Una controfigura che risultasse BUONA QUANTO la regola non e' un fallimento dello
// strumento: e' la risposta, ed e' quella che ha smontato il 43% del coefficiente del
// traffico.
//
// ── COSA NON C'E' QUI, E PERCHE' ──────────────────────────────────────────────
//
// Il MIRROR-PLAY («la raccomandazione che il motore darebbe seduto dal lato del rivale»)
// non e' fra le regole: e' DEGENERE. `pianoOttimo` dipende dal singolo rivale solo
// attraverso l'eta' gomma, che al congelamento vale lo stesso per quasi tutti — Australia
// 1 giro distinto per 20 rivali, Austria 1 per 18. Referto:
// `REFERTO_mirrorplay_degenere.md`. Il tentativo resta NON SPESO.

import { perGara, pianiVeriDi } from './bandiera.mjs';

/** Un generatore riproducibile: stesso seme, stessa sequenza. Nessun Math.random. */
export function generatore(seme) {
  let s = seme >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// ═══════════════════════════════════════════════════════════════ LE REGOLE
export const REGOLE = {
  identita: {
    nome: 'identita',
    descrizione: 'il rivale non reagisce mai — la configurazione con cui girano tutte le misure pubblicate',
    targhetta: 'REGOLA NULLA: nessun piano ai rivali, nessuna patch al prior. E\' il metro, non un candidato.',
    candidata: false,
    pianiRivali: (_gara, _freezeLap) => undefined,
  },
  // LA REGOLA-ORACOLO: non e' una regola di reazione, e' l'ingresso di laboratorio che
  // da' a ogni rivale le sue soste VERE. Serve come estremo superiore — quanto si
  // guadagnerebbe sapendo in anticipo cosa faranno tutti — non come candidata: legge il
  // futuro, e nessuna cosa che legge il futuro puo' andare in produzione (E14).
  oracolo: {
    nome: 'oracolo',
    descrizione: 'ogni rivale riceve le sue soste vere (informazione dal futuro)',
    targhetta: 'NON E\' UNA CANDIDATA: legge il futuro (E14). E\' il tetto superiore contro cui misurare una regola vera.',
    candidata: false,
    // non dipende dal congelamento: le soste vere sono quelle a qualunque giro si congeli.
    // E' anche la ragione per cui la riparazione della cucitura ha lasciato i numeri identici.
    pianiRivali: (nomeSito, _freezeLap) => pianiVeriDi(nomeSito),
  },
};

// ═══════════════════════════════════════════════════════════ LE CONTROFIGURE
//
// Una controfigura non e' una regola: e' una TRASFORMAZIONE di un piano gia' prodotto.
// Prende cio' che la regola ha deciso e ne conserva tutto tranne l'unica cosa di cui si
// vuole sapere se porta informazione — il GIRO. Stessi rivali, stesso numero di soste,
// stesse mescole: se la controfigura vale quanto la regola, la regola non sapeva quando.

/** Quanti rivali, e quante soste ciascuno: la «forma» del piano, che si conserva. */
const forma = (piani) => Object.entries(piani ?? {})
  .filter(([, v]) => Array.isArray(v) && v.length)
  .map(([drv, v]) => [drv, v.length]);

/**
 * CONTROFIGURA DI LIVELLO — gli stessi rivali si fermano lo stesso numero di volte, a
 * giri estratti UNIFORMEMENTE nell'intervallo ammissibile (freezeLap, giroFinale).
 *
 * L'intervallo e' quello e non un altro perche' e' quello che il costruttore accetta:
 * scartera' comunque tutto cio' che sta fuori, e una controfigura che si facesse scartare
 * meta' delle soste sarebbe piu' debole della regola per un motivo che non c'entra col
 * caso. Le mescole si conservano: randomizzare anche quelle spegnerebbe due gradi di
 * liberta' insieme e non si saprebbe piu' quale dei due parla.
 */
export function controfiguraLivello(piani, { freezeLap, giroFinale, rnd }) {
  const out = {};
  for (const [drv, quante] of forma(piani)) {
    const basso = freezeLap + 1;
    const alto = giroFinale - 1;
    if (alto < basso) continue;
    const giri = new Set();
    // estrazione senza ripetizione: due soste allo stesso giro non sono un piano
    let tentativi = 0;
    while (giri.size < Math.min(quante, alto - basso + 1) && tentativi < 500) {
      giri.add(basso + Math.floor(rnd() * (alto - basso + 1)));
      tentativi += 1;
    }
    const ordinati = [...giri].sort((a, b) => a - b);
    out[drv] = ordinati.map((giro, i) => ({ giro, mescola: piani[drv][i]?.mescola ?? piani[drv][0].mescola }));
  }
  return out;
}

/**
 * CONTROFIGURA DI POSIZIONE — gli stessi rivali si fermano lo stesso numero di volte, ma
 * ai giri che la regola produrrebbe IN UN'ALTRA GARA, riscalati sulla lunghezza di questa.
 *
 * E' una barra piu' alta della precedente, ed e' voluto: i giri di un'altra gara sono
 * giri PLAUSIBILI (cadono dove cadono le soste vere), non rumore. Se la regola non batte
 * nemmeno questa, allora sapeva solo che «ci si ferma verso meta' gara» — che e' una cosa
 * vera ma che non richiede un motore.
 *
 * Il riscalamento e' proporzionale e dichiarato: giro' = freezeLap + (giro − fl_altra)
 * × (giriQui − freezeLap) / (giriAltra − fl_altra). Senza, una gara da 44 giri presterebbe
 * a una da 78 giri soste tutte nel primo terzo, e la controfigura perderebbe per un motivo
 * geometrico invece che informativo.
 */
export function controfiguraPosizione(piani, prestati, { freezeLap, giroFinale, giroFinaleAltra, freezeLapAltra }) {
  const out = {};
  const daPrestare = Object.values(prestati ?? {}).filter((v) => Array.isArray(v) && v.length);
  if (!daPrestare.length) return out;
  const spanQui = giroFinale - freezeLap;
  const spanLa = Math.max(1, giroFinaleAltra - freezeLapAltra);
  const scala = (giro) => {
    const g = Math.round(freezeLap + (giro - freezeLapAltra) * (spanQui / spanLa));
    return Math.min(giroFinale - 1, Math.max(freezeLap + 1, g));
  };
  let i = 0;
  for (const [drv, quante] of forma(piani)) {
    const presi = daPrestare[i % daPrestare.length];
    i += 1;
    const giri = [...new Set(presi.slice(0, quante).map((s) => scala(s.giro)))].sort((a, b) => a - b);
    if (!giri.length) continue;
    out[drv] = giri.map((giro, k) => ({ giro, mescola: piani[drv][k]?.mescola ?? piani[drv][0].mescola }));
  }
  return out;
}

/** L'ultimo giro registrato di una gara, letto dagli arrivi (fonte diversa dal byLap). */
export function giriDiGara(nomeSito) {
  const righe = perGara(nomeSito).map((r) => Number(r.giri)).filter(Number.isFinite);
  return righe.length ? Math.max(...righe) : null;
}
