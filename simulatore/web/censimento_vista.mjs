#!/usr/bin/env node
// censimento_vista.mjs — QUALE CAMPO DELLA VISTA NON ARRIVA IN PAGINA?
//
//     node simulatore/web/censimento_vista.mjs              elenco leggibile
//     node simulatore/web/censimento_vista.mjs --verifica   esce 1 sugli orfani non dichiarati
//     node simulatore/web/censimento_vista.mjs --json       artefatto con targhetta
//
// IL BUCO CHE CHIUDE. Il generatore proietta la vista CAMPO PER CAMPO: se un campo non
// viene copiato, o viene copiato e nessuno lo legge, non succede niente di rumoroso — la
// pagina si disegna lo stesso, semplicemente senza quella cosa. E' cosi' che il campo
// `finestra` e' rimasto invisibile per un mese: calcolato, dichiarato in una decisione del
// PO, e mai reso. Nessun guardiano poteva vederlo, perche' ogni guardiano guardava cio' che
// ARRIVA in pagina. Questo censimento guarda cio' che NON ci arriva.
//
// COME. Non per grep — cercare il nome di un campo nei sorgenti darebbe falsi positivi (un
// commento) e falsi negativi (una destrutturazione con rinomina). Si RENDE davvero la
// pagina, con la vista avvolta in un Proxy che registra ogni lettura. Cio' che il Proxy non
// ha mai visto leggere, nessun componente lo legge — e non e' un'inferenza, e' un fatto
// osservato su ogni scenario committato.
//
// LA NORMALIZZAZIONE DEI PERCORSI, dichiarata perche' cambia i conteggi:
//  · gli indici di array collassano in `campo[]` — leggere l'elemento 0 conta come leggere
//    l'array, ed e' giusto: il componente cicla, non sceglie la posizione;
//  · le mappe con chiave-pilota collassano in `<DRV>` — venti sigle sono un campo, non venti.
//
// COSA LO FA USCIRE 1 (--verifica):
//  (a) un campo emesso dalla vista non e' letto da nessun componente E non e' dichiarato in
//      demo/DEBITO_DEMO.json;
//  (b) una voce del registro non corrisponde piu' a nessun campo orfano — cioe' il registro
//      descrive un debito che non esiste piu', che e' l'altro modo di mentire.
//
// COSA NON COPRE, e va detto: la vista di PRODUZIONE. Questa e' la vista del demo
// (`web/vista/demo.json`, generata da `genera_vista.mjs`). Il sito pubblico usa un altro
// generatore (`genera_vista_gara.mjs`) e un'altra vista, e li' il censimento non arriva.
// E' un limite dichiarato, a registro nel debito, non una svista.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pannello } from './pannello.mjs';
import { curva } from './curva.mjs';
import { mappa } from './mappa.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.join(QUI, '..', '..');
const ARGV = process.argv.slice(2);
const VERIFICA = ARGV.includes('--verifica');
const JSON_OUT = ARGV.includes('--json');

const VISTA = path.join(QUI, 'vista', 'demo.json');
const REGISTRO = path.join(RADICE, 'demo', 'DEBITO_DEMO.json');

// una sigla pilota: tre maiuscole. E' la stessa forma usata in tutto il repo.
const SIGLA = /^[A-Z]{2,3}$/;
const chiave = (base, k, dentroArray) => {
  if (dentroArray) return `${base}[]`;
  if (SIGLA.test(k)) return `${base}.<DRV>`;
  return base ? `${base}.${k}` : k;
};

/** Cammina la vista e raccoglie TUTTI i percorsi strutturali emessi. */
function emessi(o, base, out) {
  if (o === null || typeof o !== 'object') return out;
  if (Array.isArray(o)) {
    for (const v of o) emessi(v, `${base}[]`, out);
    if (o.length) out.add(`${base}[]`);
    return out;
  }
  for (const [k, v] of Object.entries(o)) {
    const p = chiave(base, k, false);
    out.add(p);
    emessi(v, p, out);
  }
  return out;
}

/**
 * La vista avvolta: ogni lettura di campo finisce in `visti`.
 *
 * IL PUNTO CIECO CHE QUESTA FUNZIONE HA DOVUTO CHIUDERE, e va scritto perche' un
 * censimento che sotto-conta e' peggio di nessun censimento — dice «tutto a posto» sui
 * campi che non sa vedere.
 *
 * `pannello.mjs` comincia con `const scenario = { ...s, _data: ... }`. Lo spread chiede
 * TUTTE le chiavi di primo livello dello scenario, quindi con un Proxy ingenuo ognuna
 * risulta «letta» anche se nessuno la usa: `pavimento_s`, `violazioni_director`,
 * `sospetti_director`, `sotto_neutralizzazione` sparivano dall'elenco degli orfani. Il
 * difetto e' emerso incrociando questo strumento con un censimento indipendente fatto per
 * grep, che ne trovava di piu' — e la differenza era tutta li'.
 *
 * COME SI DISTINGUE UNO SPREAD DA UNA LETTURA VERA. L'algoritmo di copia delle proprieta'
 * chiama, per ogni chiave, `[[GetOwnProperty]]` (per sapere se e' enumerabile) e SOLO POI
 * `[[Get]]`. Un accesso normale `oggetto.campo` non passa mai da `[[GetOwnProperty]]`.
 * Quindi: si marca la chiave nel trap `getOwnPropertyDescriptor` e, se il `get` che segue
 * la trova marcata, non lo si conta. Non e' un'euristica sui nomi: e' la differenza fra
 * due operazioni del linguaggio.
 */
