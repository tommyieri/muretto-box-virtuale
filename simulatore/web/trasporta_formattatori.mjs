#!/usr/bin/env node
// trasporta_formattatori.mjs — porta i componenti del pannello dove il sito puo' servirli.
//
//     node web/trasporta_formattatori.mjs             copia e scrive il manifest
//     node web/trasporta_formattatori.mjs --verifica  esce 1 se le copie sono derivate
//
// IL PROBLEMA. Vercel serve `demo/` come radice: un modulo in `simulatore/web/` non e'
// raggiungibile da una pagina del sito. Ma copiare a mano quattro file sarebbe creare due
// sorgenti della stessa cosa — l'errore che questo progetto paga da sempre (E12: due
// definizioni di "verde" sono costate il 37% di divergenza replay/live).
//
// LA SOLUZIONE. Le copie sono ARTEFATTI GENERATI, non sorgenti: portano un'intestazione
// che lo dice, e un manifest con l'hash dell'originale. `--verifica` fallisce se qualcuno
// modifica la copia invece dell'originale, oppure se l'originale cambia e nessuno ha
// ri-trasportato. La CI lo esegue: la deriva non puo' passare inosservata.
//
// PERCHE' SOLO QUESTI QUATTRO. Sono i FORMATTATORI: prendono la vista gia' calcolata e
// producono un albero dichiarativo. Non importano ne' il kernel ne' il modello ne' i
// coefficienti — verificato qui sotto, ed e' la condizione che rende lecito mandarli nel
// browser senza violare la regola 8 ("la pagina non calcola").
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORGENTE = path.join(RADICE, 'web');
const DESTINAZIONE = path.join(RADICE, '..', 'demo', 'vendor', 'simulatore');
const MANIFEST = path.join(DESTINAZIONE, 'MANIFEST.json');

const FILE = ['targhette.mjs', 'pannello.mjs', 'curva.mjs', 'render.mjs'];

// IL FOGLIO DI STILE, SCOPATO SOTTO IL CONTENITORE DEL PANNELLO.
// Il CSS del simulatore e quello del sito condividono due nomi di classe (`pista`,
// `spenta`) e regole globali su `body`, `*` e `:root`. Servirlo tale quale dentro una
// pagina del sito significherebbe che il pannello ridipinge il resto della pagina — un
// effetto a distanza che nessuno collegherebbe piu' a questo trasporto.
// Qui ogni selettore viene prefissato con `#pitKv`: le regole valgono SOLO dentro il
// pannello, e le variabili di :root diventano variabili del pannello. E' l'unica
// trasformazione che il trasporto applica, ed e' dichiarata.
const CSS = 'stile.css';
const AMBITO = '#pitKv';

function scopa(css, ambito) {
  const fuori = new Set(['*', 'body', 'html']);
  return css.replace(/(^|\})([^{}]+)\{/g, (tutto, chiusa, selettori) => {
    const s = selettori.trim();
    if (s.startsWith('@')) return tutto;                       // at-rule: si lascia stare
    const nuovi = s.split(',').map((x) => {
      const t = x.trim();
      if (!t) return t;
      if (t === ':root' || fuori.has(t)) return ambito;         // globali -> il contenitore
      return `${ambito} ${t}`;
    });
    return `${chiusa}${nuovi.join(',')}{`;
  });
}

// Cio' che un formattatore non deve MAI importare. Se un domani qualcuno aggiungesse una
// riga di fisica dentro un componente, il trasporto si rifiuta di portarlo nel browser.
const VIETATI = ['../engine/', '../scenario/', '../provenienza/', '../fisica/'];

const sha = (t) => createHash('sha256').update(t).digest('hex');

function intestazione(nome) {
  return `// ————————————————————————————————————————————————————————————————————————
// ARTEFATTO GENERATO — non modificare qui.
//   sorgente: simulatore/web/${nome}
//   generato: simulatore/web/trasporta_formattatori.mjs
// Vercel serve demo/ come radice e non vede simulatore/: questa copia esiste solo
// per essere servita. Modificare QUESTO file lo fa divergere dall'originale, e
// \`node web/trasporta_formattatori.mjs --verifica\` fallisce (lo esegue la CI).
// ————————————————————————————————————————————————————————————————————————
`;
}

