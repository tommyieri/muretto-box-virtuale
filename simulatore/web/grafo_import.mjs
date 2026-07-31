// grafo_import.mjs — camminare la chiusura degli import di un modulo.
//
// Serve a DUE cose che devono per forza vedere lo stesso grafo:
//   · la sentinella s26, che verifica che il motore sia caricabile in pagina;
//   · `trasporta_motore.mjs`, che quel motore lo copia dentro demo/.
// Se le due avessero due camminatori, il trasporto potrebbe portare un file che
// la sentinella non guarda — cioe' esattamente E12 con un altro vestito.
//
// E' un'analisi TESTUALE degli import statici, non un risolutore: import
// dinamici (`await import(...)`) non li vede. Va bene per questo scopo — il
// motore non ne ha, e la sentinella lo verifica sul risultato (un import
// dinamico verso node: farebbe fallire in pagina, non qui) — ma chi lo riusa
// deve saperlo.

/** Gli import/export-from statici di un file, come stanno scritti. */
export function importDi(testo) {
  const fuori = [];
  const re = /^\s*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(testo)) !== null) fuori.push(m[1]);
  const re2 = /^\s*import\s*['"]([^'"]+)['"]/gm;
  while ((m = re2.exec(testo)) !== null) fuori.push(m[1]);
  return fuori;
}

/**
 * Chiusura degli import a partire dagli ingressi.
 *
 * @param ingressi percorsi relativi alla radice, con separatore `/`
 * @param leggi    `(rel) => testo | null`
 * @returns `{ moduli: Set<rel>, esterni: [{da, specificatore}] }` — `esterni`
 *          sono gli import NON relativi: in un browser senza bundler sono
 *          esattamente cio' che non si risolve.
 */
export function chiusura(ingressi, leggi) {
  const moduli = new Set();
  const esterni = [];
  const coda = [...ingressi];
  while (coda.length) {
    const rel = coda.pop();
    if (moduli.has(rel)) continue;
    moduli.add(rel);
    const testo = leggi(rel);
    if (testo === null) continue;
    for (const spec of importDi(testo)) {
      if (!spec.startsWith('.')) { esterni.push({ da: rel, specificatore: spec }); continue; }
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      // normalizzazione a mano: niente node:path, cosi' questo modulo resta
      // usabile anche da chi non ha un filesystem sotto.
      const pezzi = [];
      for (const p of `${dir}/${spec}`.split('/')) {
        if (p === '' || p === '.') continue;
        if (p === '..') pezzi.pop(); else pezzi.push(p);
      }
      coda.push(pezzi.join('/'));
    }
  }
  return { moduli, esterni };
}
