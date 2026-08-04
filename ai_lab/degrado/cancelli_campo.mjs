#!/usr/bin/env node
// cancelli_campo.mjs — i cancelli di PREREG_degrado_dal_campo.md.
//
//     node ai_lab/degrado/cancelli_campo.mjs [--json] [--rimescolamenti N]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Forma, soglie e placebo sono
// copiati da li' e non si toccano.
//
// GLI EFFETTI FISSI SONO PER GARA, e non e' un dettaglio: mettendo insieme le gare, il
// giro 30 di Monaco e il giro 30 di Spa condividerebbero lo stesso effetto, che e' falso —
// sono due stati di pista diversi. La chiave e' `gara|giro`, e per lo stesso motivo il
// pilota e' `gara|pilota`: il passo di un'auto cambia da un fine settimana all'altro.
//
// COSA LO FA USCIRE 1:
//  (a) D0 non passa: l'eta' non varia abbastanza dopo aver tolto pilota e giro, quindi rho
//      non e' identificato e non si legge niente altro (prereg §4).
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
import { testSegni, mediana } from '../confronto/bandiera.mjs';
import { campo2026, degradoDi, sottraiDueVolte, MESCOLE } from './campo.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const RIMESCOLAMENTI = (() => { const i = ARGV.indexOf('--rimescolamenti'); return i >= 0 ? Number(ARGV[i + 1]) : 200; })();
const SEME = 20260804;
const IC95_SIGILLO = [0.0108, 0.0527];
const SOGLIA_D0 = 2.0;
const GARE_MIN_D0 = 8;

const generatore = (seme) => { let s = seme >>> 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };

const campo = campo2026();
// il campione unico, con le chiavi degli effetti fissi gia' qualificate per gara
const tutte = [];
for (const [gara, { righe }] of Object.entries(campo)) {
  for (const r of righe) tutte.push({ ...r, gara, drv: `${gara}|${r.drv}`, lap: `${gara}|${r.lap}` });
}

console.log('');
console.log('══ DEGRADO DAL CAMPO — PREREG_degrado_dal_campo.md ════════════════════════');
console.log(`   ${tutte.length} osservazioni · ${Object.keys(campo).length} gare · effetti fissi per gara|pilota e gara|giro`);

// ── D0 · L'IDENTIFICAZIONE ESISTE, e viene prima di tutto ───────────────────
console.log('');
console.log('   D0 · quanta eta\' resta DOPO aver tolto pilota e giro (serve >= 2,0 giri):');
const perGara = {};
let passateD0 = 0;
for (const [gara, { righe }] of Object.entries(campo)) {
  const d = degradoDi(righe, { perMescola: false });
  const dm = degradoDi(righe, { perMescola: true });
  perGara[gara] = { n: righe.length, identificazione: d.identificazione, rho_comune: d.rho, rho_per_mescola: dm.rho };
  const ok = (d.identificazione ?? 0) >= SOGLIA_D0;
  if (ok) passateD0 += 1;
  console.log(`     ${gara.padEnd(14)} ${String(righe.length).padStart(5)} oss  ·  ${(d.identificazione ?? 0).toFixed(2)} giri`
    + `  ${ok ? '✓' : '✗'}   rho comune ${d.rho === null ? '—' : d.rho.toFixed(5)}`);
}
const D0 = passateD0 >= GARE_MIN_D0;
console.log(`     → ${passateD0}/11 gare sopra soglia (serve ${GARE_MIN_D0})   D0 ${D0 ? 'PASSA' : 'NON PASSA'}`);
if (!D0) {
  console.log('\n   D0 NON PASSA: rho non e\' identificato e non si legge niente altro (prereg §4).');
  process.exit(1);
}

// ── D1 · non contraddice il sigillo ─────────────────────────────────────────
const comune = degradoDi(tutte, { perMescola: false });
const D1 = comune.rho !== null && comune.rho >= IC95_SIGILLO[0] && comune.rho <= IC95_SIGILLO[1];
console.log('');
console.log(`   D1 · rho comune sul campione unico: ${comune.rho.toFixed(5)} s/giro·giro`
  + `  ·  IC95 del sigillo [${IC95_SIGILLO[0]} ; ${IC95_SIGILLO[1]}]   ${D1 ? 'PASSA' : 'NON PASSA'}`);

