"""
agenti.py — i mestieri della redazione che parlano con il modello, e il cavo che li
collega all'API.

TRE MESTIERI, NON SEI. La letteratura sui sistemi multi-agente e' netta su due punti
e li abbiamo presi sul serio: aggiungere ruoli peggiora la resa (una catena a cinque
ruoli misurata contro un solo prompt diretto perde 30-40 punti percentuali), e
scambiarsi CRITICHE in JSON fra ruoli peggiora piu' che scambiarsele in prosa —
mentre i DATI in JSON migliorano moltissimo (−69% di errori fattuali nel data-to-text
sportivo rispetto agli stessi dati in prosa). Quindi:

  · i FATTI viaggiano in JSON, dentro tag XML;
  · le CRITICHE viaggiano in italiano;
  · i mestieri sono tre, e il quarto passaggio (la revisione) e' lo stesso mestiere
    di chi ha scritto, richiamato solo SE il correttore ha trovato qualcosa.

  1. CAPOSERVIZIO  pianifica()  — non scrive una riga di prosa. Sceglie la tesi, la
     forma, il peso, l'attacco, la chiusa, e quali fatti TACERE.
  2. FIRMA         scrivi()     — scrive. Riceve i fatti e il piano, non la prosa
     precedente da parafrasare (era il difetto del vecchio redattore: gli si
     ordinava «stesso ordine, stessi tag, migliore stile», e la freddezza restava
     nel prompt).
                   rivedi()     — stesso mestiere, richiamato con l'elenco delle
     violazioni. E' revisione GUIDATA da checklist, non auto-critica: la ricerca
     dice che la seconda non funziona senza un oracolo esterno. Qui l'oracolo e'
     stile.py, che non e' un modello.
  3. CENSORE       verifica()   — modello DIVERSO da chi ha scritto (regola
     Anthropic per il giudizio) e CIECO al piano: vede solo i fatti e la prosa, e
     prova a smentirla. Se vedesse il piano copierebbe l'errore invece di trovarlo.

NIENTE E' SILENZIOSO. Ogni chiamata finisce in diario/<id>.jsonl con modello, token,
cache, durata e esito. Il difetto piu' grave del sistema precedente non era che
l'LLM scrivesse male: era che quando falliva nessuno poteva accorgersene, perche'
`except Exception: return articolo` riportava al template senza dire niente. Da
luglio a oggi non e' andata a buon fine UNA sola riscrittura, e non c'e' una riga di
log che lo dica.

Credenziali: `ANTHROPIC_API_KEY` oppure il profilo `ant auth login` raccolto
dall'SDK. Sotto cron le esporta scheduling/auto_articoli_run.sh.
"""
from __future__ import annotations
import os
import re
import json
import time
import hashlib
import datetime

import voce

_QUI = os.path.dirname(os.path.abspath(__file__))
DIARIO = os.path.join(_QUI, "diario")

# Modelli. Chi scrive e chi giudica devono essere DIVERSI: e' l'unica mitigazione di
# bias che Anthropic prescrive esplicitamente per il grading a modello.
MODELLO_SCRITTURA = os.environ.get("MURETTO_MODELLO_SCRITTURA", "claude-opus-5")
MODELLO_GIUDICE = os.environ.get("MURETTO_MODELLO_GIUDICE", "claude-sonnet-5")
# Se il modello scelto non esiste sull'account, si ricade su questi, in ordine.
RIPIEGHI = ["claude-opus-4-8", "claude-sonnet-4-6"]

# L'effort NON si cambia fra chiamate: e' reso dentro il prompt, quindi cambiarlo
# butta la cache del prefisso (la guida di stile e' ~9k token: si paga due volte).
EFFORT = "high"
TIMEOUT_S = 300.0
TENTATIVI = 3


class ErroreAgente(RuntimeError):
    """Un mestiere non ha potuto fare il suo lavoro. Porta sempre la ragione: chi
    la cattura decide se ripiegare, ma deve poterla scrivere nel log."""


# ----------------------------------------------------------------- il cavo ----

