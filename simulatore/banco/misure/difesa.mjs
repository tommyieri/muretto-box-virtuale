// difesa.mjs — i cancelli D1…D4 di PREREG_difesa.md, eseguiti.
//
// Non misura il rientro: quella misura esiste già (`misure/rientro.mjs`) e vive
// in un posto solo (regola 1). Qui si prende il suo elenco di casi — soste
// VERE, mai finestre senza sosta (E16) — e si calibra la banda sulla posizione.
//
// La banda è l'unica risposta ammessa a «e se qualcuno si difende?». Non si
// costruisce una probabilità di sorpasso: il duello non si simula, si riproduce
// QUANTI cambi avvengono e non QUALI. Nel 2026 il DRS non esiste.

import { mediana } from './bias.mjs';

/** Semi-ampiezza intera minima che copre almeno `q` degli errori. */
function bandaMinima(errori, q) {
  if (errori.length === 0) return null;
  const massimo = Math.max(...errori.map((e) => Math.abs(e)));
  for (let n = 0; n <= massimo; n += 1) {
    if (errori.filter((e) => Math.abs(e) <= n).length / errori.length >= q) return n;
  }
  return massimo;
}

const copertura = (errori, n) =>
  (errori.length === 0 ? null : errori.filter((e) => Math.abs(e) <= n).length / errori.length);

/**
 * LA BANDA ASIMMETRICA PIU' STRETTA che copre `q`.
 *
 * Serve quando D4 dice che una banda simmetrica nasconderebbe un bias: se la
 * previsione e' storta, allargare da tutte e due le parti copre pagando due
 * volte, e la parte che non serve la paga l'utente in vaghezza. Qui si cerca
 * l'intervallo [-sopra, +sotto] di ampiezza MINIMA che copre la quota chiesta.
 *
 * Convenzione dei segni, scritta perche' e' il posto dove ci si sbaglia:
 * l'errore e' `e = prevista - reale`, quindi la posizione vera sta dentro la
 * banda [prevista - sotto, prevista + sopra] esattamente quando
 * `-sopra <= e <= sotto`. Un bias positivo (il motore mette il pilota piu'
 * INDIETRO del vero) chiede percio' un `sotto` grande, non un `sopra`.
 *
 * Con bias nullo la ricerca restituisce l'intervallo simmetrico: la funzione
 * generalizza `bandaMinima` invece di affiancarla.
 */
function bandaAsimmetricaMinima(errori, q) {
  if (errori.length === 0) return null;
  const massimo = Math.max(...errori.map((e) => Math.abs(e)));
  for (let larghezza = 0; larghezza <= 2 * massimo; larghezza += 1) {
    let migliore = null;
    for (let sotto = 0; sotto <= larghezza; sotto += 1) {
      const sopra = larghezza - sotto;
      const q_ = errori.filter((e) => e >= -sopra && e <= sotto).length / errori.length;
      // a parita' di larghezza si preferisce la piu' centrata: fra due bande che
      // coprono uguale, quella meno sbilanciata e' la meno arbitraria
      if (q_ >= q && (migliore === null || Math.abs(sotto - sopra) < Math.abs(migliore.sotto - migliore.sopra))) {
        migliore = { sotto, sopra };
      }
    }
    if (migliore) return migliore;
  }
  return { sotto: massimo, sopra: massimo };
}

const coperturaBanda = (errori, banda) => (errori.length === 0 ? null
  : errori.filter((e) => e >= -banda.sopra && e <= banda.sotto).length / errori.length);

/**
 * D1 · la banda, calibrata leave-one-race-out. Per ogni gara: `n` dalle altre,
 * copertura su quella tenuta fuori. Il cancello chiede due cose — che copra, e
 * che sia la PIÙ PICCOLA che copre: una banda imbottita coprirebbe tutto senza
 * dire niente.
 */
