// registro_eventi.mjs — IL REGISTRO DEI ~15 EVENTI DI MOVIMENTO, uno per uno.
//
//     node ai_lab/confronto/registro_eventi.mjs [--json] [--top N]
//
// PERCHE' ESISTE. `REFERTO_62_righe.md` (15/08) ha corretto il quadro del giorno prima: le 62
// coppie che la realta' scambia e il motore no NON sono 62 fallimenti indipendenti, sono una
// quindicina di episodi — lo stesso pilota che si sposta di piu' posti in due o tre giri, e
// ogni suo spostamento genera tante coppie quante sono le auto che scavalca. Il 63% delle
// coppie ha almeno un estremo in un evento multiplo, e i quattro eventi piu' grossi valgono
// il 40% del deficit. Quel referto si chiudeva con una riga di metodo:
//
//   «Smettere di cercare UNA LEGGE e cominciare a fare l'autopsia dei singoli episodi.»
//
// Ma quella quindicina di episodi viveva solo come TABELLA IN UNA PAGINA DI PROSA, contata a
// mano dall'elenco JSON. Un elenco in prosa non si ri-genera quando arriva una gara nuova, non
// si interroga, e non regge il confronto con se stesso di un mese dopo — che e' esattamente il
// difetto che questo repo ha gia' pagato con le fonti orfane. Questo file lo rende un
// ARTEFATTO: stessa definizione delle coppie, stessa classificazione dei secchi, e per ogni
// evento le metriche di traiettoria attorno ai due fatti che possono spiegarlo — la SOSTA e la
// NEUTRALIZZAZIONE.
//
// COS'E' UN EVENTO, dichiarato prima di guardare i numeri:
//
//   Un evento e' un GRAPPOLO di coppie mancate dello stesso (gara, pilota) i cui giri sono
//   contigui a meno di GAP giri. La finestra e' [min(giro) − MARGINE, max(giro) + MARGINE],
//   tagliata al congelamento e alla bandiera.
//
//   PERCHE' LA CONTIGUITA' E' UN PARAMETRO E NON UN DETTAGLIO — l'ho scoperto ricostruendo il
//   referto. Senza alcun vincolo di contiguita' («un evento = tutte le coppie di quel pilota
//   in quella gara») gli eventi multipli sono 31 e coprono l'83,9% delle mancate; il referto
//   del 15/08 ne contava «una quindicina». Non e' una discrepanza: e' che quel conteggio a
//   mano aveva raggruppato per GRAPPOLI DI GIRI senza dirlo. Belgio/HAD ne e' l'esempio
//   pulito: ha coppie ai giri 10-17 e una isolata al giro 31 — senza contiguita' e' un evento
//   da 9, con contiguita' sono la rimonta da 8 (giri 10-17) piu' una coppia sciolta.
//
//   Quindi GAP e' esplicito, ha un valore dichiarato, e il registro riporta ENTRAMBI i
//   conteggi (`senza_contiguita`), perche' un lettore deve poter vedere che la «quindicina»
//   e la «trentina» sono la stessa misura con due definizioni di episodio, non due misure in
//   conflitto. Il numero che NON dipende da questa scelta e' la copertura dei quattro
//   maggiori: 25 coppie distinte, 40,3%, identico nei due modi e identico al referto.
//
//   DOPPIO CONTEGGIO, dichiarato e non nascosto: una coppia ha DUE estremi, quindi puo'
//   appartenere a due eventi. La somma delle coppie degli eventi e' percio' maggiore di 62, e
//   il registro riporta separatamente `coppie_distinte_coperte`, che e' il numero che va
//   citato quando si parla di «quanto del deficit» copre un insieme di eventi. Il referto del
//   15/08 diceva «39 su 62 (63%)» ed e' quel secondo conteggio: le due cifre misurano cose
//   diverse e vanno tenute separate.
//
// LE METRICHE DI TRAIETTORIA, e perche' proprio prima/dopo.
//
//   Per ogni evento si prende l'ANCORA: il giro del fatto che potrebbe spiegarlo, scelto in
//   quest'ordine dichiarato — (1) la sosta PROPRIA del pilota piu' vicina ai giri dell'evento;
//   (2) se non ne ha, l'inizio della finestra neutralizzata piu' vicina; (3) se non c'e'
//   nemmeno quella, il giro mediano delle coppie. L'ordine e' questo perche' la sosta e' il
//   fatto piu' specifico del pilota, la neutralizzazione il piu' specifico della gara.
//
//   Attorno all'ancora si misura la POSIZIONE (vera e del motore) a −FINESTRA e +FINESTRA
//   giri, e si scompone il deficit:
//
//     salto_vero    = posizione vera dopo − posizione vera prima     (positivo = perde posti)
//     salto_motore  = idem per il motore
//     deficit       = salto_vero − salto_motore                      (positivo = il motore
//                                                                     muove MENO del vero)
//
//   e le stesse tre cifre sul solo tratto PRIMA dell'ancora e sul solo tratto DOPO. Serve a
//   distinguere due cose che l'aggregato confonde: un motore che *non comincia* il movimento
//   da un motore che *lo comincia e lo perde per strada* — che e' letteralmente cio' che
//   Belgio/HAD e Gran Bretagna/ANT sembravano fare a occhio nel referto («la fa a meta', e poi
//   la perde»; «si ferma a meta' strada»). Qui quelle due frasi diventano numeri.
//
// NON PROPONE NESSUN MECCANISMO. E' un registro descrittivo: nessun cancello, nessun
// parametro, nessun file di produzione toccato. Dopo cinque leggi cadute in sei giorni, la
// sesta non la si scrive guardando questi numeri — la si pre-registra, se mai.

