# Referto — la reazione dei rivali non può muovere F2 né F3, e si vede senza provare una regola

**Data: 03/08/2026.** Scritto **prima** di pre-registrare qualunque regola candidata e
prima di misurarne una. Nessuna regola nuova è stata provata: il tentativo resta
**non speso**.

---

## Il fatto

I due estremi della famiglia sono già misurati, e non sono un'opinione:

- **regola-identità** — nessun rivale reagisce mai, la configurazione con cui il motore
  gira in produzione: **48-62 alla bandiera, saldo −14**;
- **regola-oracolo** — ogni rivale riceve le sue soste vere, cioè l'informazione dal
  futuro: **57-55, saldo +2**.

Fra i due ci sono **16 punti di saldo**. Quello è **tutto** ciò che la famiglia può dare:
nessuna regola vera può superare chi conosce già le soste vere di tutti.

La domanda decisiva non è quanto vale quel divario, ma **dove cade**. Misurato oggi, con
gli strati congelati sulla configurazione identità — che nessuna regola può muovere per
costruzione — su 193 casi appaiati:

| terzile (strati congelati su identità) | n | identità | oracolo | delta di saldo |
|---|---|---|---|---|
| ne inventa **meno** del vero | 65 | 9-13 (−4) | 18-14 (+4) | **+8** |
| circa il giusto | 65 | 27-19 (+8) | 27-13 (+14) | **+6** |
| ne inventa **più** del vero — *il bersaglio di F2* | 63 | 12-30 (−18) | **12-28 (−16)** | **+2** |
| **globale** | 193 | 48-62 (−14) | 57-55 (+2) | **+16** |

> **Il 87,5 % del divario (14 punti su 16) cade nei due terzili dove il motore già vinceva.
> Al bersaglio di F2 ne arrivano 2 su 16.**

E dentro quei 2 punti non c'è nemmeno un miglioramento delle risposte giuste: le vittorie
restano **12 in entrambe le configurazioni**. Cambiano solo le sconfitte, 30 → 28.

## Le due conseguenze, e sono chiusure

**1 · F2 non è raggiungibile da questa famiglia.** F2 chiede che il terzile alto smetta di
essere significativamente peggiore del nullo. Il **soffitto** della famiglia lo lascia a
**12-28**, che è ancora una direzione netta. Una regola vera ha meno informazione
dell'oracolo, quindi atterra fra 12-30 e 12-28: **non esiste un punto d'arrivo, dentro
questa famiglia, che soddisfi F2.**

**2 · F3 non è raggiungibile da questa famiglia, per una ragione ancora più stringente:
la sua soglia È il soffitto.** F3 chiede che i due terzili bassi restino ≥ 44-27. Ma
44-27 è **il valore dell'oracolo** — le linee di base di F2 e F3 sono dichiarate, in
`KPI_5_4_4.md`, come misurate in configurazione oracolo. L'identità vale 36-32. Ogni regola
reale sta in mezzo, dunque **sotto la soglia**. La famiglia, misurata contro una linea di
base fissata al proprio soffitto, **può solo regredirla**.

## Perché questo non è una scusa, e cosa lo dimostra

Sarebbe comodo scoprire l'impossibilità di un bersaglio proprio quando si sta per mancarlo.
Tre cose lo escludono:

1. **I numeri sono pubblicati da prima.** 48-62 e 57-55 sono stampati da
   `banco_regole.mjs --regola identita|oracolo` dal 03/08 mattina, e 44-27 è la linea di
   base che `KPI_5_4_4.md` cita e che il banco riproduce in taratura. Non è stato misurato
   niente di nuovo per arrivare a questa conclusione: solo **decomposto** ciò che c'era.
2. **La decomposizione per terzile è stata verificata due volte, per vie indipendenti** —
   una durante la ricognizione, una rieseguendo la misura da capo prima di scrivere questa
   pagina. I due conteggi coincidono (8 + 6 + 2 = 16).
3. **Nessuna soglia viene toccata.** F2 e F3 restano firmate come sono. Questo referto non
   chiede di allargarle: dice che **la strada scelta per raggiungerle non ci arriva**, il
   che è un'informazione diversa e più utile di un tentativo fallito.

## Cosa NON dice, e qui sta la parte viva

**Non dice che la famiglia sia inutile.** Dice che è misurata contro il bersaglio
sbagliato. Il divario di **16 punti di saldo** è reale, ed è tutto nei due terzili sani —
cioè in una popolazione dove il motore **già funziona e potrebbe funzionare meglio**.

Ma quel confronto non è F2 né F3: è **identità → regola**, non regola → oracolo. E in
produzione il motore gira **in configurazione identità**, non oracolo: i rivali sono fermi.
Quindi la domanda vera della famiglia è

> **una regola di reazione avvicina il motore reale — quello che gira in pagina, con i
> rivali fermi — al motore che sa tutto?**

che è una **domanda di prodotto**, e vale fino a 16 punti di saldo. Va pre-registrata con
quel nome, non sotto F2/F3.

## La condizione che quella domanda deve superare per prima (F5)

Prima di provare una regola qualunque va risolto un dubbio che riguarda **anche
l'oracolo**: quanto dei 16 punti è «ho indovinato quando si fermano» e quanto è
semplicemente **«i rivali pagano il pit-loss»**? Il banco lo avverte da sempre in fondo al
posizionamento, ma nessuno l'ha ancora misurato.

Ed è misurabile **senza avere una regola candidata**, perché si può applicare il placebo di
F5 al soffitto: si fanno fermare gli stessi rivali lo stesso numero di volte, **a giri
scelti a caso**. Se l'oracolo non batte la propria controfigura, allora i 16 punti non sono
informazione sulla strategia altrui — sono aritmetica delle soste, e **l'intera famiglia è
chiusa qualunque regola le si metta dentro**.

Questa è la prossima misura, e ha la sua prereg
(`PREREG_F5_controfigure.md`). È deliberatamente il test più severo che si possa fare
per primo: **si punta al soffitto, non a un candidato**, così l'esito non dipende da
quanto era buona la regola che si è scelta.
