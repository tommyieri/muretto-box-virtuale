// S03 — L'assenza è null (Regola 6, contro E06 ed E05).
// Il vecchio `simulate` restituiva un cum inventato a chi non aveva passo:
// errori da 480 s scoperti solo stringendo il filtro. E il letterale 'None'
// è arrivato in pagina come mescola.
//
// FALLIREBBE SE: un pilota senza passo ricevesse un cum numerico invece di
// null; se un null contaminasse gli altri (NaN nei cum o nell'ordine); se il
// kernel simulasse comunque con parametri null invece di rifiutarsi (il
// conflitto su delta è APERTO: sceglierlo in silenzio è E21); o se il
// lavaggio dei letterali alla frontiera smettesse di trasformare 'None' in null.
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { simula } from '../../engine/kernel.mjs';
import { lavaLetterale } from '../../provenienza/contratto.mjs';

const b = nuovoBanco('s03_null_esplicito');

const par = { delta: 0.05, rho: 0.0389 };   // targhetta: modello dichiarato, banco
const griglia = {
  VER: { base: 90.0, eta: 5, cum: 2000.0 },
  SAI: { base: 90.5, eta: 5, cum: 2003.0 },
  SEN: { base: null, eta: 5, cum: 2010.0 },   // niente passo: deve uscire null
  LEC: { base: 90.2, eta: null, cum: 2001.0 },// niente età: idem — mai un valore plausibile
};

const esito = simula({ griglia, Lf: 20, giriTotali: 30, par, piani: {} });
b.verifica(esito.ok === true, 'simulazione rifiutata con parametri completi');
b.verifica(esito.cum.SEN === null, 'un pilota SENZA passo ha ricevuto un cum inventato');
b.verifica(esito.cum.LEC === null, 'un pilota senza età gomma ha ricevuto un cum inventato');
b.verifica(Number.isFinite(esito.cum.VER) && Number.isFinite(esito.cum.SAI), 'i piloti CON passo devono avere un cum numerico');
b.verifica(Object.values(esito.cum).every(v => v === null || Number.isFinite(v)), 'NaN nei cum: un null è entrato in aritmetica');
b.verifica(!esito.ordine.includes('SEN') && !esito.ordine.includes('LEC'), "l'ordine di rientro include piloti senza simulazione");
b.verifica(esito.ordine.length === 2, `ordine con ${esito.ordine.length} piloti invece di 2`);

// parametri incompleti = rifiuto dichiarato, non una scelta silenziosa (E21)
const paraNull = simula({ griglia, Lf: 20, giriTotali: 30, par: { delta: null, rho: 0.0389 }, piani: {} });
b.verifica(paraNull.ok === false && typeof paraNull.motivo === 'string' && paraNull.motivo.length > 0,
  'con delta null il kernel deve rifiutarsi con un motivo, non simulare');

// lavaggio dei letterali alla frontiera (E05)
b.verifica(lavaLetterale('None') === null, "lavaLetterale('None') ≠ null");
b.verifica(lavaLetterale('') === null, "lavaLetterale('') ≠ null");
b.verifica(lavaLetterale(undefined) === null, 'lavaLetterale(undefined) ≠ null');
b.verifica(lavaLetterale('MEDIUM') === 'MEDIUM', 'lavaLetterale ha lavato un valore vero');
b.verifica(lavaLetterale(94.7) === 94.7, 'lavaLetterale ha lavato un numero');

b.fine();
