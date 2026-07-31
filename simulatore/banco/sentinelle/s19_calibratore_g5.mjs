// s19_calibratore_g5 — il calibratore live rispetta le regole ereditate, e G5
// è stato eseguito come pre-registrato.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) il clamp [0,3; 3,0] non morde: un degrado sintetico assurdo produce un
//      moltiplicatore fuori dai limiti, o il clamp scatta senza dichiararsi;
//  (b) l'assenza non è null: senza stint utilizzabili il calibratore inventa
//      un moltiplicatore invece di restituire null col motivo (regola 6);
//  (c) la regola del §4 si perde: stint oggi molto più corti delle mediane
//      storiche NON fanno scattare l'allarme, o l'allarme diventa una STIMA di
//      durata invece di alzare il peso del vivo e allargare la banda, o
//      l'effetto non è dichiarato nel risultato;
//  (d) in modalità track_wide la banda non si allarga del fattore misurato, o
//      il risultato non cita il limite (84,8% · 65 falsi verdi · 34,1%);
//  (e) `calibraDegrado` non è nel registro delle misure a congelamento: la
//      sentinella di troncamento (s14) non lo sorveglierebbe, e G5 sarebbe un
//      imbroglio possibile (un calibratore che sbircia oltre Lf);
//  (f) l'esito di G5 non esiste, non è quello della prereg (congelamenti
//      {15,25,35}, metrica MAE, decisione a maggioranza dei giudicabili), o i
//      suoi numeri non si riproducono rieseguendo il banco oggi (E22);
//  (g) il verdetto scritto nell'esito non segue la regola di decisione
//      pre-registrata applicata ai suoi stessi numeri.

import { banco } from '../asserzioni.mjs';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { creaCella } from '../../provenienza/contratto.mjs';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { calibraDegrado, COSTANTI_CALIBRAZIONE } from '../../live/calibrazione.mjs';
import { LIMITE_TRACK_WIDE } from '../../live/collettore.mjs';
import { NOMI_REGISTRATI } from '../misure_congelamento.mjs';
import { eseguiG5 } from '../replay_g5.mjs';

const b = banco('s19');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const ctx = { rho: modello.rho.valore, delta70: modello.delta_70.scelto, nGiri: 70 };

// righe sintetiche: un pilota, stint di giri verdi con pendenza scelta a tavolino
const righeSintetiche = (pendenzaVera, { nStint = 2, giriPerStint = 8 } = {}) => {
  const righe = [];
  let lap = 1;
  let cum = 1000;
  for (let s = 1; s <= nStint; s += 1) {
    for (let i = 1; i <= giriPerStint; i += 1) {
      const deriva = -ctx.delta70 / ctx.nGiri;
      const t = 90 + deriva * (lap - 1) + pendenzaVera * i;
      cum += t;
      const ultimoDelloStint = i === giriPerStint && s < nStint;
      righe.push({
        drv: 'SYN', lap,
        cella: creaCella({
          lap_time: t, cum_time: cum, stint: s, compound: 'MEDIUM', tyre_age: i,
          in_lap: ultimoDelloStint, out_lap: i === 1 && s > 1, status: '1', del: false,
        }),
      });
      lap += 1;
    }
  }
  return righe;
};

// (a) il clamp morde, e si dichiara
{
  const folle = calibraDegrado(righeSintetiche(ctx.rho * 50), { finoA: 99, ...ctx });
  b.uguale('degrado 50×ρ → moltiplicatore clampato a 3,0', folle.moltiplicatore, COSTANTI_CALIBRAZIONE.clamp[1]);
  b.uguale('...e il clamp è dichiarato', folle.clampato, true);
  const sano = calibraDegrado(righeSintetiche(ctx.rho * 1.5), { finoA: 99, ...ctx });
  b.verifica(`degrado 1,5×ρ → moltiplicatore interno (${sano.moltiplicatore})`,
    sano.moltiplicatore > 1 && sano.moltiplicatore < COSTANTI_CALIBRAZIONE.clamp[1]);
  b.uguale('...senza clamp dichiarato', sano.clampato, false);
  b.verifica('la banda contiene il moltiplicatore', sano.banda[0] <= sano.moltiplicatore && sano.moltiplicatore <= sano.banda[1]);
}

// (b) l'assenza è null
{
  const vuoto = calibraDegrado([], { finoA: 30, ...ctx });
  b.uguale('nessun giro → moltiplicatore null, non un numero', vuoto.moltiplicatore, null);
  b.verifica('...col motivo dichiarato', typeof vuoto.motivo_null === 'string' && vuoto.motivo_null.length > 0);
}

// (c) l'allarme del §4: mai stima, solo peso e banda — dichiarati
{
  // 4 stint MEDIUM chiusi da 8 giri l'uno: mediana osservata 8 ≤ 0,6·19
  const righe = righeSintetiche(ctx.rho * 1.5, { nStint: 4, giriPerStint: 8 });
  const conAllarme = calibraDegrado(righe, { finoA: 99, ...ctx });
  b.verifica('stint chiusi molto corti → allarme_stint dichiarato', conAllarme.allarme_stint !== null);
  b.verifica('l\'allarme nomina le mescole coinvolte', conAllarme.allarme_stint.mescole.includes('MEDIUM'));
  b.uguale('l\'allarme ALZA il peso del vivo (α dichiarato)', conAllarme.alpha_usato, COSTANTI_CALIBRAZIONE.alpha_allarme);
  b.verifica('l\'allarme NON è una stima di durata',
    !('durata_stimata' in (conAllarme.allarme_stint ?? {})) && /DECISIONE/.test(conAllarme.allarme_stint.targhetta));

  // stesso degrado, stint lunghi (nessun allarme): la banda deve essere più stretta
  const righeLunghe = righeSintetiche(ctx.rho * 1.5, { nStint: 2, giriPerStint: 21 });
  const senzaAllarme = calibraDegrado(righeLunghe, { finoA: 99, ...ctx });
  b.uguale('stint nella norma → nessun allarme', senzaAllarme.allarme_stint, null);
  b.uguale('...e α resta quello base', senzaAllarme.alpha_usato, COSTANTI_CALIBRAZIONE.alpha_base);
  const ampiezza = (r) => r.banda[1] - r.banda[0];
  b.verifica(`l'allarme ALLARGA la banda (${ampiezza(conAllarme).toFixed(4)} contro ${ampiezza(senzaAllarme).toFixed(4)})`,
    ampiezza(conAllarme) > ampiezza(senzaAllarme));
}

