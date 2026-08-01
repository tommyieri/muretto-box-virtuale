// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/provenienza/pitloss.mjs
//   generato: simulatore/web/trasporta_motore.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste
// solo per essere ESEGUITA dal pannello live, dove il pre-calcolo non puo'
// esistere. Modificare QUESTO file lo fa divergere dall'originale, e
// `node web/trasporta_motore.mjs --verifica` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
// pitloss.mjs — la perdita ai box che il banco dà al kernel, con targhetta.
//
// È un PRIOR ESTERNO (regola 2): 2.106 stop misurati 2022-26, file
// `data/priors/pitloss_priors.json`. Non è misurato sul nostro fondo, e finché
// non lo sarà ogni numero che ne dipende porta questa etichetta. Il kernel non
// conosce pit-loss di circuito e non ne inventa uno: glielo passa chi chiama.
//
// La mappa gara → circuito sta QUI e solo qui, ed è esplicita: una gara senza
// misura di circuito NON prende un numero somigliante di nascosto, prende il
// `_fallback` d'era ED è marcata `fallback: true` nel report. Un prior generico
// spacciato per misura di circuito sarebbe la stessa famiglia di E13.
//
// ── PROMOZIONE (banco/prereg/PREREG_pitloss.md) ─────────────────────────────
// Dove la MISURA INTERNA sul fondo ha superato il cancello A, è quella a
// valere, e la targhetta diventa `misurato sul fondo`. Dove non l'ha superato
// resta il prior, con la sua targhetta invariata. Nessun valore misto: mediare
// due fonti darebbe un numero senza natura, e la regola 2 non saprebbe che
// targhetta dargli.

// Questo modulo e' PURO (nessun node:fs): il caricamento del prior sta in
// pitloss_dati.mjs. Serve perche' `perditaBox` gira anche nel browser, sotto il
// pannello live — e un import di 'node:fs' qui lo renderebbe non caricabile.

// Solo i circuiti che il prior misura davvero. Le gare non elencate usano il
// fallback dichiarato: Australia (Melbourne), Canada (Montreal — il prior
// dichiara zero stop green puliti nel 2026), Cina, Giappone, Ungheria.
export const CIRCUITO_PER_GARA = Object.freeze({
  Austria: 'spielberg',
  Belgio: 'spa',
  GranBretagna: 'silverstone',
  Miami: 'miami',
  Monaco: 'monaco',
  Spagna: 'barcelona',
});

// Gara 2026 → Gran Premio del fondo, per leggere la misura interna. È una mappa
// di NOMI, dichiarata: il fondo raggruppa per Gran Premio (vedi il limite
// dichiarato nella targhetta della misura interna).
export const GP_PER_GARA = Object.freeze({
  Australia: 'Australian_Grand_Prix',
  // Olanda aggiunta il 01/08/2026, VENTIDUE GIORNI PRIMA della gara. Non e' una
  // taratura sull'holdout: la misura interna di Zandvoort (22,382 s su 85 soste
  // verdi) viene dalle gare 2021-2025, che il 23 agosto non ha mai visto. Senza
  // questa riga il motore avrebbe usato il ripiego d'era (22,1 s) dichiarando
  // «circuito NON misurato ne' dal prior ne' dal fondo» — una frase falsa, perche'
  // il fondo lo misura e lo ha promosso. La sentinella s31 impedisce che succeda
  // di nuovo alla prossima pista nuova.
  Olanda: 'Dutch_Grand_Prix',
  Austria: 'Austrian_Grand_Prix',
  Belgio: 'Belgian_Grand_Prix',
  Canada: 'Canadian_Grand_Prix',
  Cina: 'Chinese_Grand_Prix',
  Giappone: 'Japanese_Grand_Prix',
  GranBretagna: 'British_Grand_Prix',
  Miami: 'Miami_Grand_Prix',
  Monaco: 'Monaco_Grand_Prix',
  Spagna: 'Spanish_Grand_Prix',
  Ungheria: 'Hungarian_Grand_Prix',
  // ── il resto della stagione 2026, aggiunto il 01/08 ──────────────────────
  // La sentinella s31, estesa a tutte e 22 le gare invece che alle sole
  // pubblicate, ha mostrato che l'Olanda non era un caso isolato: OGNI gara
  // ancora da correre cadeva nel ripiego pur avendo una misura promossa sul
  // fondo.
  Italia: 'Italian_Grand_Prix',
  Azerbaigian: 'Azerbaijan_Grand_Prix',
  Singapore: 'Singapore_Grand_Prix',
  StatiUniti: 'United_States_Grand_Prix',
  Messico: 'Mexico_City_Grand_Prix',
  SanPaolo: 'São_Paulo_Grand_Prix',
  Qatar: 'Qatar_Grand_Prix',
  AbuDhabi: 'Abu_Dhabi_Grand_Prix',
  LasVegas: 'Las_Vegas_Grand_Prix',
  // MADRID NON C'E', ED E' UNA DECISIONE. Derivare la mappa dal nome dell'evento
  // — la strada che sembra ovvia — darebbe `Madrid -> Spanish_Grand_Prix`, cioe'
  // assegnerebbe a un circuito che non ha mai ospitato una gara la storia di
  // BARCELLONA. Un pit-loss preso da un'altra pista non e' un'approssimazione: e'
  // la famiglia di E13, un prior generico spacciato per misura di circuito.
  // Madrid resta sul ripiego d'era, marcata `fallback: true`, ed e' la risposta
  // giusta: di quel pit-lane non sappiamo niente, e va detto.
});

