# Cosa devi fare TU — GP d'Olanda, 21-23/08/2026

**Riscritto il 17/08/2026.** *La versione precedente era del 22/07 e organizzava il weekend
d'Ungheria: un documento che dava istruzioni per un giovedì passato da tre settimane, con
scadenze in grassetto e ⏰ accanto. La pagella del 13/08 aveva ragione a chiamarli «memoria
stantia»: un documento operativo scaduto non è neutro, dice cose false con l'aria di essere
urgente. Le procedure che valgono sempre sono qui sotto; quelle chiuse (il merge, il VPS 58
commit indietro, le chiavi di sessione dell'Ungheria) le tiene la storia di git.*

**Attenzione: Zandvoort è un weekend SPRINT.** Non ci sono FP2 e FP3 — solo la FP1, poi
sprint quali, sprint, qualifiche, gara.

---

## ⏰ La sequenza

| quando (ora italiana) | cosa | quanto | se salta |
|---|---|---|---|
| **appena puoi** | **ruotare la chiave API Anthropic** | 5 min | la chiave in uso è compromessa da stanotte |
| **mer 19/08 dopo le 17:00 → ven 21/08 entro le 12:30** | rinnovare il token F1TV | 2 min | venerdì non si registra |
| **ven 21/08, 12:20** | lanciare la registrazione (FP1 12:30) | 1 min | il weekend non ha replay |
| **sab 22/08, 11:50 e 15:50** | registrazione sprint e qualifiche | 1 min | |
| **dom 23/08, 14:45** | lanciare la registrazione della gara | 1 min | perdiamo la gara |

---

## 1. 🔴 Ruotare la chiave API — e stavolta il problema non è `.zshrc`

**Il fallback in `.zshrc` non c'è più**: ho verificato, zero chiavi in chiaro, resta solo la
funzione `chiave-on` che legge `~/.muretto_env`. Quella parte è chiusa.

**Ma la rotazione del 15/08 è già scaduta.** La chiave che sta adesso in `~/.muretto_env` sul
Mac è finita **in chiaro dentro la trascrizione di un agente il 17/08 alle 03:04**: un agente
ha letto i tuoi dotfile e ne ha stampato il contenuto nel proprio log. Non è servito a niente
non esportarla — **è bastato che fosse leggibile nella home.**

E le due macchine non sono allineate: il VPS ha una **chiave diversa**, del 10/08. Che sia
ancora valida non lo so, e non l'ho provato: i giri della redazione di oggi non hanno chiamato
l'LLM (nessuna bozza da scrivere), quindi il log non dimostra nulla.

**Cosa devi fare tu** — in console Anthropic, perché io non posso e non devo:

1. crea una chiave nuova e **revoca** quella attuale;
2. scrivila in `~/.muretto_env` sul Mac (`chmod 600`);
3. scrivi **la stessa** sul VPS:

```bash
ssh muretto@167.233.236.186 'chmod 600 ~/.muretto_env && nano ~/.muretto_env'
```

> **Non incollare la chiave in una chat con un agente, mia inclusa, e non lanciare comandi che
> la contengono in chiaro.** È così che è uscita la volta scorsa: il 14/08 il comando `ssh ...
> echo "export ANTHROPIC_API_KEY=..."` è finito in una trascrizione, e la chiave con lui.

**La cosa che resta da decidere, e non è mia**: dove tenere il segreto. Un file a 600 nella tua
home è al riparo dagli altri utenti, non dagli agenti che giri tu — hanno i tuoi permessi. Le
due strade sensate sono il **keychain di macOS** (l'agente deve chiedere, e tu vedi la
richiesta) oppure **tenere la chiave solo sul VPS**, che è la macchina che pubblica e su cui
non girano agenti. La seconda è gratis e chiude il problema alla radice: sul Mac la redazione
non gira più da luglio.

## 2. 🟡 Il token F1TV — mercoledì sera o giovedì, non prima

L'abbonamento è attivo; è il **token in cache** che dura **96 ore esatte**. Uno preso lunedì
muore prima della gara.

> **Finestra buona: da mercoledì 19/08 alle 17:00 a venerdì 21/08 alle 12:30** (ora italiana).
> Prima di mercoledì sera muore durante la gara; dopo venerdì mezzogiorno arrivi tardi per la FP1.

**Passo 1** — apri il Terminale (Cmd+Spazio → `Terminale`).

**Passo 2** — incolla e premi Invio:

```bash
python3 -c "from fastf1.internals.f1auth import get_auth_token; get_auth_token()"
```

**Passo 3** — il Terminale scrive `Subscription token is invalid. Please re-authenticate.`
**È giusto**: è il vecchio che viene buttato. Poi stampa un indirizzo tipo
`https://f1login.fastf1.dev?port=54321` — **il numero cambia ogni volta**, usa quello tuo.

**Passo 4** — copia quell'indirizzo nel browser e accedi con l'account **F1 TV Access**.

## 3. 🟡 Registrare le sessioni — sul Mac, non sul VPS

Qualche minuto prima di ogni sessione:

```bash
cd ~/muretto && .venv/bin/python live/record_session.py
```

Lascia la finestra aperta. Si ferma da sola a fine sessione. Se il feed cade, riparte da sola
su un file nuovo (`_part2`, `_part3`).

| sessione | ora italiana | lancia alle |
|---|---|---|
| FP1 | ven 21/08 **12:30** | 12:20 |
| Sprint quali | ven 21/08 **16:30** | 16:20 |
| Sprint | sab 22/08 **12:00** | 11:50 |
| Qualifiche | sab 22/08 **16:00** | 15:50 |
| **Gara** | dom 23/08 **15:00** | **14:45** |

**Perché il Mac e non il VPS**: `livetiming.formula1.com` risponde 403 agli IP dei datacenter.
Dal Mac (IP di casa) funziona.

> **Due cose da guardare stavolta, e sono nuove.** (a) Se una registrazione si spezza in
> `_part2`, **dimmelo**: il buco *fra* due parti oggi non viene misurato da nessuno, e in
> Ungheria ci abbiamo perso nove giri senza saperlo (`live/REPORT_RIATTIVAZIONE.md`, §2.1).
> (b) Lascia il Mac **acceso e non in stop** fino a fine sessione: il cron della telemetria
> salta le ore in cui dorme — nel log di stanotte c'è un buco fra 06:30 e 13:30.

## 4. Cosa NON aspettarti questa domenica

**Il pannello live resta sul replay.** `live/` non è riattivato, e il motivo è preciso: il
modulo prende per buona una coordinata di parcheggio del feed — in Ungheria il **90,5 %** dei
campioni GPS nei box sta su una costante che non è `(0,0,0)` e quindi passa il filtro. Finché
non è pre-registrato il rimedio, la mappa non si accende. Referto completo in
[`live/REPORT_RIATTIVAZIONE.md`](live/REPORT_RIATTIVAZIONE.md).

Quello che **funziona ed è provato fuori campione**: decodifica, replay end-to-end e
ricostruzione di SC/VSC, su un circuito nuovo e su una registrazione in due parti.

**Se piove, il sistema si zittisce.** I coefficienti si misurano sulle sole gomme da asciutto:
sotto la pioggia smettono di aggiornarsi e restano all'ultimo valore asciutto. È un limite
dichiarato, non un guasto da segnalare.

## 5. ✅ Le macchine — controllate oggi, non serve nulla da te

| | Mac | VPS |
|---|---|---|
| checkout | `96bd392`, allineato | `96bd392`, allineato |
| cron | telemetria ogni 30 min, **gira** (ultimo giro 13:30) | `auto_gara` ogni 30 min + redazione a :15/:45, **girano** |
| crontab = file versionato | — | ✅ `verifica_crontab.sh` VERDE |
| s46 (freschezza codice) | verde a ogni giro | verde a ogni giro |
| deploy esterno | ✅ i byte online sono quelli di `main` | ✅ idem |

**Una cosa era rotta e l'ho riparata**: sul VPS `auto_run.sh` non si aggiornava più da solo dal
**10/08** — 343 giri in sette giorni fermi al codice di quel giorno. Non si era visto perché il
checkout restava fresco *per merito di un altro cron* (la redazione, che usa la forma giusta del
comando). Ora è allineato ai due wrapper gemelli e **s46 sorveglia anche questo caso**.

---

## Il minimo indispensabile, se hai poco tempo

1. **Adesso**: ruota la chiave API e allinea il VPS (§1). È l'unica voce rossa.
2. **Mercoledì sera o giovedì**: rinnova il token F1TV (§2).
3. **Domenica 14:45**: lancia `record_session.py` (§3). Se puoi, anche venerdì e sabato.

Il resto gira da solo, e stavolta l'ho verificato sulle macchine invece di fidarmi dei log.
