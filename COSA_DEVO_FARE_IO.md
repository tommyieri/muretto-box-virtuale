# Cosa devi fare TU per vedere i grossi in live

*Scritto 22/07/2026. Tutto il resto è fatto. Qui c'è solo quello che richiede le tue mani,
il tuo account o la tua firma — in ordine di scadenza.*

---

## ⏰ La sequenza, in una tabella

| quando | cosa | quanto | se salta |
|---|---|---|---|
| **giovedì 23/07** | rinnovare il token F1TV | 2 min | venerdì non si registra |
| **giovedì 23/07** | dire sì o no al merge del branch | 5 min | domenica gira il codice vecchio |
| **venerdì 24/07, 11:30 UTC** | lanciare la registrazione sul Mac | 1 min | la gara di domenica non ha replay |
| **venerdì 24/07, a sessione aperta** | un `curl` (te lo lancio io se sei al PC) | 30 s | non sappiamo se il live è possibile |
| **domenica 26/07, 12:45 UTC** | lanciare la registrazione della gara | 1 min | perdiamo la gara |

---

## 1. 🔴 Rinnovare il token F1TV — GIOVEDÌ, non oggi

L'abbonamento **è attivo**. È il *token in cache* a essere scaduto il 20/07, e dura
**esattamente 96 ore**. Uno preso oggi muore domenica a metà gara.

> **Fallo giovedì.** La finestra buona va da mercoledì 17:00 a venerdì 13:30 (ora italiana).

**Passo 1** — apri il Terminale (Cmd+Spazio → `Terminale`).

**Passo 2** — incolla e premi Invio:

```bash
python3 -c "from fastf1.internals.f1auth import get_auth_token; get_auth_token()"
```

**Passo 3** — il Terminale scrive `Subscription token is invalid. Please re-authenticate.`
**È giusto**: è il vecchio che viene buttato. Poi stampa un indirizzo tipo
`https://f1login.fastf1.dev?port=54321` — **il numero cambia ogni volta**, usa quello tuo.

**Passo 4** — copia quell'indirizzo nel browser e accedi con l'account **F1 TV Access**.

> ⚠️ **Non chiudere il Terminale** mentre fai il login: sta aspettando lì.

**Passo 5** — nel Terminale deve comparire `Sign-in successful.`

**Passo 6** — controlla (facoltativo ma consigliato):

```bash
python3 -c "from fastf1.internals.f1auth import print_auth_status; print_auth_status()"
```

La scadenza deve essere **lunedì 27 luglio**. Se cade **prima di domenica alle 15:00 UTC**,
hai rinnovato troppo presto: rifallo il giorno dopo.

| se vedi | fai |
|---|---|
| `No module named fastf1` | usa `/opt/homebrew/bin/python3` al posto di `python3` |
| resta fermo senza stampare niente | `Ctrl+C` e ricomincia dal passo 2 |
| `requires an active F1TV subscription` | l'abbonamento non risulta attivo: da guardare su F1 TV |

**Solo sul Mac.** Sul VPS quel comando aspetta un browser che non c'è e resta appeso per
sempre — è il motivo per cui il collettore non lo usa.

---

## 2. 🔴 Il merge — la decisione che sblocca tutto

**Il VPS l'ho aggiornato io** (vedi §5): era 58 commit indietro, ora è allineato a `main`.

Ma **tutto il lavoro di oggi è sul branch `claude/f1-live-strategy-analysis-cb6770`**, non su
`main`. Finché non lo mergi:

- il VPS **non ha** i cinque grossi
- il VPS **non ha** la riparazione della gara orfana
- il sito su Vercel mostra il pannello vecchio

**Cosa cambia per chi guarda il sito** — è per questo che serve una tua firma, non un merge
tecnico:

| | prima | dopo |
|---|---|---|
| pit-loss | tabella di circuito | misurato oggi, con n soste |
| gomma nuova | non c'era | misurata oggi |
| undercut | «in sviluppo» | quanti giri servono + tasso storico |
| degrado | solo scenari | anche il numero, letto dalle soste |
| box della squadra | non c'era | scostamento della squadra |
| duelli | il motore incollava le auto | **il motore non simula più il duello, e lo dice** |

L'ultima riga è un **cambio di promessa**: senza il cap due auto possono attraversarsi. In
pagina c'è scritto *«il motore riproduce quanti cambi di posizione avvengono, non quali»*.
Se questa frase non ti va bene, si torna indietro cambiando **una variabile**
(`CAP_TRAFFICO = true` in `demo/gara.html`).

> **Il merge fa deploy su Vercel al push su `main`.** Non c'è staging.

