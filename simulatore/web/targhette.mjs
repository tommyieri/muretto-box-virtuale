// targhette.mjs — la regola 2 resa IMPOSSIBILE da dimenticare.
//
// "Ogni numero mostrato o usato porta la sua natura: misurato su questa gara /
// misurato sul fondo / modello dichiarato / prior esterno — con data e, dove
// serve, banda."
//
// Qui la regola non è una convenzione da ricordare: è una funzione che RIFIUTA
// di produrre un numero senza targhetta. I componenti della pagina non toccano
// il DOM: restituiscono un ALBERO dichiarativo di nodi, e questo file sa
// camminarlo. Così l'audit del cancello P08 non è un grep sui sorgenti — è la
// verifica del vero output di ogni componente, su ogni scenario demo.
//
// Tre tipi di nodo, e basta:
//   el(tag, attributi, ...figli)  struttura
//   txt(testo)                    testo SENZA cifre (le cifre sono quantità)
//   num(valore, { targhetta })    quantità, targhetta obbligatoria
//
// Un testo che contiene cifre è respinto dall'audit, a meno che dichiari
// perché: è la porta da cui un numero senza targhetta entrerebbe in pagina
// travestito da parola.

export const NATURE = Object.freeze({
  MISURATO_QUESTA_GARA: 'misurato su questa gara',
  MISURATO_FONDO: 'misurato sul fondo',
  MODELLO_DICHIARATO: 'modello dichiarato',
  PRIOR_ESTERNO: 'prior esterno',
});

/**
 * Costruisce una targhetta valida, o fallisce. `n` e `banda` sono opzionali ma
 * se ci sono devono essere utilizzabili: una banda `[null, null]` sarebbe una
 * banda finta, peggio di nessuna banda.
 */
export function creaTarghetta({ natura, testo, data, n = null, banda = null }) {
  if (!Object.hasOwn(NATURE, natura)) {
    throw new Error(`natura sconosciuta: ${JSON.stringify(natura)} — ammesse: ${Object.keys(NATURE).join(', ')}`);
  }
  if (typeof testo !== 'string' || testo.trim() === '') throw new Error('targhetta senza testo: una natura senza spiegazione non spiega niente');
  if (typeof data !== 'string' || data.trim() === '') throw new Error('targhetta senza data (regola 2: con data)');
  if (n !== null && !(Number.isFinite(n) && n >= 0)) throw new Error(`n non utilizzabile: ${JSON.stringify(n)}`);
  if (banda !== null) {
    if (!Array.isArray(banda) || banda.length !== 2 || !banda.every((v) => Number.isFinite(v))) {
      throw new Error(`banda non utilizzabile: ${JSON.stringify(banda)} — una banda finta è peggio di nessuna banda`);
    }
    if (banda[0] > banda[1]) throw new Error(`banda invertita: ${JSON.stringify(banda)}`);
  }
  return Object.freeze({ natura, etichetta: NATURE[natura], testo, data, n, banda });
}

export const el = (tag, attributi = {}, ...figli) => ({ tag, attributi, figli: figli.flat().filter((f) => f !== null && f !== undefined) });
export const txt = (testo, opzioni = {}) => ({ testo: String(testo), ...opzioni });

/**
 * Una quantità mostrata. `targhetta` è obbligatoria e viene validata qui: non
 * esiste un percorso per mettere un numero in pagina senza dichiararne la
 * natura.
 *
 * `valore` può essere **null**: è l'assenza esplicita (regola 6). Un null
 * mostrato deve portare `motivo_soppressione` — mai uno zero al suo posto.
 */
export function num(valore, { unita = null, formato = 'decimale', targhetta, motivo_soppressione = null } = {}) {
  if (valore !== null && !Number.isFinite(valore)) throw new Error(`numero non utilizzabile: ${JSON.stringify(valore)}`);
  if (targhetta === undefined || targhetta === null) throw new Error(`numero ${valore} senza targhetta: vietato dalla regola 2`);
  if (!Object.hasOwn(NATURE, targhetta.natura)) throw new Error('targhetta non costruita da creaTarghetta');
  if (valore === null && (typeof motivo_soppressione !== 'string' || motivo_soppressione.trim() === '')) {
    throw new Error('un valore soppresso deve portare il motivo: mai uno zero che sembra un risultato, mai un vuoto senza spiegazione');
  }
  return { numero: valore, unita, formato, targhetta, motivo_soppressione };
}

