// s16_director — il guardiano del runtime respinge i paradossi, e approva la realtà.
//
// I due guardiani restano distinti (CLAUDE.md): questa sentinella è del BANCO e
// verifica il CODICE del Director ai cancelli; il Director verifica l'OUTPUT a
// runtime. Qui si prova che sappia dire di no — e, altrettanto importante, che
// sappia dire di sì: un guardiano che boccia le gare vere non è severo, è rotto.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) una delle 11 gare 2026 VERE non viene approvata: il Director starebbe
//      chiamando paradosso qualcosa che è successo davvero;
//  (b) una delle quattro rotture canoniche passa: giro verde sotto il pavimento
//      del circuito, stazionario 1,2 s, una sola mescola slick a fine gara,
//      perdita ai box sotto il clean-stop misurato;
//  (c) una violazione non porta la forma dichiarata `{codice, severita, giro,
//      atteso, ottenuto}`: chi legge l'esito non saprebbe cosa mostrare;
//  (d) una costante di guardia è CABLATA dentro director.mjs invece di venire
//      da data/ con targhetta: la soglia sparirebbe dal diff dei dati e
//      cambiarla non si vedrebbe più;
//  (e) la banda di neutralizzazione trascritta in director_limiti.json non
//      compare più nella prosa del prior da cui è stata copiata: le due copie
//      sarebbero divergenti in silenzio;
//  (f) un SOSPETTO viene promosso a FATAL (o viceversa): uno stazionario di 90 s
//      è raro ma possibile e non deve spegnere la pagina, mentre una sosta
//      neutralizzata prezzata come verde deve.

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { creaCella } from '../../provenienza/contratto.mjs';
import { validaSimulazione, simulazioneDaGara, SEVERITA } from '../../scenario/director.mjs';
import { caricaCostanti } from '../../scenario/director_dati.mjs';
import { perditaBox } from '../../provenienza/pitloss.mjs';

const b = banco('s16');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const costanti = caricaCostanti(radice);
const gare = caricaGare2026(radice);

// (a) la realtà passa
for (const [nome, gara] of Object.entries(gare)) {
  const esito = validaSimulazione(simulazioneDaGara(gara, nome), costanti);
  b.verifica(
    `${nome}: gara VERA approvata${esito.approved ? '' : ` — fatali: ${esito.violazioni.filter((v) => v.severita === 'FATAL').map((v) => `${v.codice}@${v.pilota}/${v.giro}`).join(', ')}`}`,
    esito.approved === true,
  );
}

// Base di lavoro per le rotture: una gara vera, approvata.
const NOME_BASE = 'GranBretagna';
const base = () => simulazioneDaGara(gare[NOME_BASE], NOME_BASE);
b.verifica('la base delle rotture è approvata prima di romperla', validaSimulazione(base(), costanti).approved === true);

const conCella = (cella, patch) => creaCella({ ...cella, ...patch });
const primoPilota = (sim) => Object.keys(sim.piloti)[0];

/** Applica una rottura e pretende che il Director la respinga col codice giusto. */
const rompi = (descrizione, codiceAtteso, muta) => {
  const sim = base();
  muta(sim);
  const esito = validaSimulazione(sim, costanti);
  b.verifica(`${descrizione}: RESPINTA`, esito.approved === false);
  const trovata = esito.violazioni.find((v) => v.codice === codiceAtteso && v.severita === SEVERITA.FATAL);
  b.verifica(`${descrizione}: violazione ${codiceAtteso} FATAL a referto${trovata ? '' : ` (codici visti: ${esito.riepilogo.codici})`}`, trovata !== undefined);
  if (trovata) {
    for (const campo of ['codice', 'severita', 'giro', 'atteso', 'ottenuto']) {
      b.verifica(`${descrizione}: la violazione porta il campo "${campo}"`, Object.hasOwn(trovata, campo));
    }
  }
  return esito;
};

// (b) rottura 1 — giro verde sotto il pavimento del circuito
rompi('giro verde 20 s sotto il pavimento', 'FIS01', (sim) => {
  const drv = primoPilota(sim);
  const voce = sim.piloti[drv].celle.find(({ cella }) => cella.lap_time !== null && cella.status === '1' && !cella.in_lap && !cella.out_lap && cella.compound === 'HARD');
  const pavimento = costanti.pavimenti.gare[NOME_BASE].pavimento_s;
  voce.cella = conCella(voce.cella, { lap_time: pavimento - 20 });
});

