// s23_bagnato — la Fase Bagnato è chiusa per NON ESEGUIBILITÀ, e la
// conseguenza è sorvegliata (regola 3, regola 6, E16, E22).
//
// Il fondo ha 20 gare bagnate e 10.098 giri su gomma da bagnato, ma il
// crossover — il fenomeno che il cancello chiede di riprodurre — è osservabile
// in UNA gara sola. Non è un cancello fallito: è un cancello che non si può
// nemmeno giocare. E16 dice esattamente questo: un'assenza non è una risposta,
// e un ottimo misurato dove il fenomeno non c'è è peggio del silenzio.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) l'esito non esiste, o non cita la prereg della fase;
//  (b) il verdetto non segue il criterio pre-registrato applicato ai numeri
//      dell'esito stesso (gare giudicabili ≥ 8): sarebbe un verdetto scritto a
//      mano sopra una misura che dice altro;
//  (c) il criterio eseguito dallo stimatore non è quello della prereg — minimo
//      di 3 piloti per famiglia, 5 giri misti, 8 gare giudicabili: la prereg
//      vieta di abbassarli per guadagnare gare, e questo lo verifica sul
//      codice, non sulla buona fede;
//  (d) il selettore Wet risulta ATTIVO nella vista della pagina, o il suo
//      motivo non è quello a referto: accendere un selettore senza cancello è
//      la promessa che CLAUDE.md vieta al giorno 1;
//  (e) un modello del bagnato compare in data/modelli/ o in engine/: la fase
//      non ne ha prodotto uno, e un file lì dentro verrebbe consumato come tale;
//  (f) l'esito non si riproduce rieseguendo lo stimatore, o la vista bagnata
//      non è quella su cui è stato calcolato (E22);
//  (g) lo stimatore NON fallisce su un fondo in cui la fase sarebbe eseguibile:
//      la clausola "se un giorno si può, il modello va scritto" sarebbe un
//      commento senza potere di fallire (regola 4, E09);
//  (h) `passoBagnato` smette di condividere la definizione di passo pulito con
//      `verde`: le due famiglie diventerebbero incomparabili e il Δ su cui si
//      misura il crossover confronterebbe due filtri diversi (E12).

import { banco } from '../asserzioni.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verde, passoBagnato } from '../../provenienza/definizioni.mjs';
import { creaCella } from '../../provenienza/contratto.mjs';

const b = banco('s23');
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PERCORSO_ESITO = path.join(radice, 'banco', 'prereg', 'ESITO_bagnato.json');
const esito = JSON.parse(readFileSync(PERCORSO_ESITO, 'utf8'));

// (a) l'esito è quello della prereg
b.uguale('la prereg citata è quella giusta', esito._targhetta.prereg, 'banco/prereg/PREREG_bagnato.md');
b.verifica('l\'esito avverte che i suoi numeri NON sono un modello',
  /DIAGNOSTICA DESCRITTIVA/.test(esito._targhetta.avvertenza));
b.verifica('...e spiega perché non sta in data/modelli/', /data\/modelli/.test(esito._targhetta.avvertenza));

// la vista su cui l'esito è stato calcolato è quella committata
{
  const vista = readFileSync(path.join(radice, 'data', 'viste', 'bagnato_fondo.json'));
  b.uguale('l\'esito è calcolato sulla vista committata (hash)',
    esito._targhetta.sha256_vista, createHash('sha256').update(vista).digest('hex'));
}

// (b) il verdetto segue il criterio applicato ai numeri dell'esito
{
  const min = esito.criterio_dichiarato.min_gare_giudicabili;
  const eseguibile = esito.n_gare_giudicabili >= min;
  b.verifica(`il verdetto è NON ESEGUIBILE ⇔ ${esito.n_gare_giudicabili} < ${min} gare giudicabili`,
    /NON ESEGUIBILE/.test(esito.verdetto) === !eseguibile);
  b.uguale('l\'elenco delle gare giudicabili ha la lunghezza dichiarata',
    esito.gare_giudicabili.length, esito.n_gare_giudicabili);
  // la conclusione non dipende dalla soglia scelta: nemmeno il criterio più
  // permissivo della tabella di sensibilità arriva al minimo richiesto
  const massimo = Math.max(...esito.sensibilita_al_criterio.map((s) => s.gare_con_cambio_di_segno));
  b.verifica(`nemmeno il criterio più permissivo arriva a ${min} gare (max ${massimo}): la conclusione non dipende dalla soglia`,
    massimo < min);
  const dichiarato = esito.sensibilita_al_criterio.find((s) => s.dichiarato);
  b.verifica('la riga dichiarata è nella tabella di sensibilità', dichiarato !== undefined);
  b.uguale('...e coincide col conteggio del verdetto',
    dichiarato.gare_con_cambio_di_segno, esito.n_gare_giudicabili);
}

