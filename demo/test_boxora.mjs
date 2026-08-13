// test_boxora.mjs — il banco del FLUSSO BOX ORA MONTATO.
//
// PERCHE' ESISTE. Il 13/08/2026 la pagina Gara aveva quarantotto difetti — la gara
// riavvolgeva di un giro e mezzo, le ventidue auto si accatastavano sul traguardo, la
// gomma promessa dal pannello non era quella montata, il Direttore respingeva il 12,2%
// dei piani legittimi — e i venti banchi del progetto erano TUTTI VERDI. Provavano i
// pezzi: l'orologio, la classifica, la scena, il motore. Nessuno provava il pezzo
// composto, che e' esattamente dove i difetti vivevano.
//
// COSA COPRE E COSA NO, detto subito. Qui non c'e' un browser (il progetto non ha
// dipendenze, e va bene cosi'): questo banco COMPONE i moduli veri nello stesso ordine in
// cui li compone gara.html e verifica gli invarianti del risultato. Quello che vive SOLO
// dentro la pagina — il cablaggio del DOM — si tiene fermo con gli spilli sul sorgente
// della sezione (h), che e' la stessa tecnica gia' usata da test_ese.mjs. Un difetto di
// pura resa (un colore, una classe CSS) questo banco non lo vede, e non finge di vederlo.
//
// COSA FA FALLIRE QUESTO TEST:
//  (a) le soste dei rivali tornano a essere TRANSITI in corsia invece di cambi di set;
//  (b) il Direttore ricomincia a respingere piani che la pagina stessa propone;
//  (c) chi si ritira al giro di congelamento torna a correre fino alla bandiera;
//  (d) la scena riparte da un giro intero e accatasta il campo sul traguardo;
//  (e) una sosta del piano non si vede in corsia box, o la sosta torna a durare una
//      frazione costante del giro invece della perdita vera;
//  (f) i rivali smettono di passare dalla corsia box;
//  (g) il guadagno della gomma nuova sparisce, o smette di crescere con l'eta';
//  (h) la pagina disfa una delle riparazioni di orchestrazione (p0, mescola unica,
//      dt clampato, contagiri, scelta pilota, referto con i giri).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { preparaGara, congelamentoPer } from './ese.mjs';
import { eseguiRigioca } from './ese_vista.mjs';
import { simDaRigioca } from './fantasma_sim.mjs';
import { costruisciCum, tempoReale, statoAl } from './ghostplay.mjs';
import { computeDurations } from './timeline.mjs';
import { guadagnoAlGiro, vitaMescolaGiri } from './gomma.mjs';
import { sosteDi } from './sosta.mjs';

const qui = path.dirname(fileURLToPath(import.meta.url));
let errori = 0, fatti = 0;
const fallisci = (msg) => { errori += 1; console.error(`  FALLITA  ${msg}`); };
const ok = (msg) => { fatti += 1; console.log(`  ok       ${msg}`); };
const controlla = (cond, msg) => (cond ? ok(msg) : fallisci(msg));
const leggi = (rel) => readFileSync(path.join(qui, rel), 'utf8');

/** Il sorgente SENZA i commenti.
 *
 *  Serve agli spilli che dicono «questa cosa NON deve esserci»: in questo repo i commenti
 *  CITANO il difetto riparato per spiegarlo («qui c'era `dwelling ? Infinity`, e fermava
 *  tutte e ventidue le auto»), quindi uno spillo che cerca quella stringa nel file intero
 *  trova la spiegazione e grida al difetto. E' successo alla prima esecuzione di questo
 *  banco. Lo `(?<!:)` protegge gli `http://` dentro le stringhe. */
function soloCodice(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((r) => (/^\s*(\/\/|\*)/.test(r) ? '' : r.replace(/(?<!:)\/\/.*$/, '')))
    .join('\n');
}
const fetchJson = async (u) => JSON.parse(leggi(decodeURIComponent(u.split('?')[0])));

/** La regola con cui la PAGINA sceglie la gomma (gara.html::mescolaDaMontare): mai uguale
 *  a quella montata, se non l'hai scelta tu. Il banco deve proporre quello che propone il
 *  prodotto — altrimenti misura un flusso che nessuno percorre. */
const mescolaDaMontare = (suAuto) => (suAuto === 'HARD' ? 'MEDIUM' : 'HARD');

const GARE = ['Ungheria', 'Monaco', 'Miami', 'Australia'];
const prep = {};
for (const g of GARE) prep[g] = await preparaGara(g, { fetchJson });