function spia(o, base, visti, copiati) {
  if (o === null || typeof o !== 'object') return o;
  const enumerate = new Set();
  return new Proxy(o, {
    getOwnPropertyDescriptor(t, k) { enumerate.add(k); return Reflect.getOwnPropertyDescriptor(t, k); },
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      if (typeof k === 'symbol' || typeof v === 'function') return v;
      const dentroArray = Array.isArray(t) && /^\d+$/.test(k);
      if (Array.isArray(t) && !dentroArray) return v;        // .length, .map, ...
      const p = chiave(base, k, dentroArray);
      if (enumerate.has(k)) {
        enumerate.delete(k);
        // COPIA, NON LETTURA. Un valore-oggetto resta osservabile: la copia contiene il
        // Proxy, quindi ogni lettura successiva si vede lo stesso. Un PRIMITIVO no: dopo
        // lo spread vive in un oggetto normale e nessuno puo' piu' sapere se qualcuno lo
        // usa. Quel campo non e' orfano e non e' letto: e' NON GIUDICABILE, e va detto —
        // contarlo come letto farebbe sotto-contare gli orfani, contarlo come orfano
        // accuserebbe campi che la pagina rende davvero (gara, freeze_lap, approvato).
        if (v === null || typeof v !== 'object') copiati.add(p);
      } else {
        visti.add(p);
      }
      return spia(v, p, visti, copiati);
    },
  });
}

const vista = JSON.parse(readFileSync(VISTA, 'utf8'));
const TUTTI = emessi(vista, '', new Set());

// ── si RENDE la pagina, scenario per scenario, e si guarda cosa e' stato letto ──
const visti = new Set();
const copiati = new Set();
const spiata = spia(vista, '', visti, copiati);
const errori = [];
for (let i = 0; i < vista.scenari.length; i += 1) {
  const s = spiata.scenari[i];
  for (const [nome, componente] of [['pannello', pannello], ['curva', curva], ['mappa', mappa]]) {
    try { componente(spiata, s); } catch (e) { errori.push(`${nome} scenario ${i}: ${e.message}`); }
  }
}

// LEGGERE `a.b` SIGNIFICA AVER RAGGIUNTO `a`. Senza questa regola un ramo intero
// risultava non letto solo perche' i componenti ne leggono i figli e mai il nodo: e' il
// caso di `scenari[].orizzonte`, di cui il pannello legge `orizzonte_risposta`, e di
// `scenari[].perdita`, di cui rende `targhetta`. Il conto giusto e' sul RAGGIUNTO.
const raggiunti = new Set(visti);
for (const p of visti) {
  const pezzi = p.split(/(?=\.)|(?=\[\])/);
  let acc = '';
  for (const pz of pezzi) { acc += pz; raggiunti.add(acc); }
}
const nonGiudicabili = [...TUTTI].filter((p) => !raggiunti.has(p) && copiati.has(p)).sort();
const orfani = [...TUTTI].filter((p) => !raggiunti.has(p) && !copiati.has(p)).sort();

// ── L'ALTRO VERSO: campi LETTI e mai EMESSI ─────────────────────────────────
//
// Un componente che legge un campo che il generatore non produce non esplode: riceve
// `undefined` e disegna qualcosa di vuoto. E' lo stesso guasto del campo orfano, visto dal
// lato opposto, e fa piu' male — perche' il ramo che lo legge di solito e' quello raro.
// Esempio vivo trovato costruendo questo censimento: `pannello.motivi_rifiuto`, letto dal
// pannello quando la risposta e' rifiutata e mai emesso dal generatore. Oggi non si vede
// perche' tutti gli scenari committati hanno `approvato = true`; il giorno che uno non lo
// e', la pagina scrive «Risposta non disponibile» con l'elenco dei motivi vuoto.
//
// Si escludono i percorsi che sono un PREFISSO di qualcosa di emesso (leggere `a` per
// arrivare ad `a.b` non e' leggere un campo che non c'e') e quelli su cui il componente
// fa una guardia di esistenza, che sono legittimi e restano invisibili qui: per questo il
// verdetto elenca i percorsi, non li conta e basta.
const emessoOPrefisso = (p) => TUTTI.has(p) || [...TUTTI].some((t) => t.startsWith(`${p}.`) || t.startsWith(`${p}[`));
const lettiNonEmessi = [...visti].filter((p) => !emessoOPrefisso(p)).sort();

