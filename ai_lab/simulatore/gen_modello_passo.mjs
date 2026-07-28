// gen_modello_passo.mjs — scrive il modello del passo che la PRODUZIONE legge.
//
//     node ai_lab/simulatore/gen_modello_passo.mjs
//
// Un numero in produzione senza il suo generatore e' un numero orfano, e questo progetto ha
// gia' pagato quel debito piu' volte (v. TODO.md §9). Qui i due coefficienti che il pannello
// usera' nascono dagli esiti misurati dal grezzo, con la targhetta attaccata: da dove vengono,
// su quante gare, con che intervallo, e cosa NON sanno fare.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(QUI, '..', '..');
const j = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const deg = j(path.join(QUI, 'esito_degrado.json'));
const der = j(path.join(QUI, 'esito_deriva.json'));

const out = {
  _nota: 'GENERATO da ai_lab/simulatore/gen_modello_passo.mjs — non modificare a mano.',
  forma: 't(pilota, giro) = base + delta_per_giro*(giro-1) + rho*eta_gomma;  '
       + 'la sosta AZZERA eta e paga il pit-loss. base si misura con la STESSA equazione '
       + '(demo/passo.mjs): si sottrae cio che si ri-aggiunge.',

  // DERIVA DI GARA — non si chiama carburante, ed e' il punto (PREREG_fase1.md §0/E3):
  // e' carburante + evoluzione pista + gestione, che i tempi di gara non separano.
  deriva: {
    delta_gara_s: der.mediane['2026'],
    ic95: der.ic95['2026'],
    unita: 's di scivolamento totale dal giro 1 al giro N; POSITIVO = i giri accelerano',
    per_circuito: false,
    perche_non_per_circuito: 'T2 e T3 di PREREG_fase1.md non passano: il circuito spiega il '
      + '43% della varianza (non oltre meta), e fuori campione il per-circuito batte il Phi '
      + 'unico solo in 4 gare su 10.',
    n_gare_2026: der.targhetta.gare_2026,
    n_gare_storico: der.targhetta.gare_storiche,
    storico_s: der.mediane.storico,
  },

  // DEGRADO — comune alle mescole, e la ragione sta scritta accanto
  degrado: {
    rho_s_giro: deg.pooled_comune.rho_comune,
    ic95: deg.ic95_blocchi_gara.rho_comune,
    unita: 's al giro per ogni giro di vita della gomma',
    per_mescola: false,
    perche_non_per_mescola: 'sul 2026 le mescole NON separano il degrado: rho_SOFT - rho_HARD '
      + `= ${(deg.pooled_per_mescola.rho_SOFT - deg.pooled_per_mescola.rho_HARD).toFixed(4)}, `
      + `IC95 che contiene lo zero, p(permutazione) = ${deg.nullo_permutazione.p.toFixed(3)}, `
      + 'e l ordine SOFT>MEDIUM>HARD esce da solo in 2 gare su 10. Un rho per mescola direbbe '
      + 'una differenza che i dati non sostengono.',
    per_mescola_misurato: deg.pooled_per_mescola,
    n_giri: deg.targhetta.n_giri,
    gare: deg.targhetta.gare_usate,
  },

  targhetta: {
    regime: '2026',
    escluse: [...new Set([...(deg.targhetta.escluse || []), ...(der.targhetta.escluse_2026 || [])])],
    fonte: 'grezzo (data/ti_cache + data/ti_archive) via lab/fondo.py — nessun derivato letto',
    prereg: ['ai_lab/simulatore/PREREG_fase0.md', 'ai_lab/simulatore/PREREG_fase1.md'],
    report: ['ai_lab/simulatore/REPORT_FASE0.md', 'ai_lab/simulatore/REPORT_FASE1.md',
             'ai_lab/simulatore/REPORT_FASE2.md'],
    seed: deg.targhetta.seed,
  },

  limiti_onesti: [
    'REGIME 2026 SOLTANTO. Il 2026 e una rottura regolamentare; i coefficienti storici non '
    + 'sono ereditati.',
    'DELTA E UN LIMITE SUPERIORE sull effetto carburante: contiene anche evoluzione pista e '
    + 'gestione, e i tempi di gara non li separano. Per il simulatore va bene — serve l effetto '
    + 'netto del giro — ma il nome FUEL_COEFF sarebbe una bugia comoda.',
    'RHO E COMUNE alle tre mescole asciutte. Non e una semplificazione di comodo: e cio che i '
    + 'dati 2026 sostengono. La differenza fra mescole va cercata sul fondo 2018-2025 (Fase 3).',
    'NIENTE CLIFF: il modello e lineare nell eta. Non rappresenta il crollo di fine vita.',
    'CIECO SUL BAGNATO: le gomme da bagnato sono fuori dalla stima e fuori dal modello (Fase 4).',
    'IL DEGRADO NON E PER-CIRCUITO e la deriva nemmeno: entrambe le ipotesi sono state '
    + 'testate e non passano (REPORT_FASE1.md).',
  ],
};

const dest = path.join(ROOT, 'demo', 'data', 'modello_passo_2026.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`scritto ${path.relative(ROOT, dest)}`);
console.log(`  delta di gara ${out.deriva.delta_gara_s.toFixed(3)} s   `
  + `IC95 [${out.deriva.ic95[0].toFixed(3)} ; ${out.deriva.ic95[1].toFixed(3)}]`);
console.log(`  rho           ${out.degrado.rho_s_giro.toFixed(4)} s/giro   `
  + `IC95 [${out.degrado.ic95[0].toFixed(4)} ; ${out.degrado.ic95[1].toFixed(4)}]`);
