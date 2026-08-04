// attacchi.mjs — L'OCCASIONE DI SORPASSO come unita' di misura, sul fondo 2018-2025.
//
// Non e' uno script: non stampa e non esegue niente all'import.
//
// PERCHE' ESISTE. L'indice geometrico dice quanti metri utili ci sono per attaccare in una
// pista; non dice QUANTO devi essere piu' veloce per usarli. Il PO l'ha detto in una riga:
// «una Mercedes dietro una Cadillac passa velocemente, una Aston Martin dietro la Cadillac
// no» — cioe' la sorpassabilita' non e' una proprieta' della pista da sola, e' della COPPIA
// (pista, differenza di passo). Questo modulo estrae le coppie.
//
// L'UNITA' DI MISURA: un'OCCASIONE. Al giro g l'auto F e' dietro l'auto L, vicina, e le due
// stanno correndo (nessuna delle due ai box, nessuna neutralizzazione). Si guarda quanto F
// e' piu' veloce di L PRIMA di g, e si guarda se dopo K giri F e' davanti. Niente di piu'.
//
// TRE TRAPPOLE, E DUE LE HA GIA' PAGATE QUESTO PROGETTO:
//
//  1. I CICLI DELLE SOSTE SEMBRANO SORPASSI. La prima verifica dell'indice geometrico
//     contando TUTTI gli scambi di posizione dava correlazione -0,364 — il metro misurava
//     le soste, non i sorpassi. Qui si esclude ogni coppia in cui una delle due entra o
//     esce dai box nella finestra: un cambio di posizione dovuto alla corsia box non e'
//     un sorpasso in pista.
//  2. IL CARBURANTE. Non serve correggerlo, e questa e' una proprieta' del disegno, non
//     una dimenticanza: F e L corrono GLI STESSI GIRI, quindi la deriva del carburante e'
//     identica per entrambe e si cancella ESATTAMENTE nella differenza dei passi. E' lo
//     stesso argomento con cui esporta_stint_fondo.mjs giustifica la pendenza grezza.
//  3. IL FUTURO. Il passo di F e di L si misura SOLO su giri <= g (regola 5). Il prodotto,
//     quando usera' questa soglia, sara' a un congelamento: se qui il passo guardasse
//     avanti, la soglia sarebbe tarata su un'informazione che il motore non ha (E14).
//
// COSA QUESTO MODULO NON FA: non decide niente e non stima nessuna soglia. Raccoglie.

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { garaAsciutta, passoUtilizzabile, statusVerde } from '../../simulatore/provenienza/definizioni.mjs';
import { PISTA_DI } from '../degrado/durate.mjs';

// I parametri dell'occasione. DICHIARATI, non tarati: si scrivono nella prereg e non si
// toccano dopo aver visto una curva.
export const PARAMETRI = Object.freeze({
  vicino_s: 1.0,      // entro un secondo si e' in condizione di attaccare
  orizzonte: 5,       // ...e si guarda se il sorpasso avviene entro cinque giri
  finestra_passo: 5,  // il passo di ciascuna si misura sui cinque giri precedenti
  min_giri_passo: 3,  // sotto tre giri verdi un passo e' un aneddoto
});

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Le occasioni di una gara, dalle righe gia' adattate.
 *
 * @returns array di { pista, anno, gara, giro, inseguitore, davanti, gap, delta, passato }
 *          `delta` < 0 significa che l'inseguitore e' PIU' VELOCE (secondi al giro).
 */
export function occasioniDi(righe, { pista, anno, gara }, P = PARAMETRI) {
  const perPilota = new Map();
  let nGiri = 0;
  for (const { drv, lap, cella } of righe) {
    if (Number.isInteger(lap) && lap > nGiri) nGiri = lap;
    if (!perPilota.has(drv)) perPilota.set(drv, new Map());
    perPilota.get(drv).set(lap, cella);
  }

  // il passo di un pilota nei `finestra_passo` giri che finiscono a g (compreso)
  // Le celle senza `status` o senza `del` NON si giudicano: `verde()` si rifiuta di
  // dedurre (E13) e ha ragione. Si saltano — e nel fondo 2018 succede davvero.
  const giudicabile = (c) => c && c.status !== null && c.del !== null;
  const passoA = (drv, g) => {
    const celle = perPilota.get(drv);
    const t = [];
    for (let l = g - P.finestra_passo + 1; l <= g; l += 1) {
      const c = celle?.get(l);
      if (giudicabile(c) && passoUtilizzabile(c)) t.push(c.lap_time);
    }
    return t.length >= P.min_giri_passo ? mediana(t) : null;
  };

  // nessuna delle due entra o esce dai box, e nessuna delle due e' fuori dal verde di
  // status, in tutta la finestra [g, g+orizzonte]. Il verde di STATUS e non il verde del
  // passo: un giro puo' benissimo essere verde e non utilizzabile per una mediana.
  const pulitaNellaFinestra = (drv, g) => {
    const celle = perPilota.get(drv);
    for (let l = g; l <= g + P.orizzonte; l += 1) {
      const c = celle?.get(l);
      if (!c) return false;
      if (c.in_lap || c.out_lap) return false;
      if (c.status === null || !statusVerde(c)) return false;
    }
    return true;
  };

  const fuori = [];
  for (let g = P.finestra_passo; g + P.orizzonte <= nGiri; g += 1) {
    const ordine = [];
    for (const [drv, celle] of perPilota) {
      const c = celle.get(g);
      if (c && c.cum_time !== null) ordine.push({ drv, cum: c.cum_time });
    }
    ordine.sort((a, b) => a.cum - b.cum);

    for (let i = 1; i < ordine.length; i += 1) {
      const L = ordine[i - 1]; const F = ordine[i];
      const gap = F.cum - L.cum;
      if (!(gap > 0 && gap <= P.vicino_s)) continue;
      if (!pulitaNellaFinestra(F.drv, g) || !pulitaNellaFinestra(L.drv, g)) continue;
      const pF = passoA(F.drv, g); const pL = passoA(L.drv, g);
      if (pF === null || pL === null) continue;

      // l'esito: a g+orizzonte, l'inseguitore e' davanti?
      const cF = perPilota.get(F.drv).get(g + P.orizzonte);
      const cL = perPilota.get(L.drv).get(g + P.orizzonte);
      if (!cF || !cL || cF.cum_time === null || cL.cum_time === null) continue;

      fuori.push({
        pista, anno, gara, giro: g,
        inseguitore: F.drv, davanti: L.drv,
        gap: Number(gap.toFixed(3)),
        delta: Number((pF - pL).toFixed(4)),
        passato: cF.cum_time < cL.cum_time,
      });
    }
  }
  return fuori;
}

/** Tutte le occasioni del fondo 2018-2025, gare asciutte. */
export function occasioniFondo(radice, { piste = null, P = PARAMETRI } = {}) {
  const base = path.join(radice, 'data', 'fondo');
  const out = [];
  let gareLette = 0; let gareBagnate = 0; let gareEscluse = 0;
  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      const pista = PISTA_DI[gara];
      if (!pista) throw new Error(`gara non mappata: ${anno}/${gara}`);
      if (piste && !piste.includes(pista)) continue;
      let adattate;
      try {
        adattate = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` });
      } catch { gareEscluse += 1; continue; }
      if (!garaAsciutta(adattate.righe)) { gareBagnate += 1; continue; }
      gareLette += 1;
      out.push(...occasioniDi(adattate.righe, { pista, anno: Number(anno), gara }, P));
    }
  }
  return { occasioni: out, gareLette, gareBagnate, gareEscluse };
}
