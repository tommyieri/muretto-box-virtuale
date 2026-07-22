// test_live_bylap.mjs — LA SENTINELLA DEL CAVO LIVE.
//
//     node demo/test_live_bylap.mjs      (esce 1 se qualcosa si rompe)
//
// Fa passare tutta la gara di Spa 2026 dentro l'adattatore, partendo dagli EVENTI del
// collettore, e confronta il risultato con la stessa gara ricostruita dal kernel a
// posteriori dai dati ufficiali (demo/data/Belgio.json).
//
// Sono due strade indipendenti verso lo stesso numero: una legge il flusso mentre la
// gara succede, l'altra legge il risultato quando e' finita. Se convergono, il pannello
// live e il pannello sulle gare vecchie stanno guardando la stessa gara.
//
// Il fixture (live/fixture/spa_2026_gara.jsonl) e' stato prodotto dal replay della
// registrazione vera del 19/07/2026, tenendo solo i campi che l'adattatore legge.
// Sta FUORI da demo/ apposta: e' materiale di prova, non va servito ai visitatori.
//
// Le soglie qui sotto non sono desideri: sono i valori misurati piu' un margine. Se una
// salta, e' cambiato qualcosa nel cavo — non si alza la soglia, si va a vedere.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { creaByLapLive } from './live_bylap.mjs';
import { pannelloMuretto } from './muretto.mjs';
import { misura as misuraSoste } from './gradino.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(QUI, '..', 'live', 'fixture', 'spa_2026_gara.jsonl');
const VERO = path.join(QUI, 'data', 'Belgio.json');

// ---- soglie MISURATE (22/07/2026), con margine ---------------------------------
const SOGLIA = {
  gap_mediano: 0.15,   // misurato 0,063
  gap_massimo: 0.50,   // misurato 0,180
  passo_mediano: 0.01, // misurato 0,000
  giri_diversi: 0,     // i tempi sul giro arrivano dal feed: devono coincidere
  soste_diverse: 0,    // 21 piloti su 21
};
const GIRI_ORDINE = [10, 25, 44];

let falliti = 0;
const esito = (ok, testo, dettaglio = '') => {
  if (!ok) falliti++;
  console.log(`  ${ok ? 'ok  ' : 'ROTTO'} ${testo}${dettaglio ? '   ' + dettaglio : ''}`);
};
const med = v => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

if (!fs.existsSync(FIXTURE)) {
  console.error(`fixture assente: ${FIXTURE}`);
  process.exit(1);
}

const vero = JSON.parse(fs.readFileSync(VERO, 'utf8'));
const V = {}; for (const lp of vero.laps) V[lp.lap] = lp.cars;

const A = creaByLapLive();
for (const riga of fs.readFileSync(FIXTURE, 'utf8').split('\n')) {
  if (riga) A.applica(JSON.parse(riga));
}
const B = A.byLap();

console.log('IL CAVO LIVE — Spa 2026, flusso del collettore contro la gara ufficiale');
console.log();

// 1. la struttura c'e' tutta
esito(A.nLaps() === vero.n_laps, 'distanza di gara letta dal feed',
      `${A.nLaps()} giri (ufficiale ${vero.n_laps})`);
esito(Object.keys(B).length === vero.n_laps, 'un giro ricostruito per ogni giro corso',
      `${Object.keys(B).length}/${vero.n_laps}`);

// 2. I GAP — il numero su cui il pannello lavora. Il cumulato assoluto NON si confronta:
//    il riferimento e' arbitrario per costruzione (vedi la nota in live_bylap.mjs).
//    I PRIMI DUE GIRI SONO FUORI, e non per far passare il test. Alla partenza il feed
//    manda "LAP 1" al posto del gap (non e' un numero) e i distacchi che si vedono sono
//    lo scaglionamento della griglia, non un gap di gara. Il dato ufficiale e' d'accordo:
//    al giro 1 non ha nemmeno i tempi sul giro. gara.html fa gia' la stessa cosa e li
//    sopprime a schermo (faseGriglia). Non c'e' niente da azzeccare, li' — e il pannello
//    a quei giri e' comunque muto, come verifica il controllo in fondo.
const DA_GIRO = 3;
const errTutti = [];
for (const L in B) {
  if (+L < DA_GIRO) continue;
  const comuni = Object.keys(B[L]).filter(s => V[L]?.[s]
    && typeof B[L][s].cum_time === 'number' && typeof V[L][s].cum_time === 'number');
  if (comuni.length < 3) continue;
  const lm = Math.min(...comuni.map(s => B[L][s].cum_time));
  const lv = Math.min(...comuni.map(s => V[L][s].cum_time));
  for (const s of comuni) errTutti.push(Math.abs((B[L][s].cum_time - lm) - (V[L][s].cum_time - lv)));
}
const gm = med(errTutti), gx = Math.max(...errTutti);
esito(gm <= SOGLIA.gap_mediano, `gap mediano entro ${SOGLIA.gap_mediano}s`, `${gm.toFixed(3)}s su ${errTutti.length} celle`);
esito(gx <= SOGLIA.gap_massimo, `nessun gap oltre ${SOGLIA.gap_massimo}s`, `peggiore ${gx.toFixed(3)}s`);

