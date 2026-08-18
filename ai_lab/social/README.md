# La fabbrica dei contenuti Instagram

Genera i post del Muretto **dai dati veri delle gare**, con la stessa disciplina
del resto del progetto: ogni cifra viene da `demo/data/**` e porta stampata sotto
la propria provenienza.

Piano editoriale e strategia: vedi l'artifact *«Rotta per Monza»* (17/08/2026).

## Le regole, non negoziabili

1. **Nessun numero scritto a mano.** Un `Fatto` senza `provenienza` non è
   pubblicabile — `Fatto.valido()` lo dice e i formati si rifiutano di disegnarlo.
2. **Il cancello umano non si apre da solo.** A differenza della redazione (che dal
   25/07/2026 ha una politica di auto-pubblicazione), qui **non esiste** e non deve
   esistere. Un articolo sbagliato sul sito si corregge; un post sbagliato è già
   negli screenshot di qualcuno dieci minuti dopo.
3. **Le soste sotto neutralizzazione non sono strategia.** Filtrate via: erano il
   difetto n.1 del primo rilevatore (vedi sotto).
4. **Niente font veri, niente post.** `genera()` si ferma se mancano: un post in
   Arial non è un post del Muretto.

## La catena

```
demo/data/**  ──fatti.py──►  Fatto  ──formati/──►  immagine
                               │                       │
                               └──didascalia.py──►  testo (+ cancello sulle cifre)
                                                       │
                                                    bozze/
                                                       │
                              coda.py --approva --attore "Tommi"
                                                       │
                              pubblica.py --conferma  ──►  Instagram
```

`wave_social()` in `auto_gara.py` chiama `genera` dopo ogni gara e committa le
bozze da sé (gira per ultima: se non committasse, le bozze scritte sul VPS non
arriverebbero mai sul Mac).

## Comandi

```bash
python3 -m ai_lab.social.genera --gara Belgio      # bozze da una gara
python3 -m ai_lab.social.genera --tutte            # da tutte le gare in archivio
python3 -m ai_lab.social.coda --lista              # cosa c'è in coda
python3 -m ai_lab.social.coda --mostra <id>        # testo, immagini, provenienza
python3 -m ai_lab.social.coda --approva <id> --attore "Tommi"
python3 -m ai_lab.social.pubblica --id <id>            # prova a vuoto: mostra e basta
python3 -m ai_lab.social.pubblica --id <id> --conferma # pubblica davvero
python3 -m ai_lab.social.reel Belgio /tmp/reel      # il video verticale
```

## I file

| file | cosa fa |
|---|---|
| `marca.py` | colori (**letti da `demo/muro.css`**, non ribattuti), font, misure |
| `tela.py` | il motore d'impaginazione: crenatura estesa, a-capo, componenti |
| `fatti.py` | i rilevatori: sosta decisiva, compagni, mescole, numeri, classifica |
| `formati/` | un modulo per tipo di post |
| `didascalia.py` | testo e hashtag, col cancello sulle cifre |
| `genera.py` | orchestratore: fatti → bozze |
| `coda.py` | il cancello umano |
| `pubblica.py` | Graph API. Legge `IG_TOKEN`/`IG_USER_ID` dall'ambiente, non li stampa mai |
| `reel.py` | fotogrammi + codifica ffmpeg |
| `font/` | Barlow, Barlow Condensed, JetBrains Mono (OFL, gli stessi del sito) |

## Due difetti trovati coi dati alla mano, e come sono chiusi

**Le soste sotto Safety Car.** Il primo rilevatore trovava «OCO si ferma al giro 2:
5 posizioni guadagnate» a Spa e «RUS al giro 67: 10 posizioni perse» a Monaco.
Guardando i dati: in tutti e due i casi **erano neutralizzate tutte le auto in
pista** (22/22 e 16/16), e a Monaco Russell si ferma pure due volte in tre giri.
Non erano colpi di strategia, erano soste gratis dietro la SC. Ora `sosta_decisiva`
richiede regime verde alla sosta *e* per tutta la finestra di giudizio, e lo scrive
nella provenienza. Col filtro, i guadagni scendono da 5-10 posizioni a **una**: che
è la verità, ed è la tesi del progetto.

**La gomma «durata 1 giro».** Lo stesso difetto usciva dalla parte delle mescole:
«la morbida è durata da 1 a 14 giri». Quell'1 era la stessa Safety Car del primo
giro a Spa. Contando solo i cambi in regime verde: 11-14 giri (morbida), 14-20
(media), 15-31 (dura).

## Il pubblicatore, in breve

Instagram non accetta byte: vuole un **URL pubblico** da cui scaricarsi l'immagine.
Quindi `prepara()` copia in `demo/social/`, e il post esce solo **dopo** che il
deploy ha messo l'immagine online. È lo stesso confine del resto del progetto —
portare online = merge su `main` — e rende impossibile pubblicare qualcosa che non
sia anche tracciato in git.

Servono un account Instagram **Professionale** collegato a una Pagina Facebook,
un'app Meta e un token a lunga scadenza. Il token non va mai incollato in una chat
né in un comando in chiaro: vale la lezione del 14/08/2026 sulla chiave Anthropic.

## La correzione editoriale del 18/08/2026

Direttiva del PO, e ribalta la gerarchia dei formati: **i post devono presentare
il prodotto, non insegnare la Formula 1.** «Fermarsi ai box a Spa costa 18,40
secondi» è vero, misurato, e non interessa a nessuno.

Quindi:

- `numero_del_progetto` è **fuori rotazione** (`FUORI_ROTAZIONE` in `fatti.py`).
  La funzione resta: quei numeri sono buoni *dentro* un altro post, non come post.
- Il formato di punta è **`scelta`**: «lo fermi adesso o fra tre giri?», con la
  risposta del **motore di produzione** — `motore.mjs` chiama `doveRientri`, lo
  stesso che risponde nella pagina-gara e nella hero. Stessa gomma, stesso
  pit-loss, stessi rivali: cambia solo il momento.
- Il formato **`presentazione`** dice cos'è il Muretto a chi arriva da un reel.
- **`demo_video.py`** registra il **sito vero** in un browser vero mentre
  risponde. Non è una ricostruzione: se cambia il sito, cambia il video.

La promessa non si allarga mai: il motore dice **dove rientri, non se conviene**.
Quella parte resta a chi guarda — è il prodotto, non una scommessa.

```bash
node ai_lab/social/motore.mjs Ungheria      # cerca i casi dove il momento conta
python3 -m ai_lab.social.lancio             # bio + i primi tre post
python3 -m ai_lab.social.demo_video         # il video del sito vero
python3 -m ai_lab.social.marchio            # logo: SVG per il sito, PNG per IG
```
