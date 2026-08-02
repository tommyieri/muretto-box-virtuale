// s25_difesa — la banda di rientro regge, e il duello resta non simulato.
//
// Questa è la sentinella dell'invariante più vecchio del repo: il vecchio motore
// ha MISURATO che il duello non si simula, e da allora la regola è «si riproduce
// QUANTI cambi di posizione, non QUALI». La Fase Difesa è la fase che più di
// ogni altra poteva romperla — chiedeva di rispondere a «e se qualcuno si
// difende?» — e ha risposto con una banda invece che con una probabilità di
// sorpasso. Questa sentinella esiste perché quella scelta non si riapra da sola.
//
// COSA FA FALLIRE QUESTA SENTINELLA:
//  (a) D3: da qualche parte compare una previsione su CHI supera CHI, o il DRS,
//      che nel 2026 non esiste;
//  (b) la banda è calibrata su qualcosa che non sono le soste VERE — finestre
//      senza sosta significherebbe E16 ripagato per intero;
//  (c) la banda copre ma è IMBOTTITA (la copertura di n−1 arriva già al livello):
//      una banda di ±5 coprirebbe tutto e non direbbe niente;
//  (d) la copertura dichiarata è quella DENTRO campione spacciata per fuori:
//      sarebbe il numero facile al posto di quello vero;
//  (e) il prodotto usa in verde la banda di PULITA, che richiederebbe di sapere
//      se i rivali si fermeranno — informazione dal futuro (E14);
//  (f) l'esito di D2 e la forma del modello divergono: il contesto «non separa»
//      ma il modello tiene due bande per contesto, o viceversa;
//  (g) una banda simmetrica nasconde un bias mediano ≥ 1 posizione (D4);
//  (h) la banda committata non è quella che lo stimatore produce oggi (E22), o
//      l'avviso di circuito debole non arriva in pagina;
//  (i) il difetto della statistica di D2 sparisce dall'esito: una metrica senza
//      risoluzione messa a referto non si cancella perché è imbarazzante (E21);
//  (j) il generatore del test di permutazione torna NON uniforme, o smette di
//      essere deterministico: un p-value estratto da un generatore storto non è
//      un p-value, e un esito che non si riproduce non è un esito. È già
//      successo una volta — un LCG in aritmetica JS, chi² = 170 — e il numero
//      pubblicato ha dovuto essere rimisurato.

import { banco } from '../asserzioni.mjs';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calibraBanda, conteso, separaIlContesto, creaGeneratore } from '../misure/difesa.mjs';
import { bandaDiRientro } from '../../scenario/costruttore.mjs';
import { misuraTutto, leggiCancelli } from '../misura_tutto.mjs';
import { misuraRientro } from '../misure/rientro.mjs';
import { caricaGare2026 } from '../../provenienza/gare_2026.mjs';
import { caricaPrior } from '../../provenienza/pitloss_dati.mjs';
import { costruisci } from '../scrivi_banda_rientro.mjs';

const b = banco('s25');

/** Tutti i .mjs sotto una cartella, ricorsivo. Cartella assente = elenco vuoto. */
function elencaFile(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((v) => {
    const f = path.join(dir, v.name);
    if (v.isDirectory()) return v.name === 'node_modules' ? [] : elencaFile(f);
    return v.name.endsWith('.mjs') ? [f] : [];
  });
}
const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cancelli = leggiCancelli(radice).difesa;
const banda = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'banda_rientro.json'), 'utf8'));
const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
// i casi grezzi: il riassunto di `misuraTutto` non li porta, e questa sentinella
// ha bisogno degli errori uno per uno
const rientroCasi = misuraRientro(caricaGare2026(radice), {
  rho: modello.rho.valore, delta70: modello.delta_70.scelto,
  prior: caricaPrior(radice), cancelli: leggiCancelli(radice).rientro,
});
const esito = JSON.parse(readFileSync(path.join(radice, 'banco', 'prereg', 'ESITO_difesa.json'), 'utf8'));
// UNA sola volta: le misure sono le stesse, e rifarle costerebbe solo tempo
const riassunto = misuraTutto(radice);
const d = riassunto.difesa;