// (c) il criterio nel codice è quello della prereg, non uno allentato
{
  const sorgente = readFileSync(path.join(radice, 'fisica', 'stima_bagnato.py'), 'utf8');
  for (const [nome, valore] of [['MIN_PILOTI', 3], ['MIN_GIRI_MISTI', 5], ['MIN_GARE_GIUDICABILI', 8]]) {
    b.verifica(`lo stimatore usa ${nome} = ${valore}, come pre-registrato`,
      new RegExp(`^${nome} = ${valore}\\b`, 'm').test(sorgente));
  }
  b.uguale('...e l\'esito riporta lo stesso minimo di piloti',
    esito.criterio_dichiarato.min_piloti_per_famiglia, 3);
  const prereg = readFileSync(path.join(radice, 'banco', 'prereg', 'PREREG_bagnato.md'), 'utf8');
  b.verifica('la prereg vieta di abbassare il minimo di piloti', /Non si abbassa il minimo di piloti/.test(prereg));
  b.verifica('la prereg vieta di usare i giri di cambio gomma come verità', /giri di cambio gomma come verità/.test(prereg));
  b.verifica('la prereg vieta di accendere il selettore senza cancello', /Non si accende il selettore Wet/.test(prereg));
}

// (d) il selettore Wet resta spento, col motivo a referto
{
  const vistaWeb = JSON.parse(readFileSync(path.join(radice, 'web', 'vista', 'demo.json'), 'utf8'));
  const bagnate = vistaWeb.mescole.filter((m) => ['INTERMEDIATE', 'WET'].includes(m.codice));
  b.verifica(`la pagina mostra le mescole da bagnato (${bagnate.length})`, bagnate.length >= 2);
  for (const m of bagnate) {
    b.uguale(`${m.codice}: il selettore è SPENTO`, m.attiva, false);
    b.verifica(`${m.codice}: il motivo cita l'esito della fase`, m.motivo.includes('banco/prereg/ESITO_bagnato.json'));
    b.verifica(`${m.codice}: il motivo porta la data della fase (regola 2)`, m.motivo.includes(esito._targhetta.data));
    b.verifica(`${m.codice}: il motivo porta il conteggio a referto`,
      m.motivo.includes(`${esito.n_gare_giudicabili} gara giudicabile su ${esito.n_gare_bagnate}`));
  }
}

// (e) nessun modello del bagnato è entrato dove verrebbe consumato
{
  const VIETATI = [/crossover/i, /w_stella/, /modello_bagnato/i, /delta_bagnato/i];
  const visita = (dir, fuori) => {
    for (const nome of readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (statSync(p).isDirectory()) { visita(p, fuori); continue; }
      if (/\.(mjs|py|json)$/.test(nome)) fuori.push(p);
    }
    return fuori;
  };
  for (const albero of ['engine', path.join('data', 'modelli')]) {
    const dir = path.join(radice, albero);
    if (!existsSync(dir)) continue;
    for (const file of visita(dir, [])) {
      const testo = readFileSync(file, 'utf8');
      const rel = path.relative(radice, file).split(path.sep).join('/');
      for (const vietato of VIETATI) {
        b.verifica(`${rel} non contiene un modello del bagnato (${vietato.source}): la fase non ne ha prodotto uno`,
          !vietato.test(testo));
      }
    }
  }
  b.verifica('l\'esito NON sta in data/modelli/', !existsSync(path.join(radice, 'data', 'modelli', 'bagnato.json')));
}