// ── il per-mescola, e il divario che il placebo dovra' spiegare ─────────────
const perMescola = degradoDi(tutte, { perMescola: true });
const divarioDi = (rho) => Math.max(...MESCOLE.map((m) => rho[m])) - Math.min(...MESCOLE.map((m) => rho[m]));
const divarioVero = divarioDi(perMescola.rho);
console.log('');
console.log(`   rho per mescola: ${MESCOLE.map((m) => `${m} ${perMescola.rho[m].toFixed(5)}`).join(' · ')}`);
console.log(`   divario (max − min): ${divarioVero.toFixed(5)}`);

// ── D2 · fuori campione, NELLA FORMA DEL LIVE ───────────────────────────────
//
// Si stima sulla PRIMA META' di ogni gara e si prevede la SECONDA. E' esattamente la
// situazione del live: a meta' gara hai solo cio' che e' successo finora.
console.log('');
console.log('   D2 · prima meta\' → seconda meta\', gara per gara:');
const coppie = [];
for (const [gara, { righe, nGiri }] of Object.entries(campo)) {
  const meta = Math.round(nGiri / 2);
  const prima = righe.filter((r) => r.lap <= meta);
  const dopo = righe.filter((r) => r.lap > meta);
  if (prima.length < 100 || dopo.length < 50) { console.log(`     ${gara.padEnd(14)} saltata: ${prima.length}/${dopo.length} osservazioni`); continue; }
  const stimato = degradoDi(prima, { perMescola: true });
  if (stimato.rho === null) { console.log(`     ${gara.padEnd(14)} saltata: ${stimato.motivo}`); continue; }
  // si confrontano i RESIDUI sulla seconda meta', con gli effetti fissi ri-tolti li'
  const conMio = sottraiDueVolte(dopo, [(r) => r.t - (stimato.rho[r.mescola] ?? 0) * r.eta]).map((x) => Math.abs(x[0]));
  const conSigillo = sottraiDueVolte(dopo, [(r) => r.t - 0.030776 * r.eta]).map((x) => Math.abs(x[0]));
  for (let i = 0; i < conMio.length; i += 1) coppie.push({ gara, a: conMio[i], b: conSigillo[i] });
  console.log(`     ${gara.padEnd(14)} ${String(dopo.length).padStart(4)} giri · errore mediano  campo ${mediana(conMio).toFixed(4)}`
    + `  ·  sigillo ${mediana(conSigillo).toFixed(4)}`);
}
const d2 = testSegni(coppie);
const medMio = mediana(coppie.map((c) => c.a));
const medSig = mediana(coppie.map((c) => c.b));
const D2 = medMio < medSig && d2.vinceA > d2.vinceB && d2.p < 0.05;
console.log(`     → ${d2.vinceA}-${d2.vinceB} (n=${d2.n}, p=${d2.p.toFixed(4)}) · mediana ${medMio.toFixed(4)} contro ${medSig.toFixed(4)}`
  + `   D2 ${D2 ? 'PASSA' : 'NON PASSA'}`);