// ── il registro del debito: quali orfani sono gia' dichiarati ────────────────
const reg = JSON.parse(readFileSync(REGISTRO, 'utf8'));
const dichiarati = new Map();
for (const v of reg.voci ?? []) {
  for (const c of v.campi_vista_orfani ?? []) dichiarati.set(c, v.id);
}
const nonDichiarati = orfani.filter((p) => !dichiarati.has(p));
const nonGiudicabiliNonDichiarati = nonGiudicabili.filter((p) => !dichiarati.has(p));
const lettiNonEmessiNonDichiarati = lettiNonEmessi.filter((p) => !dichiarati.has(p));
const dichiaratiFantasma = [...dichiarati.keys()].filter((c) => !orfani.includes(c) && !nonGiudicabili.includes(c)).sort();

console.log('');
console.log('══ CENSIMENTO DEI CAMPI DELLA VISTA — KPI P1 ══════════════════════════════');
console.log(`   vista: ${path.relative(RADICE, VISTA)}  ·  ${vista.scenari.length} scenari`);
console.log(`   componenti resi: pannello, curva, mappa  (${vista.scenari.length * 3} rendering)`);
if (errori.length) {
  console.log(`   ⚠ ${errori.length} rendering hanno sollevato un'eccezione:`);
  for (const e of errori.slice(0, 5)) console.log(`       ${e}`);
}
console.log('');
console.log(`   campi emessi ${TUTTI.size}  ·  raggiunti da almeno un componente ${TUTTI.size - orfani.length - nonGiudicabili.length}`
  + `  ·  ORFANI ${orfani.length}  ·  letti e MAI emessi ${lettiNonEmessi.length}`);
console.log(`   NON GIUDICABILI ${nonGiudicabili.length} — primitivi copiati da uno spread, invisibili dopo`
  + (nonGiudicabili.length ? `: ${nonGiudicabili.join(', ')}` : ''));
console.log(`   orfani DICHIARATI nel registro ${orfani.length - nonDichiarati.length}  ·  NON dichiarati ${nonDichiarati.length}`);

if (nonDichiarati.length) {
  console.log('');
  console.log('   NON DICHIARATI — o li legge qualcuno, o vanno a registro con la ragione:');
  for (const p of nonDichiarati) console.log(`     · ${p}`);
}
if (lettiNonEmessiNonDichiarati.length) {
  console.log('');
  console.log('   LETTI E MAI EMESSI — il verso opposto, e fa piu\' male: chi legge riceve');
  console.log('   `undefined` e disegna il vuoto, di solito nel ramo raro che nessuno guarda:');
  for (const p of lettiNonEmessiNonDichiarati) console.log(`     · ${p}`);
}
if (dichiaratiFantasma.length) {
  console.log('');
  console.log('   A REGISTRO MA NON PIU\' ORFANI — il registro descrive un debito che non esiste:');
  for (const p of dichiaratiFantasma) console.log(`     · ${p}`);
}

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Censimento dei campi della vista del demo: emessi dal generatore contro letti dai componenti.',
      metodo: 'rendering reale con la vista avvolta in un Proxy che registra ogni lettura — non grep',
      normalizzazione: 'indici di array -> campo[] · chiavi-pilota -> <DRV>',
      non_copre: 'la vista di PRODUZIONE (genera_vista_gara.mjs), che ha un altro generatore e un\'altra forma',
      generato_da: 'simulatore/web/censimento_vista.mjs',
      kpi: 'P1 di ai_lab/KPI_5_4_4.md',
    },
    emessi: TUTTI.size,
    letti: TUTTI.size - orfani.length,
    orfani,
    non_giudicabili_per_spread: nonGiudicabili,
    orfani_dichiarati: Object.fromEntries([...dichiarati].filter(([c]) => orfani.includes(c))),
    orfani_non_dichiarati: nonDichiarati,
    letti_non_emessi: lettiNonEmessi,
    letti_non_emessi_non_dichiarati: lettiNonEmessiNonDichiarati,
    registro_fantasma: dichiaratiFantasma,
    errori_di_rendering: errori,
  };
  const dove = path.join(RADICE, 'simulatore', 'web', 'vista', 'CENSIMENTO_campi.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}

if (VERIFICA) {
  const rosso = nonDichiarati.length || nonGiudicabiliNonDichiarati.length || lettiNonEmessiNonDichiarati.length
    || dichiaratiFantasma.length || errori.length;
  console.log('');
  if (rosso) {
    console.log('   CENSIMENTO ROSSO. Un campo calcolato e mai reso e\' lavoro buttato che sembra fatto:');
    console.log('   o lo si rende, o lo si toglie dal generatore, o lo si dichiara nel registro con la');
    console.log('   ragione per cui resta li\'. Le tre cose sono diverse e vanno decise, non subite.');
  } else {
    console.log('   censimento verde: nessun campo emesso resta invisibile senza essere dichiarato.');
  }
  process.exit(rosso ? 1 : 0);
}
console.log('');