// 3. L ORDINE — se questo si rompe il pannello dice a chi si esce davanti, sbagliando
const ordine = (o, L) => Object.entries(o[L] || {})
  .filter(([, c]) => typeof c.cum_time === 'number')
  .sort((a, b) => a[1].cum_time - b[1].cum_time).map(([s]) => s);
for (const L of GIRI_ORDINE) {
  const m = ordine(B, L), v = ordine(V, L);
  const comuni = m.filter(s => v.includes(s));
  const mm = comuni.slice().sort((a, b) => m.indexOf(a) - m.indexOf(b));
  const vv = comuni.slice().sort((a, b) => v.indexOf(a) - v.indexOf(b));
  const fuori = mm.filter((s, i) => s !== vv[i]).length;
  esito(fuori === 0, `ordine identico al giro ${L}`, `${comuni.length} piloti confrontabili`);
}

// 4. I TEMPI SUL GIRO — non sono ricostruiti, arrivano dal feed: zero tolleranza
let diversi = 0;
for (const L in B) for (const s in B[L]) {
  const a = B[L][s].lap_time, b = V[L]?.[s]?.lap_time;
  if (a != null && b != null && Math.abs(a - b) >= 0.02) diversi++;
}
esito(diversi <= SOGLIA.giri_diversi, 'tempi sul giro identici all ufficiale', `${diversi} diversi`);

// 5. LE SOSTE — il gradino e il degrado si leggono da queste. Una sosta persa e' un
//    pezzo di pannello che non si accende. La cattura al giro 1 e' inclusa apposta:
//    prima del primo passaggio sul traguardo il contagiri e' ancora vuoto, e cinque
//    soste (BEA/BOT/HAD/OCO/PER) sparivano.
const soste = o => { const out = {}; for (const L in o) for (const s in o[L]) if (o[L][s].in_lap) (out[s] ||= []).push(+L); return out; };
const sB = soste(B), sV = soste(V);
const sigle = [...new Set([...Object.keys(sB), ...Object.keys(sV)])];
const sosteKo = sigle.filter(s => (sB[s] || []).join(',') !== (sV[s] || []).join(','));
esito(sosteKo.length <= SOGLIA.soste_diverse, 'stesse soste, stessi giri',
      `${sigle.length - sosteKo.length}/${sigle.length} piloti${sosteKo.length ? ' — fuori: ' + sosteKo.join(' ') : ''}`);

// 5-bis. STINT, NEUTRALIZZAZIONE E LA SOSTA MISURATA. Tre campi che nessuno guarda e da
//    cui dipende tutto il resto, perche' quando sbagliano il pannello NON si rompe: mostra
//    il numero peggiore e tace. Al primo collaudo il pit-loss live diceva 24,06 s dove la
//    stessa gara ne misura 21,15, e nessuno se ne sarebbe accorto guardando lo schermo.
//      - lo STINT: l'in-lap si guida sulla gomma vecchia. Contandolo nello stint nuovo,
//        gradino.mjs non trovava i giri di riferimento e scartava TUTTE le soste.
//      - il NEUTRALIZZATO: "Safety Car in rientro" non e' "Safety Car". Trattarlo come
//        tale buttava via giri buoni e con essi le soste da misurare.
let stOk = 0, stKo = 0, neOk = 0, neKo = 0;
for (const L in B) for (const s in B[L]) {
  const c = B[L][s], v = V[L]?.[s];
  if (!v) continue;
  c.stint === v.stint ? stOk++ : stKo++;
  (!!c.neutralized === !!v.neutralized) ? neOk++ : neKo++;
}
esito(stKo === 0, 'stint identico all ufficiale in ogni cella', `${stOk}/${stOk + stKo}`);
esito(neKo <= 2, 'neutralizzazione identica (tolleranza 2 celle)', `${neOk}/${neOk + neKo} · ${neKo} diverse`);
const sosteLive = Object.values(sB).flat().length;
const sosteVere = Object.values(sV).flat().length;
const mLive = misuraSoste(B, A.nLaps(), vero.n_laps), mVero = misuraSoste(V, vero.n_laps, vero.n_laps);
esito(mLive.n_perdita >= mVero.n_perdita - 1,
      'quasi tutte le soste sono misurabili anche in diretta',
      `live ${mLive.n_perdita} · ufficiale ${mVero.n_perdita} (${sosteLive}/${sosteVere} giri di sosta visti)`);
esito(Math.abs(mLive.perdita - mVero.perdita) <= 1.5,
      'il pit-loss misurato in diretta entro 1,5 s da quello ufficiale',
      `${mLive.perdita.toFixed(2)} s contro ${mVero.perdita.toFixed(2)} s`);
esito(Math.abs(mLive.gradino - mVero.gradino) <= 0.3,
      'il gradino di sosta entro 0,3 s/giro da quello ufficiale',
      `${mLive.gradino.toFixed(2)} contro ${mVero.gradino.toFixed(2)} s/giro`);