---

## 3. 🟡 Venerdì — la registrazione (FP1 alle 11:30 UTC = 13:30 italiane)

Sul **Mac**, qualche minuto prima:

```bash
cd ~/muretto && .venv/bin/python live/record_session.py
```

Lascia la finestra aperta. Si ferma da sola a fine sessione. Se il feed cade, riparte da
sola su un file nuovo (`_part2`, `_part3`).

**Perché serve il Mac e non il VPS**: `livetiming.formula1.com` risponde 403 agli IP dei
datacenter. Dal Mac (IP di casa) funziona.

---

## 4. 🟡 Venerdì a sessione aperta — la verifica che decide il live

Una riga sola, e vale il resto del progetto:

```bash
curl -s 'https://api.openf1.org/v1/stints?session_key=11335' | head -c 400
```

- **risponde con dati** → il piano OpenF1 copre il realtime, il pannello live è possibile
- **risponde vuoto o errore** → il live resta torre + mappa, e il pannello resta sul replay

Le chiavi di sessione dell'Ungheria le ho già prese:
**FP1 11335 · FP2 11336 · FP3 11337 · Quali 11338 · Gara 11342**

Se sei al PC scrivimi e lo lancio io.

---

## 5. ✅ Il VPS — fatto io, oggi

| | |
|---|---|
| prima | `02d2393`, **58 commit indietro** |
| adesso | `ac3c7d8`, **0 commit indietro** |
| servizio | `active`, riavviato e verificato |
| `/status` | connesso, token OpenF1 valido, 0 fallimenti |
| disco | 32,9 GB liberi su 37,2 |

Ho controllato **prima** di aggiornare che il runtime del collettore non cambiasse: dei 183
file toccati, in `live/` cambiava **solo un file di test**. Requirements invariati.
Poi ho provato sul VPS i dodici generatori di laboratorio mai girati lassù (`numpy 2.5.1`,
`pandas 2.3.3` presenti) e la catena completa a vuoto: **exit 0**.

**Punto di ritorno**, se qualcosa andasse storto:

```bash
ssh muretto@167.233.236.186 'cd ~/muretto && git reset --hard 02d23934cfc30f0ef4d03e75680e19bb8e580587 && sudo systemctl restart muretto-live'
```

### ⚠️ Una cosa che resta rotta lassù, e serve il merge

La crontab del VPS lancia `auto_gara.py` **direttamente**, saltando `scheduling/auto_run.sh`
— cioè saltando il `git pull` che ho aggiunto. Risultato: **il VPS non si aggiorna mai da
solo**, va aggiornato a mano come ho fatto oggi.

La riparazione è sul branch e ha bisogno del merge, perché `auto_run.sh` deve prima imparare
a usare il venv giusto (`.venv-auto`, non `python3`). Dopo il merge la crontab va cambiata
così — **una riga, e la faccio io quando dici**:

```
*/30 * * * * flock -n /home/muretto/muretto/data/.auto_gara.lock /home/muretto/muretto/scheduling/auto_run.sh
```

---

## 6. Domenica — la gara (13:00 UTC = 15:00 italiane)

Stesso comando del venerdì, lanciato verso le **12:45 UTC**:

```bash
cd ~/muretto && .venv/bin/python live/record_session.py
```

**Cosa succede domenica**, secondo il piano concordato:

- il sito mostra **torre + mappa + bandiere** in diretta
- il **pannello pit resta sul replay** delle gare passate
- si **registra tutto**, e lunedì si fa lo shadow-run sulla registrazione

Il pannello live debutta al GP successivo, con un cancello deciso il venerdì sera e non la
domenica alle 13.

---

## 7. Due cose da sapere per domenica, senza fare niente

**L'Ungheria non ha una banda SOFT.** Se un pilota monta gomma morbida, gli scenari di
degrado **non compaiono** (non mostrano zero: spariscono). È il comportamento giusto, ma se
lo vedi non è un guasto.

**Se piove, il sistema si zittisce.** I coefficienti si misurano sulle sole gomme da
asciutto: sotto la pioggia smettono di aggiornarsi e restano all'ultimo valore asciutto. Il
2026 ha **14 giri su 11.302** in intermedia: non abbiamo materiale per validare il bagnato,
e questo è un limite dichiarato, non un bug da segnalare.

---

## Il minimo indispensabile, se hai poco tempo

1. **Giovedì**: rinnova il token (§1). Senza, venerdì non si registra.
2. **Giovedì**: dimmi sì o no al merge (§2).
3. **Domenica 12:45 UTC**: lancia `record_session.py` (§6).

Il resto lo faccio io.