function main() {
  const verifica = process.argv.includes('--verifica');
  mkdirSync(DESTINAZIONE, { recursive: true });
  const manifest = {};
  const problemi = [];

  for (const nome of FILE) {
    const orig = readFileSync(path.join(SORGENTE, nome), 'utf8');

    for (const v of VIETATI) {
      if (orig.includes(`from '${v}`)) {
        problemi.push(`${nome} importa da ${v}: un formattatore non puo' portare fisica nel browser`);
      }
    }

    const atteso = intestazione(nome) + orig;
    const dest = path.join(DESTINAZIONE, nome);
    manifest[nome] = { sha256_sorgente: sha(orig), byte: atteso.length };

    if (verifica) {
      if (!existsSync(dest)) { problemi.push(`${nome}: copia assente`); continue; }
      const attuale = readFileSync(dest, 'utf8');
      if (attuale !== atteso) {
        problemi.push(`${nome}: la copia e' DERIVATA dall'originale `
          + '(qualcuno ha modificato la copia, o l\'originale e cambiato senza ri-trasportare)');
      }
    } else {
      writeFileSync(dest, atteso);
    }
  }

  // il CSS: stessa disciplina dei moduli, piu' la scopatura dichiarata
  {
    const orig = readFileSync(path.join(SORGENTE, CSS), 'utf8');
    const atteso = `/* ARTEFATTO GENERATO da simulatore/web/trasporta_formattatori.mjs\n`
      + `   sorgente: simulatore/web/${CSS}\n`
      + `   ogni selettore e' stato prefissato con '${AMBITO}': queste regole valgono SOLO\n`
      + `   dentro il pannello e non possono ridipingere il resto della pagina. */\n`
      + scopa(orig, AMBITO);
    const dest = path.join(DESTINAZIONE, CSS);
    manifest[CSS] = { sha256_sorgente: sha(orig), byte: atteso.length, ambito: AMBITO };
    if (verifica) {
      if (!existsSync(dest) || readFileSync(dest, 'utf8') !== atteso) {
        problemi.push(`${CSS}: la copia e' DERIVATA dall'originale`);
      }
    } else {
      writeFileSync(dest, atteso);
    }
  }

  if (verifica) {
    const m = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : null;
    if (!m) problemi.push('manifest assente');
    else for (const nome of [...FILE, CSS]) {
      if (m.file?.[nome]?.sha256_sorgente !== manifest[nome].sha256_sorgente) {
        problemi.push(`${nome}: hash del sorgente diverso da quello nel manifest`);
      }
    }
    if (problemi.length) {
      console.error('TRASPORTO DERIVATO:');
      problemi.forEach((p) => console.error('  ' + p));
      process.exit(1);
    }
    console.log(`trasporto verificato: ${FILE.length} formattatori + il CSS, identici all'originale`);
    return;
  }

  if (problemi.length) {
    console.error('TRASPORTO RIFIUTATO:');
    problemi.forEach((p) => console.error('  ' + p));
    process.exit(1);
  }
  writeFileSync(MANIFEST, JSON.stringify({
    _nota: 'GENERATO da simulatore/web/trasporta_formattatori.mjs. Le copie in questa '
         + 'cartella sono artefatti: si modifica l\'originale in simulatore/web/ e si '
         + 'ri-trasporta. `--verifica` esce 1 sulla deriva.',
    generato_il: new Date().toISOString().slice(0, 10),
    file: manifest,
  }, null, 1));
  console.log(`trasportati ${FILE.length} formattatori -> demo/vendor/simulatore/`);
  for (const n of [...FILE, CSS]) {
    console.log(`  ${n.padEnd(16)} ${manifest[n].byte} byte`
      + (manifest[n].ambito ? `  (scopato sotto ${manifest[n].ambito})` : ''));
  }
}

main();
