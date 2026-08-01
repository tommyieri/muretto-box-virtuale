// g0.mjs — G0′, la metrica riscritta (E08).
//
// G0 contava come FALLIMENTO la risposta corretta al bordo: quando l'ottimo
// cade prima del primo giro in cui ci si può fermare, "fermati subito" è la
// risposta giusta, e la vecchia metrica la puniva. G0 resta ritirata a referto;
// questa è la nuova pre-registrazione (banco/prereg/PREREG_banco.md), non una
// correzione retroattiva della vecchia.
//
// Si confrontano due calcoli DIVERSI della stessa cosa: l'argmin trovato
// sweeppando il giro di sosta col kernel vero, e la forma chiusa
// k* = (giri rimasti − età)/2. Non è tautologico: il kernel lavora in giri
// discreti, con la perdita ai box, l'orizzonte troncato alla fine della gara e
// l'età presa dal grezzo — ed è proprio il troncamento a fine gara che genera i
// casi al bordo su cui G0 sbagliava.
//
// La sosta è valutata a perdita VERDE: è una domanda controfattuale ("quando
// conviene fermarsi"), non la ricostruzione di una sosta avvenuta sotto regime.

import { passoUtilizzabile } from '../../provenienza/definizioni.mjs';
import { osservazioniVerdi } from '../../provenienza/gare_indice.mjs';
import { simulate } from '../../engine/kernel.mjs';
import { creaPasso, stimaBasi } from '../../engine/passo_v2.mjs';
import { perditaBox } from '../../provenienza/pitloss.mjs';

const EPS = 1e-9;

export function misuraG0(gare, { rho, delta70, rodaggio = null, prior, cancelli }) {
  const {
    congelamenti, min_giri_rimanenti: minRimanenti, min_giri_base: minGiriBase,
    tolleranza_bordo_giri: tolleranzaBordo,
  } = cancelli;
  const casi = [];
  const esclusi = [];

  for (const [nomeGara, gara] of Object.entries(gare)) {
    const osservazioni = osservazioniVerdi(gara.righe);
    const perdita = perditaBox(prior, nomeGara, null).perdita;

    for (const Lf of congelamenti) {
      const R = gara.nGiri - Lf;
      if (R < minRimanenti) continue;
      const basi = stimaBasi(osservazioni, { delta70, rho, nGiri: gara.nGiri, finoA: Lf, minGiri: minGiriBase, rodaggio });
      const pace = creaPasso({ delta70, rho, nGiri: gara.nGiri, basi, rodaggio });

      for (const [drv, celle] of gara.perPilota) {
        const c = celle.get(Lf);
        if (!c || c.cum_time === null || c.tyre_age === null) continue;
        let verdiPrima = 0;
        for (const [l, cc] of celle) if (l <= Lf && passoUtilizzabile(cc) && cc.tyre_age !== null) verdiPrima += 1;
        if (verdiPrima < minGiriBase) continue;
        if (basi[drv] === null || basi[drv] === undefined) {
          esclusi.push({ gara: nomeGara, Lf, drv, motivo: 'base assente: la previsione è null, non entra nel conteggio (regola 6)' });
          continue;
        }

        const stato = [{ drv, lap: Lf, cum_time: c.cum_time, tyre_age: c.tyre_age }];
        let minimo = Infinity;
        const totali = [];
        for (let k = 1; k <= R - 1; k += 1) {
          const cum = simulate({ state: stato, pace, freezeLap: Lf, steps: R, pits: { [drv]: [{ lap: Lf + k, perdita }] } }).cum[drv];
          totali.push({ k, cum });
          if (cum < minimo) minimo = cum;
        }
        const migliori = totali.filter((x) => x.cum <= minimo + EPS).map((x) => x.k);

        const eta = c.tyre_age;
        const kStar = (R - eta) / 2;
        const alBordoBasso = migliori.includes(1);
        const alBordoAlto = migliori.includes(R - 1);
        const alBordo = alBordoBasso || alBordoAlto;
        const bordo = alBordoBasso ? 1 : R - 1;

        // Caso interno: identico nelle due scritture. Deve coincidere con la
        // forma chiusa; pari merito quando R − età è dispari, perché k* sta a
        // metà fra due interi ed entrambi sono ottimi.
        const attesi = Number.isInteger(kStar) ? [kStar] : [Math.floor(kStar), Math.ceil(kStar)];
        const internoOk = migliori.length === attesi.length && migliori.every((k, i) => k === attesi[i]);

        // G0′ (RITIRATA — banco/prereg/PREREG_G0_secondo.md): distanza dal
        // bordo in valore assoluto. Boccia la risposta corretta quando k* cade
        // molto PRIMA del primo giro utile: è E08 ripetuto. Si calcola ancora
        // solo per tenerne il numero a referto.
        const passaPrimo = alBordo ? Math.abs(kStar - bordo) <= tolleranzaBordo : internoOk;

        // G0″ (in vigore): clausola di bordo UNILATERALE. Al bordo basso passa
        // se k* ≤ 1 + tolleranza, senza limite inferiore — più k* sta sotto,
        // più "fermati subito" è la risposta giusta. Simmetrico in alto. Un
        // difetto vero resta preso: k*=10 con argmin=1 fallisce ancora.
        const passaSecondo = alBordo
          ? (alBordoBasso ? kStar <= bordo + tolleranzaBordo : kStar >= bordo - tolleranzaBordo)
          : internoOk;

        casi.push({
          gara: nomeGara, Lf, drv, R, eta, k_star: kStar, argmin: migliori,
          tipo: alBordo ? 'bordo' : 'interno',
          passa: passaSecondo,
          passa_g0_primo: passaPrimo,
          motivo: alBordo
            ? `bordo k=${bordo}, k*=${kStar}`
            : `interno, argmin [${migliori}] contro atteso [${attesi}]`,
        });
      }
    }
  }

  const passati = casi.filter((c) => c.passa).length;
  const passatiPrimo = casi.filter((c) => c.passa_g0_primo).length;
  const alBordo = casi.filter((c) => c.tipo === 'bordo');
  const quota = (n) => (casi.length ? Number((n / casi.length).toFixed(6)) : null);
  return {
    n_casi: casi.length,
    n_esclusi: esclusi.length,
    n_interni: casi.length - alBordo.length,
    n_al_bordo: alBordo.length,
    quota_al_bordo: casi.length ? Number((alBordo.length / casi.length).toFixed(4)) : null,
    // G0″, in vigore
    passati,
    quota_passaggio: quota(passati),
    falliti: casi.filter((c) => !c.passa),
    // G0′, RITIRATA: il numero resta a referto (E08/E21)
    g0_primo_ritirata: {
      passati: passatiPrimo,
      quota_passaggio: quota(passatiPrimo),
      n_falliti: casi.length - passatiPrimo,
      targhetta: 'metrica RITIRATA — clausola di bordo a due code, bocciava la risposta corretta al bordo; resta a referto, non fa cancello (banco/prereg/PREREG_G0_secondo.md)',
    },
    casi,
  };
}
