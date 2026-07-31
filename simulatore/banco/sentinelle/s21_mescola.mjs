// s21_mescola — la Fase Mescola è chiusa in negativo, e la conseguenza è
// sorvegliata (regola 3, E08, E21).
//
// La Fase I ha trovato un effetto forte e riproducibile col SEGNO SBAGLIATO, e
// la clausola direzionale pre-registrata l'ha bocciato. Finché è così, ρ resta
// comune: nessun degrado per mescola entra nel modello o nel kernel.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) l'esito della Fase Mescola non esiste, o non è quello della prereg
//      (appaiamento entro (anno,gara,pilota), permutazione, blocchi = gare);
//  (b) il verdetto scritto nell'esito non segue le TRE condizioni
//      pre-registrate applicate ai suoi stessi numeri — inclusa la clausola
//      direzionale, che la prima stesura dello stimatore aveva dimenticato e che
//      avrebbe dichiarato PASSA su un effetto all'incontrario;
//  (c) un ρ per mescola entra in engine/ o in data/modelli/ mentre il cancello
//      è negativo: sarebbe la separazione cablata senza il suo cancello;
//  (d) la pagina smette di dichiarare che la mescola non cambia il degrado;
//  (e) i numeri dell'esito non si riproducono rieseguendo lo stimatore (E22),
//      oppure la vista degli stint non è quella su cui l'esito è stato calcolato;
//  (f) la Fase II non è pre-registrata: senza una prereg nuova, la domanda
//      aperta tornerebbe a essere una scelta silenziosa (E21).

import { banco } from '../asserzioni.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const b = banco('s21');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const esito = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_mescola.json'), 'utf8'));

// (a) l'esito è quello della prereg
b.uguale('la prereg citata è quella giusta', esito._targhetta.prereg, 'banco/prereg/PREREG_mescola.md');
b.verifica('l\'unità è il contrasto appaiato entro (anno, gara, pilota)', /entro \(anno, gara, pilota\)/.test(esito._targhetta.unita));
b.verifica('l\'incertezza è bootstrap a blocchi = gare (E11)', /blocchi = gare/.test(esito._targhetta.bootstrap));
b.verifica('il null è per permutazione', /permutazioni/.test(esito._targhetta.permutazione));
b.uguale('il 2018 è escluso', esito._targhetta.anno_escluso, 2018);
b.verifica('...con motivo strutturale dichiarato', /2 soli stint HARD/.test(esito._targhetta.motivo_anno_escluso));

// la vista su cui l'esito è stato calcolato è quella committata
{
  const vista = readFileSync(path.join(radice, 'data', 'viste', 'stint_fondo.json'));
  b.uguale('l\'esito è calcolato sulla vista committata (hash)',
    esito._targhetta.sha256_vista, createHash('sha256').update(vista).digest('hex'));
}

// (b) il verdetto segue le tre condizioni applicate ai numeri dell'esito
{
  const c = esito.cancello;
  b.uguale('le condizioni pre-registrate sono tre', c.condizioni.length, 3);
  b.verifica('la terza è la clausola direzionale', /attesa direzionale/i.test(c.condizioni[2]));
  const fuoriOk = c.fuori_campione.every((a) => c.esiti_per_stagione[String(a)].passa);
  b.uguale('il riepilogo del fuori campione è coerente coi suoi esiti', c.fuori_campione_soddisfatto, fuoriOk);
  const atteso = fuoriOk && c.attesa_direzionale_soft_piu_veloce_a_degradare;
  b.uguale('il verdetto è fuori-campione E attesa direzionale', c.passa, atteso);
  // e la direzione si legge dai numeri, non da un flag
  b.uguale('l\'attesa direzionale riflette il segno della stima dentro campione',
    c.attesa_direzionale_soft_piu_veloce_a_degradare, esito.dentro_campione.media > 0);
}

// (c) finché il cancello è negativo, nessun ρ per mescola entra nel modello
if (esito.cancello.passa === false) {
  const PER_MESCOLA = [/rho_per_mescola/, /rho_soft/i, /rho_hard/i, /rho_medium/i, /degrado_per_mescola/];
  const visita = (dir, fuori) => {
    for (const nome of readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (statSync(p).isDirectory()) { visita(p, fuori); continue; }
      if (/\.(mjs|py|json)$/.test(nome)) fuori.push(p);
    }
    return fuori;
  };
  for (const albero of ['engine', path.join('data', 'modelli')]) {
    const dir = path.join(radice, albero);
    if (!existsSync(dir)) continue;
    for (const file of visita(dir, [])) {
      const testo = readFileSync(file, 'utf8');
      const rel = path.relative(radice, file).split(path.sep).join('/');
      for (const vietato of PER_MESCOLA) {
        b.verifica(`${rel} non cabla un ρ per mescola (${vietato.source}): la Fase Mescola non ha passato il cancello`,
          !vietato.test(testo));
      }
    }
  }
  b.verifica('l\'esito dichiara la conseguenza in chiaro', /NON entra nel modello/.test(esito.conseguenza));
  b.verifica('...e rifiuta di inventare il ripiego Pirelli', /non se ne inventa uno/.test(esito.conseguenza));

  // (d) la pagina continua a dichiararlo
  const vistaWeb = JSON.parse(readFileSync(path.join(radice, 'web', 'vista', 'demo.json'), 'utf8'));
  for (const s of vistaWeb.scenari) {
    const a = s.assunzioni.find((x) => x.codice === 'MESCOLA_NON_SEPARA');
    b.verifica(`${s.gara}: la pagina dichiara che la mescola non cambia il degrado`, a !== undefined);
  }

  // (f) la Fase II è pre-registrata
  const preregII = path.join(radice, 'banco', 'prereg', 'PREREG_mescola_II.md');
  b.verifica('la Fase Mescola II è pre-registrata', existsSync(preregII));
  if (existsSync(preregII)) {
    const t = readFileSync(preregII, 'utf8');
    b.verifica('la Fase II dichiara di NON riscrivere la Fase I', /non si riscrive/i.test(t));
    b.verifica('la Fase II dichiara l\'appaiamento su finestra', /appaiamento SU FINESTRA/i.test(t));
    b.verifica('la Fase II dichiara il proprio cancello', /\*\*CANCELLO\*\*/.test(t));
    b.verifica('la Fase II dichiara quando è NON eseguibile', /non eseguibile/i.test(t));
  }
}

// (e) riproducibilità: rieseguito oggi, stessi numeri
{
  const r = spawnSync('python3', [path.join(radice, 'fisica', 'stima_mescola.py')], { encoding: 'utf8' });
  b.uguale('lo stimatore rigira senza errori', r.status, 0);
  const rifatto = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_mescola.json'), 'utf8'));
  b.uguale('la stima complessiva si riproduce', rifatto.complessivo.media, esito.complessivo.media);
  b.uguale('l\'IC si riproduce', rifatto.complessivo.ic95, esito.complessivo.ic95);
  b.uguale('il verdetto si riproduce', rifatto.cancello.passa, esito.cancello.passa);
}

b.chiudi();