import { writeFileSync } from 'node:fs';
import { gare, garaNuova } from './banco.mjs';
import { regimePerGiroDiCampo } from '../../simulatore/provenienza/definizioni.mjs';
import { corri, pianiVeriDi, perGara } from './bandiera.mjs';

const JSON_OUT = process.argv.includes('--json');
const iTop = process.argv.indexOf('--top');
const TOP = iTop >= 0 ? Number(process.argv[iTop + 1]) : 4;

const MARGINE = 3;    // giri di contorno della finestra dell'evento
const FINESTRA = 3;   // giri prima e dopo l'ancora per le metriche di traiettoria
const MIN_COPPIE = 2; // un evento e' MULTIPLO da due coppie in su
const iGap = process.argv.indexOf('--gap');
// GAP = 5 giri: due coppie separate da piu' di cinque giri non sono lo stesso episodio.
// Il valore e' scelto perche' riproduce il raggruppamento del referto del 15/08 (Belgio/HAD
// 8 coppie ai giri 10-17, con la coppia isolata del giro 31 fuori) — cioe' e' TARATO SU UNA
// LETTURA PRECEDENTE, non sui numeri di oggi, e va detto invece di spacciarlo per naturale.
const GAP = iGap >= 0 ? Number(process.argv[iGap + 1]) : 5;

// spezza i giri ordinati in grappoli contigui a meno di `gap`
const grappoli = (giri, gap) => {
  const out = [];
  for (const L of giri) {
    if (out.length && L - out[out.length - 1][out[out.length - 1].length - 1] <= gap) {
      out[out.length - 1].push(L);
    } else out.push([L]);
  }
  return out;
};

// posizione di `d` al giro L: 1 + quanti hanno cum minore. `null` se manca il dato.
const posizione = (cum, vivi, d, L) => {
  const mio = cum[d]?.[L];
  if (!Number.isFinite(mio)) return null;
  let n = 1;
  for (const e of vivi) {
    if (e === d) continue;
    const suo = cum[e]?.[L];
    if (Number.isFinite(suo) && suo < mio) n += 1;
  }
  return n;
};

const eventi = [];
const mancateTotali = [];
const senzaContiguita = [];   // solo per riconciliare la «quindicina» con la «trentina»

