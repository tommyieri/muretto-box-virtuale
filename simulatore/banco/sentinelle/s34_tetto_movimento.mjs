// s34_tetto — il tetto al movimento fa quello che dice, e spento non esiste.
//
// Il kernel dichiara da sempre «DUE AUTO POSSONO ATTRAVERSARSI». Dal 03/08/2026 esiste un
// vincolo opzionale che lo impedisce. Quella riga resta vera finche' `tetto` e' null, e a
// dirlo dev'essere un'asserzione, non un commento.
//
// COSA LA FA FALLIRE:
//  (a) `tetto: null` cambia anche un solo bit rispetto a non passarlo affatto;
//  (b) il PAVIMENTO non tiene: due auto finiscono a meno di minGap l'una dall'altra;
//  (c) il sorpasso avviene SENZA che il vantaggio di passo superi la soglia — cioe' il
//      vincolo e' decorativo e le auto si attraversano lo stesso;
//  (d) il sorpasso NON avviene quando il vantaggio la supera — cioe' il tetto e' un muro
//      e non un vincolo: bloccherebbe anche chi ha il passo per passare, che sarebbe
//      inventare movimento al contrario;
//  (e) il tetto si applica SOTTO NEUTRALIZZAZIONE, dove la spaziatura e' una misura
//      (kappa sul fondo) e non deve essere sovrascritta da un parametro importato;
//  (f) parametri malformati non esplodono (E07).
import { banco } from '../asserzioni.mjs';
import { simulate } from '../../engine/kernel.mjs';

const b = banco('s34');

const TETTO = { minGap: 0.5, sogliaSorpasso: 1.35, costoDuello: 0.3, costoSubito: 0.3 };
const STATO = [
  { drv: 'AAA', lap: 10, cum_time: 1000, tyre_age: 5 },   // davanti
  { drv: 'BBB', lap: 10, cum_time: 1000.2, tyre_age: 5 }, // dietro di 0,2 s: gia' sotto il pavimento
];
const base = { state: STATO, freezeLap: 10, steps: 3 };

// passo costante per AAA; BBB piu' veloce di `dv` al giro
const passi = (dv) => (drv) => (drv === 'AAA' ? 90 : 90 - dv);

// ── (a) spento e' spento ─────────────────────────────────────────────────────
{
  const senza = simulate({ ...base, pace: passi(0.5) });
  const conNull = simulate({ ...base, pace: passi(0.5), tetto: null });
  b.uguale('tetto null: cum bit-identico a non passarlo affatto', conNull.cum, senza.cum);
  b.uguale('tetto null: ordine identico', conNull.ordine, senza.ordine);
}

// ── (b) e (c) chi NON ha il passo per passare resta dietro ───────────────────
{
  // BBB e' piu' veloce di 0,5 s/giro: sotto la soglia di 1,35 -> non deve passare
  const senza = simulate({ ...base, pace: passi(0.5) });
  const con = simulate({ ...base, pace: passi(0.5), tetto: TETTO });
  b.verifica('senza tetto BBB passa (altrimenti il caso non prova niente)',
    senza.ordine[0] === 'BBB');
  b.verifica(`con tetto BBB NON passa: ordine ${JSON.stringify(con.ordine)}`,
    con.ordine[0] === 'AAA');
  const gap = con.cum.BBB - con.cum.AAA;
  b.verifica(`il pavimento tiene: gap finale ${gap.toFixed(3)} s ≥ ${TETTO.minGap}`,
    gap >= TETTO.minGap - 1e-9);
}

// ── (d) chi HA il passo passa: il tetto non e' un muro ───────────────────────
{
  // BBB e' piu' veloce di 2,0 s/giro: sopra la soglia 1,35 -> deve passare
  const con = simulate({ ...base, pace: passi(2.0), tetto: TETTO });
  b.verifica(`con vantaggio 2,0 s > soglia 1,35 BBB passa: ordine ${JSON.stringify(con.ordine)}`,
    con.ordine[0] === 'BBB');
}

// ── (e) sotto neutralizzazione il tetto NON entra ────────────────────────────
{
  const neutra = { perGiro: { 11: 0.691, 12: 0.691, 13: 0.691 } };
  const senza = simulate({ ...base, pace: passi(0.5), neutralizzazione: neutra });
  const con = simulate({ ...base, pace: passi(0.5), neutralizzazione: neutra, tetto: TETTO });
  b.uguale('sotto compressione il tetto non tocca niente: la misura di kappa non si sovrascrive',
    con.cum, senza.cum);
}

// ── il costo del duello si paga davvero ──────────────────────────────────────
{
  const senza = simulate({ ...base, pace: passi(0.5) });
  const con = simulate({ ...base, pace: passi(0.5), tetto: TETTO });
  b.verifica(`chi duella perde tempo: AAA ${(con.cum.AAA - senza.cum.AAA).toFixed(2)} s in piu' del caso senza tetto`,
    con.cum.AAA > senza.cum.AAA + 1e-9);
}

// ── (f) parametri malformati esplodono ───────────────────────────────────────
b.esplode('tetto.minGap negativo: rifiutato', () => simulate({ ...base, pace: passi(0.5), tetto: { ...TETTO, minGap: -1 } }));
b.esplode('tetto.sogliaSorpasso NaN: rifiutato', () => simulate({ ...base, pace: passi(0.5), tetto: { ...TETTO, sogliaSorpasso: NaN } }));
b.esplode('tetto senza costoDuello: rifiutato', () => simulate({ ...base, pace: passi(0.5), tetto: { minGap: 0.5, sogliaSorpasso: 1.35, costoSubito: 0.3 } }));
b.esplode('tetto non oggetto: rifiutato', () => simulate({ ...base, pace: passi(0.5), tetto: 0.5 }));

b.chiudi();