def disponibile():
    """Vero se si puo' davvero chiamare l'API. Attenzione: `anthropic.Anthropic()`
    si costruisce anche SENZA credenziali e alza solo alla prima richiesta — per
    questo la vecchia `redattore.disponibile()` diceva True in ambienti senza
    chiave. Qui si controlla che una credenziale ci sia davvero."""
    try:
        import anthropic  # noqa: F401
    except Exception:
        return False
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    for p in ("~/.anthropic/credentials.json", "~/.config/anthropic/credentials.json"):
        if os.path.exists(os.path.expanduser(p)):
            return True
    return False


def _client():
    import anthropic
    return anthropic.Anthropic(timeout=TIMEOUT_S, max_retries=0)


def _sistema(guida=True, coda=None):
    """I blocchi di system. La guida di stile e' il primo blocco e porta il
    breakpoint di cache: ~9k token che, riletti, costano un decimo."""
    blocchi = []
    if guida:
        blocchi.append({"type": "text", "text": voce.testo_completo(),
                        "cache_control": {"type": "ephemeral", "ttl": "1h"}})
    if coda:
        blocchi.append({"type": "text", "text": coda})
    return blocchi


def _diario(id_, riga):
    os.makedirs(DIARIO, exist_ok=True)
    riga["quando"] = datetime.datetime.now().isoformat(timespec="seconds")
    with open(os.path.join(DIARIO, f"{id_ or 'senza-id'}.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(riga, ensure_ascii=False) + "\n")


def chiama(ruolo, sistema, utente, modello, schema=None, max_tokens=16000, id_=""):
    """Una chiamata, con ritentativi, diario e nessun fallimento muto.

    Ritorna il testo, oppure — se c'e' uno schema — l'oggetto gia' validato
    dall'API (structured outputs: decodifica vincolata, non un `json.loads` col
    dito incrociato come faceva il vecchio `re.search(r'\\[.*\\]')`)."""
    if not disponibile():
        raise ErroreAgente("nessuna credenziale Anthropic (ANTHROPIC_API_KEY o profilo SDK)")
    import anthropic
    client = _client()
    kw = dict(model=modello, max_tokens=max_tokens, system=sistema,
              messages=[{"role": "user", "content": utente}])
    oc = {"effort": EFFORT}
    if schema is not None:
        oc["format"] = {"type": "json_schema", "schema": schema}
    kw["output_config"] = oc

    modelli = [modello] + [m for m in RIPIEGHI if m != modello]
    ultimo = None
    for m in modelli:
        kw["model"] = m
        for tent in range(1, TENTATIVI + 1):
            t0 = time.time()
            try:
                msg = client.messages.create(**kw)
            except Exception as e:
                ultimo = e
                nome = type(e).__name__
                _diario(id_, {"ruolo": ruolo, "modello": m, "esito": "errore",
                              "tipo": nome, "dettaglio": str(e)[:300], "tentativo": tent})
                if nome in ("NotFoundError", "BadRequestError") and "model" in str(e).lower():
                    break                                   # modello assente: si ripiega
                if nome in ("AuthenticationError", "PermissionDeniedError"):
                    raise ErroreAgente(f"credenziali rifiutate: {e}") from e
                if tent == TENTATIVI:
                    break
                time.sleep(2 ** tent)
                continue
            testo = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            u = msg.usage
            _diario(id_, {"ruolo": ruolo, "modello": m, "esito": str(msg.stop_reason),
                          "secondi": round(time.time() - t0, 1),
                          "in": u.input_tokens, "out": u.output_tokens,
                          "cache_scritta": getattr(u, "cache_creation_input_tokens", 0),
                          "cache_letta": getattr(u, "cache_read_input_tokens", 0),
                          "impronta_voce": voce.impronta()})
            if msg.stop_reason == "refusal":
                raise ErroreAgente(f"{ruolo}: la richiesta e' stata rifiutata dal modello")
            if msg.stop_reason == "max_tokens":
                raise ErroreAgente(f"{ruolo}: risposta troncata a {max_tokens} token")
            if schema is None:
                return testo
            try:
                return json.loads(testo)
            except Exception as e:
                raise ErroreAgente(f"{ruolo}: JSON non valido nonostante lo schema: {e}") from e
    raise ErroreAgente(f"{ruolo}: nessun modello disponibile ({type(ultimo).__name__}: "
                       f"{str(ultimo)[:200]})")


# ------------------------------------------------------------------ schemi ----
# Gli schemi sono CONGELATI: cambiarli invalida la cache della grammatica (24h) e
# quella del prompt. Si toccano solo con una ragione.

SCHEMA_PIANO = {
    "type": "object",
    "additionalProperties": False,
    "required": ["tesi", "confutabile_da", "conseguenza", "forma", "peso",
                 "attacco", "chiusa", "titolo", "occhiello", "sommario",
                 "sezioni", "taciuti"],
    "properties": {
        "tesi": {"type": "string",
                 "description": "L'affermazione confutabile del pezzo, una frase."},
        "confutabile_da": {"type": "string",
                           "description": "La misura che la smentirebbe."},
        "conseguenza": {"type": "string",
                        "description": "Che cosa cambia adesso. 'Niente' e' una risposta valida, purche' argomentata."},
        "forma": {"type": "string",
                  "enum": ["anomalia", "contro-narrazione", "duello",
                           "ritratto-di-un-numero", "verifica", "nulla-di-fatto"]},
        "peso": {"type": "string", "enum": ["breve", "standard", "lungo"]},
        "attacco": {"type": "string",
                    "enum": ["aspettativa-incrinata", "numero-solitario",
                             "due-macchine-identiche", "assenza", "paradosso",
                             "regola-come-personaggio", "contro-narrazione",
                             "domanda-del-lettore"]},
        "chiusa": {"type": "string",
                   "enum": ["ritorno", "conseguenza", "verifica", "limite", "scena"]},
        "titolo": {"type": "string"},
        "occhiello": {"type": "string"},
        "sommario": {"type": "string",
                     "description": "Due o tre frasi che PROMETTONO, non riassumono."},
        "numero_chiave": {"type": "string",
                          "description": "Il numero attorno a cui gira il pezzo, come va scritto."},
        "scala_umana": {"type": "string",
                        "description": "La traduzione del numero chiave in qualcosa che un corpo umano immagina."},
        "sezioni": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["tag", "titolo", "compito", "fatti"],
                "properties": {
                    "tag": {"type": "string",
                            "description": "L'etichetta della sezione, che il lettore VEDE stampata sopra il testo. Iniziale maiuscola, due o tre parole, descrittiva: 'Il confronto', 'Dove si separano'. Mai una parola sola in minuscolo."},
                    "titolo": {"type": "string"},
                    "compito": {"type": "string",
                                "description": "Che cosa deve fare questa sezione, in una frase. Non e' il testo."},
                    "fatti": {"type": "array", "items": {"type": "string"},
                              "description": "I campi del dossier che questa sezione usa."},
                    "figura": {"type": "string",
                               "description": "La chiave della figura gia' esistente da tenere qui, se ce n'e' una."}
                }
            }
        },
        "taciuti": {"type": "array", "items": {"type": "string"},
                    "description": "I fatti veri che il pezzo NON dira', e perche'. Tacere e' una scelta editoriale."}
    }
}