// Le gare che cadono nel ripiego PER SCELTA, non per dimenticanza. Ognuna con il
// suo motivo: la sentinella s31 le ammette solo se sono qui, cosi' un buco vero
// non puo' nascondersi dietro «sara' voluto».
export const RIPIEGO_DICHIARATO = Object.freeze({
  Madrid: 'circuito NUOVO nel 2026 (Madring): il fondo non ha nessuna gara su questo tracciato. '
    + 'L\'evento si chiama Spanish Grand Prix, ma la storia con quel nome e\' di Barcellona, che e\' un\'altra pista.',
});

/**
 * Il FATTORE di neutralizzazione, con la stessa gerarchia della perdita verde:
 * misura interna se promossa, altrimenti prior esterno.
 *
 * La parte verde è stata promossa a misura interna su 26 GP mentre questa metà
 * è rimasta un prior esterno mai validato in casa: `esporta_neutralizzazione_fondo.mjs`
 * chiude quell'asimmetria. Il fattore promosso vive in
 * `prior.fattori_neutralizzazione_interni`, e finché `promosso` non è `true` non
 * tocca nessuna risposta — la promozione è il cancello N3 di
 * `ai_lab/confronto/PREREG_neutralizzazione.md`, non un valore che compare in un file.
 */
export function fattoreDi(prior, regime) {
  if (regime === null) return { fattore: 1, fattore_fonte: 'verde', fattore_targhetta: 'sosta in verde: si paga la perdita intera' };
  const interni = prior.fattori_neutralizzazione_interni;
  const x = interni?.[regime];
  if (x && interni.promosso === true && typeof x.mediana === 'number') {
    return {
      fattore: x.mediana,
      fattore_fonte: 'misura_interna',
      fattore_targhetta: `MISURATO sul fondo: mediana di ${x.n} soste sotto ${regime} su ${x.n_gare} gare `
        + `(IC95 ${x.ic95 ? `${x.ic95[0]}–${x.ic95[1]}` : 'non calcolabile'}); `
        + `dispersione dichiarata p25-p75 ${x.p25}–${x.p75}: il fattore è una MEDIANA, non una costante`,
    };
  }
  const f = prior.fattori_neutralizzazione[regime];
  return {
    fattore: f,
    fattore_fonte: 'prior_esterno',
    fattore_targhetta: `PRIOR ESTERNO CON BANDA (SC 0,40-0,60 · VSC 0,60-0,70), usato al valore centrale ${f}`,
  };
}

/**
 * Perdita in secondi per una sosta in quella gara, sotto quel regime.
 * `regime` ∈ {null, 'SC', 'VSC'}: sotto neutralizzazione si paga solo una
 * frazione della perdita verde — vedi `fattoreDi` per la provenienza del fattore.
 */
export function perditaBox(prior, gara, regime = null) {
  const { fattore, fattore_fonte, fattore_targhetta } = fattoreDi(prior, regime);
  if (typeof fattore !== 'number') throw new Error(`regime senza fattore dichiarato: ${regime}`);

  // 1. la misura interna, se questo Gran Premio è stato PROMOSSO
  const gp = GP_PER_GARA[gara];
  const interna = gp ? prior.misura_interna?.circuiti?.[gp] : null;
  if (interna && interna.cancello_A?.promosso === true) {
    return {
      perdita: interna.mediana_green_s * fattore,
      perdita_verde: interna.mediana_green_s,
      clean_10pct_s: interna.clean_10pct_s,
      circuito: gp,
      fonte: 'misura_interna',
      fallback: false,
      regime,
      fattore,
      fattore_fonte,
      fattore_targhetta,
      targhetta: `misurato sul fondo 2018-2025: mediana di ${interna.n_soste} soste verdi su asciutto a ${gp} (IC95 ${interna.ic95_mediana ? `${interna.ic95_mediana[0]}–${interna.ic95_mediana[1]}` : 'non calcolabile'} s)`,
    };
  }

  // 2. altrimenti il prior esterno, con la sua targhetta invariata
  const cid = CIRCUITO_PER_GARA[gara];
  const misura = cid ? prior.circuiti[cid] : prior.circuiti._fallback;
  const medianaVerde = misura.mediana_green_s;
  return {
    perdita: medianaVerde * fattore,
    perdita_verde: medianaVerde,
    clean_10pct_s: misura.clean_10pct_s ?? null,
    circuito: cid ?? '_fallback',
    fonte: 'prior_esterno',
    fallback: !cid,
    regime,
    fattore,
    fattore_fonte,
    fattore_targhetta,
    targhetta: cid
      ? `prior esterno, mediana green misurata a ${cid} (${misura.qualita}) — il fondo non ha promosso questo circuito`
      : 'prior esterno, mediana d\'era 22,1 s — circuito NON misurato ne\' dal prior ne\' dal fondo, valore di ripiego dichiarato',
  };
}