/** Formattazione italiana: la virgola decimale, e il segno esplicito dove serve. */
export function formatta(nodo) {
  if (nodo.numero === null) return '—';
  const v = nodo.numero;
  // L'UNITA' VALE ANCHE PER GLI INTERI. Fino al 03/08/2026 questo ramo la buttava via:
  // la semi-ampiezza della banda arrivava in pagina come «2» nudo, accanto a «Incertezza
  // sulla posizione», e chi non e' tecnico non poteva sapere se fossero secondi, giri o
  // posizioni. Un numero senza unita' non e' piu' leggibile di un numero senza targhetta —
  // e' lo stesso difetto, un piano piu' in basso. (KPI P3.)
  if (nodo.formato === 'intero') return `${Math.round(v)}${nodo.unita ? ` ${nodo.unita}` : ''}`;
  if (nodo.formato === 'posizione') return `P${Math.round(v)}`;
  const decimali = nodo.formato === 'secondi' ? 1 : nodo.formato === 'preciso' ? 3 : 2;
  const segno = nodo.formato === 'delta' && v > 0 ? '+' : '';
  return `${segno}${v.toFixed(decimali).replace('.', ',')}${nodo.unita ? ` ${nodo.unita}` : ''}`;
}

const CIFRA = /\d/;

/**
 * L'AUDIT del cancello P08. Cammina l'albero di un componente e restituisce le
 * violazioni della regola 2. Non guarda gli attributi (la geometria di un SVG
 * non è una quantità mostrata): guarda le quantità e i testi.
 */
export function auditaAlbero(nodo, percorso = 'radice') {
  const violazioni = [];
  if (nodo === null || nodo === undefined) return violazioni;
  if (Array.isArray(nodo)) {
    nodo.forEach((f, i) => violazioni.push(...auditaAlbero(f, `${percorso}[${i}]`)));
    return violazioni;
  }
  if (Object.hasOwn(nodo, 'numero')) {
    if (!nodo.targhetta || !Object.hasOwn(NATURE, nodo.targhetta.natura)) {
      violazioni.push({ percorso, tipo: 'NUMERO_SENZA_TARGHETTA', dettaglio: `valore ${nodo.numero}` });
    }
    if (nodo.numero === null && !nodo.motivo_soppressione) {
      violazioni.push({ percorso, tipo: 'SOPPRESSIONE_SENZA_MOTIVO', dettaglio: 'valore null senza motivo' });
    }
    return violazioni;
  }
  if (Object.hasOwn(nodo, 'testo')) {
    if (CIFRA.test(nodo.testo) && !nodo.cifre_dichiarate) {
      violazioni.push({
        percorso, tipo: 'CIFRE_IN_TESTO',
        dettaglio: `"${nodo.testo}" — una quantità travestita da parola aggira la targhetta; usare num() o dichiarare cifre_dichiarate`,
      });
    }
    return violazioni;
  }
  if (Object.hasOwn(nodo, 'tag')) {
    nodo.figli.forEach((f, i) => violazioni.push(...auditaAlbero(f, `${percorso}>${nodo.tag}[${i}]`)));
    return violazioni;
  }
  violazioni.push({ percorso, tipo: 'NODO_SCONOSCIUTO', dettaglio: JSON.stringify(nodo).slice(0, 120) });
  return violazioni;
}

/** Tutte le quantità dell'albero, per contarle e ispezionarle nei test. */
export function raccogliNumeri(nodo, fuori = []) {
  if (nodo === null || nodo === undefined) return fuori;
  if (Array.isArray(nodo)) { nodo.forEach((f) => raccogliNumeri(f, fuori)); return fuori; }
  if (Object.hasOwn(nodo, 'numero')) { fuori.push(nodo); return fuori; }
  if (Object.hasOwn(nodo, 'tag')) { nodo.figli.forEach((f) => raccogliNumeri(f, fuori)); return fuori; }
  return fuori;
}
