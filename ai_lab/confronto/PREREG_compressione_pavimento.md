# Prereg — la compressione sotto neutralizzazione non può produrre un giro impossibile

**Data: 13/08/2026.** Scritta **prima** di eseguire una sola misura della riparazione.

Il **sintomo** è già stato misurato ed è dichiarato qui sotto al §1: è l'ingresso, non
l'esito. Cosa succeda applicando la forma proposta — se i giri impossibili spariscano, se il
verde resti fermo, se κ continui a essere consegnato, se il contro-fattuale diventi
interrogabile — **non è stato misurato**.

---

## 1 · Il sintomo, misurato il 13/08 prima di questa prereg

Rimettendo la traccia del kernel **dentro** il kernel (`demo/stato_contro.mjs`) — cosa che
nessuno aveva mai fatto, perché l'output non era mai stato un input — il Simulation Director
rifiuta con «giro verde sotto il pavimento del circuito».

| | |
|---|---|
| giri sotto il pavimento, 11 gare | **305** |
| di cui dentro una finestra SC/VSC/rossa | **305 (100%)** |
| giri sotto il pavimento nella gara **vera** | **0** |
| giri di durata **negativa** (Monaco/STR) | −7,2 s, peggiore **−16,4 s** |
| rifiuti di `rispostaLive` sul contro-fattuale | **26%** (4 gare) |

Per gara: Monaco 105 · Gran Bretagna 87 · Giappone 59 · Spagna 39 · Austria 7 · Canada 4 ·
Australia 2 · Ungheria 2 · Cina/Miami/Belgio 0.

Esempio leggibile — **Spagna, giri 61-63** (VSC): BOR, PER e OCO a **76,8–77,4 s** contro un
pavimento di **80,1 s**, che è il giro più veloce che qualcuno abbia fatto in quella gara.

## 2 · Il meccanismo, letto nel codice

`engine/kernel.mjs`, blocco «la compressione, dopo che tutti hanno percorso il giro»:

```js
const delta = (capofila.c + g * kappaDelGiro) - m.c;
m.c += delta;
if (m.ultimoGiro) m.ultimoGiro.lap_time += delta;
```

Il distacco di fine giro diventa `g·κ`. Con κ = 0,691 sotto Safety Car il distacco si contrae
del **31% per giro**, e il tempo recuperato viene sommato al **tempo sul giro** — scelta
deliberata e giusta (è la lezione GEO02: chiudere sul leader dietro la vettura di sicurezza
*è* un giro diverso, e deve comparire nel giro).

**Ciò che manca è un pavimento.** Un pilota a 60 s dal leader recupera 18,6 s in un giro, e il
suo `lap_time` diventa `t − 18,6`: sotto il minimo del circuito, e a Monaco sotto zero.

**Perché è fisicamente rovesciato.** Sotto neutralizzazione il campo si compatta perché **il
leader rallenta**, non perché gli inseguitori accelerano. Il kernel lo scrive come se
accelerassero, e senza limite. κ resta una misura buona: è il modo in cui viene *consegnato*
a essere sbagliato.

## 3 · La forma proposta — un pavimento, zero parametri liberi

```
delta = (capofila.c + g·κ) − m.c                       (come oggi)
delta = max(delta, pavimento − t_verde_del_giro)       (nuovo: non si scende sotto il minimo)
```

dove `pavimento` è il **minimo misurato del circuito** — lo stesso numero che il Director già
usa per rifiutare, e che quindi non è un parametro nuovo ma un vincolo che il progetto ha già
dichiarato. Il recupero non consumato **resta nel distacco**: non si sposta altrove, non si
spalma su altri giri, non si inventa.

Non tocco il caso in-lap/out-lap (già escluso), né il leader, né il tetto al movimento, né κ.

**Cosa questa forma NON è.** Non è una ri-misura di κ, e non pretende di essere più giusta
della fisica: è il vincolo minimo perché **il kernel non emetta ciò che il suo stesso Director
rifiuta in ingresso**. Se il pavimento morde spesso, vuol dire che κ su quei distacchi non è
consegnabile in un giro — e quello è un risultato, non un fastidio da tarare (vedi C3).

## 4 · I cancelli, dichiarati prima

