#!/usr/bin/env node
// misura_tutto.mjs — esegue TUTTE le misure del banco e restituisce il
// riassunto. Una sola implementazione (regola 1) usata da tre padroni: il
// golden, la sentinella s15 e la corsa notturna. Se ognuno rifacesse le
// proprie misure, il numero sorvegliato e il numero pubblicato potrebbero
// divergere in silenzio.
//
// Uso: node banco/misura_tutto.mjs                 → stampa il riassunto
//      node banco/misura_tutto.mjs --scrivi-golden → riscrive la linea di base

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../provenienza/gare_2026.mjs';
import { misuraBias } from './misure/bias.mjs';
import { misuraRientro } from './misure/rientro.mjs';
import { misuraG0 } from './misure/g0.mjs';
import { misuraM1, misuraM2, misuraM3M4 } from './misure/multistint.mjs';
import { misuraDifesa } from './misure/difesa.mjs';
import { caricaDurate2026 } from '../scenario/allarmi.mjs';
import { caricaCostanti } from '../scenario/director.mjs';
import { caricaPrior } from '../provenienza/pitloss.mjs';

export const PERCORSO_GOLDEN_BANCO = 'banco/golden/banco_2026.json';

export function leggiCancelli(radice) {
  return JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'cancelli_banco.json'), 'utf8'));
}

export function misuraTutto(radice) {
  const cancelli = leggiCancelli(radice);
  const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const rho = modello.rho.valore;
  const delta70 = modello.delta_70.scelto;
  if (typeof delta70 !== 'number') {
    throw new Error('il modello non ha un δ₇₀ scelto: il banco non misura su un modello non cablabile (vedi PREREG_delta.md)');
  }
  const prior = caricaPrior(radice);
  const gare = caricaGare2026(radice);
  const opzioni = { rho, delta70, prior };

  const rientro = misuraRientro(gare, { ...opzioni, cancelli: cancelli.rientro });
  const g0 = misuraG0(gare, { ...opzioni, cancelli: cancelli.g0_secondo });
  const bias = misuraBias(gare, { delta70Di: () => delta70, rho, cancelli: cancelli.bias });

  // FASE MULTI-STINT (banco/prereg/PREREG_multistint.md)
  const contestoBase = { modello, prior, costantiDirector: caricaCostanti(radice) };
  const m1 = misuraM1({ rho, delta70, cancelli: cancelli.multistint });
  const m2 = misuraM2(gare, { contestoBase, cancelli: cancelli.multistint });
  const m34 = misuraM3M4(gare, { contestoBase, durate2026: caricaDurate2026(radice), cancelli: cancelli.multistint });

  // FASE DIFESA (banco/prereg/PREREG_difesa.md) — usa i casi del rientro, non li rifà
  const difesa = misuraDifesa(rientro, { cancelli: cancelli.difesa, secchi: cancelli.rientro.secchi });

  const attesaSanita = (() => {
    const p = rientro.secchi.PULITA?.mediana_errore_assoluto;
    const s = rientro.secchi.SOSTE_RIVALI?.mediana_errore_assoluto;
    if (p === null || s === null || p === undefined || s === undefined) return null;
    return { enunciato: cancelli.rientro.attesa_sanita, PULITA: p, SOSTE_RIVALI: s, regge: p <= s };
  })();

  return {
    _targhetta: {
      tipo: 'misurato sulle 11 gare 2026 dal grezzo pinnato',
      prereg: ['banco/prereg/PREREG_banco.md', 'banco/prereg/PREREG_G0_secondo.md'],
      modello: 'data/modelli/modello_v2.json',
      rho,
      delta_70: delta70,
      pitloss: 'prior esterno data/priors/pitloss_priors.json — NON misurato sul nostro fondo',
      generato_da: 'banco/misura_tutto.mjs',
    },
    rientro: {
      n_soste: rientro.n_soste,
      n_scarti: rientro.n_scarti,
      secchi: rientro.secchi,
      gare_con_pitloss_di_ripiego: rientro.gare_con_pitloss_di_ripiego,
      attesa_sanita: attesaSanita,
    },
    g0: {
      n_casi: g0.n_casi,
      n_interni: g0.n_interni,
      n_al_bordo: g0.n_al_bordo,
      n_esclusi: g0.n_esclusi,
      passati: g0.passati,
      quota_passaggio: g0.quota_passaggio,
      falliti: g0.falliti.map((c) => ({ gara: c.gara, Lf: c.Lf, drv: c.drv, R: c.R, eta: c.eta, k_star: c.k_star, argmin: c.argmin, motivo: c.motivo })),
      g0_primo_ritirata: g0.g0_primo_ritirata,
    },
    bias: bias.perOrizzonte,
    multistint: {
      m1: {
        n_casi: m1.n_casi,
        n_ammessi: m1.forma_chiusa.n_ammessi,
        n_al_bordo: m1.n_al_bordo,
        forma_chiusa: { passati: m1.forma_chiusa.passati, quota: m1.forma_chiusa.quota, falliti: m1.forma_chiusa.falliti.map((c) => ({ R: c.R, a: c.a, perdita: c.perdita, k: c.k, chiusa: c.forma_chiusa, argmin: c.argmin_esaustivo })) },
        ricerca: { passati: m1.ricerca.passati, quota: m1.ricerca.quota, falliti: m1.ricerca.falliti.map((c) => ({ R: c.R, a: c.a, perdita: c.perdita, k: c.k, ricerca: c.ricerca, argmin: c.argmin_esaustivo })) },
        k_ottimo: { n: m1.k_ottimo.n, passati: m1.k_ottimo.passati, quota: m1.k_ottimo.quota, casi: m1.k_ottimo.casi },
        bordo_diagnostica: m1.bordo_diagnostica,
      },
      m2: { n_casi: m2.n_casi, passati: m2.passati, quota: m2.quota, falliti: m2.falliti },
      m3: m34.m3,
      m4: m34.m4,
      n_casi_reali: m34.n_casi,
      distribuzione_k: m34.distribuzione_k,
    },
    difesa,
  };
}

