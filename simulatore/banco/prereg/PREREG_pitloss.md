# PREREG — PROMOZIONE DEI PIT-LOSS: dalla misura esterna alla misura interna

**Scritta il 2026-07-29, PRIMA di calcolare una sola mediana per circuito.**
Regola 3. Di numeri, finora, sono stati guardati solo quelli strutturali:
2.997 soste misurabili, 20 gare bagnate escluse, e il conteggio per Gran Premio.

## Perché questa fase esiste

Oggi ogni perdita ai box del prodotto è un **prior esterno**
(`data/priors/pitloss_priors.json`, 2.106 stop 2022-26, fonte F1 Chronicle), e
cinque gare su undici del 2026 usano il valore di ripiego d'era perché il loro
circuito non è misurato. Il prior stesso dichiara la propria subordinazione:

> «rifare la stessa misura sul fondo con banco dedicato e pre-registrazione; se
> la misura interna passa, questo file decade a cross-check; **se contraddice,
> vince la misura interna**».

Questa è quella misura. Il prior non viene cancellato: diventa cross-check.

## La misura

Identica alla metodologia che il prior dichiara per sé — così i due numeri sono
confrontabili invece di somigliarsi:

    perdita = t(in-lap) + t(out-lap) − 2 × mediana del passo pulito
              del PILOTA STESSO, adiacente alla sosta

- solo soste a **bandiera verde** (in-lap e out-lap entrambi senza 2/4/5/6, via
  `statusVerde` di provenienza) e su **gara asciutta** (nessuna gomma da bagnato
  in tutta la gara, per nessuno);
- baseline su finestre di **2, 3 e 5** giri per lato, con almeno 2 giri puliti
  per lato; **W = 3 è la primaria**, le altre servono al cancello di robustezza;
- raggruppamento per **Gran Premio**, non per circuito: il fondo porta il nome
  della gara. *Limite dichiarato*: si assume che nel 2018-2025 lo stesso GP si
  sia corso sullo stesso tracciato. Le eccezioni fuori periodo (il GP di Spagna
  che dal 2026 si sposta a Madrid) non toccano questo fondo, ma toccheranno chi
  userà il numero.

## CANCELLO A — quando un circuito viene promosso (dichiarato prima)

Un GP passa alla misura interna se e solo se tutte e tre:

1. **numerosità**: ≥ 20 soste verdi su asciutto;
2. **robustezza alla finestra**: `|mediana(W=2) − mediana(W=5)| ≤ 0,30 s` — lo
   stesso criterio che il prior dichiara di aver superato, così il confronto è
   fra pari;
3. **plausibilità fisica**: mediana fra **10 e 45 s**. Non è un confronto col
   prior: è il rifiuto di promuovere un numero che nessuna corsia box può
   produrre. Un circuito fuori da questa banda viene dichiarato **non
   misurabile su questo fondo** e tiene il prior.

## CANCELLO B — il prodotto non deve peggiorare (dichiarato prima)

Dopo la promozione, la corsa notturna non deve segnalare regressione sui
cancelli già pre-registrati in `PREREG_banco.md`: in particolare
l'accuratezza del rientro non deve peggiorare oltre le tolleranze dichiarate
(0,25 posizioni di mediana, 5 punti di quota entro ±1).

Se il banco regredisce, **la promozione si annulla**: il prior torna in vigore e
l'esito resta a referto. Un numero più "nostro" che risponde peggio non è un
progresso — è E16 al contrario.

## Cross-check col prior — riportato, NON decisivo

Sui GP dove il prior dichiara un valore misurato, si riporta la differenza
`mediana interna − prior`, calcolata sull'**era sovrapposta 2022-2025** (il
prior copre 2022-26, il fondo 2018-25: confrontare periodi diversi
confonderebbe l'era con il metodo).

Corrispondenza dichiarata prior → GP: `miami`→Miami, `silverstone`→British,
`spielberg`→Austrian, `monaco`→Monaco, `barcelona`→Spanish, `spa`→Belgian,
`imola`→Emilia_Romagna, `singapore`→Singapore, `lusail`→Qatar.

Una differenza oltre **2,0 s** si mette a referto come **discordanza** e va
spiegata nel report — ma **non impedisce la promozione**, perché il prior stesso
ha dichiarato in anticipo di cedere alla misura interna. Il verso di questa
regola è fissato adesso proprio per non poterlo scegliere dopo aver visto quale
dei due numeri è più comodo.

## Cosa succede ai circuiti non promossi

Tengono il prior, **con la targhetta invariata** (`prior esterno`), e la pagina
continua a dirlo. Nessun circuito riceve un valore "misto": o è misurato
internamente, o è prior. Mediare due fonti produrrebbe un numero senza natura,
e la regola 2 non saprebbe che targhetta dargli.

## Cosa renderebbe la fase non informativa

- Meno di 5 GP promossi: la promozione non cambierebbe abbastanza da essere
  verificabile sul banco, e si dichiara la fase **insufficiente**.
- Un cancello B che fallisce: la promozione si annulla, e va riportato quale
  circuito l'ha fatta fallire.