SCHEMA_PROSA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["sezioni"],
    "properties": {
        "sezioni": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["tag", "titolo", "html"],
                "properties": {
                    "tag": {"type": "string"},
                    "titolo": {"type": "string"},
                    "html": {"type": "string",
                             "description": "Solo <p>...</p>, con <b> per i valori che contano. Nient'altro."}
                }
            }
        }
    }
}

SCHEMA_CENSORE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["problemi"],
    "properties": {
        "problemi": {
            "type": "array",
            "items": {
                "type": "object", "additionalProperties": False,
                "required": ["tipo", "citazione", "perche"],
                "properties": {
                    "tipo": {"type": "string",
                             "enum": ["numero-inventato", "causa-spacciata-per-misura",
                                      "grandezza-non-nel-feed", "superlativo-non-dimostrato",
                                      "contraddizione", "caveat-mancante",
                                      "regolamento-sbagliato", "fonte-non-citata"]},
                    "citazione": {"type": "string", "description": "Le parole esatte del pezzo."},
                    "perche": {"type": "string"},
                    "gravita": {"type": "string", "enum": ["blocca", "segnala"]}
                }
            }
        }
    }
}


# ---------------------------------------------------------- 1. caposervizio ----

_ISTRUZIONI_PIANO = """Sei il caposervizio di Muretto. Non scrivi prosa: decidi il pezzo.

Ricevi il DOSSIER (i fatti gia' misurati, in JSON) e la MEMORIA della redazione (che
cosa abbiamo gia' fatto negli ultimi pezzi). Restituisci il PIANO.

Il tuo lavoro e' fare quattro scelte che chi scrive non deve rifare:
1. la TESI, che dev'essere confutabile: qualcuno con altri dati deve poterla
   smentire, e tu dichiari con quale misura;
2. la FORMA, che non puo' essere una di quelle sature indicate dalla memoria;
3. il PESO, che segue l'importanza sportiva del fatto e non la quantita' di dati
   disponibili: un fatto minore merita un pezzo breve, anche se abbiamo cento numeri;
4. che cosa TACERE. Un dossier ha piu' fatti di quanti ne stiano in un articolo.
   Scegliere quali lasciare fuori e' la meta' del mestiere: elencali, col perche'.

Il piano vincola chi scrive. Ogni sezione dice che cosa deve FARE, non che cosa deve
dire: se scrivi tu le frasi, hai fatto il lavoro di un altro.

Se il dossier non basta per una tesi confutabile, dillo scegliendo la forma
`nulla-di-fatto`: un risultato nullo e' un articolo legittimo e a volte il migliore
della settimana."""


