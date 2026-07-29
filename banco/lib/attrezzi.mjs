// Attrezzi comuni delle sentinelle del banco.
// Regola 4: un test che stampa FALLITO ed esce 0 è un ornamento. Qui l'uscita
// è cablata all'esito: `fine()` esce 1 se anche UNA verifica è fallita.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// radice del repo, indipendente dalla cwd di chi lancia
export const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function nuovoBanco(nome) {
  const guasti = [];
  let contate = 0;
  return {
    verifica(condizione, messaggio) {
      contate += 1;
      if (!condizione) guasti.push(messaggio);
    },
    fine() {
      if (guasti.length === 0) {
        console.log(`OK  ${nome} — ${contate} verifiche`);
        process.exit(0);
      }
      console.error(`FALLITO  ${nome} — ${guasti.length}/${contate} verifiche:`);
      for (const g of guasti) console.error(`  · ${g}`);
      process.exit(1);
    },
  };
}

// uguaglianza strutturale severa: null ≠ undefined ≠ NaN ≠ 0 — le assenze
// contano quanto i valori (Regola 6)
export function stessi(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every(k => stessi(a[k], b[k]));
}