for (const nomeSito of gare()) {
  const gSim = garaNuova(nomeSito);
  const neutraVera = regimePerGiroDiCampo(gSim.perPilota);
  const ritiriVeri = {};
  for (const x of perGara(nomeSito)) {
    if (x.classificato) continue;
    const celle = gSim.perPilota.get(x.pilota);
    if (celle && celle.size) ritiriVeri[x.pilota] = Math.max(...celle.keys());
  }
  const piani = pianiVeriDi(nomeSito);
  let e = null;
  for (const x of perGara(nomeSito)) {
    const t = corri(nomeSito, x.pilota, {
      pianiRivali: piani, ritiriRivali: ritiriVeri, neutralizzazioneVera: neutraVera, conTraccia: true,
    });
    if (!t.saltato) { e = t; break; }
  }
  if (!e) continue;

  const lf = e.congelamento; const fine = e.n_giri;
  const campo = Object.entries(e.traccia ?? {})
    .filter(([, p]) => Array.isArray(p) && p.length).map(([d]) => d)
    .filter((d) => gSim.perPilota.get(d)?.size);
  const cumV = {}; const cumM = {};
  for (const d of campo) {
    cumV[d] = {}; for (const [L, c] of gSim.perPilota.get(d)) if (Number.isFinite(c.cum_time)) cumV[d][L] = c.cum_time;
    cumM[d] = {}; for (const p of e.traccia[d]) cumM[d][p.lap] = p.cum_time;
  }
  const vivi = campo.filter((d) => Number.isFinite(cumV[d][lf]) && Number.isFinite(cumV[d][fine]) && Number.isFinite(cumM[d][fine]));

  // soste vere: per pilota e per giro (stessa fonte dei secchi di coppie_mancate.mjs)
  const sosteAlGiro = {}; const sostePilota = {};
  for (const r of perGara(nomeSito)) {
    sostePilota[r.pilota] = r.soste_piano.map((s) => s.giro).sort((a, b) => a - b);
    for (const s of r.soste_piano) (sosteAlGiro[s.giro] ||= new Set()).add(r.pilota);
  }
  const secchioDi = (L, A, B) => {
    if (neutraVera[L]) return 'neutralizzato';
    let qualcuno = false; let loro = false;
    for (let x = L - 1; x <= L + 1; x += 1) {
      const s = sosteAlGiro[x];
      if (!s || !s.size) continue;
      qualcuno = true;
      if (s.has(A) || s.has(B)) loro = true;
    }
    return loro ? 'suo' : (qualcuno ? 'altrui' : 'pista');
  };

  // ---- le coppie mancate, identiche a coppie_mancate.mjs
  const mancate = [];
  for (let i = 0; i < vivi.length; i += 1) {
    for (let j = i + 1; j < vivi.length; j += 1) {
      const A = vivi[i]; const B = vivi[j];
      const primaA = cumV[A][lf] < cumV[B][lf];
      const veroFlip = primaA !== (cumV[A][fine] < cumV[B][fine]);
      const motFlip = primaA !== (cumM[A][fine] < cumM[B][fine]);
      if (!veroFlip || motFlip) continue;   // solo le MANCATE
      let ultimo = null; let stato = primaA;
      for (let L = lf + 1; L <= fine; L += 1) {
        const a = cumV[A][L]; const b = cumV[B][L];
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        const ora = a < b;
        if (ora !== stato) { ultimo = L; stato = ora; }
      }
      if (ultimo === null) continue;
      const riga = { gara: nomeSito, A, B, lap: ultimo, secchio: secchioDi(ultimo, A, B) };
      mancate.push(riga); mancateTotali.push(riga);
    }
  }

  // ---- raggruppa per (gara, pilota): ogni coppia aderisce a DUE gruppi
  const gruppi = {};
  for (const m of mancate) {
    for (const d of [m.A, m.B]) {
      (gruppi[d] ||= { pilota: d, coppie: [] }).coppie.push(m);
    }
  }

  for (const g of Object.values(gruppi)) {
    // il conteggio SENZA contiguita', tenuto solo per riconciliare le due letture
    if (g.coppie.length >= MIN_COPPIE) {
      senzaContiguita.push({ gara: nomeSito, pilota: g.pilota, coppie: g.coppie.length });
    }
    const tuttiGiri = g.coppie.map((c) => c.lap).sort((a1, b1) => a1 - b1);
    for (const giri of grappoli(tuttiGiri, GAP)) {
    if (giri.length < MIN_COPPIE) continue;
    const coppieEv = g.coppie.filter((c) => giri.includes(c.lap));
    const da = Math.max(lf, giri[0] - MARGINE);
    const a = Math.min(fine, giri[giri.length - 1] + MARGINE);

    // ---- l'ancora, nell'ordine dichiarato in testa
    const mediano = giri[Math.floor(giri.length / 2)];
    // L'ANCORA DEVE STARE DENTRO LA FINESTRA DELL'EVENTO, e questa riga nasce da un difetto
    // visto nel primo giro di stampa: Belgio/LAW ha due grappoli (giri 15-16 e 30-33) e una
    // sola sosta dopo il congelamento, al giro 15. Senza vincolo entrambi i grappoli
    // ancoravano a quella sosta, e i due eventi uscivano con metriche IDENTICHE — cioe' il
    // secondo descriveva i giri 12-18 mentre le sue coppie stanno ai giri 30-33. Un'ancora
    // fuori finestra non spiega l'episodio: misura un altro momento della gara.
    const dentro = (L) => L >= da && L <= a;
    const piuVicino = (cands) => cands.reduce((best, s) => (Math.abs(s - mediano) < Math.abs(best - mediano) ? s : best), cands[0]);
    const mie = (sostePilota[g.pilota] ?? []).filter((s) => s > lf && dentro(s));
    const finestre = Object.keys(neutraVera).map(Number).filter((L) => neutraVera[L] && L > lf && dentro(L));
    let ancora = null; let tipoAncora = null;
    if (mie.length) { ancora = piuVicino(mie); tipoAncora = 'sosta propria'; } else if (finestre.length) {
      ancora = piuVicino(finestre); tipoAncora = 'neutralizzazione';
    } else { ancora = mediano; tipoAncora = 'giro mediano delle coppie'; }

    const primaL = Math.max(lf, ancora - FINESTRA);
    const dopoL = Math.min(fine, ancora + FINESTRA);
    const p = (cum, L) => posizione(cum, vivi, g.pilota, L);
    const salto = (cum, x, y) => {
      const px = p(cum, x); const py = p(cum, y);
      return (px === null || py === null) ? null : py - px;
    };
    const dif = (v, m) => (v === null || m === null ? null : v - m);

    const veroTot = salto(cumV, primaL, dopoL);
    const motTot = salto(cumM, primaL, dopoL);
    const veroPre = salto(cumV, primaL, ancora);
    const motPre = salto(cumM, primaL, ancora);
    const veroPost = salto(cumV, ancora, dopoL);
    const motPost = salto(cumM, ancora, dopoL);

    // ---- traiettoria giro per giro: la finestra dell'evento UNITA a quella delle metriche,
    // perche' una tabella che non copre i giri su cui il deficit e' calcolato non si
    // puo' controllare a occhio, ed e' il primo controllo che si fa.
    const daT = Math.min(da, primaL); const aT = Math.max(a, dopoL);
    const traiettoria = [];
    for (let L = daT; L <= aT; L += 1) {
      const altrui = [];
      for (const [pil, ss] of Object.entries(sostePilota)) {
        if (pil !== g.pilota && ss.includes(L)) altrui.push(pil);
      }
      traiettoria.push({
        giro: L,
        vero: p(cumV, L),
        motore: p(cumM, L),
        neutralizzato: Boolean(neutraVera[L]),
        sosta_propria: (sostePilota[g.pilota] ?? []).includes(L),
        soste_altrui: altrui.length,
      });
    }

    eventi.push({
      gara: nomeSito,
      pilota: g.pilota,
      coppie: coppieEv.length,
      giri: { da: giri[0], a: giri[giri.length - 1], elenco: giri },
      secchi: coppieEv.reduce((acc, c) => { acc[c.secchio] = (acc[c.secchio] ?? 0) + 1; return acc; }, {}),
      soste_vere: sostePilota[g.pilota] ?? [],
      neutralizzato_nella_finestra: traiettoria.some((t) => t.neutralizzato),
      ancora: { giro: ancora, tipo: tipoAncora, prima: primaL, dopo: dopoL },
      traiettoria_metriche: {
        // L'EVENTO INTERO, e non e' un doppione dell'ancora. L'ancora e' il fatto che
        // POTREBBE spiegare l'episodio, ma puo' cadere DOPO il movimento che ha generato le
        // coppie: Belgio/HAD ha le coppie ai giri 10-17 e la sua sosta al giro 20, quindi la
        // finestra ±3 attorno all'ancora fotografa il crollo post-sosta e si perde la
        // rimonta. Senza questa riga il registro misurerebbe con precisione il momento
        // sbagliato — e i due segni opposti (deficit −4 sull'ancora, +8 sull'evento) sono
        // esattamente l'informazione che serve.
        finestra_evento: { da, a, salto_vero: salto(cumV, da, a), salto_motore: salto(cumM, da, a), deficit: dif(salto(cumV, da, a), salto(cumM, da, a)) },
        finestra_ancora: { salto_vero: veroTot, salto_motore: motTot, deficit: dif(veroTot, motTot) },
        prima_ancora: { salto_vero: veroPre, salto_motore: motPre, deficit: dif(veroPre, motPre) },
        dopo_ancora: { salto_vero: veroPost, salto_motore: motPost, deficit: dif(veroPost, motPost) },
      },
      traiettoria,
    });
    }
  }
}