def pianifica(dossier, memoria_txt, id_=""):
    utente = (f"<dossier>\n{json.dumps(dossier, ensure_ascii=False, indent=1)}\n</dossier>\n\n"
              f"<memoria>\n{memoria_txt}\n</memoria>\n\n"
              "Restituisci il piano.")
    return chiama("caposervizio", _sistema(coda=_ISTRUZIONI_PIANO), utente,
                  MODELLO_SCRITTURA, SCHEMA_PIANO, max_tokens=8000, id_=id_)


# ------------------------------------------------------------------ 2. firma ----

_ISTRUZIONI_FIRMA = """Sei chi scrive, a Muretto. La guida qui sopra e' la tua legge.

Ricevi il DOSSIER (i fatti, in JSON) e il PIANO (le scelte gia' fatte dal
caposervizio). Scrivi la prosa delle sezioni e nient'altro.

Non discutere il piano: la tesi, la forma, il peso, il tipo di attacco e il tipo di
chiusa sono decisi. Tu scegli le parole.

Quattro cose che ti riguardano piu' di tutte:
- Ogni numero che scrivi deve stare nel dossier. Nessuna eccezione, nemmeno per
  arrotondare verso una cifra piu' bella. Se un numero ti serve e non c'e', la frase
  va scritta senza.
- Il ritmo si vede. Frasi lunghe e frasi corte, dentro l'argomentazione e non solo in
  fondo al paragrafo.
- Il markup e' minimo: paragrafi <p>, e <b> soltanto sui pochi valori che il lettore
  deve ricordare. Niente liste, niente titoli, niente markdown.
- La lunghezza la decide il peso dichiarato nel piano. Non allungare per riempire, e
  non aggiungere una sezione di riepilogo: qui non esistono.

Rispondi direttamente col JSON delle sezioni, senza preamboli."""


def scrivi(dossier, piano, id_=""):
    utente = (f"<dossier>\n{json.dumps(dossier, ensure_ascii=False, indent=1)}\n</dossier>\n\n"
              f"<piano>\n{json.dumps(piano, ensure_ascii=False, indent=1)}\n</piano>\n\n"
              "Scrivi le sezioni previste dal piano, nello stesso ordine e con gli "
              "stessi tag.")
    return chiama("firma", _sistema(coda=_ISTRUZIONI_FIRMA), utente,
                  MODELLO_SCRITTURA, SCHEMA_PROSA, max_tokens=16000, id_=id_)


