// classifica.mjs — CHI E' DAVANTI, DI QUANTO, E CHI E' DOPPIATO. In un posto solo.
//
// Rispondeva alla stessa domanda in due punti del repo, con lo stesso identico modello:
//   - gara.html::classificaAt   sui cum_time REALI dei dati gara;
//   - ghostplay.mjs::classificaSim sui cum SIMULATI della scena rigiocata.
// Il commento della seconda lo ammetteva per iscritto — «STESSO modello del replay reale» —
// e cio' che condividevano non era un dettaglio: il cum interpolato a (L, f), l'ordine per
// quel cum, il conteggio dei doppiati sul battistrada ai giri L..L+3, e le tre etichette.
// Regola 1, ed E12 del catalogo. Qui ce n'e' una.
//
// COSA RESTA FUORI, perche' NON e' duplicato: la decorazione. La pagina-gara aggiunge lo
// stato del giro (mescola, eta', BOX/OUT, gomma che monta, durata dello stop, penalita',
// posizioni guadagnate) e la coda dei fuori-gara; la scena aggiunge il marcatore del
// fantasma. Sono cose diverse che vivono ai due capi, e metterle qui vorrebbe dire far
// conoscere a questo modulo la pagina che lo usa.
//
// LE TRE DIFFERENZE CONSERVATE, ciascuna con la sua ragione:
//   1. IL PAREGGIO. Con due cum identici, la pagina-gara ordina per (icum, cum_time, sigla)
//      — deterministico e stabile fra un frame e l'altro; la scena si affidava all'ordine
//      delle chiavi. Non si e' scelto «il piu' giusto»: si e' conservato quello che
//      ciascuna aveva, perche' cambiarlo avrebbe scambiato due righe in pagina senza che
//      nessuno lo avesse chiesto. `pareggio` dice quale.
//   2. L'ANCORA DEL PRIMO GIRO. In gara al giro 1 il cum precedente non esiste (i dati
//      partono dalla fine del giro 1) e si usa l'istante di partenza; nella scena si usa
//      il lead del giro prima del congelamento. E' lo stesso concetto — «da dove si
//      interpola» — con due sorgenti: `ancora`.
//   3. LA FASE GRIGLIA. Esiste solo in gara (giro 1, fermo): l'ordine e' quello di
//      partenza e i delta di cum_time NON sono distacchi di gara, quindi si sopprimono.
//      Chi non ha una griglia non passa `ordineGriglia` e la fase non scatta.

const ORIZZONTE_DOPPIAGGIO = 3;   // giri avanti su cui si guarda il battistrada

/** Il tempo del battistrada ai giri L..L+3: serve a sapere chi e' stato doppiato.
 *  @param celleAlGiro (k) => {sigla: cella} del giro k, o null
 *  @param ammesso     (sigla) => boolean, per escludere i non partenti
 *  @returns {Object} {giro: cum del battistrada} */
export function battistradaAiGiri(celleAlGiro, L, nLap, ammesso = () => true) {
  const out = {};
  for (let k = L; k <= Math.min(L + ORIZZONTE_DOPPIAGGIO, nLap); k++) {
    const celle = celleAlGiro(k);
    if (!celle) continue;
    let mn = Infinity;
    for (const [d, c] of Object.entries(celle)) {
      if (typeof c?.cum_time === 'number' && ammesso(d) && c.cum_time < mn) mn = c.cum_time;
    }
    if (mn < Infinity) out[k] = mn;
  }
  return out;
}

/** Il cum INTERPOLATO a (L, f): dove sarebbe il pilota a frazione f del giro L.
 *  Senza il giro precedente non si interpola e si tiene il cum di fine giro — mai un
 *  valore inventato per riempire il buco. */
export function cumInterpolato(cumPrec, cumCorr, f) {
  return (typeof cumPrec === 'number') ? cumPrec + f * (cumCorr - cumPrec) : cumCorr;
}

/** Quanti GIRI di ritardo ha questo pilota rispetto al battistrada. */
export function giriDiRitardo(battistrada, L, cumFineGiro) {
  let gd = 0;
  for (const k in battistrada) if (+k > L && cumFineGiro > battistrada[k]) gd = +k - L;
  return gd;
}

/** La classifica a (L, f). Ritorna [{drv, icum, pos, giriRitardo, distacco, et, cls, prev}].
 *  `et`/`cls` sono le etichette gia' formattate, identiche alle due versioni precedenti. */
export function classifica({ cumCorrente, cumPrecedente, ancora, primoGiro, f, L, nLap,
                             battistrada = {}, escludi = () => false,
                             pareggio = 'gara', ordineGriglia = null,
                             ripiegoAncora = false }) {
  if (!cumCorrente) return [];
  const righe = [];
  for (const [d, c] of Object.entries(cumCorrente)) {
    if (typeof c?.cum_time !== 'number' || escludi(d)) continue;
    // DA DOVE SI INTERPOLA. Al primo giro il cum precedente non esiste e si usa l'ancora.
    // Dopo, si usa il cum del pilota al giro prima — e se manca le due versioni facevano
    // cose DIVERSE: la scena ripiegava sul battistrada del giro precedente (perche' al
    // congelamento nessuno ha un «giro prima» proprio, e senza ripiego i distacchi
    // resterebbero congelati); la pagina-gara no, e lasciava il cum di fine giro cosi'
    // com'e'. Si conservano entrambe: `ripiegoAncora` dice quale.
    let prec;
    if (primoGiro) prec = ancora;
    else {
      const proprio = cumPrecedente?.[d]?.cum_time;
      prec = (typeof proprio === 'number') ? proprio : (ripiegoAncora ? ancora : undefined);
    }
    righe.push([d, c.cum_time, cumInterpolato(prec, c.cum_time, f)]);
  }

  const faseGriglia = !!(ordineGriglia && ordineGriglia.length && L === 1 && f === 0);
  if (faseGriglia) {
    const rank = {}; ordineGriglia.forEach((d, i) => rank[d] = i);
    righe.sort((a, b) => (rank[a[0]] ?? 999) - (rank[b[0]] ?? 999));
  } else if (pareggio === 'gara') {
    // deterministico: a pari cum interpolato decide il cum di fine giro, poi la sigla
    righe.sort((a, b) => (a[2] - b[2]) || (a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
  } else {
    righe.sort((a, b) => a[2] - b[2]);     // scena: come prima, nessun tie-break esplicito
  }

  const leader = righe.length ? righe[0][2] : 0;
  return righe.map(([drv, cumFine, icum], i) => {
    const gd = giriDiRitardo(battistrada, L, cumFine);
    const distacco = icum - leader;
    let et, cls = '', prev = null;
    if (faseGriglia) { et = i === 0 ? 'POLE' : '—'; cls = i === 0 ? 'lead' : ''; }
    else if (gd >= 1) { et = `+${gd} gir${gd > 1 ? 'i' : 'o'}`; cls = 'lapped'; }
    else if (i === 0) { et = 'LEADER'; cls = 'lead'; }
    else { et = `+${distacco.toFixed(1)}s`; prev = icum - righe[i - 1][2]; }
    return { drv, icum, cumFine, pos: i + 1, giriRitardo: gd, distacco, et, cls, prev };
  });
}
