# Prereg — i sette giri, scomposti: è il numero di soste o è il giro?

**Data: 05/08/2026.** Scritta **prima** di aver scomposto un solo errore.

**Non è un cambio di modello.** Non si accende niente, non si stima niente, non si spedisce
niente. È una **diagnosi**, e la sola cosa che va decisa prima è **come si legge il
risultato** — perché una diagnosi letta dopo aver visto i numeri è un racconto.

---

## 1 · Il fatto da spiegare

Una tabella di **tre numeri** — SOFT 12, MEDIUM 19, HARD 22, la mediana per mescola, senza
una riga di fisica — prevede la durata di uno stint con **5 giri** di errore mediano. Il
motore, con kernel, degrado, carburante, rodaggio, pit-loss per circuito, traffico e tetto,
ne fa **7**.

È misurato fuori campione su 167 decisioni vere (`ESITO_vita_mescola.md`, cancello V2:
48-107, p = 0,0000) e nessuno l'ha più toccato.

Le tre cause che la diagnosi del PO indicava sono state chiuse tutte e tre, e insieme hanno
mosso l'errore **di un giro**:

| voce | esito | effetto |
|---|---|---|
| il traffico | chiusa | 8 → 7 giri |
| i rivali fermi | NULL | mediana ferma |
| l'obiettivo è il tempo | inerte al 97 % | mediana ferma |

Quindi la causa **non è nessuna delle tre**, e questo lo sappiamo per misura. Restano due
possibilità, e non sono state mai separate.

## 2 · Le due possibilità, e perché la distinzione decide il lavoro dei prossimi giorni

Un piano è due scelte, non una: **quante volte fermarsi** (`k`) e **a quale giro**.

- Se l'errore è nel **`k`**, la fisica del passo è sana e il difetto sta nel confronto fra
  0/1/2/3 soste — cioè nella forma chiusa e nel pit-loss, che decidono quale `k` vince.
- Se l'errore è nel **giro dato `k`**, la fisica è il problema: il motore sa quante volte
  fermarsi e sbaglia comunque quando.

Le due curano cose opposte. Oggi si spende su entrambe alla cieca.

## 3 · I tre bracci, e costano una sola esecuzione

`pianoOttimo` già valuta **tutti** i `k` da `kMinimo` a 3 e li restituisce in `per_k`. Quindi
non serve rieseguire niente: i bracci si leggono dalla stessa chiamata.

| | braccio | cos'è |
|---|---|---|
| **A** | **libero** | il piano che il motore sceglie davvero — il prodotto di oggi |
| **B** | **`k` imposto** | il piano del motore **al numero di soste VERO**, letto da `per_k` |
| **C** | **pavimento** | la tabella di tre numeri: `vita[mescola]`, leave-one-race-out |

**`k` vero** = quante soste ha fatto davvero quel pilota da questo giro alla bandiera,
contate sugli stint conclusi da una sosta (`stintConclusi`, non filtrati per mescola: una
sosta è una sosta anche se monta l'intermedia).

**B non è un oracolo travestito da modello.** Riceve UN'informazione dal futuro — il numero
di soste — e nient'altro: il giro se lo sceglie da solo, con la sua fisica. È esattamente
la domanda «se ti dicessi quante volte ti fermi, sapresti dirmi quando?», e serve a
misurare quanto della colpa sta nella prima scelta. **B non è un candidato alla produzione**
e non lo diventerà: nessun prodotto conosce il numero di soste in anticipo.

## 4 · La metrica

Errore assoluto in **giri** fra la durata prevista del primo stint e quella vera, per
decisione. Mediana. Confronti **appaiati** sulle stesse decisioni.

Il perimetro è quello del banco delle decisioni: le 167 misurabili. Le altre 209 restano
fuori per la ragione strutturale già a referto — al giro 1 non ci sono giri verdi da cui
ricavare un passo — e si contano, non si nascondono.

## 5 · La regola di lettura, scritta adesso

Sia `Δ` = mediana(A) − mediana(B), cioè quanti giri si guadagnano regalando al motore il
numero di soste giusto.

| | | conclusione |
|---|---|---|
| **Δ ≥ 2 giri** | il `k` spiega la maggior parte | **il difetto è la SCELTA DI QUANTE SOSTE.** Si lavora su forma chiusa e pit-loss, non sul passo |
| **Δ ≤ 0,5 giri** | il `k` non spiega quasi niente | **il difetto è il GIRO DATO `k`**, cioè la fisica del passo |
| **in mezzo** | condiviso | si riporta la ripartizione e si sceglie il ramo più grande, dichiarando che è parziale |

**E un terzo esito è possibile**, va scritto prima: se **anche B** resta peggio del pavimento
C, allora conoscere il numero di soste non basta, e il problema non è in nessuna delle due
scelte del piano — è che il motore non sa prevedere le decisioni dei team, punto. Sarebbe il
risultato più importante dei tre, perché chiuderebbe la domanda invece di spostarla.

## 6 · Cosa si riporta comunque, qualunque sia Δ

1. **La matrice di confusione `k` motore × `k` vero.** Se il motore dice 1 quando la verità è
   2 nella maggior parte dei casi, la forma del difetto si vede lì prima che in una mediana.
2. **Quante decisioni hanno il `k` vero disponibile in `per_k`** — se il `k` vero supera 3
   (`kMax`) o se a quel `k` non esisteva un piano valido, il caso esce da B e si conta.
3. **La quota di «arrivi così»** nei tre bracci.

## 7 · Cosa NON si fa

- Non si tocca `kMax`, la forma chiusa, il raggio di ricerca, il pit-loss.
- Non si accende niente e non si spedisce niente: qualunque sia l'esito, la conseguenza è
  una **prereg nuova** sul ramo che questa diagnosi indica.
- Non si guarda la matrice di confusione prima di aver fissato Δ. È già fissato qui sopra.

---

**Sigillo.** Committata prima di aver letto un solo errore scomposto.
