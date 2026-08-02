// s22_pitloss — la promozione dei pit-loss regge le sue condizioni.
//
// La misura interna sul fondo ha sostituito il prior esterno sui circuiti che
// hanno superato il cancello A. Il prior non è stato cancellato: è diventato
// cross-check, e resta in vigore dove il fondo non ha promosso.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) un circuito è promosso senza avere le tre condizioni del cancello A
//      (≥ 20 soste, robustezza alla finestra ≤ 0,30 s, plausibilità 10-45 s):
//      sarebbe una promozione senza cancello;
//  (b) `perditaBox` usa il prior dove il fondo ha promosso, o la misura interna
//      dove NON ha promosso: in entrambi i casi la fonte non è quella dichiarata;
//  (c) un valore MISTO fra le due fonti — la prereg lo vieta, perché un numero
//      mediato fra prior e misura non ha una natura e la regola 2 non saprebbe
//      che targhetta dargli;
//  (d) la targhetta non cambia con la fonte: un numero misurato sul fondo che
//      continua a dirsi "prior esterno" è una targhetta che mente (regola 2);
//  (e) il Director legge il pit-loss da una fonte DIVERSA da quella del motore:
//      il guardiano validerebbe con un metro e il motore prezzerebbe con un
//      altro — E12 nel posto peggiore;
//  (f) l'esito non si riproduce rieseguendo lo stimatore (E22), o la vista delle
//      soste non è quella su cui è stato calcolato;
//  (g) il cross-check col prior sparisce dall'esito: il prior decade a
//      cross-check, non a niente (E21: una misura non si cancella).

import { banco } from '../asserzioni.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { perditaBox, GP_PER_GARA } from '../../provenienza/pitloss.mjs';
import { caricaPrior } from '../../provenienza/pitloss_dati.mjs';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { validaSimulazione, simulazioneDaGara } from '../../scenario/director.mjs';
import { caricaCostanti } from '../../scenario/director_dati.mjs';

const b = banco('s22');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const interno = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'pitloss_interno.json'), 'utf8'));
const prior = caricaPrior(radice);

// (a) il cancello A è applicato, non dichiarato
{
  const c = interno.cancello_A;
  b.uguale('la prereg citata è quella giusta', interno._targhetta.prereg, 'banco/prereg/PREREG_pitloss.md');
  b.verifica('la metodologia è quella del prior (confrontabile, non somigliante)',
    /in-lap.*out-lap.*mediana del passo pulito/.test(interno._targhetta.metodologia));
  b.verifica('la fase è sufficiente (≥ 5 promossi)', c.sufficiente === true);
  for (const [gp, m] of Object.entries(interno.circuiti)) {
    const atteso = m.n_soste >= c.min_soste
      && m.spostamento_finestra_2_5 !== null && m.spostamento_finestra_2_5 <= c.max_spostamento_finestra_s
      && m.mediana_green_s >= c.banda_plausibilita_s[0] && m.mediana_green_s <= c.banda_plausibilita_s[1];
    b.uguale(`${gp}: promosso ⇔ le tre condizioni del cancello A`, m.cancello_A.promosso, atteso);
    if (m.cancello_A.promosso) b.verifica(`${gp}: è nell'elenco dei promossi`, c.promossi.includes(gp));
  }
  b.uguale('l\'elenco dei promossi coincide con i promossi', c.promossi.length, c.n_promossi);
}

// la vista su cui l'esito è stato calcolato è quella committata
{
  const vista = readFileSync(path.join(radice, 'data', 'viste', 'soste_fondo.json'));
  b.uguale('la misura è calcolata sulla vista committata (hash)',
    interno._targhetta.sha256_vista, createHash('sha256').update(vista).digest('hex'));
}

// (b) + (c) + (d) la fonte è quella dichiarata, e la targhetta la dice
{
  let conMisura = 0;
  let conPrior = 0;
  for (const [gara, gp] of Object.entries(GP_PER_GARA)) {
    const promosso = interno.circuiti[gp]?.cancello_A?.promosso === true;
    const r = perditaBox(prior, gara, null);
    b.uguale(`${gara}: la fonte è quella dichiarata dal cancello`, r.fonte, promosso ? 'misura_interna' : 'prior_esterno');
    if (promosso) {
      conMisura += 1;
      // (c) nessun valore misto: il numero è ESATTAMENTE quello misurato
      b.uguale(`${gara}: la perdita è esattamente la mediana misurata, non una media fra le fonti`,
        r.perdita_verde, interno.circuiti[gp].mediana_green_s);
      // (d) la targhetta cambia con la fonte
      b.verifica(`${gara}: la targhetta dice "misurato sul fondo"`, /misurato sul fondo/.test(r.targhetta));
      b.verifica(`${gara}: la targhetta porta il numero di soste`, /\d+ soste/.test(r.targhetta));
    } else {
      conPrior += 1;
      b.verifica(`${gara}: la targhetta dice "prior esterno"`, /prior esterno/.test(r.targhetta));
    }
  }
  b.verifica(`la promozione tocca davvero delle gare 2026 (${conMisura} misurate, ${conPrior} col prior)`, conMisura >= 5);
  b.verifica('...e almeno una resta col prior, altrimenti il confronto è cieco', conPrior >= 1);
}