export function calibraBanda(casi, { q, minGare, minCasi }) {
  if (casi.length < minCasi) {
    return { sufficiente: false, n: null, motivo: `${casi.length} casi, minimo ${minCasi}` };
  }
  const gare = [...new Set(casi.map((c) => c.gara))].sort();
  if (gare.length < minGare) {
    return { sufficiente: false, n: null, motivo: `${gare.length} gare, minimo ${minGare} per un leave-one-race-out` };
  }

  // dentro campione: la banda che il prodotto userebbe
  const errori = casi.map((c) => c.errore);
  const n = bandaMinima(errori, q);
  // D4 decide la FORMA della banda, e la decide sul campione intero: se la
  // previsione e' storta di almeno una posizione, una banda simmetrica coprirebbe
  // pagando due volte — e la meta' che non serve la paga l'utente in vaghezza.
  const asimmetrica = Math.abs(mediana(errori)) >= 1;
  // la banda si CERCA della forma decisa. Prima si cercava sempre simmetrica e
  // l'asimmetria veniva solo dichiarata a valle: il file diceva una banda e la
  // copertura ne misurava un'altra.
  // PROVATA E RESPINTA, il 01/08/2026, e resta a referto perche' il prossimo che
  // legge D4 rosso avra' la stessa idea: cercare la banda ASIMMETRICA piu' stretta
  // (con `bandaAsimmetricaMinima`, qui sopra) porta la copertura fuori campione di
  // NEUTRA da 77,4% a 58,3%. Con 84 casi e posizioni intere l'asimmetria si adatta
  // alla piega del fold e non generalizza: e' overfitting, non correzione di bias.
  // La banda resta percio' SIMMETRICA, e D4 resta rosso — cioe' dichiarato aperto,
  // che e' meglio di chiuso male. La strada giusta non e' compensare il bias con la
  // banda: e' toglierlo dalla previsione (il rodaggio della gomma nuova, misurato
  // a −0,275 s/giro sui giri 2-8 dopo la sosta, e' il primo indiziato).
  // LA BANDA SI SPOSTA, non si ri-cerca. Un grado di liberta' solo: la larghezza
  // resta quella simmetrica minima, e l'intervallo trasla del bias mediano
  // arrotondato. Corregge una previsione storta senza adattarsi alla piega del
  // campione — che e' l'errore in cui e' caduta la ricerca a due gradi (sopra).
  const bandaDi = (e) => {
    const m = bandaMinima(e, q);
    const b = asimmetrica ? Math.round(mediana(e)) : 0;
    return { sotto: m + Math.max(0, b), sopra: m - Math.min(0, b) };
  };
  const banda = bandaDi(errori);

  // fuori campione: la copertura vera, e quella di una posizione piu' stretta
  // (dal lato largo) per la minimalita'
  let coperti = 0;
  let copertiSotto = 0;
  let totale = 0;
  const perGara = {};
  for (const gara of gare) {
    const fuori = casi.filter((c) => c.gara === gara);
    const dentro = casi.filter((c) => c.gara !== gara).map((c) => c.errore);
    if (dentro.length === 0 || fuori.length === 0) continue;
    const bLoo = bandaDi(dentro);
    const stretta = bLoo.sotto >= bLoo.sopra
      ? { sotto: Math.max(0, bLoo.sotto - 1), sopra: bLoo.sopra }
      : { sotto: bLoo.sotto, sopra: Math.max(0, bLoo.sopra - 1) };
    const e = fuori.map((c) => c.errore);
    coperti += e.filter((x) => x >= -bLoo.sopra && x <= bLoo.sotto).length;
    copertiSotto += e.filter((x) => x >= -stretta.sopra && x <= stretta.sotto).length;
    totale += e.length;
    perGara[gara] = { n_casi: e.length, n_loo: bLoo.sotto === bLoo.sopra ? bLoo.sotto : `-${bLoo.sopra}/+${bLoo.sotto}`,
                      copertura: Number((coperturaBanda(e, bLoo)).toFixed(4)) };
  }

  const coperturaLoo = totale ? coperti / totale : null;
  const coperturaSotto = totale ? copertiSotto / totale : null;
  // D4: una banda simmetrica attorno a una previsione storta copre e mente.
  // `asimmetrica` e' gia' stato deciso sopra, perche' decide anche la RICERCA.
  const biasMediano = mediana(errori);

  return {
    sufficiente: true,
    n,
    n_casi: casi.length,
    n_gare: gare.length,
    copertura_dentro_campione: Number(coperturaBanda(errori, banda).toFixed(4)),
    copertura_fuori_campione: Number(coperturaLoo.toFixed(4)),
    copertura_fuori_campione_n_meno_1: Number(coperturaSotto.toFixed(4)),
    copre: coperturaLoo >= q,
    minimale: coperturaSotto < q,
    passa: coperturaLoo >= q && coperturaSotto < q,
    // D4
    bias_mediano_posizioni: Number(biasMediano.toFixed(4)),
    asimmetrica,
    // la banda DICHIARATA e' quella su cui la copertura e' stata misurata, non
    // una derivata dal bias a posteriori: erano due bande diverse
    banda_dichiarata: banda,
    per_gara: perGara,
  };
}

/**
 * Il generatore del test di permutazione. Esportato perché la sentinella possa
 * MISURARLO invece di fidarsene: un p-value estratto da un generatore storto non
 * è un p-value.
 *
 * È già successo. La prima stesura usava un LCG classico
 * (`stato * 1103515245 + 12345`) in aritmetica JS: il prodotto supera 2^53, i
 * bit bassi si perdono nel float, e sono esattamente quelli che l'AND a 31 bit
 * conserva. Non era degenere — il mescolamento spostava ~10 etichette su 20 — ma
 * era misurabilmente NON uniforme: chi² = 170 sui decili di 200.000 estrazioni,
 * contro una soglia al 5% di 16,92.
 *
 * Questo è mulberry32: ogni moltiplicazione passa da `Math.imul`, esatta a 32
 * bit, quindi non c'è niente da perdere nel float. Misurato: chi² = 3,91.
 */