// ── D3 · IL PLACEBO SULLE ETICHETTE ─────────────────────────────────────────
//
// La separazione fra mescole potrebbe venire da CHI le monta: se le squadre veloci usano
// piu' spesso la hard, la hard sembrera' migliore senza esserlo. Si rimescolano le
// etichette FRA I PILOTI, dentro la stessa gara, lasciando tutto il resto identico.
console.log('');
console.log(`   D3 · placebo: ${RIMESCOLAMENTI} rimescolamenti delle mescole fra piloti, seme ${SEME}`);
const rnd = generatore(SEME);
const divariFinti = [];
for (let i = 0; i < RIMESCOLAMENTI; i += 1) {
  // dentro ogni gara, si permutano le mescole FRA I PILOTI: ogni pilota riceve in blocco
  // la sequenza di mescole di un altro. Cosi' la struttura temporale resta intatta e
  // cambia solo CHI aveva cosa.
  const finte = [];
  for (const [gara, { righe }] of Object.entries(campo)) {
    const piloti = [...new Set(righe.map((r) => r.drv))];
    const mescolate = [...piloti];
    for (let j = mescolate.length - 1; j > 0; j -= 1) { const k = Math.floor(rnd() * (j + 1)); [mescolate[j], mescolate[k]] = [mescolate[k], mescolate[j]]; }
    const mappa = new Map(piloti.map((p, idx) => [p, mescolate[idx]]));
    const perPilota = new Map();
    for (const r of righe) { if (!perPilota.has(r.drv)) perPilota.set(r.drv, []); perPilota.get(r.drv).push(r); }
    for (const r of righe) {
      const donatore = perPilota.get(mappa.get(r.drv));
      const q = donatore[Math.min(donatore.length - 1, righe.indexOf(r) % donatore.length)];
      finte.push({ ...r, gara, drv: `${gara}|${r.drv}`, lap: `${gara}|${r.lap}`, mescola: q.mescola });
    }
  }
  const d = degradoDi(finte, { perMescola: true });
  if (d.rho !== null) divariFinti.push(divarioDi(d.rho));
  if ((i + 1) % 50 === 0) console.log(`       ${i + 1}/${RIMESCOLAMENTI}`);
}
divariFinti.sort((a, b) => a - b);
const p95 = divariFinti[Math.floor(0.95 * divariFinti.length)];
const D3 = divarioVero > p95;
console.log(`     divario vero ${divarioVero.toFixed(5)}  ·  finti: mediana ${divariFinti[Math.floor(0.5 * divariFinti.length)].toFixed(5)},`
  + ` 95° percentile ${p95.toFixed(5)}   D3 ${D3 ? 'PASSA' : 'NON PASSA'}`);

console.log('');
console.log(`   D0 ${D0 ? 'PASSA' : 'NO'} · D1 ${D1 ? 'PASSA' : 'NO'} · D2 ${D2 ? 'PASSA' : 'NO'} · D3 ${D3 ? 'PASSA' : 'NO'}`);
console.log('');
if (D0 && D1 && D2 && D3) {
  console.log('   Lo stimatore e\' ammesso. L\'accensione resta una decisione del PO.');
} else if (!D3) {
  console.log('   LETTURA OBBLIGATA DALLA PREREG §4: la separazione fra mescole e\' un artefatto di');
  console.log('   CHI le monta. Si riporta il rho comune e si dichiara che il per-mescola non regge.');
} else if (!D2) {
  console.log('   LETTURA OBBLIGATA DALLA PREREG §4: il per-mescola e\' reale ma non predice. Si');
  console.log('   riporta come misura descrittiva, NON come modello, e non entra nel motore.');
}
console.log('');
console.log('   LIMITE DICHIARATO PRIMA (prereg §6): le eta\' alte esistono solo per chi ha scelto di');
console.log('   restare fuori, e spesso lo fa perche\' la sua gomma va bene. Il rho che esce di qui e\'');
console.log('   un LIMITE INFERIORE, e nessun effetto fisso lo corregge.');

if (JSON_OUT) {
  const doc = {
    _targhetta: {
      cosa_e: 'Degrado stimato dal CAMPO con due effetti fissi (gara|pilota e gara|giro).',
      prereg: 'ai_lab/degrado/PREREG_degrado_dal_campo.md',
      forma: 't = alpha(pilota) + gamma(giro) + rho(mescola)*eta — gamma assorbe carburante, evoluzione, meteo, neutralizzazioni',
      limite: 'rho e\' un LIMITE INFERIORE: le eta\' alte sono selezionate verso chi aveva la gomma buona',
      data: '2026-08-04',
    },
    n: tutte.length,
    per_gara: perGara,
    rho_comune: comune.rho,
    rho_per_mescola: perMescola.rho,
    divario_vero: divarioVero,
    D0: { passa: D0, gare_sopra_soglia: passateD0, soglia: SOGLIA_D0 },
    D1: { passa: D1, rho: comune.rho, ic95_sigillo: IC95_SIGILLO },
    D2: { passa: D2, ...d2, coppie: undefined, mediana_campo: medMio, mediana_sigillo: medSig },
    D3: { passa: D3, vero: divarioVero, p95, mediana_finti: divariFinti[Math.floor(0.5 * divariFinti.length)], rimescolamenti: divariFinti.length },
  };
  const dove = path.join(RADICE, 'ai_lab', 'degrado', 'ESITO_cancelli_campo.json');
  writeFileSync(dove, JSON.stringify(doc, null, 1) + '\n');
  console.log(`\n   scritto ${path.relative(RADICE, dove)}`);
}
