// S09 — Stessa equazione per misura e predizione (Regola 10, contro E02).
// Ciò che si sottrae misurando (deriva, degrado) si ri-aggiunge simulando:
// il carburante sottratto e mai ri-aggiunto è costato −1,48 s/giro di bias.
// Giro completo: genero una gara sintetica DALL'equazione del kernel con
// parametri noti, ri-stimo i parametri dai giri verdi ≤ Lf, simulo il futuro
// e confronto col futuro generato. Senza rumore, tutto deve tornare esatto.
//
// FALLIREBBE SE: la misura e la simulazione usassero forme diverse — una
// deriva contata due volte o mai (E20), un degrado sottratto e non riaggiunto
// (E02), un'età azzerata nel posto sbagliato — il fit non recupererebbe i
// parametri dichiarati, o il cum simulato divergerebbe dal generato.
// FALLIREBBE ANCHE SE lo stimatore accettasse un disegno a rango non pieno
// senza urlare (E10: pinv silenziosa).
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { tempoGiro, simula } from '../../engine/kernel.mjs';

const b = nuovoBanco('s09_stessa_equazione');

// verità dichiarata (targhetta: modello dichiarato, banco)
const VERO = { base: 91.3, delta: 0.048, rho: 0.041 };
const N = 50, Lf = 26, giroSosta = 12, perdita = 21.0;

// genero byLap sintetico DALLA stessa equazione del kernel: la sosta al giro
// 12 azzera l'età (out-lap 13 con gomma d'età 1)
const celle = [];
let cum = 0;
for (let g = 1; g <= N; g++) {
  const eta = g <= giroSosta ? g : g - giroSosta;
  let t = tempoGiro({ base: VERO.base, eta, giro: g }, VERO);
  if (g === giroSosta) t += perdita;
  cum += t;
  celle.push({
    lap_time: t, cum_time: cum, stint: g <= giroSosta ? 1 : 2, compound: 'MEDIUM',
    tyre_age: eta, in_lap: g === giroSosta, out_lap: g === giroSosta + 1,
    status: '1', del: false,
  });
}

// MISURA: minimi quadrati su [1, giro−1, età] dai giri verdi ≤ Lf (niente
// in/out-lap: il verde è il filtro di produzione). La sosta dentro la finestra
// decorrelaziona età e giro: il disegno ha rango pieno.
const verdi = celle.filter((c, i) => i + 1 <= Lf && !c.in_lap && !c.out_lap);
const stima = minimiQuadrati3(verdi.map(c => [1, (celle.indexOf(c) + 1) - 1, c.tyre_age]), verdi.map(c => c.lap_time));
b.verifica(stima.ok === true, 'lo stimatore ha rifiutato un disegno a rango pieno');
const [baseFit, deltaFit, rhoFit] = stima.beta;
b.verifica(Math.abs(baseFit - VERO.base) < 1e-9, `base non recuperata: ${baseFit} vs ${VERO.base}`);
b.verifica(Math.abs(deltaFit - VERO.delta) < 1e-9, `delta non recuperata: ${deltaFit} vs ${VERO.delta} — la deriva misurata non è quella simulata`);
b.verifica(Math.abs(rhoFit - VERO.rho) < 1e-9, `rho non recuperato: ${rhoFit} vs ${VERO.rho} — il degrado misurato non è quello simulato`);

// guardia di rango (E10): senza sosta nella finestra, età ≡ giro → rango 2 →
// lo stimatore DEVE rifiutarsi, non inventare con una pinv silenziosa
const collineari = celle.slice(0, giroSosta - 1);
const degenerata = minimiQuadrati3(collineari.map((c, i) => [1, i, c.tyre_age]), collineari.map(c => c.lap_time));
b.verifica(degenerata.ok === false, 'disegno collineare (età ≡ giro) accettato: pinv silenziosa (E10)');

// PREDIZIONE: dallo stato al congelamento, il kernel deve riprodurre
// ESATTAMENTE il futuro generato (stessa equazione, zero bias)
const griglia = { EGO: { base: baseFit, eta: celle[Lf - 1].tyre_age, cum: celle[Lf - 1].cum_time } };
const esito = simula({ griglia, Lf, giriTotali: N, par: { delta: deltaFit, rho: rhoFit }, piani: {} });
b.verifica(esito.ok === true, 'simulazione rifiutata con parametri stimati completi');
const scarto = Math.abs(esito.cum.EGO - celle[N - 1].cum_time);
b.verifica(scarto < 1e-6, `cum simulato ≠ cum generato di ${scarto} s: misura e predizione non usano la stessa equazione`);

// minimi quadrati 3 parametri con guardia esplicita di condizionamento
function minimiQuadrati3(X, y) {
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Xty = [0, 0, 0];
  for (let r = 0; r < X.length; r++) {
    for (let i = 0; i < 3; i++) {
      Xty[i] += X[r][i] * y[r];
      for (let j = 0; j < 3; j++) XtX[i][j] += X[r][i] * X[r][j];
    }
  }
  // eliminazione con pivot; pivot relativo sotto soglia = rango non pieno
  const A = XtX.map((riga, i) => [...riga, Xty[i]]);
  const scala = Math.max(...A.flat().map(Math.abs));
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9 * scala) return { ok: false, motivo: 'rango non pieno' };
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 4; k++) A[r][k] -= f * A[c][k];
    }
  }
  return { ok: true, beta: A.map((riga, i) => riga[3] / riga[i]) };
}

b.fine();
