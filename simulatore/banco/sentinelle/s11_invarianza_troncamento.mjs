// s11_invarianza_troncamento — regola 5, sul percorso stato→kernel (E15).
//
// "Ogni misura al congelamento Lf deve dare lo stesso risultato su byLap
// intero e su byLap troncato a Lf. È la definizione operativa di «non sbircia
// il futuro»." Qui la misura è la proiezione del kernel: si costruisce lo
// stato al congelamento dal grezzo 2026 INTERO e dallo stesso grezzo TRONCATO
// a Lf, e si pretende che stato e proiezione coincidano byte per byte.
//
// Nel vecchio repo la misura del gradino a congelamento leggeva fino a 6 giri
// dopo Lf (E15): con dati interi dava un numero, con dati troncati un altro.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) lo stato costruito dal grezzo intero differisce da quello costruito dal
//      troncato: qualcosa oltre Lf è entrato nello stato;
//  (b) la proiezione del kernel differisce fra i due;
//  (c) il caso è VUOTO (nessun pilota con cum al congelamento): un test che
//      confronta due insiemi vuoti passa sempre e non prova niente (E09).

import { banco } from '../asserzioni.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from '../../provenienza/adattatore.mjs';
import { simulate, statoAlCongelamento } from '../../engine/kernel.mjs';

const b = banco('s11');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Fixture dichiarata (una gara reale del grezzo pinnato, non un'attesa):
// Ungheria, congelamento al giro 30, orizzonte 12 giri.
const FONTE = 'data/gare_2026/ti_archive/Ungheria/Race.json';
const LF = 30;
const STEPS = 12;

const { righe } = adattaColonnare(JSON.parse(readFileSync(path.join(radice, FONTE), 'utf8')), { fonte: FONTE });
const troncate = righe.filter((r) => r.lap <= LF);
b.verifica('il troncamento toglie davvero qualcosa (altrimenti non prova nulla)', troncate.length < righe.length);

const statoIntero = statoAlCongelamento(righe, LF);
const statoTroncato = statoAlCongelamento(troncate, LF);

// (c) il caso non è vuoto
const conCum = statoIntero.filter((v) => v.cum_time !== null);
b.verifica('ci sono piloti con cum al congelamento', conCum.length > 0);

// (a) stesso stato
b.uguale('lo stato al congelamento non cambia se il futuro non esiste', statoTroncato, statoIntero);

// (b) stessa proiezione
// passo di comodo: dipende da pilota ed età, così una differenza di stato si
// vedrebbe nel risultato invece di essere assorbita da una costante.
const passo = (pilota, giro, eta) => 80 + (pilota.charCodeAt(0) % 7) * 0.1 + 0.05 * eta;
const proietta = (stato) => simulate({ state: stato, pace: passo, freezeLap: LF, steps: STEPS, pits: {} });
b.uguale('la proiezione del kernel non cambia', proietta(statoTroncato), proietta(statoIntero));

b.chiudi();