// (b) rottura 2 — stazionario 1,2 s, sotto il pavimento fisico di 1,8 s
rompi('stazionario 1,2 s (pavimento fisico 1,8 s)', 'FIS02', (sim) => {
  const drv = Object.keys(sim.piloti).find((d) => sim.piloti[d].soste.length > 0);
  sim.piloti[drv].soste[0].stazionario = 1.2;
});

// (b) rottura 3 — una sola mescola slick su gara asciutta completata
rompi('una sola mescola slick a fine gara asciutta', 'REG01', (sim) => {
  const drv = Object.keys(sim.piloti).find((d) => {
    const c = sim.piloti[d].celle;
    return c[c.length - 1].lap === sim.n_giri;
  });
  sim.piloti[drv].celle = sim.piloti[drv].celle.map((v) => ({
    lap: v.lap,
    cella: v.cella.compound === null ? v.cella : conCella(v.cella, { compound: 'MEDIUM' }),
  }));
});

// (b) rottura 4 — perdita ai box sotto il clean-stop misurato del circuito
rompi('perdita pit sotto il clean-stop del circuito', 'FIS04', (sim) => {
  const drv = Object.keys(sim.piloti).find((d) => sim.piloti[d].soste.some((s) => s.regime === null));
  const sosta = sim.piloti[drv].soste.find((s) => s.regime === null);
  // il clean di riferimento è quello che il Director usa DAVVERO: dove il fondo
  // ha promosso il circuito è la misura interna, non il prior
  const clean = perditaBox(costanti.prior, NOME_BASE, null).clean_10pct_s;
  sosta.perdita = clean - costanti.limiti.margine_pitloss_s.valore - 2;
});

// (f) i SOSPETTI restano sospetti: non spengono la pagina
{
  const sim = base();
  const drv = Object.keys(sim.piloti).find((d) => sim.piloti[d].soste.length > 0);
  sim.piloti[drv].soste[0].stazionario = 90;
  const esito = validaSimulazione(sim, costanti);
  b.verifica('stazionario 90 s: SOSPETTO, non FATAL', esito.approved === true);
  b.verifica('...ed è a referto come FIS03', esito.violazioni.some((v) => v.codice === 'FIS03' && v.severita === SEVERITA.SOSPETTO));
}
// ...mentre una sosta neutralizzata prezzata come verde è FATAL
{
  const sim = base();
  const drv = Object.keys(sim.piloti).find((d) => sim.piloti[d].soste.some((s) => s.regime !== null))
    ?? Object.keys(sim.piloti).find((d) => sim.piloti[d].soste.length > 0);
  const sosta = sim.piloti[drv].soste.find((s) => s.regime !== null) ?? sim.piloti[drv].soste[0];
  sosta.regime = 'SC';
  sosta.perdita = perditaBox(costanti.prior, NOME_BASE, null).perdita_verde; // rapporto 1,00
  const esito = validaSimulazione(sim, costanti);
  b.verifica('sosta sotto SC prezzata come verde: RESPINTA', esito.approved === false);
  b.verifica('...con codice REG03 FATAL', esito.violazioni.some((v) => v.codice === 'REG03' && v.severita === SEVERITA.FATAL));
}

// (d) nessuna costante di guardia cablata nel codice del Director
{
  const sorgente = readFileSync(path.join(radice, 'scenario', 'director.mjs'), 'utf8')
    .split('\n').filter((r) => !r.trim().startsWith('//')).join('\n');
  const CABLATE = [
    ['1.8', 'pavimento fisico dello stazionario'],
    ['7200', 'limite di 2 ore'],
    ['10800', 'finestra di 3 ore'],
    ['0.95', 'rapporto massimo del pit neutralizzato'],
    ['22.1', 'mediana di pit-loss d\'era'],
  ];
  for (const [numero, cosa] of CABLATE) {
    b.verifica(`director.mjs non cabla ${numero} (${cosa}): viene da data/ con targhetta`, !sorgente.includes(numero));
  }
}

// (e) la banda trascritta corrisponde ancora alla prosa del prior
{
  const prosa = costanti.prior.fattori_neutralizzazione.incertezza;
  const bande = costanti.limiti.bande_neutralizzazione;
  const comeProsa = (v) => String(v).replace('.', ',').replace(/^0,(\d)$/, '0,$10');
  for (const regime of ['SC', 'VSC']) {
    const [basso, alto] = bande[regime];
    b.verifica(
      `la banda ${regime} [${basso}, ${alto}] è ancora quella dichiarata in prosa dal prior ("${prosa}")`,
      prosa.includes(`${comeProsa(basso)}-${comeProsa(alto)}`),
    );
  }
}

b.chiudi();