// (d) track_wide: banda allargata del fattore misurato, limite citato
{
  const righe = righeSintetiche(ctx.rho * 1.5);
  const perAuto = calibraDegrado(righe, { finoA: 99, ...ctx, fonteStatus: 'per_auto' });
  const trackWide = calibraDegrado(righe, { finoA: 99, ...ctx, fonteStatus: 'track_wide' });
  const ampiezza = (r) => r.banda[1] - r.banda[0];
  b.verifica('track_wide allarga la banda', ampiezza(trackWide) > ampiezza(perAuto));
  // Gli estremi della banda sono arrotondati a 6 decimali nel risultato: il
  // confronto del fattore tollera l'arrotondamento (5e-6), non lo scarto vero.
  const attesaAmpiezza = ampiezza(perAuto) * (1 + LIMITE_TRACK_WIDE.quota_celle_passo_oltre_soglia);
  b.verifica(`...del fattore misurato (1 + 0,341): ${ampiezza(trackWide).toFixed(6)} contro atteso ${attesaAmpiezza.toFixed(6)}`,
    Math.abs(ampiezza(trackWide) - attesaAmpiezza) <= 5e-6);
  b.uguale('...e il risultato porta il limite', trackWide.limite, LIMITE_TRACK_WIDE);
}

// (e) il calibratore è sotto la sentinella di troncamento
b.verifica('calibraDegrado è nel registro delle misure a congelamento (s14)', NOMI_REGISTRATI.has('calibraDegrado'));

// (f) + (g) G5: esito conforme alla prereg e riproducibile
{
  const esito = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_G5.json'), 'utf8'));
  b.uguale('G5: la prereg citata è quella giusta', esito._targhetta.prereg, 'banco/prereg/PREREG_G5.md');
  b.uguale('G5: i congelamenti sono quelli pre-registrati', Object.keys(esito.per_congelamento).map(Number), [15, 25, 35]);

  const prereg = readFileSync(path.join(radice, 'banco', 'prereg', 'PREREG_G5.md'), 'utf8');
  b.verifica('la prereg dichiara la metrica MAE', /MAE/.test(prereg));
  b.verifica('la prereg dichiara la regola del §4 (decisione, non misura)', /DECISIONE dei team/.test(prereg));

  // (g) il verdetto segue la regola applicata ai numeri dell'esito
  const giudicabili = Object.values(esito.per_congelamento).filter((c) => c.giudicabile);
  const vinti = giudicabili.filter((c) => c.mediana_delta_mae < 0).length;
  const verdettoAtteso = giudicabili.length >= 2 && vinti >= 2;
  b.uguale('il verdetto scritto segue la regola pre-registrata', esito.g5_passa, verdettoAtteso);

  // (f) riproducibilità: rieseguito oggi, stessi numeri (E22)
  const rieseguito = eseguiG5(radice, caricaGare2026(radice));
  b.uguale('G5 rieseguito oggi = esito committato (per_congelamento)', rieseguito.per_congelamento, esito.per_congelamento);
  b.uguale('G5 rieseguito oggi = stesso verdetto', rieseguito.g5_passa, esito.g5_passa);

  // (h) LA CONSEGUENZA DICHIARATA. La prereg dice: se G5 non passa, il
  //     moltiplicatore NON entra nei percorsi decisionali e resta diagnostica.
  //     Una conseguenza scritta in un markdown e non sorvegliata dal banco è
  //     un'intenzione, non una regola: finché l'esito è negativo, nessun file
  //     di scenario/ o engine/ può importare il calibratore.
  if (esito.g5_passa === false) {
    const visita = (dir, trovati) => {
      for (const nome of readdirSync(dir)) {
        const p = path.join(dir, nome);
        if (statSync(p).isDirectory()) { visita(p, trovati); continue; }
        if (/\.mjs$/.test(nome)) trovati.push(p);
      }
      return trovati;
    };
    for (const albero of ['scenario', 'engine']) {
      const dir = path.join(radice, albero);
      if (!existsSync(dir)) continue;
      for (const file of visita(dir, [])) {
        const testo = readFileSync(file, 'utf8');
        const rel = path.relative(radice, file).split(path.sep).join('/');
        b.verifica(
          `${rel} non usa calibraDegrado: G5 non è passato, il moltiplicatore resta DIAGNOSTICA (conseguenza pre-registrata)`,
          !/calibraDegrado|live\/calibrazione/.test(testo),
        );
      }
    }
    b.verifica('l\'esito dichiara la conseguenza in chiaro', /DIAGNOSTICA/.test(esito._targhetta.conseguenza));
  }
}

b.chiudi();