export function creaGeneratore(seme) {
  let stato = seme >>> 0;
  return () => {
    stato = (stato + 0x6D2B79F5) >>> 0;
    let t = stato;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un rientro è CONTESO se almeno un rivale è entro `soglia` s di cum previsto. */
export const conteso = (caso, soglia) => caso.gap_previsti_s.some((g) => g <= soglia);

/**
 * D2 · il contesto separa? Differenza fra le mediane di |errore|, nulla per
 * permutazione dell'etichetta DENTRO la gara (blocchi = gare, E11).
 *
 * La clausola direzionale è parte del cancello, non un commento: un effetto
 * forte col segno all'incontrario — previsione più affidabile proprio dove c'è
 * traffico — è un difetto, non una scoperta.
 */
export function separaIlContesto(casi, { soglia, permutazioni, alpha, seme }) {
  const conEtichetta = casi.map((c) => ({ gara: c.gara, err: Math.abs(c.errore), conteso: conteso(c, soglia) }));
  const contesi = conEtichetta.filter((x) => x.conteso);
  const puliti = conEtichetta.filter((x) => !x.conteso);
  if (contesi.length === 0 || puliti.length === 0) {
    return { eseguibile: false, motivo: `un gruppo è vuoto (contesi ${contesi.length}, puliti ${puliti.length})`, soglia };
  }
  const statistica = (elenco) => {
    const c = elenco.filter((x) => x.conteso).map((x) => x.err);
    const p = elenco.filter((x) => !x.conteso).map((x) => x.err);
    if (c.length === 0 || p.length === 0) return null;
    return mediana(c) - mediana(p);
  };
  const osservata = statistica(conEtichetta);

  const random = creaGeneratore(seme);

  const perGara = new Map();
  for (const x of conEtichetta) {
    if (!perGara.has(x.gara)) perGara.set(x.gara, []);
    perGara.get(x.gara).push(x);
  }
  let almenoEstremi = 0;
  let valide = 0;
  for (let r = 0; r < permutazioni; r += 1) {
    const permutato = [];
    for (const gruppo of perGara.values()) {
      const etichette = gruppo.map((x) => x.conteso);
      for (let i = etichette.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [etichette[i], etichette[j]] = [etichette[j], etichette[i]];
      }
      gruppo.forEach((x, i) => permutato.push({ ...x, conteso: etichette[i] }));
    }
    const s = statistica(permutato);
    if (s === null) continue;
    valide += 1;
    if (Math.abs(s) >= Math.abs(osservata)) almenoEstremi += 1;
  }
  const p = valide ? (almenoEstremi + 1) / (valide + 1) : null;
  // attesa direzionale: i contesi sbagliano DI PIÙ
  const direzioneAttesa = osservata > 0;

  return {
    eseguibile: true,
    soglia,
    n_contesi: contesi.length,
    n_puliti: puliti.length,
    mediana_errore_contesi: Number(mediana(contesi.map((x) => x.err)).toFixed(4)),
    mediana_errore_puliti: Number(mediana(puliti.map((x) => x.err)).toFixed(4)),
    differenza_mediane: Number(osservata.toFixed(4)),
    p_permutazione: p === null ? null : Number(p.toFixed(5)),
    permutazioni_valide: valide,
    significativo: p !== null && p < alpha,
    attesa_direzionale_contesi_sbagliano_di_piu: direzioneAttesa,
    // il cancello è la CONGIUNZIONE: significatività E direzione
    separa: p !== null && p < alpha && direzioneAttesa,
  };
}

/**
 * La fase intera. `casi` arriva da `misuraRientro`: soste VERE e nient'altro.
 */
export function misuraDifesa(rientro, { cancelli, secchi }) {
  const casi = rientro.casi;
  const opzioni = { q: cancelli.livello_banda, minGare: cancelli.min_gare, minCasi: cancelli.min_casi_secco };

  const complessiva = calibraBanda(casi, opzioni);
  const perSecco = {};
  for (const nome of secchi) {
    perSecco[nome] = calibraBanda(casi.filter((c) => c.secco === nome), opzioni);
  }

  // ── IL SECCO CHE IL PRODOTTO PUÒ DAVVERO USARE ───────────────────────────
  // La prereg dava per scontato che «il prodotto usa il secco della domanda».
  // Non è vero in verde: distinguere PULITA da SOSTE_RIVALI richiede di sapere
  // se i rivali si fermeranno, che al congelamento è informazione del futuro
  // (E14) — ed è esattamente l'ignoranza che il secco SOSTE_RIVALI esiste per
  // misurare invece di nasconderla. Quindi in verde la banda del prodotto è
  // calibrata sull'UNIONE dei due secchi: è la banda che copre entrambi i casi
  // in cui potremmo essere, e non promette una precisione che dipende da un
  // dato che non abbiamo. Sotto regime il secco è noto (NEUTRA) e si usa quello.
  const perProdotto = {
    VERDE: calibraBanda(casi.filter((c) => c.regime === null), opzioni),
    NEUTRA: perSecco.NEUTRA,
  };

  // D2 alla soglia dichiarata, e la sensibilità su tutte quelle registrate
  const contesto = separaIlContesto(casi, {
    soglia: cancelli.soglia_vicinanza_s, permutazioni: cancelli.permutazioni,
    alpha: cancelli.alpha, seme: cancelli.seme,
  });
  const sensibilita = cancelli.soglie_sensibilita.map((s) => {
    const r = separaIlContesto(casi, { soglia: s, permutazioni: cancelli.permutazioni, alpha: cancelli.alpha, seme: cancelli.seme });
    return {
      soglia: s, n_contesi: r.n_contesi ?? 0, differenza_mediane: r.differenza_mediane ?? null,
      p: r.p_permutazione ?? null, separa: r.separa ?? false, dichiarata: s === cancelli.soglia_vicinanza_s,
    };
  });

  const sufficienti = Object.entries(perSecco).filter(([, b]) => b.sufficiente);
  return {
    n_casi: casi.length,
    n_gare: [...new Set(casi.map((c) => c.gara))].length,
    complessiva,
    per_secco: perSecco,
    per_prodotto: perProdotto,
    nota_per_prodotto: 'in verde il prodotto NON sa se i rivali si fermeranno (sarebbe informazione dal futuro, E14): la sua banda è calibrata sull\'unione di PULITA e SOSTE_RIVALI. Sotto regime il secco è noto e si usa NEUTRA',
    secchi_sufficienti: sufficienti.map(([n]) => n),
    contesto,
    sensibilita_soglia: sensibilita,
    // D1 su tutti i secchi sufficienti e sul complessivo
    d1_passa: complessiva.passa === true
      && sufficienti.every(([, b]) => b.passa === true)
      && Object.values(perProdotto).every((b) => b.sufficiente && b.passa === true),
    d1_falliti: [
      ...(complessiva.passa ? [] : [{ secco: 'COMPLESSIVA', ...complessiva }]),
      ...sufficienti.filter(([, b]) => !b.passa).map(([n, b]) => ({ secco: n, ...b })),
      ...Object.entries(perProdotto).filter(([, b]) => !b.sufficiente || !b.passa).map(([n, b]) => ({ secco: `PRODOTTO/${n}`, ...b })),
    ],
    d2_separa: contesto.separa === true,
    // D4: i secchi con bias mediano ≥ 1 posizione devono essere dichiarati asimmetrici
    d4_asimmetrici: Object.entries(perSecco).filter(([, b]) => b.sufficiente && b.asimmetrica).map(([n]) => n),
    // D4, LETTO COME LA SUA PREREG LO SCRIVE. Il verificatore precedente pretendeva
    // ZERO secchi asimmetrici, cioe' diventava rosso esattamente quando il modello
    // faceva la cosa giusta — PREREG_difesa.md §D4 non chiede che l'asimmetria non
    // esista, chiede che quando c'e' «la banda di quel secco viene dichiarata
    // asimmetrica e mostrata come tale, non centrata su un numero che si sa spostato».
    // Il difetto era a registro in ROSSE_DICHIARATE.json dal 02/08 con la sua diagnosi
    // («va corretto il verificatore, non il modello») e qui viene chiuso.
    //
    // Cio' che si sorveglia adesso e' la COERENZA fra le due cose: chi ha il bias ha la
    // banda traslata, chi non ce l'ha non ce l'ha. Ha potere di fallire in entrambi i
    // versi — una banda spostata senza bias sarebbe un adattamento al campione, un bias
    // senza banda spostata sarebbe esattamente la banda che mente.
    d4_non_dichiarati: Object.entries(perSecco)
      .filter(([, b]) => b.sufficiente)
      .filter(([, b]) => {
        const traslata = b.banda_dichiarata && b.banda_dichiarata.sotto !== b.banda_dichiarata.sopra;
        return b.asimmetrica !== traslata;
      })
      .map(([n, b]) => `${n} (bias ${b.bias_mediano_posizioni}, banda ${b.banda_dichiarata?.sotto}/${b.banda_dichiarata?.sopra})`),
  };
}