_ISTRUZIONI_REVISIONE = """Sei chi ha scritto il pezzo, e il correttore te lo ha
rimandato indietro con l'elenco delle violazioni.

Il correttore non e' un modello: e' aritmetica. Ha contato, non interpretato. Quando
dice che una frase ha 61 parole, ne ha 61; quando dice che un numero non e' nei
fatti, non c'e'. Non discutere i rilievi: correggili.

Regole della correzione:
- Cambia solo quello che serve a chiudere i rilievi. Non riscrivere le parti sane:
  ogni riscrittura non richiesta e' un'occasione in piu' di introdurre un errore.
- Non risolvere un rilievo creandone un altro. Se tagli una frase lunga in due,
  controlla di non aver prodotto due frasi della stessa lunghezza.
- Se un rilievo riguarda un numero non tracciabile, la correzione e' toglierlo o
  sostituirlo con un numero che esiste nel dossier. Mai inventare la fonte.
- Restituisci TUTTE le sezioni, anche quelle che non hai toccato, nello stesso
  ordine e con gli stessi tag."""


def rivedi(dossier, piano, sezioni, rilievi, id_=""):
    utente = (f"<dossier>\n{json.dumps(dossier, ensure_ascii=False, indent=1)}\n</dossier>\n\n"
              f"<piano>\n{json.dumps(piano, ensure_ascii=False, indent=1)}\n</piano>\n\n"
              f"<pezzo>\n{json.dumps({'sezioni': sezioni}, ensure_ascii=False, indent=1)}\n</pezzo>\n\n"
              f"<rilievi>\n{rilievi}\n</rilievi>\n\n"
              "Correggi il pezzo e restituisci tutte le sezioni.")
    return chiama("revisione", _sistema(coda=_ISTRUZIONI_REVISIONE), utente,
                  MODELLO_SCRITTURA, SCHEMA_PROSA, max_tokens=16000, id_=id_)


# ---------------------------------------------------------------- 3. censore ----

_ISTRUZIONI_CENSORE = """Sei il censore di Muretto. Non conosci il piano del pezzo,
non sai come e' stato costruito, e non e' un tuo problema: hai davanti i FATTI e il
TESTO, e il tuo mestiere e' provare a smentirlo.

Cerchi sei cose, e solo quelle:
1. numeri inventati: che non stanno nei fatti e non si ricavano con un'aritmetica
   elementare dai fatti. NON segnalare arrotondamenti, differenze, percentuali,
   conversioni di unita', anni, conteggi;
2. una causa spacciata per misura: la telemetria dice DOVE cambia il tempo, non
   PERCHE'. «Ha piu' carico» non e' misurato, «all'apice porta 7 km/h in piu'» si';
3. grandezze che non stanno nel nostro feed QUANTIFICATE come se le misurassimo:
   energia, erogazione elettrica, stato di carica, mescola, carburante a bordo,
   temperature. Attenzione al verso: parlarne e' lecito e anzi doveroso — «e'
   compatibile con una gestione dell'energia» va bene, «recupera 0,4 MJ» no. Segnala
   il numero, non il vocabolo;
4. superlativi e assoluti non dimostrati («il piu' veloce di sempre», «nessuno lo
   fa»), a meno che il fatto sia nei dati;
5. contraddizioni interne, e caveat mancanti dove il confronto e' sporco: tempi di
   qualifica presentati come griglia, giri sotto neutralizzazione letti come passo,
   stint di mescole diverse confrontati, libere prese per buone senza dire che il
   carburante e' ignoto;
6. errori di regolamento 2026: DRS, MGU-H, beam wing, X-mode/Z-mode non esistono.

Segnala TUTTO quello che trovi, anche i dubbi: filtrare tocca a un altro passaggio.
Ma non inventare problemi per avere qualcosa da dire: se il pezzo e' pulito,
restituisci una lista vuota. Ogni problema porta le parole esatte del testo."""


def censura(sezioni, facts, id_=""):
    corpo = "\n\n".join(f"[{s.get('tag')}] {s.get('titolo')}\n{s.get('html')}"
                        for s in sezioni)
    utente = (f"<fatti>\n{json.dumps(facts or {}, ensure_ascii=False, indent=1)}\n</fatti>\n\n"
              f"<testo>\n{corpo}\n</testo>\n\n"
              "Elenca i problemi reali.")
    # niente guida di stile: il censore giudica la verita', non lo stile, e un
    # prompt piu' corto e' anche una cache diversa che non vale la pena scrivere.
    return chiama("censore", [{"type": "text", "text": _ISTRUZIONI_CENSORE}], utente,
                  MODELLO_GIUDICE, SCHEMA_CENSORE, max_tokens=4000, id_=id_)
