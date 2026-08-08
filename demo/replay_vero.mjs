// replay_vero.mjs — DOVE ERANO DAVVERO LE VETTURE.
//
// Consuma demo/data/replay_<gara>.json (generato da gen_replay.py dal GPS per-auto di
// FastF1) e risponde a una domanda sola: al tempo di gara T, che frazione di giro aveva
// percorso ciascun pilota?
//
// COSA CAMBIA RISPETTO A PRIMA. Fino a oggi quella frazione era una frazione di TEMPO:
// gara.html::giroDi la ricavava dai cum_time per-giro assumendo velocita' uniforme dentro
// il giro (approssimazione dichiarata in testa a pista.mjs). Qui e' MISURATA: le vetture
// rallentano in curva, si sgranano in staccata, e chi perde tre secondi alla Source lo
// perde nel punto in cui l'ha perso.
//
// L'ASSENZA E' ASSENZA (regola 6). Se un pilota non ha campioni in un istante — non e'
// ancora partito, si e' ritirato, buco nel feed — questo modulo NON restituisce una
// posizione. Non tiene l'ultimo valore, non interpola oltre il bordo: il pallino sparisce.
// E' il difetto per cui data/archivio/telemetria_proto_data.json e' rimasto archiviato.
//
// L'OROLOGIO E' LO STESSO della pagina: la griglia e' in secondi di sessione, cioe' i
// cum_time dei file gara. Non e' un'assunzione — gen_replay.py lo verifica a ogni
// esecuzione su ogni fine-giro di ogni pilota (targhetta in sorgente.orologio) e si
// rifiuta di produrre un file disallineato.
//
// Consumatore puro: legge il JSON, non tocca engine/timeline/ghostplay.

const ASSENTE = -1;

export async function creaReplayVero({ url }) {
  const res = await fetch(url);
  if (!res.ok) return null;                     // gara senza replay vero: il chiamante ricade
  const dati = await res.json();                // {t0,hz,n,scala_s,piloti,pitlane,sorgente}
  const { t0, hz, n } = dati;
  const SCALA = dati.scala_s || 10000;

  // decodifica: differenze -> valore assoluto, con i buchi tenuti come buchi.
  // s[i] = (giro-1 + frazione) del pilota all'istante i, oppure NaN se assente.
  const piloti = {};
  for (const [sigla, p] of Object.entries(dati.piloti)) {
    const s = new Float64Array(n).fill(NaN);
    let acc = 0;
    for (let k = 0; k < p.s.length; k++) {
      const dv = p.s[k];
      if (dv === ASSENTE) continue;
      acc += dv;
      s[p.da + k] = acc / SCALA;
    }
    // tratti in corsia box, come insieme di indici per una risposta O(1) per frame
    const pit = new Uint8Array(n);
    for (const [a, b] of (p.pit || [])) pit.fill(1, a, b + 1);
    piloti[sigla] = { s, pit, da: p.da, a: p.da + p.s.length - 1 };
  }

  // indice frazionario del tempo T sulla griglia; fuori griglia -> null
  function indiceDi(T) {
    const x = (T - t0) * hz;
    if (!(x >= 0) || x > n - 1) return null;
    return x;
  }

  // posizione di UN pilota al tempo T: {s, f, giro, box} oppure null se assente.
  // Fra due campioni si interpola linearmente; se uno dei due manca, si restituisce
  // null invece di estrapolare (mai una posizione dedotta oltre il dato).
  function posizioneDi(sigla, T) {
    const P = piloti[sigla];
    if (!P) return null;
    const x = indiceDi(T);
    if (x === null) return null;
    const i = Math.floor(x), j = Math.min(n - 1, i + 1), t = x - i;
    const a = P.s[i], b = P.s[j];
    if (!Number.isFinite(a)) return null;
    const s = Number.isFinite(b) ? a + (b - a) * t : a;
    return {
      s,
      f: s - Math.floor(s),
      giro: Math.floor(s) + 1,
      box: P.pit[i] ? 'lane' : null,
    };
  }

  return {
    sorgente: dati.sorgente,
    // la corsia box MISURATA su questa gara (non la stilizzata di pista_<gara>.json)
    pitlane: dati.pitlane || null,
    piloti: Object.keys(piloti),
    ha(sigla) { return !!piloti[sigla]; },
    posizioneDi,
    // tutte le posizioni al tempo T: solo i piloti presenti. Chi manca non compare —
    // il chiamante non deve poterlo confondere con un'auto ferma.
    posizioniA(T) {
      const out = {};
      for (const sigla of Object.keys(piloti)) {
        const p = posizioneDi(sigla, T);
        if (p) out[sigla] = p;
      }
      return out;
    },
    // estremi della finestra coperta, in secondi di sessione
    finestra() { return [t0, t0 + (n - 1) / hz]; },
  };
}