// 6. IL PASSO-BASE — stessa formula del kernel su dati ricostruiti. Se diverge, il
//    pannello live e quello sulle gare vecchie danno risposte diverse alla stessa domanda.
const errP = [];
for (const L of [10, 25, 40]) {
  const pm = A.pace(L), pv = vero.pace[String(L)] || {};
  for (const s in pm) if (pv[s] != null) errP.push(Math.abs(pm[s] - pv[s]));
}
const pmed = med(errP);
esito(pmed <= SOGLIA.passo_mediano, `passo-base entro ${SOGLIA.passo_mediano}s dal kernel`,
      `mediana ${pmed.toFixed(4)}s su ${errP.length} confronti`);

// 7. NIENTE ZERI AL POSTO DEI NULL — un doppiato senza gap deve sparire, non finire
//    incollato al leader. E' la regola che rende il pannello onesto invece che carino.
let sospetti = 0;
for (const L in B) for (const s in B[L]) {
  const c = B[L][s];
  if (c.cum_time === 0 && !(L === '1')) sospetti++;
}
esito(sospetti === 0, 'nessun cum_time azzerato di nascosto', `${sospetti} sospetti`);

// 8. E ALLA PARTENZA IL PANNELLO DEVE TACERE. E' il contrappeso del punto 2: li' i gap
//    non sono confrontabili, quindi bisogna essere sicuri che nessuno li usi. Il passo
//    base pretende 3 giri verdi a testa, e nei primi giri quei giri non esistono.
const primi = [1, 2].map(L => A.diagnosi(L));
esito(primi.every(d => !d.pronto), 'ai giri 1-2 il pannello si dichiara non pronto',
      primi.map((d, i) => `g${i + 1}: ${d.motivo}`).join(' | '));
// e a meta' gara invece deve esserlo, altrimenti il cavo c'e' ma non serve a niente
const meta = A.diagnosi(25);
esito(meta.pronto, 'al giro 25 il pannello e pronto', `${meta.n} piloti con passo-base`);

// 9. E IL PANNELLO DEVE RISPONDERE, non solo avere i dati. Si rifa' scorrere la gara
//    dall'inizio fermandosi a piu' punti, e a ogni fermata si chiede al muretto la sua
//    domanda — come farebbe uno che guarda la diretta a quel minuto. Nessun dato del
//    futuro entra: l'adattatore ha visto solo gli eventi fino a li'.
console.log();
console.log('IL PANNELLO SULLA GARA IN CORSO — la domanda del muretto, giro per giro');
const righe = fs.readFileSync(FIXTURE, 'utf8').split('\n').filter(Boolean);
const L2 = creaByLapLive();
const TAPPE = [8, 15, 22, 30, 38];
const visti = [];
let prossima = 0;
for (const riga of righe) {
  L2.applica(JSON.parse(riga));
  const g = L2.giroPieno();
  if (prossima < TAPPE.length && g != null && g >= TAPPE[prossima]) {
    visti.push({ g, n: Object.keys(L2.byLap()[g] || {}).length, snap: L2 });
    prossima++;
    // fotografo qui: byLap e' mutabile, quindi la risposta va chiesta ADESSO
    // si sceglie fra chi ha un passo-base MISURATO: e' l'insieme a cui il muretto puo'
    // rispondere. Sceglierne uno a caso e' come chiedere a chi si e' appena fermato —
    // il motore rifiuta, giustamente, e il test misurerebbe la propria distrazione.
    const B2 = L2.byLap(), conPasso = Object.keys(L2.pace(g)).filter(s => L2.presenti(g).includes(s)).sort();
    const drv = conPasso[Math.min(3, conPasso.length - 1)];
    const r = drv ? pannelloMuretto({
      byLap: B2, nLaps: L2.nLaps(), pace: L2.pace(g), laps: null,
      gara: null, circuitId: 'spa-francorchamps',
      driver: drv, freezeLap: g, pitLap: g + 1,
      pitLossTabella: 23.36, penalita: null, nonParten: new Set(),
      neutroFondo: null, ragg: null, bandeClim: null,
    }) : { ok: false, html: 'nessun pilota' };
    const testo = (r.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    esito(r.ok && /Rientro/.test(r.html) && /Pit-loss/.test(r.html),
      `giro ${String(g).padStart(2)}: il muretto risponde per ${drv}`,
      r.ok ? `${Object.keys(B2[g]).length} piloti nel giro · ${testo.slice(0, 64)}…`
           : `NON risponde: ${testo.slice(0, 70)}`);
  }
}
esito(visti.length === TAPPE.length, 'tutte le tappe raggiunte',
      `${visti.length}/${TAPPE.length}`);
// il congelamento deve avvenire su un giro PIENO: e' il guasto trovato al primo replay,
// quando si congelava sull'ultimo giro chiuso da chiunque e nel giro c'era una macchina sola
const magri = visti.filter(v => v.n < 12);
esito(magri.length === 0, 'si congela su un giro col campo dentro, mai su una macchina sola',
      visti.map(v => `g${v.g}:${v.n}`).join(' '));

console.log();
if (falliti) { console.log(`${falliti} controlli ROTTI`); process.exit(1); }
console.log('cavo live integro.');