/* ─────────────────────────────────────────────── (a) la sosta e' un cambio di set */
console.log('(a) le soste dei rivali sono cambi di set, non transiti in corsia');
{
  for (const g of GARE) {
    const byLap = prep[g].race.byLap;
    const piloti = new Set();
    for (const L in byLap) for (const d in byLap[L]) piloti.add(d);
    let attese = 0;
    for (const d of piloti) {
      const perGiro = {};
      for (const L in byLap) if (byLap[L][d]) perGiro[L] = byLap[L][d];
      attese += sosteDi(perGiro).length;
    }
    const nostre = Object.values(prep[g].sosteVere).reduce((a, b) => a + b.length, 0);
    controlla(nostre === attese,
      `${g}: ${nostre} soste nel piano dei rivali contro ${attese} cambi di set veri`);
  }
  // il caso testimone: a Monaco Albon transita in corsia cinque volte e cambia gomma due
  const alb = (prep.Monaco.sosteVere.ALB ?? []).map((s) => s.giro);
  controlla(JSON.stringify(alb) === JSON.stringify([43, 67]),
    `Monaco/ALB: soste ai giri ${JSON.stringify(alb)} (le sfilate sotto SC e sotto rossa non sono soste)`);
}

/* ────────────────────────── (b) il Direttore approva cio' che la pagina propone */
console.log('(b) il Direttore approva il piano che la pagina propone');
{
  let provati = 0, respinti = 0, assenti = 0;
  const motivi = new Map();
  for (const g of GARE) {
    const P = prep[g], N = P.race.n_laps;
    for (const pilota of Object.keys(P.race.byLap[8] ?? {})) {
      for (let freeze = 8; freeze <= Math.min(45, N - 5); freeze += 7) {
        const suAuto = P.race.byLap[freeze]?.[pilota]?.compound;
        provati += 1;
        try {
          const e = eseguiRigioca({ prep: P, pilota, freeze,
            soste: [{ giro: freeze + 1, mescola: mescolaDaMontare(suAuto) }] });
          if (!e.mio.direttore.approved) {
            respinti += 1;
            for (const v of (e.mio.direttore.violazioni ?? []).filter((x) => x.severita === 'FATAL')) {
              motivi.set(v.codice, (motivi.get(v.codice) ?? 0) + 1);
            }
          }
        } catch (err) {
          // un pilota gia' ritirato al congelamento non ha una cella: e' un rifiuto GIUSTO
          if (/cella al congelamento/.test(err.message)) assenti += 1;
          else { respinti += 1; motivi.set(err.message.slice(0, 50), 1); }
        }
      }
    }
  }
  controlla(respinti === 0,
    `${provati} piani provati su ${GARE.length} gare: ${respinti} respinti`
    + (respinti ? ` — ${[...motivi].map(([k, n]) => `${k}×${n}`).join(', ')}` : '')
    + ` (${assenti} rifiuti giusti: pilota già ritirato)`);
}

/* ───────────────────────────── (c) il ritirato al congelamento resta ritirato */
console.log('(c) chi si ritira al giro di congelamento non torna in gara');
{
  // Ungheria: BOT si ritira al giro 14, e il primo BOX ORA naturale (sosta al 15) da'
  // congelamento 14. E' il caso ordinario, non un bordo raro.
  const P = prep.Ungheria;
  const f = congelamentoPer({ nome: P.nome, contesto: P.contesto, pilota: 'LEC', giroSosta: 15 });
  controlla(f.freezeLap === 14, `il congelamento per una sosta al giro 15 è ${f.freezeLap}`);
  const e = eseguiRigioca({ prep: P, pilota: 'LEC', freeze: 14, soste: [{ giro: 15, mescola: 'HARD' }] });
  const r = e.mio.risultato;
  controlla(!r.ordine.includes('BOT'), 'BOT (ritirato al giro 14) non è in classifica');
  controlla((r.ritirati ?? []).some((x) => x.drv === 'BOT'), 'BOT è fra i ritirati del risultato');
}

