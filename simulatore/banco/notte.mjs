#!/usr/bin/env node
// notte.mjs — la corsa notturna: l'infrastruttura che si auto-verifica contro
// le gare vere mentre nessuno guarda.
//
// Rilancia la suite intera e tutte le misure del banco, confronta con la notte
// precedente, scrive banco/REPORT_NOTTE.md ed ESCE 1 SU REGRESSIONE. Una
// notturna che stampa "peggiorato" ed esce 0 è un ornamento (regola 4).
//
// Regressione, come pre-registrato in PREREG_banco.md:
//   1. una sentinella della suite fallisce; oppure
//   2. un cancello pre-registrato che passava ora non passa; oppure
//   3. una misura peggiora oltre la tolleranza dichiarata (rientro: 0,25
//      posizioni di mediana e 5 punti di quota entro ±1; bias: 0,02 s/giro).
// Il primo giro senza storico NON è una regressione: registra la linea di base.
//
// Uso: node banco/notte.mjs              → misura, confronta, scrive, esce 0/1
//      node banco/notte.mjs --registra   → e aggiunge la notte allo storico

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { misuraTutto, verificaCancelli, leggiCancelli } from './misura_tutto.mjs';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERCORSO_STORICO = path.join(radice, 'banco', 'storico_notti.json');
const PERCORSO_REPORT = path.join(radice, 'banco', 'REPORT_NOTTE.md');

const cancelli = leggiCancelli(radice);
const storico = existsSync(PERCORSO_STORICO) ? JSON.parse(readFileSync(PERCORSO_STORICO, 'utf8')) : [];
const precedente = storico.length ? storico[storico.length - 1] : null;

// ── 1. la suite ─────────────────────────────────────────────────────────────
const suite = spawnSync(process.execPath, [path.join(radice, 'banco', 'run_suite.mjs')], { encoding: 'utf8' });
const suiteVerde = (suite.status ?? 1) === 0;
const righeSuite = (suite.stdout ?? '').split('\n').filter((r) => /^(PASSA|FALLITA)/.test(r));
const sentinelleRotte = righeSuite.filter((r) => r.startsWith('FALLITA')).map((r) => r.replace(/^FALLITA\s+/, ''));

// ── 2. le misure ────────────────────────────────────────────────────────────
let riassunto = null;
let erroreMisura = null;
try {
  riassunto = misuraTutto(radice);
} catch (e) {
  erroreMisura = e.message;
}

const golden = existsSync(path.join(radice, 'banco', 'golden', 'banco_2026.json'))
  ? JSON.parse(readFileSync(path.join(radice, 'banco', 'golden', 'banco_2026.json'), 'utf8'))
  : null;
const esitiCancelli = riassunto ? verificaCancelli(riassunto, cancelli, golden) : [];
const cancelliRotti = esitiCancelli.filter((e) => !e.passa);

// ── 3. confronto con la notte precedente ────────────────────────────────────
const confronti = [];
const regressioniMisura = [];
if (riassunto && precedente) {
  for (const nome of cancelli.rientro.secchi) {
    const ora = riassunto.rientro.secchi[nome];
    const prima = precedente.rientro.secchi[nome];
    if (!ora || !prima || ora.mediana_errore_assoluto === null || prima.mediana_errore_assoluto === null) continue;
    const dMediana = ora.mediana_errore_assoluto - prima.mediana_errore_assoluto;
    const dQuota = (ora.quota_entro_1 - prima.quota_entro_1) * 100;
    confronti.push({ voce: `rientro ${nome} · mediana|err|`, prima: prima.mediana_errore_assoluto, ora: ora.mediana_errore_assoluto, delta: dMediana });
    confronti.push({ voce: `rientro ${nome} · entro ±1`, prima: `${(prima.quota_entro_1 * 100).toFixed(1)}%`, ora: `${(ora.quota_entro_1 * 100).toFixed(1)}%`, delta: dQuota });
    if (dMediana > cancelli.rientro.non_regressione_mediana_errore) regressioniMisura.push(`rientro ${nome}: mediana|errore| +${dMediana.toFixed(3)} oltre la tolleranza ${cancelli.rientro.non_regressione_mediana_errore}`);
    if (-dQuota > cancelli.rientro.non_regressione_quota_entro_1_pp) regressioniMisura.push(`rientro ${nome}: quota entro ±1 ${dQuota.toFixed(1)} punti, oltre la tolleranza ${cancelli.rientro.non_regressione_quota_entro_1_pp}`);
  }
  const dG0 = riassunto.g0.quota_passaggio - precedente.g0.quota_passaggio;
  confronti.push({ voce: 'G0″ quota di passaggio', prima: precedente.g0.quota_passaggio, ora: riassunto.g0.quota_passaggio, delta: dG0 });
  if (dG0 < 0) regressioniMisura.push(`G0″: quota di passaggio scesa di ${(-dG0 * 100).toFixed(2)} punti`);
  for (const [H, o] of Object.entries(riassunto.bias)) {
    const p = precedente.bias[H];
    if (!p || o.bias === null || p.bias === null) continue;
    const d = Math.abs(o.bias) - Math.abs(p.bias);
    confronti.push({ voce: `bias H=${H}`, prima: p.bias, ora: o.bias, delta: d });
    if (o.giudicabile && d > cancelli.bias.non_regressione_bias) regressioniMisura.push(`bias H=${H}: |bias| +${d.toFixed(4)} oltre la tolleranza ${cancelli.bias.non_regressione_bias}`);
  }
}