// il fattore di neutralizzazione si applica alla fonte giusta, qualunque sia
{
  for (const gara of ['Spagna', 'Monaco']) {
    const verde = perditaBox(prior, gara, null);
    const sotto = perditaBox(prior, gara, 'SC');
    b.uguale(`${gara}: sotto SC si paga il fattore della STESSA perdita di riferimento`,
      Number(sotto.perdita.toFixed(6)), Number((verde.perdita_verde * prior.fattori_neutralizzazione.SC).toFixed(6)));
    b.uguale(`${gara}: la fonte non cambia col regime`, sotto.fonte, verde.fonte);
  }
}

// (e) il Director usa la STESSA fonte del motore
{
  const sorgente = readFileSync(path.join(radice, 'scenario', 'director.mjs'), 'utf8');
  b.verifica('director.mjs chiede la perdita a provenienza/pitloss.mjs', /from '\.\.\/provenienza\/pitloss\.mjs'/.test(sorgente));
  b.verifica('director.mjs non tiene una propria mappa gara→circuito', !/CIRCUITO_PER_GARA\s*=/.test(sorgente));
  const costanti = caricaCostanti(radice);
  const gare = caricaGare2026(radice);
  for (const [nome, gara] of Object.entries(gare)) {
    const esito = validaSimulazione(simulazioneDaGara(gara, nome), costanti);
    b.uguale(`${nome}: il Director dichiara la fonte del pit-loss che usa il motore`,
      esito.riepilogo.fonte_pit_loss, perditaBox(prior, nome, null).fonte);
    b.verifica(`${nome}: ...e ne porta la targhetta`, typeof esito.riepilogo.targhetta_pit_loss === 'string');
  }
}

// (g) il prior resta come cross-check, coi suoi numeri
{
  const cross = interno.cross_check_prior;
  b.verifica('il cross-check col prior è a referto', cross !== undefined && cross.per_circuito !== undefined);
  b.verifica('...ed è dichiarato NON decisivo', /NON decisivo/.test(cross.nota));
  b.uguale('...sull\'era sovrapposta dichiarata', cross.era, [2022, 2025]);
  const confrontati = Object.values(cross.per_circuito).filter((x) => x.differenza_s !== null);
  b.verifica(`il cross-check confronta abbastanza circuiti (${confrontati.length})`, confrontati.length >= 5);
  for (const [cid, x] of Object.entries(cross.per_circuito)) {
    if (x.differenza_s === null) continue;
    b.uguale(`${cid}: la discordanza è calcolata sulla soglia dichiarata`,
      x.discordanza, Math.abs(x.differenza_s) > cross.soglia_discordanza_s);
  }
}

// (f) riproducibilità — SENZA lasciare il file diverso da come lo si e' trovato.
//
// Questo blocco rilancia lo stimatore, che RISCRIVE data/modelli/pitloss_interno.json.
// Finche' l'output era identico il danno era invisibile; dal 02/08/2026 quel file e' un
// MODELLO SIGILLATO per l'holdout di Zandvoort (e' quello che gli da' i suoi 22,382 s),
// e un banco che riscrive cio' che deve sorvegliare e' un guardiano che sposta la prova.
// Basterebbe un aggiornamento di numpy, o una riga in piu' in soste_fondo.json, perche'
// far girare la suite — o la CI, che parte a ogni push — rompa il sigillo in silenzio.
//
// Percio': si fotografano i byte PRIMA, si rilancia, si confronta, e si RIMETTONO i byte
// originali. La verifica conserva tutto il suo potere (se lo stimatore producesse numeri
// diversi, le asserzioni qui sotto diventerebbero rosse) e non lascia traccia.
{
  const dovInterno = path.join(radice, 'data', 'modelli', 'pitloss_interno.json');
  const prima = readFileSync(dovInterno);
  const r = spawnSync('python3', [path.join(radice, 'fisica', 'stima_pitloss.py')], { encoding: 'utf8' });
  b.uguale('lo stimatore rigira senza errori', r.status, 0);
  const rifatto = JSON.parse(readFileSync(dovInterno, 'utf8'));
  writeFileSync(dovInterno, prima);   // il banco non lascia il modello diverso da come l'ha trovato
  b.uguale('...e il file sorvegliato e\' tornato esattamente com\'era',
    createHash('sha256').update(readFileSync(dovInterno)).digest('hex'),
    createHash('sha256').update(prima).digest('hex'));
  b.uguale('i promossi si riproducono', rifatto.cancello_A.promossi, interno.cancello_A.promossi);
  for (const gp of rifatto.cancello_A.promossi) {
    b.uguale(`${gp}: la mediana si riproduce`, rifatto.circuiti[gp].mediana_green_s, interno.circuiti[gp].mediana_green_s);
  }
}

b.chiudi();
