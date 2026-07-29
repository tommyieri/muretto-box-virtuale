// S05 — La sosta azzera l'età, mai vantaggi perpetui (contro E01).
// Il "gradino per sempre" del vecchio motore produceva "fermati subito" nel
// 100% dei casi: misurato 718/718. Nel modello v2 il vantaggio della gomma
// nuova è SOLO l'azzeramento dell'età: decade mentre la gomma nuova invecchia.
//
// FALLIREBBE SE: uno sconto costante post-sosta rientrasse nel kernel o nel
// costruttore di scenari — con gomma fresca e risparmio massimo possibile
// (ρ·R²/4) sotto la perdita di sosta, fermarsi diventerebbe comunque
// conveniente; e l'argmin smetterebbe di muoversi con l'età, inchiodato al
// primo giro disponibile.
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { curvaQuandoConviene } from '../../scenario/costruttore.mjs';

const b = nuovoBanco('s05_gradino_non_perpetuo');

const par = { delta: 0.05, rho: 0.0389 };   // targhetta: modello dichiarato, banco
const perdita = 20.0;

function migliore(curva) {
  let m = null;
  for (const p of curva) if (m === null || p.delta < m.delta) m = p;
  return m;
}

// gomma fresca (età 0), 20 giri rimasti: il risparmio massimo teorico è
// ρ·R²/4 = 0,0389·100 ≈ 3,9 s ≪ 20 s di perdita → NESSUNA sosta deve convenire
const fresca = curvaQuandoConviene({
  griglia: { EGO: { base: 90, eta: 0, cum: 1000 } }, pilota: 'EGO',
  Lf: 30, giriTotali: 50, par, perditaSosta: perdita,
});
b.verifica(fresca.every(p => p.delta > 0),
  'con gomma fresca e risparmio teorico ≪ perdita, una sosta risulta conveniente: profuma di gradino perpetuo (E01)');

// gomma vecchia (età 30), 30 giri rimasti: qui la sosta DEVE convenire —
// se non conviene mai, il vantaggio della gomma nuova è sparito del tutto
const vecchia = curvaQuandoConviene({
  griglia: { EGO: { base: 90, eta: 30, cum: 1000 } }, pilota: 'EGO',
  Lf: 20, giriTotali: 50, par, perditaSosta: perdita,
});
b.verifica(migliore(vecchia).delta < 0,
  'con gomma a 30 giri e 30 giri davanti, nessuna sosta conviene: il beneficio della gomma nuova non c\'è');

// l'argmin deve MUOVERSI con l'età: (R−e)/2 → età 0,10,20,30 su R=30 danno
// attese 15,10,5,1 giri dal congelamento — strettamente decrescenti, non
// inchiodate al primo giro
const argmins = [0, 10, 20, 30].map(eta => migliore(curvaQuandoConviene({
  griglia: { EGO: { base: 90, eta, cum: 1000 } }, pilota: 'EGO',
  Lf: 20, giriTotali: 50, par, perditaSosta: perdita,
})).giroSosta);
b.verifica(argmins.every((g, i) => i === 0 || g < argmins[i - 1]),
  `l'argmin non decresce con l'età (${argmins.join(', ')}): l'età non governa più la scelta`);
b.verifica(!argmins.every(g => g === 21),
  '"fermati subito" in tutti i casi: è ESATTAMENTE il sintomo del gradino perpetuo (718/718 sul vecchio motore)');

b.fine();