const regressione = !suiteVerde || erroreMisura !== null || cancelliRotti.length > 0 || regressioniMisura.length > 0;
const primaNotte = precedente === null;

// ── 4. il report ────────────────────────────────────────────────────────────
const adesso = new Date().toISOString();
const segno = (d) => (typeof d === 'number' ? `${d >= 0 ? '+' : ''}${d.toFixed(4)}` : '—');
// Le pipe dentro il testo di una cella spezzano la tabella markdown: i nomi dei
// cancelli contengono |bias| e |errore|, quindi si scappano.
const cella = (t) => String(t).replaceAll('|', '&#124;');
const R = [];
R.push('# REPORT NOTTE');
R.push('');
R.push(`Corsa del **${adesso}** · confronto con ${primaNotte ? '**nessuna notte precedente** (prima corsa: si registra la linea di base)' : `la notte del **${precedente.data}**`}.`);
R.push('');
R.push(`## Esito: ${regressione ? '🔴 REGRESSIONE' : '🟢 nessuna regressione'}`);
R.push('');
if (regressione) {
  R.push('Motivi:');
  R.push('');
  if (!suiteVerde) R.push(`- sentinelle rotte: ${sentinelleRotte.join(', ') || '(la suite non è partita)'}`);
  if (erroreMisura) R.push(`- le misure non sono eseguibili: ${erroreMisura}`);
  for (const c of cancelliRotti) R.push(`- cancello non passato — ${c.nome} · ${c.dettaglio}`);
  for (const m of regressioniMisura) R.push(`- ${m}`);
  R.push('');
}
R.push('## Suite');
R.push('');
R.push(`${righeSuite.filter((r) => r.startsWith('PASSA')).length}/${righeSuite.length} sentinelle verdi.`);
R.push('');
if (riassunto) {
  R.push('## Cancelli pre-registrati');
  R.push('');
  R.push('| cancello | esito | dettaglio |');
  R.push('|---|---|---|');
  for (const e of esitiCancelli) R.push(`| ${cella(e.nome)} | ${e.passa ? '🟢' : '🔴'} | ${cella(e.dettaglio)} |`);
  R.push('');
  R.push('## Misure');
  R.push('');
  R.push('### Rientro sulle soste vere 2026, per secco');
  R.push('');
  R.push(`${riassunto.rientro.n_soste} soste misurate, ${riassunto.rientro.n_scarti} scartate.`);
  R.push('');
  R.push('| secco | n | mediana &#124;errore&#124; | errore medio | entro ±1 | entro ±2 |');
  R.push('|---|---|---|---|---|---|');
  for (const [nome, s] of Object.entries(riassunto.rientro.secchi)) {
    R.push(`| ${nome}${s.sufficiente ? '' : ' *(insufficiente)*'} | ${s.n} | ${s.mediana_errore_assoluto} | ${s.errore_medio_con_segno >= 0 ? '+' : ''}${s.errore_medio_con_segno} | ${(s.quota_entro_1 * 100).toFixed(1)}% | ${(s.quota_entro_2 * 100).toFixed(1)}% |`);
  }
  R.push('');
  if (riassunto.rientro.attesa_sanita) {
    const a = riassunto.rientro.attesa_sanita;
    R.push(`Attesa di sanità dichiarata (\`${a.enunciato}\`): **${a.regge ? 'regge' : 'SMENTITA'}**.`);
    R.push('');
  }
  if (riassunto.rientro.gare_con_pitloss_di_ripiego.length) {
    R.push(`Perdita ai box di ripiego (circuito non misurato dal prior): ${riassunto.rientro.gare_con_pitloss_di_ripiego.join(', ')}.`);
    R.push('');
  }
  R.push('### G0″ — ottimo del banco contro forma chiusa');
  R.push('');
  R.push(`**${riassunto.g0.passati}/${riassunto.g0.n_casi} = ${(riassunto.g0.quota_passaggio * 100).toFixed(2)}%** (interni ${riassunto.g0.n_interni}, al bordo ${riassunto.g0.n_al_bordo}, esclusi ${riassunto.g0.n_esclusi}).`);
  R.push('');
  R.push(`G0′ è **ritirata** e resta a referto: ${riassunto.g0.g0_primo_ritirata.passati}/${riassunto.g0.n_casi} = ${(riassunto.g0.g0_primo_ritirata.quota_passaggio * 100).toFixed(2)}% — bocciava la risposta corretta al bordo (E08).`);
  R.push('');
  R.push('### Bias sui tempi assoluti');
  R.push('');
  R.push('| orizzonte | bias (s/giro) | gare | finestre | giudicabile |');
  R.push('|---|---|---|---|---|');
  for (const [H, o] of Object.entries(riassunto.bias)) {
    R.push(`| ${H} | ${o.bias >= 0 ? '+' : ''}${o.bias} | ${o.n_gare} | ${o.n_finestre} | ${o.giudicabile ? 'sì' : '**no** — non validato' } |`);
  }
  R.push('');
}
if (confronti.length) {
  R.push('## Delta rispetto alla notte precedente');
  R.push('');
  R.push('| voce | notte prima | stanotte | delta |');
  R.push('|---|---|---|---|');
  for (const c of confronti) R.push(`| ${cella(c.voce)} | ${c.prima} | ${c.ora} | ${segno(c.delta)} |`);
  R.push('');
} else if (primaNotte) {
  R.push('## Delta');
  R.push('');
  R.push('Nessuno: è la prima corsa. Questi numeri diventano la linea di base per il confronto di domani.');
  R.push('');
}
R.push('---');
R.push('');
R.push('Generato da `banco/notte.mjs`. Le soglie vengono da `banco/prereg/cancelli_banco.json`,');
R.push('dichiarate in parole in `banco/prereg/PREREG_banco.md` e `banco/prereg/PREREG_G0_secondo.md`.');
writeFileSync(PERCORSO_REPORT, R.join('\n') + '\n');

if (process.argv.includes('--registra') && riassunto) {
  storico.push({
    data: adesso,
    suite_verde: suiteVerde,
    cancelli_passati: esitiCancelli.every((e) => e.passa),
    rientro: { secchi: riassunto.rientro.secchi },
    g0: { quota_passaggio: riassunto.g0.quota_passaggio, n_casi: riassunto.g0.n_casi },
    bias: riassunto.bias,
  });
  writeFileSync(PERCORSO_STORICO, JSON.stringify(storico, null, 2) + '\n');
}

console.log(`suite: ${righeSuite.filter((r) => r.startsWith('PASSA')).length}/${righeSuite.length} verdi`);
if (riassunto) console.log(`cancelli: ${esitiCancelli.filter((e) => e.passa).length}/${esitiCancelli.length} passati`);
console.log(primaNotte ? 'prima notte: linea di base registrata, nessun confronto' : `confronto con ${precedente.data}`);
console.log(`report: banco/REPORT_NOTTE.md`);
console.log(regressione ? '🔴 REGRESSIONE' : '🟢 nessuna regressione');
process.exit(regressione ? 1 : 0);