eventi.sort((x, y) => y.coppie - x.coppie || x.gara.localeCompare(y.gara));

// quante coppie DISTINTE copre un insieme di eventi (il conteggio da citare)
const distinte = (lista) => {
  const visti = new Set();
  for (const ev of lista) for (const c of ev.coppie ? [] : []) visti.add(c);
  return visti.size;
};
const chiaveCoppia = (c) => `${c.gara}|${c.A}|${c.B}|${c.lap}`;
const copertePer = (lista) => {
  const visti = new Set();
  for (const ev of lista) {
    for (const m of mancateTotali) {
      if (m.gara === ev.gara && (m.A === ev.pilota || m.B === ev.pilota)) visti.add(chiaveCoppia(m));
    }
  }
  return visti.size;
};

const registro = {
  _targhetta: {
    cosa_e: 'Registro degli eventi di movimento: le coppie MANCATE raggruppate per (gara, pilota), con metriche di traiettoria attorno alla sosta o alla neutralizzazione.',
    generato_da: 'ai_lab/confronto/registro_eventi.mjs',
    referto_di_origine: 'ai_lab/confronto/REFERTO_62_righe.md (15/08/2026)',
    natura: 'DESCRITTIVO — nessun cancello, nessun meccanismo, nessun parametro',
    definizioni: {
      evento: `grappolo di almeno ${MIN_COPPIE} coppie mancate dello stesso (gara, pilota) con giri contigui a meno di GAP=${GAP} giri`,
      gap: `${GAP} giri — parametro dichiarato, scelto per riprodurre il raggruppamento a mano del referto del 15/08. Vedi \`senza_contiguita\`.`,
      doppio_conteggio: "una coppia ha due estremi e puo' stare in due eventi: la somma di `coppie` supera le mancate totali. Il numero da citare per la copertura e' `coppie_distinte_coperte`.",
      ancora: '(1) sosta propria piu' + ' vicina al giro mediano delle coppie; (2) altrimenti neutralizzazione piu' + ' vicina; (3) altrimenti il giro mediano',
      finestra_metriche: `±${FINESTRA} giri attorno all'ancora`,
      segno_deficit: 'positivo = il motore muove MENO della realta' + "'",
    },
  },
  mancate_totali: mancateTotali.length,
  eventi_multipli: eventi.length,
  senza_contiguita: {
    _nota: "la stessa misura con «evento = tutte le coppie di quel pilota in quella gara». Le due cifre non sono in conflitto: sono due definizioni di episodio, ed e' il motivo per cui GAP e' esplicito.",
    eventi_multipli: senzaContiguita.length,
  },
  coppie_distinte_coperte: copertePer(eventi),
  quota_coperta: mancateTotali.length ? Number((copertePer(eventi) / mancateTotali.length * 100).toFixed(1)) : null,
  primi: {
    n: Math.min(TOP, eventi.length),
    coppie_distinte_coperte: copertePer(eventi.slice(0, TOP)),
    quota: mancateTotali.length ? Number((copertePer(eventi.slice(0, TOP)) / mancateTotali.length * 100).toFixed(1)) : null,
  },
  eventi,
};

