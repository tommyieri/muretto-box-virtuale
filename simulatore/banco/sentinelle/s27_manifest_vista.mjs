// s27_manifest_vista — il manifest della vista descrive l'ARCHIVIO, non l'ultimo giro
// di manovella.
//
// IL GUAIO CHE QUESTA SENTINELLA IMPEDISCE, trovato il 31/07/2026 durante l'audit di
// pre-pubblicazione, prima che arrivasse in produzione:
//
//   `auto_gara.py` chiama `node web/genera_vista_gara.mjs <gara>` con UNA gara sola —
//   quella appena corsa. Il manifest veniva scritto dall'elenco delle gare RIGENERATE in
//   quella esecuzione, quindi dopo il primo Gran Premio automatico avrebbe contenuto una
//   voce sola. `gara.html` legge da li' la mappa dei nomi ("Gran Bretagna" → cartella
//   "GranBretagna"): senza, il pannello resta muto su tutte le altre gare.
//
//   Dieci gare su undici mute, in produzione, di domenica notte, senza che nessuno
//   avesse toccato niente. Il tipo di guasto peggiore: silenzioso, automatico, e con la
//   causa a giorni di distanza dal sintomo.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il manifest scritto dal generatore NON elenca una gara che sta su disco — cioe'
//      l'elenco e' tornato a dipendere da cosa e' stato rigenerato in quel giro;
//  (b) la mappa dei nomi perde la gara col nome separato ("Gran Bretagna"), che e' E24
//      del catalogo — lo spazio nel nome che spezza i glob;
//  (c) il manifest COMMITTATO in demo/data/vista/ non corrisponde alle cartelle presenti:
//      il sito verrebbe pubblicato con un indice che non descrive i suoi dati;
//  (d) il controllo non morde: su una cartella senza `indice.json` la gara non deve
//      comparire, altrimenti (a) passerebbe anche con un manifest che elenca cartelle vuote.
//
// COME E' COSTRUITO IL CONTROLLO (a). Si esegue il generatore VERO dalla riga di comando,
// su una cartella di prova gia' popolata, chiedendogli una gara che non esiste: cosi' non
// rigenera niente (35 s risparmiati) ma passa esattamente dal punto in cui il manifest si
// scrive. Sul codice di prima quel manifest sarebbe uscito VUOTO — ed e' il motivo per cui
// il controllo e' fatto cosi' invece di chiamare direttamente la funzione: una sentinella
// deve poter fallire sul difetto che dice di sorvegliare.

import { banco } from '../asserzioni.mjs';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { manifestDaDisco } from '../../web/genera_vista_gara.mjs';

const b = banco('s27');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const VISTA = path.join(radice, '..', 'demo', 'data', 'vista');

// finte cartelle di vista: bastano un `indice.json` a testa
const FINTE = ['Australia', 'GranBretagna', 'Ungheria'];
const SENZA_INDICE = 'CartellaVuota';

// ── (a) + (b) + (d) il generatore vero, su una cartella di prova ───────────
{
  const tmp = mkdtempSync(path.join(tmpdir(), 's27-'));
  try {
    for (const g of FINTE) {
      mkdirSync(path.join(tmp, g), { recursive: true });
      writeFileSync(path.join(tmp, g, 'indice.json'), JSON.stringify({ gara: g, piloti: {} }));
    }
    // una cartella SENZA indice: non e' una vista, e non deve entrare nel manifest
    mkdirSync(path.join(tmp, SENZA_INDICE), { recursive: true });

    // il generatore, chiamato su una gara che non esiste: non rigenera niente e arriva
    // comunque alla scrittura del manifest — che e' il punto sotto esame
    execFileSync('node', ['web/genera_vista_gara.mjs', '__gara_inesistente__', '--dove', tmp],
      { cwd: radice, stdio: 'pipe' });

    const percorso = path.join(tmp, 'manifest.json');
    b.verifica('il generatore scrive il manifest anche quando non rigenera nulla', existsSync(percorso));
    const m = JSON.parse(readFileSync(percorso, 'utf8'));

    // (a) l'elenco viene dal DISCO, non dalle gare di questa esecuzione (che sono zero)
    b.uguale('il manifest elenca TUTTE le gare su disco, non quelle rigenerate ora',
      [...(m.gare ?? [])].sort(), [...FINTE].sort());
    // (d) e non elenca una cartella che non e' una vista
    b.verifica(`${SENZA_INDICE} (senza indice.json) NON entra nel manifest`,
      !(m.gare ?? []).includes(SENZA_INDICE));
    // (b) la mappa dei nomi regge il nome separato (E24)
    b.uguale('"Gran Bretagna" mappa sulla cartella senza spazio', m.cartella_di?.['Gran Bretagna'], 'GranBretagna');
    b.uguale('...e un nome senza spazi mappa su se stesso', m.cartella_di?.Australia, 'Australia');
    b.uguale('la mappa copre tutte le gare elencate',
      Object.keys(m.cartella_di ?? {}).length, (m.gare ?? []).length);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ── (c) il manifest COMMITTATO descrive i dati committati ──────────────────
{
  const percorso = path.join(VISTA, 'manifest.json');
  b.verifica('la vista del sito esiste ed e\' committata', existsSync(percorso));
  if (existsSync(percorso)) {
    const committato = JSON.parse(readFileSync(percorso, 'utf8'));
    const daDisco = manifestDaDisco(VISTA);
    b.uguale('il manifest committato elenca esattamente le viste presenti su disco',
      [...(committato.gare ?? [])].sort(), [...daDisco.gare].sort());
    b.uguale('...e la stessa mappa dei nomi', committato.cartella_di, daDisco.cartella_di);
    // ogni gara elencata ha davvero il suo indice, e l'indice ha dei piloti
    for (const g of daDisco.gare) {
      const ind = path.join(VISTA, g, 'indice.json');
      b.verifica(`${g}: l'indice esiste`, existsSync(ind));
      if (!existsSync(ind)) continue;
      const i = JSON.parse(readFileSync(ind, 'utf8'));
      const piloti = Object.keys(i.piloti ?? {});
      b.verifica(`${g}: l'indice elenca dei piloti (${piloti.length})`, piloti.length > 0);
      // e i file dei piloti ci sono davvero: un indice che promette e non mantiene
      // manderebbe la pagina a chiedere un 404
      const mancanti = piloti.filter((p) => !existsSync(path.join(VISTA, g, `${p}.json`)));
      b.verifica(`${g}: nessun pilota promesso dall'indice e assente dal disco`
        + (mancanti.length ? ` — mancano ${mancanti.join(', ')}` : ''), mancanti.length === 0);
    }
    b.verifica(`sono state controllate abbastanza gare (${daDisco.gare.length})`, daDisco.gare.length >= 10);
  }
}

b.chiudi();
