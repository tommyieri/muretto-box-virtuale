# 🖥️ UX & Product (`web/`)

BOX NOW, targhette, bande, la mappa che non si spegne mai.

## L'architettura, e perché è così

**La pagina non calcola.** `genera_vista.mjs` (Node) esegue `doveRientri` e
`curvaDelQuando` — che passano dal Director — e scrive `web/vista/demo.json`. I
moduli del browser leggono da lì e **formattano**. Non è pigrizia: una seconda
implementazione della fisica dentro l'interfaccia sarebbe E17 nel posto peggiore,
perché la pagina è ciò che l'utente crede. `s20` fa fallire la suite se un
modulo del browser importa dall'albero della fisica o fa aritmetica su un
coefficiente del modello.

**Con UNA deroga, dichiarata: la diretta.** In `live.html` la gara sta
succedendo, e una risposta pre-calcolata su un giro non ancora percorso non è
difficile — è impossibile. Lì il motore gira **nel browser**. Prima di
concederlo sono state pesate le alternative: il collettore che calcola e spinge
la risposta (il più bello, ma è un servizio Python che questo repo non collauda,
e si scriverebbe alla cieca il pezzo che deve reggere durante la gara) e una
funzione serverless (Vercel serve `demo/` come radice, quindi il motore andrebbe
copiato dentro `demo/` **comunque**: stesso trasporto, più un giro di rete e un
avvio a freddo nel momento peggiore).

La deroga vale sulla LETTERA, non sulla ragione. Ciò che la regola vuole
impedire è E17 — *due* fisiche per due risposte adiacenti — e quel rischio non
dipende da dove il codice gira, ma dall'esistere di due sorgenti. Qui la
sorgente resta una: `web/trasporta_motore.mjs` copia i moduli come artefatti con
manifest di hash, rifiuta di trasportare un motore che in pagina non partirebbe,
e `--verifica` esce 1 sulla deriva (la CI lo esegue). Il montaggio della
risposta è lo stesso modulo per entrambe le strade (`scenario/risposta.mjs`), e
`demo/test_parita_live.mjs` **misura** che le due risposte coincidano su una
gara vera invece di darlo per scontato. `s26` verifica che il grafo del motore
resti caricabile in pagina: un solo `import ... from 'node:fs'` lo spegnerebbe,
e ce ne si accorgerebbe col pannello vuoto durante un Gran Premio.

I componenti non toccano il DOM: restituiscono un **albero dichiarativo**, e
`render.mjs` lo disegna. È questa separazione che rende possibile l'audit del
cancello — che cammina il vero output di ogni componente su ogni scenario demo,
invece di grepparne i sorgenti.

## Le targhette (regola 2)

`targhette.mjs` non è una convenzione: `num()` **rifiuta** un valore senza
targhetta, e `creaTarghetta()` rifiuta una natura sconosciuta, una targhetta
senza data, o una banda finta `[null, null]`. Le quattro nature sono quelle di
CLAUDE.md — misurato su questa gara · misurato sul fondo · modello dichiarato ·
prior esterno — con `n` e banda dove esistono. In pagina ogni quantità è un
bottone: al tap si apre la sua targhetta.

L'audit ha una seconda lama: **un numero scritto dentro un testo è una
violazione**. `txt('Rientri P14')` passerebbe inosservato a qualunque controllo
sui tipi; qui viene trovato. L'unica via d'uscita è `cifre_dichiarate`, che
lascia la deroga scritta e leggibile (la usa «δ su 70 kg», dove il 70 è il nome
dell'unità, non una quantità).

## L'invariante animazione ↔ pannello

Il fantasma è uno **strato di proiezione completo** — tutte le auto — disegnato
sopra il reale, mai al posto suo. È una scelta di correttezza: il pannello
ordina la mia auto fra cum *previsti*, quindi una mappa che mostrasse i rivali al
reale e me proiettato darebbe un ordine diverso da quello del pannello. Cioè
l'animazione contraddirebbe il numero, che è precisamente ciò che l'invariante
vieta.

`s20` verifica su **tutte e 12 le gare demo** che la posizione calcolata dalla
mappa — ordinando i punti che sta per disegnare — sia quella del pannello. È il
`377/377` del vecchio repo, rinato. Provato per mutazione: far ordinare alla
mappa lo strato reale invece del fantasma la fa fallire subito.

La sosta si vede: al giro d'ingresso il pallino entra in corsia e ci resta per il
tempo dello stazionario, che è un **prior dichiarato** — il grezzo per-giro non
porta la durata reale della sosta, e non si inventa.

## Ciò che è visibile ma spento

Il selettore **Wet/Intermediate** è visibile e disabilitato, con la targhetta
«modello non ancora misurato». Mostrarlo attivo prometterebbe un modello che non
esiste; nasconderlo farebbe credere che la pioggia non sia prevista.

## Gap soppressi

Sotto neutralizzazione il campo si compatta: la differenza di cumulato resta un
numero, ma non è più il tempo da recuperare. Il gap esce **soppresso col
motivo** — non uno zero che sembra un risultato. La soppressione nasce in
`scenario/costruttore.mjs`, non nella grafica: è una questione di misura.
