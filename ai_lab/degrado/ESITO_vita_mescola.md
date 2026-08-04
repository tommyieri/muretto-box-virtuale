# ESITO — la vita della mescola: NULL, e il motivo è l'obiettivo, non il parametro

**Data: 04/08/2026.** Esegue `PREREG_vita_mescola.md`, sigillata prima dei numeri
(commit `82ffecd`). Dati: `ESITO_cancelli_vita.json`. Nessuna soglia toccata.

---

## Il verdetto

| | cancello | esito |
|---|---|---|
| **V1** | batte il motore di oggi | **PASSA** — 35-8, p = 0,0000 · errore mediano **8 giri contro 11** |
| **V2** | batte il pavimento descrittivo | **NON PASSA** — 48-107, p = 0,0000 · errore mediano **8 contro 5** |

Per la regola di decisione scritta nella prereg §5:

> **NULL.** La vita della mescola, in questa forma, non riproduce le decisioni meglio dei
> nulli. **Il selettore mescola resta un display**, con la ragione aggiornata.

V2 non fallisce di poco: fallisce **al contrario**, e in modo massiccio. La mediana per
mescola — dodici, diciannove, ventidue giri, senza una riga di fisica — prevede la durata
di uno stint **meglio** del motore che la usa, di tre giri di errore mediano.

## Ma due cose sono state misurate per la prima volta, e cambiano il quadro

### 1 · Quanto sbaglia il motore di oggi, in numeri

Nessuno l'aveva mai quantificato:

> **Errore mediano di 11 giri sulla durata di uno stint. E in 99 casi su 167 — il 59 % —
> il piano dice «arrivi così», cioè non fermarti mai.**

È la forma numerica di *«il motore non vale niente»* su questa domanda. Non è un'opinione: è
una misura fuori campione su 167 decisioni vere.

### 2 · Il segnale della mescola passa davvero attraverso la fisica

Il termine di vita **fa quello per cui era stato costruito**:

| | motore di oggi | col termine di vita |
|---|---|---|
| errore mediano | 11 giri | **8 giri** |
| «arrivi così» (non fermarti mai) | 99 / 167 · **59 %** | **73 / 167 · 44 %** |

E V1 vince **in ogni singola gara** che produca coppie discordanti — Australia 7-0, Austria
7-2, Canada 4-2, Spagna 4-0, Ungheria 5-1, Monaco 6-3, Miami 2-0. Non è un artefatto di
Monaco, che pure pesa per il 38 % del perimetro.

## Perché allora perde contro una mediana, e qui sta la cosa da capire

Anche V2 è **uniforme al contrario**: il modello perde in quasi tutte le gare (Spagna 2-24,
Ungheria 3-18, Australia 1-8, Monaco 22-38). L'unica dove vince è l'Austria, 11-8.

La diagnosi è che **il problema non è il parametro, è l'obiettivo.**

Il pianificatore minimizza il **tempo totale di gara**, con i rivali fermi, senza traffico e
senza posizione in pista. I team si fermano per ragioni che quell'obiettivo **non contiene**:
coprire un avversario, sfruttare una neutralizzazione, non finire nel traffico, proteggere
una posizione. Un parametro comportamentale buono, fatto passare attraverso un obiettivo
sbagliato, **peggiora**: gli 8 giri di errore del modello sono il prezzo di aver tradotto
«i team si fermano a 12 giri» in «minimizza il tempo totale», e la traduzione perde.

> Il termine di vita non è stato bocciato perché la mescola non conta. È stato bocciato
> perché **il motore chiede la domanda sbagliata al parametro giusto.**

## Cosa NON si fa adesso

**Non si prova un'altra forma.** Sarebbe una prereg nuova, e la diagnosi dice che la forma
non è il problema: cambiarla significherebbe rispondere a una domanda a cui questi numeri
hanno già risposto. Se un giorno si riapre, si riapre sull'**obiettivo**.

**Non si sposta la soglia di V2** né si dichiara «V1 basta»: la prereg chiedeva entrambi, e
il motivo era esattamente evitare la circolarità che V2 ha intercettato.

**Non si accende niente.** `vita_mescola` resta assente dal modello, quindi il motore in
produzione è bit-identico a prima (`s37`).

## Cosa resta, e vale più del NULL

**La mediana per mescola è un predittore usabile oggi**: 5 giri di errore mediano fuori
campione, zero fisica, e il numero è già misurato e sigillato. Il prodotto potrebbe dire —
come **nota comportamentale dichiarata**, non come previsione del motore —

> *«su questo circuito una SOFT dura tipicamente 12 giri; tu sei al giro 15.»*

Non è il simulatore che sceglie la mescola: è il prodotto che smette di tacere su una cosa
che sa. **È una decisione del PO**, non un esito di misura, e non la prendo qui.

**E la mescola adesso arriva al motore.** Il lavoro di cablaggio — stato, sosta, passo —
resta e non è sprecato: qualunque tentativo futuro sulla mescola parte da lì invece che da
zero, e `s37` garantisce che spento non costi niente.

## I limiti dichiarati

- **167 decisioni su 376 misurabili.** Le 209 perse hanno una causa **strutturale**, non una
  scelta: al giro d'inizio del primo stint (giro 1) il motore non ha giri verdi da cui
  ricavare un passo base, quindi non può pianificare. Sono i primi stint di ogni pilota.
- **Monaco pesa il 38 %** del perimetro (63 su 167). Entrambi i verdetti sono però uniformi
  fra le gare, quindi non dipendono da lui.
- **V3 non è stato eseguito.** La regola di decisione rende l'esito NULL comunque, e
  misurare il danno alla risposta a due giri di un modello già respinto non aggiungerebbe
  niente.
- **Il modello riprodurrebbe ciò che i team decidono**, non ciò che è fisicamente ottimo. È
  il limite che la deroga imponeva di dichiarare, e vale anche per la nota comportamentale
  qui sopra.