// (h) le due famiglie passano dallo STESSO filtro di passo pulito
{
  const cella = (patch) => creaCella({
    lap_time: 90, cum_time: 900, stint: 1, compound: 'HARD', tyre_age: 5,
    in_lap: false, out_lap: false, status: '1', del: false, ...patch,
  });
  // stesse condizioni di esclusione, cambiata solo la famiglia di mescole
  for (const [descrizione, patch] of [
    ['giro sotto Safety Car', { status: '4' }],
    ['giro sotto gialla', { status: '2' }],
    ['giro cancellato', { del: true }],
    ['in-lap', { in_lap: true }],
    ['out-lap', { out_lap: true }],
  ]) {
    b.uguale(`${descrizione}: escluso dal passo slick`, verde(cella(patch)), false);
    b.uguale(`${descrizione}: escluso ANCHE dal passo bagnato`,
      passoBagnato(cella({ ...patch, compound: 'INTERMEDIATE' })), false);
  }
  // ...e ciascuna accetta solo la propria famiglia
  b.uguale('slick pulito: verde sì', verde(cella({})), true);
  b.uguale('slick pulito: passoBagnato no', passoBagnato(cella({})), false);
  b.uguale('intermedia pulita: passoBagnato sì', passoBagnato(cella({ compound: 'INTERMEDIATE' })), true);
  b.uguale('intermedia pulita: verde no', verde(cella({ compound: 'INTERMEDIATE' })), false);
}

// (f) riproducibilità: rieseguito oggi, stessi numeri
{
  const r = spawnSync('python3', [path.join(radice, 'fisica', 'stima_bagnato.py')], { encoding: 'utf8' });
  b.uguale('lo stimatore rigira senza errori', r.status, 0);
  const rifatto = JSON.parse(readFileSync(PERCORSO_ESITO, 'utf8'));
  b.uguale('il verdetto si riproduce', rifatto.verdetto, esito.verdetto);
  b.uguale('il conteggio delle gare giudicabili si riproduce', rifatto.n_gare_giudicabili, esito.n_gare_giudicabili);
  b.uguale('la tabella di sensibilità si riproduce', rifatto.sensibilita_al_criterio, esito.sensibilita_al_criterio);
}

// (g) lo stimatore fallisce se la fase diventa eseguibile — provato, non promesso
{
  // fondo sintetico: 8 gare, ognuna con una finestra mista larga e un cambio di
  // segno di Δ. È esattamente la condizione che la prereg chiede per eseguire.
  const gare = [];
  for (let i = 0; i < 8; i += 1) {
    const giri = [];
    for (let giro = 1; giro <= 8; giro += 1) {
      const delta = giro <= 4 ? 2 : -2; // il segno cambia al giro 5
      giri.push({
        giro, n_slick: 5, n_bagnato: 5,
        mediana_slick: 90, mediana_bagnato: 90 + delta, mediana_campo: 90,
      });
    }
    gare.push({
      anno: 2000 + i, gara: `Sintetica_${i}`, chiave: `${2000 + i}/Sintetica_${i}`,
      giri_su_bagnato: 40, n_slick_puliti: 100, riferimento_asciutto_s: 85, giri,
    });
  }
  const dir = mkdtempSync(path.join(tmpdir(), 's23-'));
  const finto = path.join(dir, 'bagnato_sintetico.json');
  const uscita = path.join(dir, 'esito_sintetico.json');
  writeFileSync(finto, JSON.stringify({ n_gare: gare.length, giri_su_bagnato_totali: 320, gare }));

  const primaDell = readFileSync(PERCORSO_ESITO, 'utf8');
  const r = spawnSync('python3', [path.join(radice, 'fisica', 'stima_bagnato.py')], {
    encoding: 'utf8',
    env: { ...process.env, MB_VISTA_BAGNATO: finto, MB_ESITO_BAGNATO: uscita },
  });
  b.verifica('su un fondo dove la fase sarebbe eseguibile, lo stimatore FALLISCE invece di improvvisare un modello',
    r.status !== 0);
  b.verifica('...e dice che il modello va scritto', /modello.*non è implementato|va scritto/s.test(r.stderr));
  b.verifica('...senza scrivere niente', !existsSync(uscita));
  b.uguale('...e senza toccare l\'esito reale', readFileSync(PERCORSO_ESITO, 'utf8'), primaDell);
}

b.chiudi();
