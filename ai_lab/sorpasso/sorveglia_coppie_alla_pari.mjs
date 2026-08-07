// sorveglia_coppie_alla_pari.mjs — la sorveglianza di PREREG_coppie_alla_pari.md.
//
//     node ai_lab/sorpasso/sorveglia_coppie_alla_pari.mjs
//
// CONTA E TACE. Accumula le occasioni alla-pari (divario d'eta' < 5) sui giri di
// ripartenza e sui verdi ordinari, SOLO sulle gare successive alle 11 congelate
// qui sotto — la fonte che l'ipotesi non ha mai visto. Riscrive lo stato a ogni
// gara (agganciata ad auto_gara, check=False: non ferma mai la pubblicazione).
// NESSUN verdetto automatico: quando lo stato dice CANCELLO_INTERROGABILE, la
// lettura e' un gesto umano (prereg).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gare, garaNuova } from '../confronto/banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { creaGeneratore } from '../../simulatore/banco/misure/difesa.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const GAP_MAX = 1.5;
const G_DIVARIO = 5;
const SEME = 20260807;
const RIPETIZIONI = 2000;
const OCCASIONI_MINIME = 200;

// L'ELENCO CONGELATO: le gare che esistevano quando l'ipotesi e' nata (07/08/2026).
// Non si aggiorna MAI: e' il confine della fonte. Una gara nuova entra nel perimetro
// da sola comparendo nel registro; una gara di questo elenco non puo' entrare mai.
const GIA_VISTE = Object.freeze(new Set([
  'Australia', 'Austria', 'Belgio', 'Canada', 'Cina', 'Giappone',
  'Gran Bretagna', 'Miami', 'Monaco', 'Spagna', 'Ungheria',
]));

function occasioniAllaPari(nomeSito) {
  const g = garaNuova(nomeSito);
  const finestre = regimePerGiroDiCampo(g.perPilota);
  const ripartenze = new Set();
  for (let L = 2; L <= g.nGiri; L += 1) if (finestre[L - 1] && !finestre[L]) ripartenze.add(L);
  const esiti = { ripartenza: [], verde: [] };
  for (let L = 2; L <= g.nGiri; L += 1) {
    if (finestre[L]) continue;
    const tipo = ripartenze.has(L) ? 'ripartenza' : (finestre[L - 1] ? null : 'verde');
    if (tipo === null) continue;
    const righe = [];
    for (const [drv, perLap] of g.perPilota) {
      const prima = perLap.get(L - 1); const ora = perLap.get(L);
      if (!prima || !ora) continue;
      if (!Number.isFinite(prima.cum_time) || !Number.isFinite(ora.cum_time)) continue;
      righe.push({ drv, prima: prima.cum_time, dopo: ora.cum_time, inout: ora.in_lap === true || ora.out_lap === true, eta: ora.tyre_age });
    }
    righe.sort((a, b) => a.prima - b.prima);
    for (let i = 1; i < righe.length; i += 1) {
      const avanti = righe[i - 1]; const dietro = righe[i];
      if (avanti.inout || dietro.inout) continue;
      const gap = dietro.prima - avanti.prima;
      if (!(gap >= 0 && gap <= GAP_MAX)) continue;
      if (!Number.isFinite(avanti.eta) || !Number.isFinite(dietro.eta)) continue;
      if ((avanti.eta - dietro.eta) >= G_DIVARIO) continue;       // solo le coppie ALLA PARI
      esiti[tipo].push({ sorpasso: dietro.dopo < avanti.dopo });
    }
  }
  return esiti;
}

const nuove = gare().filter((g) => !GIA_VISTE.has(g));
const blocchi = nuove.map((g) => ({ gara: g, esiti: occasioniAllaPari(g) }));

const conta = (righe) => ({ n: righe.length, passa: righe.filter((x) => x.sorpasso).length });
const odds = (c) => (c.passa === 0 || c.passa === c.n ? null : (c.passa / c.n) / (1 - c.passa / c.n));
const rip = conta(blocchi.flatMap((b) => b.esiti.ripartenza));
const ver = conta(blocchi.flatMap((b) => b.esiti.verde));

let statistica = null;
if (rip.n >= OCCASIONI_MINIME && blocchi.length >= 2) {
  const oR = odds(rip); const oV = odds(ver);
  const or = (oR === null || oV === null) ? null : oR / oV;
  const rnd = creaGeneratore(SEME);
  const boot = [];
  for (let i = 0; i < RIPETIZIONI; i += 1) {
    const campione = Array.from({ length: blocchi.length }, () => blocchi[Math.floor(rnd() * blocchi.length)]);
    const r = conta(campione.flatMap((b) => b.esiti.ripartenza)); const v = conta(campione.flatMap((b) => b.esiti.verde));
    const a = odds(r); const bo = odds(v);
    if (a !== null && bo !== null) boot.push(a / bo);
  }
  boot.sort((a, b) => a - b);
  statistica = { odds_ratio: or, ic95: [boot[Math.floor(0.025 * boot.length)], boot[Math.floor(0.975 * boot.length)]] };
}

const stato = rip.n >= OCCASIONI_MINIME ? 'CANCELLO_INTERROGABILE' : 'IN_ATTESA';
const esito = {
  _cosa_e: 'Sorveglianza di PREREG_coppie_alla_pari.md — conta e tace. La lettura del cancello e\' un gesto umano.',
  _prereg: 'ai_lab/sorpasso/PREREG_coppie_alla_pari.md',
  stato,
  progresso: `${rip.n}/${OCCASIONI_MINIME} occasioni alla-pari di ripartenza sulla fonte nuova`,
  gare_nuove_viste: blocchi.map((b) => b.gara),
  ripartenza: rip,
  verde: ver,
  ...(statistica ? { statistica_al_cancello: statistica } : {}),
  attesa_dal_fondo: 'OR 1,990 (5,8% -> 10,9%) — misurato sul fondo che ha GENERATO l\'ipotesi: qui e\' un\'attesa, mai una prova',
  aggiornata: process.env.SORVEGLIANZA_DATA ?? null,
};
writeFileSync(path.join(QUI, 'SORVEGLIANZA_coppie_alla_pari.json'), `${JSON.stringify(esito, null, 1)}\n`);
console.log(`[coppie-alla-pari] ${stato} — ${esito.progresso}${blocchi.length ? ` (gare nuove: ${blocchi.map((b) => b.gara).join(', ')})` : ' (nessuna gara nuova ancora)'}`);
