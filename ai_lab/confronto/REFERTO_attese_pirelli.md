# Referto — l'arbitro esterno sulle soste, e cosa fa al KPI F4

**Data: 03/08/2026.** Fonte: `ai_lab/confronto/pirelli_attese_2026.json` (11 gare, ogni
citazione ri-aperta alla fonte da un verificatore diverso da chi l'aveva trovata: 11
CONFERMATE su 11, zero scartate). Metà interna: `ai_lab/confronto/ESITO_censimento_soste.json`.

Questo referto **non decide niente**. Riporta cosa dice la fonte esterna e cosa
comporta per il KPI F4, che il PO ha firmato il 03/08 *prima* che questi numeri
esistessero.

## 1 · Il quadro che cambia la diagnosi

Il censimento aveva stabilito il fatto strutturale: su 11.142 pannelli il motore propone
**mai** due soste. Detto così sembra sbagliato undici volte su undici. Con l'arbitro
esterno il quadro è un altro:

| cosa si aspettava Pirelli | gare | il motore propone |
|---|---|---|
| **1 sosta** | Australia, Cina, Giappone, Miami, Canada, Monaco, Gran Bretagna, Belgio (**8**) | 1 sosta — **d'accordo** |
| **2 soste** | Spagna, Austria (**2**) | 1 sosta — **in disaccordo** |
| **1 e 2 alla pari** | Ungheria (**1**) | 1 sosta — dentro l'attesa |

Il motore **concorda con l'attesa esterna in 8 gare su 11**. Il difetto «non propone mai
due soste» morde in **due gare**, non in undici. È una diagnosi molto più stretta di
quella da cui eravamo partiti, e restringe anche il lavoro: non serve rifare la fisica
delle gomme, serve farla arrivare dove oggi manca.

## 2 · Il caso più pulito, e quanto costa ribaltarlo

**Austria** è il bersaglio migliore che abbiamo. Pirelli si aspettava due soste, e il
resoconto post-gara dice che **nessun pilota** ha fatto una sosta sola: *«a one-stop
strategy was not viable»*, con 17 piloti su 20 a due soste e tre a tre. Il motore lì
propone una sosta, e il suo piano a due soste perde di **+12,6 s** — il secondo deficit
più basso della stagione.

**Spagna**: Pirelli dava «due come minimo, la terza non esclusa», la realtà ha visto da
due a quattro soste, il motore propone una, e il deficit è **+15,1 s**.

Quindi la struttura importata non deve ribaltare i +17,4 s mediani di tutte le gare:
deve ribaltarne **12,6 e 15,1** nelle due gare che contano. È un bersaglio più piccolo e
molto più definito.

## 3 · Il KPI F4 è misurabile, ma il suo denominatore è due

F4 dice: *«il piano propone due soste in almeno 1 gara su 3 fra quelle in cui la fonte
esterna se le aspettava»*. Ora sappiamo che quelle gare sono **due** (Spagna e Austria),
tre se si conta l'Ungheria come caso limite.

Con un denominatore di due o tre, «1 su 3» significa: **basta azzeccarne una**. Il KPI è
onesto — è stato scritto e firmato prima di sapere quanto sarebbe stato grande
l'insieme — ma la sua potenza statistica è quella che è, e va detto adesso e non dopo:

> **Un F4 superato con 1 gara su 2 non dimostra che il modello delle gomme è giusto.**
> Dimostra che in un caso ha cambiato risposta nella direzione giusta. Perché voglia dire
> di più servono le gare che arrivano: Olanda, Italia, Madrid e le altre nove del 2026
> non sono ancora corse, e ognuna aggiunge una riga a questo denominatore.

Il PO decida se: (a) lasciare F4 com'è, sapendo che è un indizio e non una prova;
(b) affiancargli una condizione su Austria come caso singolo dichiarato; (c) rimandare il
giudizio a quando il denominatore sarà ≥5 gare. **Non è una decisione mia**, e cambiare
la soglia adesso senza dichiararlo sarebbe E08.

## 4 · Due correzioni a cose che avevo scritto io

**(a) La riga della Gran Bretagna era letta male, ed era la mia riga più enfatica.**
Il censimento diceva: «in Gran Bretagna tutti e 22 i piloti si sono fermati almeno due
volte, e lì il motore ne propone una». Il resoconto Pirelli dice perché: *«two
neutralisations in the closing stages forced all drivers to make at least two pit
stops»*. Il piano era **una sosta** — Pirelli il sabato la dava *«around 13 seconds
quicker than a two-stop»* — e le seconde soste sono una conseguenza, non una strategia.
La Gran Bretagna non è la prova che il motore sbaglia: è una gara in cui il motore
**concorda** con l'attesa.

**(b) Il mio rilevatore di contaminazione ha mancato la Gran Bretagna per 0,8 punti.**
Marcavo come sospetta una gara con ≥40% delle soste nell'ultimo quinto; la Gran Bretagna
sta al **39,2%**. La soglia del 40% l'avevo scelta io, senza evidenza.

**Non la sposto.** Spostare una soglia perché non ha catturato il caso che ora so essere
vero è esattamente il modo in cui una soglia smette di essere una misura. La lezione è
un'altra, e vale oltre questo caso: **la contaminazione la dichiara meglio la fonte
esterna del mio euristico**. Il resoconto post-gara di Pirelli dice «due neutralizzazioni
hanno costretto tutti a fermarsi» in modo esplicito e senza soglie da tarare. Il campo
`sospetta_neutralizzazione` del censimento resta come segnale grezzo e dichiarato tale;
l'arbitro è questo file.

## 5 · Cosa resta fuori, dichiarato

- **Undici gare del 2026 non sono ancora corse** (dall'Olanda in poi): per quelle non
  esiste attesa Pirelli pubblicabile né una gara con cui confrontarla.
- **Madrid non è Spagna.** Il 2026 ha due gare spagnole: Barcellona (round 7, in questa
  tabella) e Madrid (round 14, non ancora corsa). La riga «Spagna» **non vale** per
  Madrid.
- **I delta fra mescole quasi non esistono nella fonte primaria.** Pirelli pubblica
  finestre e numero di soste, non secondi al giro per mescola. L'unico delta attribuito a
  Pirelli in tutta la tabella è quello del Giappone (0,5-0,6 s fra C2 e C3) e il
  verificatore avverte che viene da **run di prestazione, non di passo gara**: usarlo
  come delta di passo sarebbe un'estensione che la fonte non sostiene. I delta di Monaco
  (Medium +0,30, Hard +0,51) vengono da una fonte di rango 2.
  **Conseguenza pratica**: l'idea di importare «gli offset per mescola pubblicati da
  Pirelli» va ridimensionata — quei numeri, nella forma che serve al motore, in buona
  parte **non sono pubblicati**. Chi apre la prereg delle mescole lo sappia prima.
