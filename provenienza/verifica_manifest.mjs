// PROVENIENZA / VERIFICA MANIFEST — data/MANIFEST.sha256 è la verità
// (Regola 7): ogni file ereditato ha il suo hash atteso e il fallimento è
// rumoroso. Niente validità "size > 1000", niente fonti mutabili (E18).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

// artefatti locali per-macchina DICHIARATI (rispecchiano .gitignore): possono
// esistere sotto data/ senza stare nel manifest. Tutto il resto che compare
// fuori manifest è un intruso.
const ARTEFATTI_LOCALI = [
  /^data\/ff1_cache\//, /^data\/fastf1_cache\//, /^data\/live_raw\//,
  /\.log$/, /\.ff1pkl$/, /\.pkl$/, /^data\/\.auto_/, /\/\.DS_Store$/,
];

export function verificaManifest({ radice, manifestTesto = null }) {
  const testo = manifestTesto ?? readFileSync(join(radice, 'data', 'MANIFEST.sha256'), 'utf8');
  const attesi = new Map();
  for (const riga of testo.split('\n')) {
    if (!riga.trim()) continue;
    const m = riga.match(/^([0-9a-f]{64})\s+(.+)$/);
    if (!m) return { ok: false, motivo: `riga di manifest malformata: ${riga.slice(0, 60)}`, difformi: [], mancanti: [], extra: [], contati: 0 };
    attesi.set(m[2], m[1]);
  }

  const difformi = [], mancanti = [];
  let contati = 0;
  for (const [percorso, hashAtteso] of attesi) {
    const pieno = join(radice, percorso);
    if (!existsSync(pieno)) { mancanti.push(percorso); continue; }
    const hash = createHash('sha256').update(readFileSync(pieno)).digest('hex');
    contati += 1;
    if (hash !== hashAtteso) difformi.push(percorso);
  }

  // intrusi: file sotto data/ né a manifest né dichiarati artefatti locali
  // (il pickle del warm-in è ereditato E pinnato: sta a manifest, l'esenzione
  // *.pkl copre solo eventuali pickle locali non ereditati)
  const extra = [];
  for (const percorso of tuttiSotto(join(radice, 'data'))) {
    const rel = relative(radice, percorso).split('\\').join('/');
    if (rel === 'data/MANIFEST.sha256') continue;
    if (attesi.has(rel)) continue;
    if (ARTEFATTI_LOCALI.some(re => re.test(rel)) && !attesi.has(rel)) continue;
    extra.push(rel);
  }

  return { ok: difformi.length === 0 && mancanti.length === 0 && extra.length === 0, difformi, mancanti, extra, contati };
}

function* tuttiSotto(dir) {
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) yield* tuttiSotto(pieno);
    else yield pieno;
  }
}