// ── (a) D3 · QUANTI, non QUALI. E nessun DRS. ────────────────────────────────
{
  // Il DRS non esiste nel 2026. Nominarlo per DIRE che non esiste è esattamente
  // ciò che la costituzione chiede; modellarlo è vietato. La distinzione si fa
  // riga per riga: una riga che parla di DRS deve negarlo, e nessun IDENTIFICATORE
  // può chiamarsi drs — un campo `drs` è un modello, non una dichiarazione.
  const VIETATI = [
    [/\bdrs[_A-Za-z]*\s*[:=]|[_a-zA-Z]drs\b\s*[:=]/i, 'un identificatore che modella il DRS'],
    [/prob(abilita|abilità)_sorpasso/i, 'una probabilità di sorpasso'],
    [/chi_supera|supera_chi|sorpassante|sorpassato/i, 'un campo che nomina sorpassante e sorpassato'],
  ];
  const visita = (dir, fuori) => {
    for (const nome of readdirSync(dir)) {
      const p = path.join(dir, nome);
      if (statSync(p).isDirectory()) { visita(p, fuori); continue; }
      if (/\.(mjs|json)$/.test(nome) && !/vista\/demo\.json$/.test(p)) fuori.push(p);
    }
    return fuori;
  };
  for (const albero of ['engine', 'scenario', 'live', 'web', path.join('data', 'modelli')]) {
    for (const file of visita(path.join(radice, albero), [])) {
      const testo = readFileSync(file, 'utf8');
      const rel = path.relative(radice, file).split(path.sep).join('/');
      for (const [vietato, cosa] of VIETATI) {
        b.verifica(`${rel} non contiene ${cosa}`, !vietato.test(testo));
      }
      // ogni riga che nomina il DRS deve NEGARLO, non usarlo
      for (const riga of testo.split('\n')) {
        if (!/\bDRS\b/i.test(riga)) continue;
        b.verifica(`${rel}: la riga che nomina il DRS ne dichiara l'inesistenza — "${riga.trim().slice(0, 70)}"`,
          /non esiste|Manual Override|non c'è più/i.test(riga));
      }
    }
  }
  // l'unica grandezza di duello ammessa è un CONTEGGIO, e c'è
  const kernel = readFileSync(path.join(radice, 'engine', 'kernel.mjs'), 'utf8');
  b.verifica('il kernel espone il CONTEGGIO dei cambi di posizione', /export function cambiDiPosizione/.test(kernel));
  b.verifica('...e dichiara che le auto possono attraversarsi', /POSSONO ATTRAVERSARSI/.test(kernel));

  // l'output della banda non nomina nessun rivale
  const chiavi = new Set();
  const raccogli = (o) => {
    if (o === null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) { chiavi.add(k); raccogli(v); }
  };
  raccogli(banda);
  for (const k of chiavi) {
    b.verifica(`il modello della banda non ha un campo "${k}" che nomini un duello`,
      !/sorpass|duello|batte|vince/i.test(k));
  }
  b.verifica('la targhetta della banda dichiara COSA NON È', /NON è una probabilità di sorpasso/.test(banda._targhetta.cosa_NON_e));
  b.verifica('...e che il DRS non esiste nel 2026', /DRS non esiste/.test(banda._targhetta.cosa_NON_e));
}

// ── (b) calibrata sulle SOSTE VERE, e su nient'altro (E16) ──────────────────
{
  b.verifica('la fonte dichiarata sono le soste realmente avvenute',
    /soste REALMENTE avvenute/.test(banda._targhetta.fonte));
  b.verifica('...e cita E16', /E16/.test(banda._targhetta.fonte));
  const sorgente = readFileSync(path.join(radice, 'banco', 'misure', 'difesa.mjs'), 'utf8')
    .split('\n').filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*')).join('\n');
  b.verifica('difesa.mjs non importa la misura del rientro: la riceve già fatta (regola 1)',
    !/from '.*rientro\.mjs'/.test(sorgente));
  b.verifica('difesa.mjs non tocca le celle di gara: non può rifare il rientro a modo suo',
    !/perPilota|in_lap|cum_time/.test(sorgente));
  // il numero di casi è quello della misura del rientro, non un sottoinsieme
  // scelto: se qualcuno filtrasse per far tornare la copertura, si vedrebbe qui
  b.uguale('la banda è calibrata su TUTTE le soste misurate del rientro',
    banda.n_casi, riassunto.rientro.n_soste);
  b.uguale('...su tutte le gare', banda.n_gare, 11);
}

// ── (c) + (d) copre, è minimale, e il numero dichiarato è quello FUORI campione ─
{
  b.verifica(`D1 passa (${d.n_casi} soste, ${d.n_gare} gare)`, d.d1_passa === true);
  // i contesti del modello e quelli della misura devono essere gli stessi, o i
  // confronti sotto girerebbero a vuoto (o esploderebbero, che è come questa
  // sentinella si è rotta la seconda volta)
  b.uguale('i contesti del modello sono quelli che la misura produce',
    Object.keys(banda.contesti).sort(), Object.keys(d.per_prodotto).sort());
  for (const [nome, x] of Object.entries(d.per_prodotto)) {
    if (!banda.contesti[nome]) continue;
    b.verifica(`${nome}: copre almeno ${cancelli.livello_banda} fuori campione (${x.copertura_fuori_campione})`,
      x.copertura_fuori_campione >= cancelli.livello_banda);
    // (c) minimalità: n−1 NON deve già bastare
    b.verifica(`${nome}: NON è imbottita — la banda di ±${x.n - 1} copre solo ${x.copertura_fuori_campione_n_meno_1}`,
      x.copertura_fuori_campione_n_meno_1 < cancelli.livello_banda);
    // (d) il modello pubblica la copertura FUORI campione, non quella dentro
    b.uguale(`${nome}: il modello dichiara la copertura fuori campione`,
      banda.contesti[nome].copertura_fuori_campione, x.copertura_fuori_campione);
    b.verifica(`${nome}: ...e tiene a referto anche quella dentro, distinta`,
      banda.contesti[nome].copertura_dentro_campione !== undefined);
  }
  // Le due coperture COINCIDONO su questi due contesti (il leave-one-race-out
  // dà la stessa banda su ogni blocco), quindi qui non si distinguono. La prova
  // che la macchina del fuori campione non è un alias di quella dentro sta sulla
  // banda COMPLESSIVA, dove i due numeri divergono davvero.
  b.verifica(`sulla banda complessiva dentro e fuori campione DIVERGONO (${d.complessiva.copertura_dentro_campione} contro ${d.complessiva.copertura_fuori_campione}): il leave-one-race-out non è un alias`,
    d.complessiva.copertura_dentro_campione !== d.complessiva.copertura_fuori_campione);
  b.verifica('...e il fuori campione è il più severo dei due',
    d.complessiva.copertura_fuori_campione < d.complessiva.copertura_dentro_campione);
  // la minimalità morde: una banda più larga di uno non passerebbe il cancello.
  // Si prova sui dati veri, non si afferma.
  const errori = rientroCasi.casi.map((c) => c.errore);
  const imbottita = calibraBanda(
    rientroCasi.casi.map((c) => ({ ...c, errore: Math.trunc(c.errore / 4) })),
    { q: cancelli.livello_banda, minGare: cancelli.min_gare, minCasi: cancelli.min_casi_secco },
  );
  b.verifica('su errori artificialmente piccoli la banda scende a 0: la calibrazione segue i dati, non una costante',
    imbottita.sufficiente && imbottita.n === 0);
  b.verifica('gli errori veri non sono tutti nulli (senza questo il controllo sopra è vuoto)',
    errori.some((e) => e !== 0));
}

// ── (e) in verde il prodotto NON usa la banda di PULITA ─────────────────────
{
  b.verifica('i contesti del modello sono VERDE e NEUTRA, non i secchi del banco',
    JSON.stringify(Object.keys(banda.contesti).sort()) === JSON.stringify(['NEUTRA', 'VERDE']));
  b.verifica('nessun contesto si chiama PULITA o SOSTE_RIVALI: distinguerli richiederebbe il futuro (E14)',
    !Object.keys(banda.contesti).some((k) => k === 'PULITA' || k === 'SOSTE_RIVALI'));
  b.verifica('...e il modello spiega perché', /informazione dal futuro|E14/.test(banda._targhetta.contesto_verde));
  // la banda VERDE deve essere calibrata sull'UNIONE: più casi di ciascun secco
  b.verifica('la banda VERDE ha più casi di PULITA da sola',
    banda.contesti.VERDE.n_casi > d.per_secco.PULITA.n_casi);
  b.verifica('...e più di SOSTE_RIVALI da sola',
    banda.contesti.VERDE.n_casi > d.per_secco.SOSTE_RIVALI.n_casi);

  // il selettore di contesto risponde al regime, non a un caso
  const finta = { contesti: banda.contesti, livello: banda.livello, _targhetta: banda._targhetta };
  const verde = bandaDiRientro({ banda: finta, gara: 'Spagna', regime: null, posizione: 10, suQuanti: 20 });
  const neutra = bandaDiRientro({ banda: finta, gara: 'Spagna', regime: 'SC', posizione: 10, suQuanti: 20 });
  b.uguale('in verde il contesto è VERDE', verde.contesto, 'VERDE');
  b.uguale('sotto SC il contesto è NEUTRA', neutra.contesto, 'NEUTRA');
  b.verifica('la banda sotto regime è almeno larga come quella in verde', neutra.semi_ampiezza >= verde.semi_ampiezza);
  // la banda non esce dal gruppo: P1 non ha nessuno davanti
  const alBordo = bandaDiRientro({ banda: finta, gara: 'Spagna', regime: null, posizione: 1, suQuanti: 20 });
  b.uguale('a P1 la banda non propone una posizione 0', alBordo.da, 1);
  const ultimo = bandaDiRientro({ banda: finta, gara: 'Spagna', regime: null, posizione: 20, suQuanti: 20 });
  b.uguale('all\'ultimo posto la banda non supera il numero di auto', ultimo.a, 20);
  // regola 6: nessuna posizione, nessuna banda
  b.uguale('senza posizione non c\'è banda (regola 6)',
    bandaDiRientro({ banda: finta, gara: 'Spagna', regime: null, posizione: null, suQuanti: 20 }), null);
}

// ── (f) l'esito di D2 e la forma del modello non divergono ──────────────────
{
  const separa = d.d2_separa;
  b.uguale('l\'esito committato dice ciò che la misura dice oggi', esito.D2.separa, separa);
  if (!separa) {
    b.verifica('il contesto non separa ⇒ il modello NON tiene due bande per vicinanza',
      typeof banda.contesto_non_separa === 'string' && /NON separa/.test(banda.contesto_non_separa));
    b.verifica('...e nessun contesto è etichettato per vicinanza',
      !Object.keys(banda.contesti).some((k) => /CONTES|VICIN/i.test(k)));
  } else {
    b.verifica('il contesto separa ⇒ esistono due bande per vicinanza',
      Object.keys(banda.contesti).some((k) => /CONTES/i.test(k)));
  }
  // ── la clausola direzionale ha POTERE DI FALLIRE ────────────────────────
  // Sui dati veri l'effetto non è significativo, quindi togliere la clausola
  // direzionale non cambierebbe l'esito: un controllo che si limita a rileggere
  // `separa` sui dati veri NON accorgerebbe della sua sparizione. Si prova su
  // dati SINTETICI, dove l'effetto è forte e col segno SBAGLIATO — i contesi
  // sbagliano MENO — e la clausola è l'unica cosa che può fermarlo.
  b.verifica('D2 riporta la direzione insieme alla significatività',
    typeof d.contesto.attesa_direzionale_contesi_sbagliano_di_piu === 'boolean');
  {
    // I dati sintetici NON possono essere due masse puntiformi (tutti 0 contro
    // tutti 5): con quelle, la mediana di un gruppo misto SCATTA fra 0 e 5 a
    // seconda di dove cade il conteggio, la distribuzione permutata vale ±5
    // quasi sempre e il p-value viene 0,90 anche con un effetto enorme. Provato:
    // è la stessa mancanza di risoluzione che l'esito di D2 mette a referto,
    // vista da dentro. Qui serve una dispersione su cui la mediana possa
    // MUOVERSI, quindi tre valori per gruppo.
    const costruisci = (erroriContesi, erroriPuliti) => {
      const out = [];
      for (let g = 0; g < 10; g += 1) {
        for (let i = 0; i < 30; i += 1) {
          const contesoQui = i < 15;
          const scala = contesoQui ? erroriContesi : erroriPuliti;
          out.push({
            gara: `G${g}`,
            errore: scala[i % scala.length],
            gap_previsti_s: [contesoQui ? 0.5 : 100],
          });
        }
      }
      return out;
    };
    const opzioni = { soglia: 2, permutazioni: 2000, alpha: cancelli.alpha, seme: cancelli.seme };

    // segno SBAGLIATO: i contesi sbagliano MENO
    const rovescio = separaIlContesto(costruisci([0, 1, 2], [4, 5, 6]), opzioni);
    b.verifica(`sul sintetico l'effetto è significativo (p = ${rovescio.p_permutazione}, differenza ${rovescio.differenza_mediane})`,
      rovescio.significativo === true);
    b.uguale('...col segno SBAGLIATO (i contesi sbagliano meno)', rovescio.attesa_direzionale_contesi_sbagliano_di_piu, false);
    b.uguale('...e la clausola direzionale lo FERMA: separa resta false', rovescio.separa, false);

    // ...e lo stesso effetto col segno GIUSTO passa: la clausola non blocca tutto
    const giusto = separaIlContesto(costruisci([4, 5, 6], [0, 1, 2]), opzioni);
    b.verifica(`lo stesso effetto col segno GIUSTO è significativo (p = ${giusto.p_permutazione})`, giusto.significativo === true);
    b.uguale('...e separa', giusto.separa, true);

    // nessun effetto: né significativo né separante
    const nullo = separaIlContesto(costruisci([0, 1, 2], [0, 1, 2]), opzioni);
    b.uguale('senza effetto non separa', nullo.separa, false);
  }
  // la sensibilità sulla soglia è a referto, e contiene quella dichiarata
  const dichiarata = d.sensibilita_soglia.find((x) => x.dichiarata);
  b.verifica('la soglia dichiarata è nella tabella di sensibilità', dichiarata !== undefined);
  b.uguale('...e coincide con quella dei cancelli', dichiarata.soglia, cancelli.soglia_vicinanza_s);
  // «conteso» fa davvero due gruppi non banali
  b.verifica(`i due gruppi non sono degeneri (${d.contesto.n_contesi} contesi, ${d.contesto.n_puliti} puliti)`,
    d.contesto.n_contesi >= 20 && d.contesto.n_puliti >= 20);
  // e la definizione morde: a soglia 0 nessuno è conteso, a soglia enorme tutti
  const caso = rientroCasi.casi[0];
  b.uguale('a soglia 0 nessun rientro è conteso', conteso(caso, 0), false);
  b.uguale('a soglia 10.000 s ogni rientro è conteso', conteso(caso, 10000), true);
}

// ── (g) D4 · nessuna banda simmetrica nasconde un bias ─────────────────────
{
  for (const [nome, x] of Object.entries(d.per_prodotto)) {
    const dichiarata = banda.contesti[nome];
    b.uguale(`${nome}: l'asimmetria dichiarata segue il bias misurato`,
      dichiarata.asimmetrica, Math.abs(x.bias_mediano_posizioni) >= cancelli.bias_massimo_simmetrico_posizioni);
    if (!dichiarata.asimmetrica) {
      b.uguale(`${nome}: banda simmetrica ⇒ sotto e sopra coincidono`, dichiarata.banda.sotto, dichiarata.banda.sopra);
    }
    b.verifica(`${nome}: il bias mediano resta a referto accanto alla banda`,
      dichiarata.bias_mediano_posizioni !== undefined);
  }
}

// ── (h) riproducibilità, e l'avviso di circuito arriva in pagina ───────────
{
  const rifatto = costruisci(radice, riassunto);
  b.uguale('la banda committata è quella che lo stimatore produce oggi (E22)',
    JSON.stringify(rifatto.banda.contesti), JSON.stringify(banda.contesti));
  b.uguale('l\'esito committato è quello che lo stimatore produce oggi',
    rifatto.esito.verdetto, esito.verdetto);

  const vistaWeb = JSON.parse(readFileSync(path.join(radice, 'web', 'vista', 'demo.json'), 'utf8'));
  // `!= null` e non `!== null`: un campo ASSENTE non è un campo nullo, e
  // filtrare col confronto stretto lascerebbe passare gli undefined — che è
  // come questa sentinella si è rotta la prima volta
  const conBanda = vistaWeb.scenari.filter((s) => s.approvato && s.pannello.banda_posizione != null);
  b.uguale('ogni scenario approvato dichiara il campo della banda (assente ≠ nullo)',
    vistaWeb.scenari.filter((s) => s.approvato && !Object.hasOwn(s.pannello, 'banda_posizione')).map((s) => s.gara), []);
  b.verifica(`la banda arriva in pagina su abbastanza scenari (${conBanda.length}/${vistaWeb.scenari.length})`, conBanda.length >= 5);
  for (const s of conBanda) {
    const bp = s.pannello.banda_posizione;
    b.verifica(`${s.gara}: la banda contiene la posizione mostrata`,
      bp.da <= s.pannello.posizione && s.pannello.posizione <= bp.a);
    b.verifica(`${s.gara}: la banda non esce dal gruppo`, bp.da >= 1 && bp.a <= s.pannello.su_quanti);
    b.verifica(`${s.gara}: porta la targhetta della calibrazione`, /soste vere del 2026/.test(bp.targhetta));
    b.verifica(`${s.gara}: porta il "cosa non è"`, /NON è una probabilità di sorpasso/.test(bp.cosa_non_e));
    b.uguale(`${s.gara}: il contesto segue il regime`, bp.contesto, s.regime !== null ? 'NEUTRA' : 'VERDE');
  }
  // e l'avviso di circuito debole ESISTE su almeno un circuito: senza, la
  // dichiarazione «i circuiti sotto livello arrivano in pagina» non è provata
  const deboli = Object.values(banda.contesti).flatMap((c) => c.circuiti_sotto_livello.map((x) => x.gara));
  b.verifica(`esistono circuiti sotto il livello dichiarato (${[...new Set(deboli)].join(', ')})`, deboli.length > 0);
  const conAvviso = conBanda.filter((s) => s.pannello.banda_posizione.circuito_sotto_livello !== null);
  b.verifica(`l'avviso di circuito raggiunge la pagina su almeno uno scenario (${conAvviso.map((s) => s.gara).join(', ') || 'nessuno'})`,
    conAvviso.length > 0);
}

// ── (i) il difetto della statistica di D2 resta a referto ──────────────────
{
  b.verifica('l\'esito dichiara il difetto della statistica pre-registrata',
    /priva di risoluzione/.test(esito.D2.difetto_della_statistica));
  b.verifica('...e dice che NON si riscrive dopo aver visto il risultato',
    /non si riscrive dopo aver visto/i.test(esito.D2.difetto_della_statistica));
  b.verifica('...e punta alla prereg della Fase II', /PREREG_difesa_II\.md/.test(esito.D2.difetto_della_statistica));
  const preregII = readFileSync(path.join(radice, 'banco', 'prereg', 'PREREG_difesa_II.md'), 'utf8');
  b.verifica('la Fase II dichiara di NON riscrivere la Fase I', /non si riscrive/i.test(preregII));
  b.verifica('la Fase II dichiara una statistica con risoluzione', /quote di\s+errore entro ±1/.test(preregII));
  b.verifica('la Fase II dichiara la potenza PRIMA', /Potenza dichiarata prima/.test(preregII));
  b.verifica('la Fase II vieta la probabilità di sorpasso anche a sé stessa', /Non si costruirà una probabilità di sorpasso/.test(preregII));
  b.verifica('la Fase II dichiara quando è non eseguibile', /NON ESEGUIBILIT/.test(preregII));
  // i limiti della Fase I restano dichiarati
  const codici = esito.limiti_dichiarati.map((l) => l.codice);
  b.verifica('il limite di disomogeneità per circuito è a referto', codici.includes('DISOMOGENEITA_PER_CIRCUITO'));
  b.verifica('...e quello su cosa la banda NON è', codici.includes('BANDA_NON_E_PROBABILITA_DI_SORPASSO'));
}

// ── (j) il generatore è uniforme, ed è deterministico ──────────────────────
{
  const N = 200000;
  const decili = new Array(10).fill(0);
  const rnd = creaGeneratore(cancelli.seme);
  for (let i = 0; i < N; i += 1) decili[Math.min(9, Math.floor(rnd() * 10))] += 1;
  const atteso = N / 10;
  const chi2 = decili.reduce((a, x) => a + ((x - atteso) ** 2) / atteso, 0);
  // 9 gradi di libertà, soglia al 5% = 16,92. Il generatore precedente dava 170.
  b.verifica(`il generatore del test di permutazione è uniforme (chi² = ${chi2.toFixed(2)}, soglia 16,92)`, chi2 < 16.92);
  b.verifica('...e i valori stanno in [0, 1)', decili.reduce((a, x) => a + x, 0) === N);

  // determinismo: lo stesso seme dà la stessa sequenza, o l'esito non si riproduce
  const a = creaGeneratore(cancelli.seme);
  const c = creaGeneratore(cancelli.seme);
  const primi = (g) => Array.from({ length: 50 }, () => g());
  b.uguale('lo stesso seme dà la stessa sequenza', primi(a), primi(c));
  // ...e semi diversi danno sequenze diverse: un generatore che ignora il seme
  // sarebbe deterministico e inutile insieme
  b.verifica('semi diversi danno sequenze diverse',
    JSON.stringify(primi(creaGeneratore(cancelli.seme + 1))) !== JSON.stringify(primi(creaGeneratore(cancelli.seme))));

  // il p-value pubblicato viene da QUESTO generatore
  b.uguale('il p-value a referto è quello che il generatore corrente produce',
    esito.D2.alla_soglia_dichiarata.p_permutazione, d.contesto.p_permutazione);
  b.verifica('...e l\'esito tiene a referto anche quello ottenuto col generatore storto (E22)',
    /0,29527/.test(esito.D2.generatore_corretto));
}

// ── (k) LE SOSTE VERE DEI RIVALI restano un ingresso di LABORATORIO ────────
//
// `costruisciScenario` accetta `pianiRivali`: dai a ogni rivale le SUE soste vere.
// Serve a una domanda diagnostica sola (ai_lab/confronto/PREREG_sorpassi.md), ed e'
// informazione dal futuro in piena regola — al congelamento non si sa quando si
// fermeranno gli altri. Misurare la fisica a strategia nota e' lecito; PUBBLICARE
// una risposta nata da li' sarebbe E14 alla scala del prodotto.
//
// COSA FA FALLIRE QUESTO BLOCCO: qualcuno passa `pianiRivali` da un percorso che
// finisce in pagina (web/, demo/, o le risposte in scenario/). Il banco e ai_lab
// possono: e' il loro mestiere.
{
  const vietate = [
    ...elencaFile(path.join(radice, 'web')),
    ...elencaFile(path.join(radice, 'scenario')).filter((f) => !/costruttore\.mjs$/.test(f)),
    // demo/vendor/ e' fuori: e' la COPIA byte-derivata di simulatore/, prodotta da
    // trasporta_motore.mjs e sorvegliata da `--verifica` in CI. Contiene il costruttore
    // per intero, quindi contiene anche il PARAMETRO `pianiRivali` — ma contenerlo non
    // e' passarlo, ed e' esattamente la distinzione che questo blocco deve fare. Vietare
    // alla copia cio' che si permette all'originale renderebbe rossa la sentinella ogni
    // volta che il motore viene ri-trasportato, cioe' proprio quando le cose sono a posto.
    ...elencaFile(path.join(radice, '..', 'demo'))
      .filter((f) => !/\/data\//.test(f) && !/\/vendor\//.test(f)),
  ];
  const colpevoli = vietate.filter((f) => /pianiRivali/.test(readFileSync(f, 'utf8')));
  b.uguale('nessun percorso di produzione passa le soste vere dei rivali (E14)',
    colpevoli.map((f) => path.relative(radice, f)).sort(), []);

  // ...e il costruttore la dichiara come assunzione, invece di applicarla in silenzio
  const cost = readFileSync(path.join(radice, 'scenario', 'costruttore.mjs'), 'utf8');
  b.verifica('il costruttore mette a referto SOSTE_VERE_DEI_RIVALI', /SOSTE_VERE_DEI_RIVALI/.test(cost));
  b.verifica('...e la dichiara informazione dal futuro', /INFORMAZIONE DAL FUTURO/.test(cost));
}

b.chiudi();
