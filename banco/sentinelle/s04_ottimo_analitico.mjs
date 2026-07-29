// S04 — L'ottimo analitico a una sosta (verifica dei casi al bordo).
// Nel modello v2 l'ottimo teorico cade a x* = (giri rimasti − età)/2 giri dal
// congelamento: il banco lo usa come verifica analitica del kernel.
// Derivazione: la parte della curva che dipende dal giro di sosta L = Lf + x è
//   f(x) = ρ·[ e·x + x(x+1)/2 + (R−x)(R−x+1)/2 ],  con R = giri rimasti,
// e = età al congelamento; df/dx = ρ·(e + 2x − R) → x* = (R − e)/2.
// La deriva δ e la perdita di sosta sono costanti in L: non spostano l'argmin.
//
// FALLIREBBE SE: il kernel deviasse dal modello v2 — un gradino perpetuo
// (E01), un doppio conteggio della deriva (E20), un azzeramento dell'età
// sbagliato — sposterebbe l'argmin della curva dal punto analitico. E il caso
// al bordo (età ≥ giri rimasti → fermarsi SUBITO) è la risposta CORRETTA,
// non un fallimento: specificato qui, prima di guardare i numeri (E08).
import { nuovoBanco } from '../lib/attrezzi.mjs';
import { curvaQuandoConviene } from '../../scenario/costruttore.mjs';

const b = nuovoBanco('s04_ottimo_analitico');

const par = { delta: 0.05, rho: 0.0389 };   // targhetta: modello dichiarato, banco

function argminCurva(curva) {
  let migliore = null;
  for (const p of curva) if (migliore === null || p.delta < migliore.delta) migliore = p;
  return migliore.giroSosta;
}

// (Lf, giriTotali, età) → attesa analitica x* = (R − e)/2, clampata a [1, R]
const casi = [
  [20, 57, 8],    // x* = (37−8)/2 = 14,5 → argmin ∈ {34, 35}
  [10, 50, 0],    // x* = 20 → argmin = 30
  [10, 50, 39],   // x* = 0,5 → argmin ∈ {11}: quasi al bordo
  [10, 50, 40],   // x* = 0 → bordo: fermarsi subito (giro 11) è CORRETTO
  [10, 50, 55],   // età > giri rimasti → idem, fermarsi subito
  [30, 44, 7],    // x* = 3,5 → argmin ∈ {33, 34}
];
for (const [Lf, N, eta] of casi) {
  const R = N - Lf;
  const xStar = (R - eta) / 2;
  const attesi = xStar <= 1 ? [1] : [Math.floor(xStar), Math.ceil(xStar)].filter(x => x >= 1 && x <= R);
  const curva = curvaQuandoConviene({
    griglia: { EGO: { base: 90, eta, cum: 1000 } }, pilota: 'EGO',
    Lf, giriTotali: N, par, perditaSosta: 22.1,
  });
  b.verifica(curva.length === R, `Lf=${Lf} N=${N}: la curva ha ${curva.length} candidati invece di ${R}`);
  const argmin = argminCurva(curva);
  b.verifica(attesi.map(x => Lf + x).includes(argmin),
    `Lf=${Lf} N=${N} età=${eta}: argmin al giro ${argmin}, atteso Lf+{${attesi}} (x*=${xStar})`);
}

// la perdita di sosta trasla la curva ma NON sposta l'argmin (è costante in L).
// CORREZIONE A REFERTO (2026-07-29, prima stesura fallita di suo): con età 8
// x* = 14,5 è un PAREGGIO ESATTO fra i giri 34 e 35, e l'argmin di un
// pareggio lo decidono le briciole float — la condizione era mal specificata
// (il fallimento era del banco, non del kernel). Ri-dichiarata su x* INTERO:
// età 7 → x* = 15, minimo unico. (Disciplina E08: la metrica sbagliata si
// mette a referto e se ne dichiara una nuova, non si tace.)
const base = { griglia: { EGO: { base: 90, eta: 7, cum: 1000 } }, pilota: 'EGO', Lf: 20, giriTotali: 57, par };
const a1 = argminCurva(curvaQuandoConviene({ ...base, perditaSosta: 18.4 }));
const a2 = argminCurva(curvaQuandoConviene({ ...base, perditaSosta: 28.1 }));
b.verifica(a1 === 35 && a2 === 35, `la perdita di sosta ha spostato l'argmin (${a1} vs ${a2}, atteso 35 = Lf+x*): c'è un termine che dipende da L e non dovrebbe`);

b.fine();
