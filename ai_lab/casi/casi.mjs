// casi.mjs — il motore PER CASI: risponde contando, non tarando.
//
//     node ai_lab/casi/casi.mjs [--json]
//
// PERCHE' ESISTE. Il repo ha passato una giornata a tarare parametri su undici
// gare: sei ipotesi sulla neutralizzazione, sei NULL. E le risposte pulite sono
// arrivate tutte dall'altra parte — «chi si ferma sotto SC» misurato su 105 gare
// ha chiuso in un colpo una voce che quattro tentativi numerici non spostavano.
//
// La differenza non e' il metodo statistico: e' che il cancello viveva sul 6% dei
// dati (11 gare su 184). Questo modulo risponde dove i dati sono.
//
// COSA CAMBIA rispetto a un modello a parametri. Un parametro risponde SEMPRE,
// anche quando non sa niente: 0,691 e' un numero anche su tre osservazioni. Un
// conteggio no — sotto una soglia dichiarata dice «non lo so», ed e' la proprieta'
// per cui vale la pena costruirlo.
//
// LA CARTA DELLE ERE, e non e' un dettaglio. Nel 2026 il DRS non esiste piu', le
// gomme e l'unita' di potenza sono altre. Per certe domande le 173 gare del fondo
// sono un ALTRO SPORT, e un caso di un'era diversa non e' un caso in meno: e' un
// caso sbagliato, che sposta la risposta invece di allargarla.
// Percio' ogni domanda dichiara di cosa ha bisogno (ai_lab/casi/CARTA_DELLE_ERE.md)
// e ogni risposta porta TRE numeri: fondo, 2026, e se i due sono compatibili.
//
// NON SCRIVE NIENTE su disco.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { regimeDiCella } from '../../simulatore/provenienza/definizioni.mjs';
import { MESCOLE_BAGNATO } from '../../simulatore/provenienza/vocabolario.mjs';
import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const SIM = path.resolve(QUI, '..', '..', 'simulatore');
const QUOTA_CAMPO = 0.5;      // PREREG-6: neutralizzazione DI CAMPO
const MIN_CASI = 30;          // sotto questo, la risposta e' «non lo so»
const B_BOOT = 2000;
const SEME = 20260801;

function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** IC95 della quota, ricampionando le GARE (E11): due casi della stessa gara non
 *  sono due prove indipendenti. */
function icQuota(perGara) {
  const chiavi = Object.keys(perGara).filter((k) => perGara[k].length > 0);
  if (chiavi.length < 2) return null;
  const r = rng(SEME); const out = [];
  for (let b = 0; b < B_BOOT; b += 1) {
    let s = 0; let n = 0;
    for (let i = 0; i < chiavi.length; i += 1) {
      for (const v of perGara[chiavi[Math.floor(r() * chiavi.length)]]) { n += 1; if (v) s += 1; }
    }
    if (n) out.push(s / n);
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))];
  return [Number(q(0.025).toFixed(4)), Number(q(0.975).toFixed(4))];
}

/** Un insieme di esiti binari -> la risposta per casi, o «non lo so». */
function rispondi(perGara) {
  const tutti = Object.values(perGara).flat();
  const n = tutti.length;
  if (n < MIN_CASI) {
    return { sa: false, n, motivo: `solo ${n} casi (ne servono ${MIN_CASI}): non lo so` };
  }
  const s = tutti.filter(Boolean).length;
  return {
    sa: true, n, volte: s,
    quota: Number((s / n).toFixed(4)),
    ic95: icQuota(perGara),
    n_gare: Object.keys(perGara).filter((k) => perGara[k].length).length,
  };
}

/** Compatibili se gli IC95 si sovrappongono. Senza IC (troppo poche gare) non si
 *  decide: si dichiara che non si e' potuto guardare. */
function compatibili(a, b) {
  if (!a.sa || !b.sa) return { verdetto: 'non giudicabile', perche: 'uno dei due non ha abbastanza casi' };
  if (!a.ic95 || !b.ic95) return { verdetto: 'non giudicabile', perche: 'IC non calcolabile: meno di due gare' };
  const sovrappone = a.ic95[0] <= b.ic95[1] && b.ic95[0] <= a.ic95[1];
  // IL POTERE DEL CONFRONTO, e senza questo il verdetto inganna. Con dieci gare
  // l'IC del 2026 e' larghissimo, e «compatibile» diventa vero per qualunque
  // valore: non sta dicendo «sono uguali», sta dicendo «non riesco a
  // distinguere». La differenza e' tutta, e va stampata accanto al verdetto.
  //
  // Il test si dichiara CIECO se l'IC del piccolo campione contiene sia il valore
  // del fondo sia il suo doppio: se non saprebbe vedere nemmeno un raddoppio, un
  // «compatibili» non e' una notizia.
  const cieco = b.ic95[0] <= a.quota && a.quota <= b.ic95[1]
             && b.ic95[0] <= a.quota * 2 && a.quota * 2 <= b.ic95[1];
  return {
    verdetto: sovrappone ? 'compatibili' : 'DIVERGONO',
    potere: cieco ? 'CIECO' : 'utile',
    perche: sovrappone
      ? (cieco
        ? 'gli IC95 si sovrappongono, MA il campione piccolo non saprebbe vedere nemmeno un raddoppio: '
          + '«compatibili» qui vuol dire NON RIESCO A DISTINGUERE, non «sono uguali». Il fondo si usa dichiarando questo.'
        : 'gli IC95 si sovrappongono, e il confronto avrebbe potuto vedere una differenza: il fondo puo\' rispondere per il 2026')
      : 'gli IC95 NON si sovrappongono: vince il 2026, il fondo diventa contesto',
    scarto_punti: Number((100 * (b.quota - a.quota)).toFixed(1)),
  };
}