/** I cancelli pre-registrati, applicati al riassunto. Nessuna soglia cablata. */
export function verificaCancelli(riassunto, cancelli, golden) {
  const esiti = [];
  const dichiara = (nome, passa, dettaglio) => esiti.push({ nome, passa, dettaglio });

  // G0″ — proprietà di correttezza
  dichiara(
    'G0″ quota di passaggio',
    riassunto.g0.quota_passaggio >= cancelli.g0_secondo.quota_passaggio_richiesta,
    `${riassunto.g0.quota_passaggio} richiesto ≥ ${cancelli.g0_secondo.quota_passaggio_richiesta} (${riassunto.g0.falliti.length} falliti)`,
  );

  // MULTI-STINT — M1…M4 (banco/prereg/PREREG_multistint.md)
  {
    const m = riassunto.multistint;
    const richiesta = cancelli.multistint.quota_passaggio_richiesta;
    dichiara('M1 forma chiusa ⇔ ottimo esaustivo del kernel (casi ammessi)',
      m.m1.forma_chiusa.quota >= richiesta,
      `${m.m1.forma_chiusa.passati}/${m.m1.n_ammessi} ammessi (${m.m1.n_al_bordo} al bordo, fuori cancello)`);
    dichiara('M1 la ricerca ristretta trova l\'ottimo esaustivo',
      m.m1.ricerca.quota >= richiesta,
      `${m.m1.ricerca.passati}/${m.m1.n_casi}`);
    dichiara('M1 il k della forma chiusa è il k che vince',
      m.m1.k_ottimo.quota >= richiesta,
      `${m.m1.k_ottimo.passati}/${m.m1.k_ottimo.n}`);
    dichiara('M2 piano a una sosta identico allo scenario a una sosta',
      m.m2.n_casi > 0 && m.m2.quota >= richiesta,
      `${m.m2.passati}/${m.m2.n_casi}`);
    dichiara('M3 ogni piano è approvato dal Director',
      m.m3.quota >= richiesta,
      `${m.m3.approvati}/${riassunto.multistint.n_casi_reali}`);
    dichiara('M3 non è cieco: esistono piani OBBLIGATI a fermarsi',
      m.m3.cieco === false,
      `${m.m3.n_obbligati_a_fermarsi} obbligati, ${m.m3.obbligati_con_sosta} con sosta (minimo ${cancelli.multistint.min_casi_obbligati})`);
    dichiara('M4 gli allarmi non cambiano il piano',
      m.m4.quota >= richiesta,
      `${m.m4.identici}/${riassunto.multistint.n_casi_reali}`);
  }

  // DIFESA — D1…D4 (banco/prereg/PREREG_difesa.md)
  {
    const d = riassunto.difesa;
    dichiara('D1 la banda di rientro copre ed è minimale (leave-one-race-out)',
      d.d1_passa === true,
      `${d.n_casi} soste su ${d.n_gare} gare; falliti: ${d.d1_falliti.map((x) => x.secco).join(', ') || 'nessuno'}`);
    // D2 non è un cancello da passare: è una domanda. Il suo esito VINCOLA la
    // forma del modello, e ciò che si sorveglia è la coerenza fra i due.
    dichiara('D2 l\'esito del contesto è coerente col numero di bande',
      d.d2_separa === false,
      `contesto ${d.d2_separa ? 'separa' : 'NON separa'} (p = ${d.contesto.p_permutazione}) → ${d.d2_separa ? 'due bande' : 'una banda per contesto di regime'}`);
    dichiara('D4 nessuna banda simmetrica nasconde un bias ≥ 1 posizione',
      d.d4_asimmetrici.length === 0,
      `asimmetrici: ${d.d4_asimmetrici.join(', ') || 'nessuno'}`);
  }

  // BIAS — cancelli ereditati, solo sugli orizzonti giudicabili
  const giudicabili = Object.entries(riassunto.bias).filter(([, o]) => o.giudicabile);
  dichiara('bias: esiste almeno un orizzonte giudicabile', giudicabili.length > 0, `${giudicabili.length} orizzonti`);
  for (const [H, o] of giudicabili) {
    dichiara(`bias |H=${H}| ≤ ${cancelli.bias.soglia_bias}`, Math.abs(o.bias) <= cancelli.bias.soglia_bias, `${o.bias} su ${o.n_gare} gare`);
  }
  if (giudicabili.length > 1) {
    const assoluti = giudicabili.map(([, o]) => Math.abs(o.bias));
    const piattezza = Math.max(...assoluti) - Math.min(...assoluti);
    dichiara(`bias piatto entro ${cancelli.bias.soglia_piattezza}`, piattezza <= cancelli.bias.soglia_piattezza, `${piattezza.toFixed(6)}`);
  }

  // RIENTRO — non-regressione rispetto alla linea di base registrata
  if (golden) {
    for (const nome of cancelli.rientro.secchi) {
      const ora = riassunto.rientro.secchi[nome];
      const prima = golden.rientro.secchi[nome];
      if (!ora || !prima || !ora.sufficiente || !prima.sufficiente) {
        dichiara(`rientro ${nome}: secco insufficiente, non fa cancello`, true, `n=${ora?.n ?? 0} (minimo ${cancelli.rientro.min_casi_secco})`);
        continue;
      }
      dichiara(
        `rientro ${nome}: mediana|errore| non peggiora di ${cancelli.rientro.non_regressione_mediana_errore}`,
        ora.mediana_errore_assoluto <= prima.mediana_errore_assoluto + cancelli.rientro.non_regressione_mediana_errore,
        `${ora.mediana_errore_assoluto} contro linea ${prima.mediana_errore_assoluto}`,
      );
      dichiara(
        `rientro ${nome}: quota entro ±1 non cala di ${cancelli.rientro.non_regressione_quota_entro_1_pp} punti`,
        ora.quota_entro_1 * 100 >= prima.quota_entro_1 * 100 - cancelli.rientro.non_regressione_quota_entro_1_pp,
        `${(ora.quota_entro_1 * 100).toFixed(1)}% contro linea ${(prima.quota_entro_1 * 100).toFixed(1)}%`,
      );
    }
  }
  return esiti;
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = misuraTutto(radice);
  console.log('— RIENTRO (soste vere 2026) —');
  console.log(`${r.rientro.n_soste} soste misurate, ${r.rientro.n_scarti} scartate`);
  for (const [n, s] of Object.entries(r.rientro.secchi)) {
    console.log(`  ${n.padEnd(13)} n=${String(s.n).padStart(3)}  mediana|err|=${s.mediana_errore_assoluto}  err.medio=${s.errore_medio_con_segno >= 0 ? '+' : ''}${s.errore_medio_con_segno}  ±1=${(s.quota_entro_1 * 100).toFixed(1)}%  ±2=${(s.quota_entro_2 * 100).toFixed(1)}%${s.sufficiente ? '' : '  (INSUFFICIENTE)'}`);
  }
  const a = r.rientro.attesa_sanita;
  if (a) console.log(`  attesa di sanità (${a.enunciato}): ${a.regge ? 'REGGE' : 'SMENTITA'}`);
  console.log('\n— G0″ (ottimo del banco contro forma chiusa) —');
  console.log(`  ${r.g0.passati}/${r.g0.n_casi} = ${(r.g0.quota_passaggio * 100).toFixed(2)}%  (interni ${r.g0.n_interni}, al bordo ${r.g0.n_al_bordo}, esclusi ${r.g0.n_esclusi})`);
  console.log(`  G0′ RITIRATA, a referto: ${r.g0.g0_primo_ritirata.passati}/${r.g0.n_casi} = ${(r.g0.g0_primo_ritirata.quota_passaggio * 100).toFixed(2)}%`);
  const m = r.multistint;
  console.log('\n— MULTI-STINT (M1…M4) —');
  console.log(`  M1 forma chiusa   ${m.m1.forma_chiusa.passati}/${m.m1.n_ammessi} ammessi  (${m.m1.n_al_bordo} al bordo: ${m.m1.bordo_diagnostica.riprodotti}/${m.m1.bordo_diagnostica.n} riprodotti col vincolo, diagnostica)`);
  console.log(`  M1 ricerca        ${m.m1.ricerca.passati}/${m.m1.n_casi}   ·  k ottimo ${m.m1.k_ottimo.passati}/${m.m1.k_ottimo.n}`);
  console.log(`  M2 non-regressione ${m.m2.passati}/${m.m2.n_casi}`);
  console.log(`  M3 Director       ${m.m3.approvati}/${m.n_casi_reali}  (${m.m3.n_obbligati_a_fermarsi} obbligati dal regolamento, ${m.m3.obbligati_con_sosta} con sosta nel piano)`);
  console.log(`  M4 allarmi        ${m.m4.identici}/${m.n_casi_reali} piani identici a allarmi spenti`);
  console.log(`  soste proposte:   ${Object.entries(m.distribuzione_k).map(([k, n]) => `k=${k}: ${n}`).join(' · ')}`);

  const dd = r.difesa;
  console.log('\n— DIFESA DELLA POSIZIONE (banda di rientro) —');
  for (const [nome, b] of Object.entries(dd.per_prodotto)) {
    console.log(`  ${nome.padEnd(7)} ±${b.n}  n=${String(b.n_casi).padStart(3)}  fuori campione ${(b.copertura_fuori_campione * 100).toFixed(1)}%  (n−1: ${(b.copertura_fuori_campione_n_meno_1 * 100).toFixed(1)}%)  ${b.passa ? 'PASSA' : 'FALLITA'}`);
  }
  console.log(`  contesto (rivali entro ${dd.contesto.soglia} s): ${dd.d2_separa ? 'SEPARA' : 'NON separa'} — p = ${dd.contesto.p_permutazione}, ${dd.contesto.n_contesi} contesi contro ${dd.contesto.n_puliti} puliti`);

  console.log('\n— BIAS sui tempi assoluti —');
  for (const [H, o] of Object.entries(r.bias)) {
    console.log(`  H=${H.padEnd(2)}  bias=${o.bias >= 0 ? '+' : ''}${o.bias}  su ${o.n_gare} gare, ${o.n_finestre} finestre${o.giudicabile ? '' : '  (NON giudicabile)'}`);
  }
  if (process.argv.includes('--scrivi-golden')) {
    const dest = path.join(radice, PERCORSO_GOLDEN_BANCO);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(r, null, 2) + '\n');
    console.log(`\nlinea di base scritta: ${PERCORSO_GOLDEN_BANCO}`);
  }
}