**C1 — nessun giro impossibile.** Su tutte e 11 le gare, con lo stesso campione del §1:
**zero** giri sotto il pavimento e **zero** giri di durata negativa. È il punto: se fallisce,
la forma è sbagliata e si chiude qui.

**C2 — il verde non si muove.** Sulle gare **senza** alcuna finestra di neutralizzazione, e
sui giri fuori finestra di tutte le altre, i cumulati devono restare **identici al bit**. Una
sola differenza in verde significa che la riparazione è uscita dal suo perimetro: STOP.

**C3 — la compressione resta compressione.** Sui giri compressi in cui il pavimento **non**
morde, il rapporto `gap(k+1)/gap(k)` deve restare entro **±0,02** dal κ sigillato. E il
pavimento deve mordere su **meno del 30%** dei giri compressi: se morde di più, κ non è
consegnabile con questa forma e il problema è il modello, non il codice — si dichiara e si
ferma, **non si tara il pavimento**.

> **EMENDAMENTO C3, 13/08/2026 — scritto dopo aver misurato il FONDO, prima della
> riparazione.** Misurando la colonna «prima» è venuto fuori che il kernel di oggi consegna κ
> con uno scarto mediano di **0,0299**, cioè la soglia ±0,02 che avevo scritto **non la passa
> nemmeno il codice attuale**: era mal specificata, e un cancello che boccia il fondo non
> misura la riparazione. Lo dichiaro invece di spostarlo in silenzio.
>
> C3 diventa, ed è **più stretto** di quello che sostituisce:
> **(a)** sui giri in cui il pavimento non morde, i cumulati devono essere **identici al bit**
> a quelli di oggi — non entro una tolleranza: identici, perché la forma proposta lascia
> `delta` intatto quando il vincolo non lega, e se qualcosa si muove lì la forma non è quella
> che ho scritto;
> **(b)** il pavimento morde su **meno del 30%** dei giri compressi. Misurato sul fondo come
> limite superiore: **308 su 1396 = 22,1%** — la riparazione può solo ridurlo, perché alza i
> tempi e riduce i distacchi da comprimere.
>
> Il cambio riguarda il **fondo**, non l'esito, e va nella direzione severa. Se avessi
> allargato la tolleranza sarebbe stato l'opposto e non si sarebbe potuto fare.

**C4 — il contro-fattuale diventa interrogabile.** I rifiuti di `rispostaLive` sullo stato
contro-fattuale scendono **sotto il 5%** (oggi 26%, misurato su Ungheria/LEC, Spagna/VER,
Miami/NOR, Austria/HAM). È il cancello di PRODOTTO: senza, il pannello non si può spostare
sulla gara del giocatore e la riparazione non serve a niente.

**C5 — niente regressioni.** `banco/run_suite.mjs` resta con esattamente le rosse dichiarate;
i golden del motore restano verdi; i venti banchi del sito restano verdi.

## 5 · Che cosa vorrà dire l'esito

- **C1..C5 tutti verdi** → si accende. Il kernel smette di emettere l'impossibile, e il
  pannello può passare a rispondere sulla gara del giocatore.
- **C1 verde, C3 rosso** → il pavimento morde troppo: κ non si consegna in un giro su quei
  distacchi. Si dichiara NULL su questa forma e si apre una prereg sua sul **come** si
  consegna la compressione (candidata dichiarata qui per non sceglierla dopo: farla pagare al
  **leader**, che è la lettura fisica giusta, al prezzo di muovere l'ancora di tutto).
- **C2 rosso** → la riparazione tocca il verde: si annulla, qualunque cosa dicano gli altri.
- **C1 verde ma C4 rosso** → i rifiuti hanno un'altra causa oltre al pavimento: si misura
  quale prima di toccare il pannello.

## 6 · Cosa NON si farà, qualunque sia l'esito

Non si tara il pavimento, non si tocca κ, non si allarga il margine di 1,5 s del Director, e
non si sopprime il rifiuto lato pannello per far sparire il sintomo. Se la forma non passa,
passa il referto.

---

*Sigillo: questa prereg è committata **prima** della prima esecuzione della riparazione. Il
commit che la introduce non contiene modifiche a `engine/kernel.mjs`.*