// ═════════════════════════════════════ raccolta: fondo e 2026, stessa domanda
/** Occasioni «campo neutralizzato»: -> si ferma entro L+2? */
function occasioniSC(perPilota, nGiri, chiave, dentro) {
  for (let L = 2; L <= nGiri - 2; L += 1) {
    const alGiro = [];
    for (const [drv, celle] of perPilota) {
      const c = celle.get(L);
      if (c && c.status !== null && c.status !== undefined) alGiro.push({ drv, c });
    }
    if (alGiro.length < 6) continue;
    let neutri = 0;
    for (const { c } of alGiro) { let r = null; try { r = regimeDiCella(c); } catch { r = null; } if (r !== null) neutri += 1; }
    if (neutri / alGiro.length < QUOTA_CAMPO) continue;
    for (const { drv, c } of alGiro) {
      if (c.tyre_age === null || c.tyre_age === undefined) continue;
      let siFerma = false;
      for (let k = 1; k <= 2; k += 1) if (perPilota.get(drv)?.get(L + k)?.in_lap === true) { siFerma = true; break; }
      (dentro[chiave] ??= []).push(siFerma);
      (dentro[`${chiave}|eta${c.tyre_age >= 15 ? 'alta' : 'bassa'}`] ??= []).push(siFerma);
    }
  }
}

const fondo = {}; const duemilaventisei = {};
{
  const base = path.join(SIM, 'data', 'fondo');
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try { ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` })); } catch { continue; }
      if (righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound))) continue;
      const perPilota = new Map(); let nGiri = 0;
      for (const { drv, lap, cella } of righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
        if (lap > nGiri) nGiri = lap;
      }
      occasioniSC(perPilota, nGiri, `${anno}/${gara}`, fondo);
    }
  }
}
{
  const gare = caricaGare2026(SIM);
  for (const [nome, g] of Object.entries(gare)) {
    if ([...g.perPilota.values()].some((c) => [...c.values()].some((x) => MESCOLE_BAGNATO.has(x.compound)))) continue;
    occasioniSC(g.perPilota, g.nGiri, nome, duemilaventisei);
  }
}

const soloBase = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.includes('|')));
const soloFascia = (o, f) => Object.fromEntries(Object.entries(o).filter(([k]) => k.endsWith(`|${f}`)));

const domande = [
  { nome: 'chi si ferma sotto Safety Car di campo', dipende: 'decisione di muretto, pit-lane, regola delle due mescole',
    fondoVale: 'si — nulla di cio\' che la governa e\' cambiato nel 2026',
    F: rispondi(soloBase(fondo)), D: rispondi(soloBase(duemilaventisei)) },
  { nome: '...con gomme VECCHIE (eta >= 15)', dipende: 'come sopra, piu\' il degrado (gomme 2026 diverse)',
    fondoVale: 'da verificare — le mescole sono cambiate',
    F: rispondi(soloFascia(fondo, 'etaalta')), D: rispondi(soloFascia(duemilaventisei, 'etaalta')) },
  { nome: '...con gomme FRESCHE (eta < 15)', dipende: 'come sopra',
    fondoVale: 'da verificare',
    F: rispondi(soloFascia(fondo, 'etabassa')), D: rispondi(soloFascia(duemilaventisei, 'etabassa')) },
];

const esito = domande.map((q) => ({ ...q, compatibilita: compatibili(q.F, q.D) }));
if (process.argv.includes('--json')) { console.log(JSON.stringify(esito, null, 2)); process.exit(0); }

const pc = (x) => (x.sa ? `${(100 * x.quota).toFixed(1)}%  (${x.volte}/${x.n} su ${x.n_gare} gare${x.ic95 ? `, IC95 ${(100 * x.ic95[0]).toFixed(1)}-${(100 * x.ic95[1]).toFixed(1)}%` : ''})` : `NON LO SO — ${x.motivo}`);
console.log('MOTORE PER CASI — risponde contando, e dichiara quando non sa');
console.log(`  soglia: sotto ${MIN_CASI} casi la risposta e' «non lo so» · IC a blocchi = gare (E11)`);
for (const q of esito) {
  console.log(`\n  ${q.nome}`);
  console.log(`    dipende da: ${q.dipende}`);
  console.log(`    il fondo vale? ${q.fondoVale}`);
  console.log(`    FONDO 2018-2025 : ${pc(q.F)}`);
  console.log(`    2026            : ${pc(q.D)}`);
  const c = q.compatibilita;
  console.log(`    -> ${c.verdetto}${c.potere ? ` (potere del confronto: ${c.potere})` : ''}`
    + `${c.scarto_punti !== undefined ? ` · il 2026 sta ${c.scarto_punti >= 0 ? '+' : ''}${c.scarto_punti} punti sopra il fondo` : ''}`);
  console.log(`       ${c.perche}`);
}