// UN REGISTRO SI SCRIVE, altrimenti e' un'altra stampa da rileggere a mano — che e' il difetto
// da cui questo file nasce. L'artefatto ha targhetta e generatore, quindi non e' orfano.
const DESTINAZIONE = new URL('./REGISTRO_eventi_movimento.json', import.meta.url);
writeFileSync(DESTINAZIONE, `${JSON.stringify(registro, null, 1)}\n`);

if (JSON_OUT) { console.log(JSON.stringify(registro, null, 1)); } else {
  const seg = (o) => `${String(o.salto_vero ?? '·').padStart(3)} /${String(o.salto_motore ?? '·').padStart(3)} =${String(o.deficit ?? '·').padStart(3)}`;
  console.log('');
  console.log('  IL REGISTRO DEGLI EVENTI DI MOVIMENTO');
  console.log('');
  console.log(`  ${registro.mancate_totali} coppie mancate -> ${registro.eventi_multipli} eventi multipli (grappoli, GAP=${GAP} giri),`
    + ` che coprono ${registro.coppie_distinte_coperte} coppie distinte (${registro.quota_coperta}%)`);
  console.log(`  senza vincolo di contiguita' sarebbero ${registro.senza_contiguita.eventi_multipli}: stessa misura, altra definizione di episodio`);
  console.log(`  i primi ${registro.primi.n} coprono ${registro.primi.coppie_distinte_coperte} coppie distinte (${registro.primi.quota}%)`);
  console.log('');
  console.log("  vero/motore=deficit · positivo = il motore muove MENO della realta'");
  console.log('  evento                  cop  giri      ancora           EVENTO INTERO   ancora±3        (prima)         (dopo)');
  for (const ev of eventi) {
    const m = ev.traiettoria_metriche;
    console.log(`  ${(ev.gara + ' · ' + ev.pilota).padEnd(22)} ${String(ev.coppie).padStart(3)}`
      + `  ${String(ev.giri.da).padStart(2)}-${String(ev.giri.a).padEnd(2)}`
      + `  ${String(ev.ancora.giro).padStart(2)} ${ev.ancora.tipo.slice(0, 14).padEnd(14)}`
      + ` ${seg(m.finestra_evento)}  ${seg(m.finestra_ancora)}  ${seg(m.prima_ancora)}  ${seg(m.dopo_ancora)}`);
  }
  console.log('');
  console.log(`  I PRIMI ${registro.primi.n}, GIRO PER GIRO  (N = neutralizzato · S = sosta propria · n = soste altrui)`);
  for (const ev of eventi.slice(0, TOP)) {
    console.log('');
    console.log(`  ${ev.gara} · ${ev.pilota} — ${ev.coppie} coppie, giri ${ev.giri.da}-${ev.giri.a}`
      + ` · soste vere [${ev.soste_vere.join(', ')}] · ancora: giro ${ev.ancora.giro} (${ev.ancora.tipo})`);
    console.log(`     giro   ${ev.traiettoria.map((t) => String(t.giro).padStart(3)).join('')}`);
    console.log(`     vero   ${ev.traiettoria.map((t) => String(t.vero ?? '·').padStart(3)).join('')}`);
    console.log(`     motore ${ev.traiettoria.map((t) => String(t.motore ?? '·').padStart(3)).join('')}`);
    console.log(`     segni  ${ev.traiettoria.map((t) => (t.sosta_propria ? '  S' : t.neutralizzato ? '  N' : t.soste_altrui ? '  n' : '  ·')).join('')}`);
  }
  console.log('');
}