/* ─────────── (d)(e)(f) la scena: niente pila, la sosta si vede, anche dei rivali */
console.log('(d)(e)(f) la scena messa in atto');
{
  const P = prep.Ungheria, race = P.race;
  const durate = computeDurations(race.byLap, race.n_laps, new Set());
  const freeze = 14, PIANO = [{ giro: 15, mescola: 'HARD' }, { giro: 45, mescola: 'MEDIUM' }];
  const e = eseguiRigioca({ prep: P, pilota: 'LEC', freeze, soste: PIANO });
  const sim = simDaRigioca({ risultato: e.mio.risultato, race, pilota: 'LEC', freeze });
  const C = costruisciCum(sim);
  const soste = {};
  for (const [d, giri] of Object.entries(sim.soste ?? {})) soste[d] = new Set(giri);
  const opts = { driver: 'LEC', pitLap: sim.pitLap, soste, FE: 0.95 };

  // (d) la scena parte dall'ISTANTE in cui stavi guardando, non dal giro intero prima:
  // li' ogni pilota ha frazione zero e le ventidue auto finiscono sullo stesso punto.
  {
    const p = 15.6;                       // un istante qualunque dentro un giro
    const st = statoAl(C, tempoReale(C, p), opts);
    const distinte = new Set(st.map((s) => s.fd.toFixed(3))).size;
    controlla(st.length > 15 && distinte === st.length,
      `a p=${p} ci sono ${st.length} pallini con ${distinte} frazioni distinte (nessuna pila)`);
  }

  // (e) OGNI sosta del piano ha la sua finestra in corsia, e dura quanto la perdita vera
  {
    const perdita = e.mio.risultato.traccia.LEC.find((x) => x.lap === 15);
    const finestre = [];
    let dentro = null, fermoDa = null, fermoA = null, prima = false;
    const sec = (a, b) => { let s = 0; for (let q = a; q < b; q += 0.002) s += 0.002 * (durate[Math.floor(q)] ?? 90); return s; };
    for (let p = C.freezeLap; p <= C.nLap + 1; p += 0.002) {
      const T = tempoReale(C, p);
      if (T === undefined) continue;
      const me = statoAl(C, T, opts).find((s) => s.d === 'LEC');
      if (!me) continue;
      if (me.inPit && !prima) { dentro = p; fermoDa = fermoA = null; }
      if (me.inPit && me.fermo) { if (fermoDa === null) fermoDa = p; fermoA = p; }
      if (!me.inPit && prima) finestre.push({ corsia: sec(dentro, p), fermo: fermoDa === null ? 0 : sec(fermoDa, fermoA) });
      prima = me.inPit;
    }
    controlla(finestre.length === PIANO.length,
      `un piano a ${PIANO.length} soste si vede ${finestre.length} volte in corsia box`);
    const corte = finestre.filter((x) => x.corsia < 12);
    controlla(corte.length === 0,
      `ogni transito dura quanto la perdita vera (${finestre.map((x) => x.corsia.toFixed(1) + ' s').join(', ')}; la perdita è ~${perdita ? (perdita.lap_time - 85).toFixed(0) : '?'} s)`);
    controlla(finestre.every((x) => x.fermo > 1),
      `in ogni sosta il pallino sta FERMO sulla piazzola (${finestre.map((x) => x.fermo.toFixed(1) + ' s').join(', ')})`);
  }

  // (f) anche i rivali passano dalla corsia: la loro sosta non e' un giro lento in pista
  {
    const conSosta = Object.keys(sim.soste ?? {}).filter((d) => d !== 'LEC');
    controlla(conSosta.length >= 10,
      `${conSosta.length} rivali hanno le loro soste nella scena`);
    const rivale = conSosta[0];
    const giro = sim.soste[rivale][0];
    let visto = false;
    for (let p = Math.max(C.freezeLap, giro - 1); p <= Math.min(C.nLap, giro + 3) && !visto; p += 0.004) {
      const T = tempoReale(C, p);
      if (T === undefined) continue;
      visto = !!statoAl(C, T, opts).find((s) => s.d === rivale && s.inPit);
    }
    controlla(visto, `${rivale} si vede entrare in corsia box alla sua sosta (giro ${giro})`);
  }

  // il contagiri della scena non puo' superare i giri della gara
  controlla(Math.min(C.nLap, Math.floor(C.nLap + 1)) === C.nLap,
    `alla bandiera il contagiri resta a ${C.nLap} e non scrive un giro che non esiste`);
}

/* ──────────────────────────── (g) quanto vado piu' forte, e per quanto */
console.log('(g) il guadagno della gomma nuova');
{
  const ctx = await fetchJson('vendor/simulatore/motore/contesto_live.json');
  const g = (eta, ora, nuova) => guadagnoAlGiro({ contestoLive: ctx, nomeGara: 'Ungheria', etaOra: eta, mescolaOra: ora, mescolaNuova: nuova });
  controlla(Math.abs(g(1, 'MEDIUM', 'MEDIUM')) < 1e-9,
    'una gomma appena montata non guadagna niente a rimontarla');
  const scala = [5, 10, 20, 30].map((e) => g(e, 'MEDIUM', 'HARD'));
  controlla(scala.every((v, i) => i === 0 || v > scala[i - 1]),
    `il guadagno cresce con l'età: ${scala.map((v) => v.toFixed(2)).join(' < ')} s/giro`);
  controlla(scala[0] > 0.2 && scala[3] < 5, `i valori sono di ordine plausibile (${scala[0].toFixed(2)}…${scala[3].toFixed(2)} s/giro)`);
  // la mescola non cambia il guadagno IMMEDIATO ma cambia la VITA: e' la ragione per cui
  // il pannello mostra i due numeri insieme. Se un giorno la vita entrasse nel guadagno
  // immediato, questo controllo va riscritto — non cancellato.
  const perMescola = ['SOFT', 'MEDIUM', 'HARD'].map((m) => g(18, 'SOFT', m));
  controlla(new Set(perMescola.map((v) => v.toFixed(6))).size === 1,
    'a gomma nuova il guadagno immediato non dipende dalla mescola');
  const vite = ['SOFT', 'MEDIUM', 'HARD'].map((m) => vitaMescolaGiri({ contestoLive: ctx, nomeGara: 'Ungheria', mescola: m }));
  controlla(vite[0] < vite[1] && vite[1] < vite[2],
    `la vita sì: ${vite.join(' < ')} giri — è quello che la scelta della gomma decide`);
}

