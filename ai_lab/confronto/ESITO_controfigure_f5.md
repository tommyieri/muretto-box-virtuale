# ESITO — F5: il soffitto della famiglia non batte il caso, e il perché non è il margine

**Data: 03/08/2026.** Esegue `PREREG_F5_controfigure.md`, sigillata prima dei numeri
(commit `8e1005d`). Dati: `ESITO_controfigure_f5.json`. Nessuna soglia toccata.

---

## Il verdetto

| | cancello | vero (oracolo) | finti: mediana · **p95** | esito |
|---|---|---|---|---|
| **P1** | l'oracolo batte **C-LIVELLO** (giri a caso) | **+2** | −7 · **+3** | **NON PASSA** |
| **P2** | l'oracolo batte **C-POSIZIONE** (giri di un'altra gara) | **+2** | −12 · **−5** | **PASSA** |
| P3 | quota del divario che sopravvive *(diagnostico)* | | livello **56 %** · posizione **88 %** | |

500 estrazioni ciascuna, semi 20260803 / 20260804, taratura verde (identità 48-62, oracolo
57-55). Per la regola di decisione scritta nella prereg §4:

> **La famiglia si chiude con questo numero, e NESSUNA regola candidata viene costruita.**

La candidata che la ricognizione aveva isolato — la **cascata dell'undercut**, unica
sopravvissuta ai tre filtri, a zero parametri nuovi — **non è stata implementata né
pre-registrata**. Il tentativo resta **non speso**.

## Perché il margine di un punto non è la cosa importante

P1 fallisce per **un punto di saldo** (+2 contro +3), e sarebbe disonesto non dirlo. Ma la
lettura che chiude la famiglia non è quella: è la **decomposizione per terzile**, ed è netta.

| terzile (strati congelati su identità) | identità | oracolo | divario | mediana del caso |
|---|---|---|---|---|
| ne inventa **meno** del vero | −4 | +4 | **+8** | **+5** |
| circa il giusto | +8 | +14 | **+6** | +11 |
| ne inventa **più** del vero | −18 | −16 | **+2** | −21 |

> **Dove il divario è più grande — il terzile basso, 8 punti su 16 — il caso lo cattura
> tutto, e anzi lo supera: la mediana dei tetti finti è +5, l'oracolo +4.**

Cioè: nella popolazione che contribuisce per metà al guadagno della famiglia, **sapere
quando si fermano davvero gli altri non vale niente**. Vale solo il fatto che si fermino.

L'oracolo batte il caso solo nel terzile alto (−16 contro −21) — cioè **là dove il divario
totale vale 2 punti su 16**, la popolazione in cui la famiglia non ha comunque nulla da
dare. L'informazione c'è, ed è nel posto sbagliato.

Questa lettura **non dipende dal margine di un punto**: reggerebbe identica se l'oracolo
avesse vinto P1 per due o tre punti.

## Il difetto della mia prereg, a referto e non riscritto

La sonda della cucitura riporta: le controfigure fanno arrivare al motore **3705** e
**3696** soste, l'oracolo **3639**. Le controfigure ne portano **66 in più — l'1,8 %**.

La causa è nota e strutturale: l'oracolo ha rivali che si sono fermati *prima* del
congelamento, e quelle soste il costruttore le scarta; le controfigure ridistribuiscono
**tutte** le soste dentro `(freezeLap, giroFinale)`, quindi non ne perdono nessuna.

**La clausola di validità che avevo scritto in §6(a) è a senso unico.** Dice che l'esito
sarebbe non valido *«se le controfigure ne perdessero sistematicamente di più»* — cioè
prevede solo il verso che avrebbe favorito la regola. Il verso osservato è l'opposto: sono
le controfigure a essere avvantaggiate, e **il cancello è fallito per un punto**.

Non la riscrivo (regola 3, E08): la registro. E ne registro la conseguenza onesta:

> **Con questa misura, da sola, non si può escludere che il fallimento di P1 sia un
> artefatto dell'1,8 % di soste in più concesse al caso.**

È lo stesso tipo di svista già messa a referto per la soglia di T2 e per il criterio di
contaminazione della curva dell'orizzonte. Il rimedio è quello di casa: **una prereg nuova
e datata** con la controfigura corretta e **la stessa soglia** — `PREREG_F5_bis.md` — non
una correzione applicata adesso a un numero già visto.

## Cosa questo esito NON dice — §6(b), scritto prima

**L'oracolo non è un ottimizzatore.** Dà ai rivali le soste **vere**, non quelle che
massimizzano questa metrica. La lettura corretta del NULL è:

> **la strategia vera degli altri non porta informazione utile a questa metrica**,

**non** «nessuna regola potrebbe fare meglio del caso». La differenza è reale. Ma va letta
insieme al terzile basso: là il caso **batte** la strategia vera, il che rende poco
plausibile che una regola con *meno* informazione dell'oracolo faccia meglio.

## Cosa resta acceso, e cosa no

- **F5 è registrato come strumento esistente e applicato** — che è ciò che il KPI chiede:
  F5 non è una soglia da superare, è una condizione da imporre. Vive in
  `ai_lab/confronto/regole.mjs` (le due controfigure) e `controfigure_f5.mjs` (i cancelli),
  ed è riusabile da qualunque regola futura.
- **La produzione non cambia**: resta in configurazione identità, i rivali fermi.
- **La cascata dell'undercut non è costruita.** Se un giorno la famiglia si riaprisse,
  quella è la candidata da cui ripartire: la sua definizione completa è nel referto della
  ricognizione, e il suo unico parametro (il pit-loss in verde della gara) non è nuovo.
- **Il pezzo di infrastruttura resta e vale a prescindere**: la cucitura riparata
  (`pianiRivali(gara, freezeLap, {pilota, futuro})`), la sonda proposte/arrivate, e le due
  controfigure. Il difetto che la sonda ha reso visibile — 66 soste scartate in silenzio
  anche all'oracolo — nessuno poteva vederlo prima.