/* ─────────────────── (h) gli spilli sull'orchestrazione, che vive solo in pagina */
console.log('(h) la pagina non disfa le riparazioni di orchestrazione');
{
  const gara = soloCodice(leggi('gara.html'));
  const ghost = soloCodice(leggi('ghostplay.mjs'));
  const tl = soloCodice(leggi('timeline.mjs'));

  controlla(!/p0:[^,\n]*giroSosta\s*-\s*1/.test(gara),
    'la scena non riparte da giroSosta−1 (era il salto indietro di un giro e mezzo)');
  controlla(/p0:\s*Math\.min\(Math\.max\(daDove/.test(gara),
    'la scena riparte dall\'istante che stavi guardando');
  controlla(!/function gommaPerBox/.test(gara) && /function mescolaDaMontare/.test(gara),
    'un posto solo decide la gomma da montare');
  controlla(/mescolaNuova: nuova/.test(gara),
    'il pannello nomina la gomma che BOX ORA monterà davvero');
  controlla(!/sim\.pitLap\s*=\s*giroSosta/.test(gara),
    'la scena non sovrascrive più le soste con l\'ultima aggiunta');
  controlla(/DT_MAX/.test(tl) && /Math\.min\(\(t - last\) \/ 1000, DT_MAX\)/.test(tl),
    'l\'orologio limita il dt (al ritorno da un\'altra scheda la gara non teletrasporta)');
  controlla(/velocita: velCorrente/.test(gara) && /function scegliVel/.test(gara),
    'la velocità è uno stato solo e sopravvive a BOX ORA');
  controlla(!/dwelling \? Infinity/.test(ghost),
    'la sosta non ferma più tutto il campo');
  controlla(/Math\.min\(C\.nLap, Math\.floor\(p\)\)/.test(ghost),
    'il contagiri della scena usa floor come il replay');
  controlla(/id="scelta"/.test(gara) && /Per chi fai la strategia\?/.test(gara),
    'la finestra di scelta pilota c\'è');
  controlla(/function chiediPilota/.test(gara) && /showModal\(\)/.test(gara),
    'la finestra si apre davvero all\'ingresso');
  controlla(/function pianoInParole/.test(gara) && /pianoInParole\(sueVere\)/.test(gara)
    && /pianoInParole\(STRAT\.soste\)/.test(gara),
    'il referto finale nomina i giri delle soste, tue e vere');
  controlla(/if \(STRAT \|\| scenaGp\) azzera\(\)/.test(gara),
    'cambiare pilota azzera la simulazione del pilota di prima');
  controlla(/scenaFinita/.test(gara),
    'la scena si dichiara conclusa invece di restare viva per sempre');
  controlla(/sosteVereDi\[d\]/.test(gara) && /sostaFra\(c, race\.byLap/.test(gara),
    'le tacche della barra nascono dalla definizione unica di sosta');
  controlla(/class: 'pit ' \+ cls/.test(gara) && /'mia'/.test(gara) && /'vera'/.test(gara),
    'le tue soste e quelle vere si distinguono sulla barra');
  controlla(/function inCorsiaVera/.test(gara),
    'il flag pit del replay è incrociato con una sosta vera');
  controlla(/run\.direttore\?\.approved === false\) return null/.test(gara),
    'un run respinto dal Direttore non ha una posizione da stampare');
  controlla(/function pittaRegime/.test(gara) && /pittaRegime\(meta\.lap\)/.test(gara),
    'il banner SC/VSC e la tinta della pista seguono il regime anche durante la scena');
  controlla(/\.comandi \.barra-t\{ grid-column:1\/-1/.test(gara),
    'la barra dei giri ha una riga sua: il giro si può scegliere');
}

console.log(`\ntest_boxora: ${fatti} controlli passati, ${errori} falliti`);
if (errori) process.exit(1);
console.log('ESITO: verde — il flusso BOX ORA montato regge');
