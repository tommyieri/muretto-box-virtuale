# Mappa della conoscenza — Muretto AI Lab

*Generata dal Knowledge Extractor. Deterministica: stessi dossier, stessa mappa.*
*Nessun LLM coinvolto. I collegamenti sono co-occorrenze misurate, mai causali.*

- dossier letti: **6** (saltati: 0)
- osservazioni: **36** · fenomeni: **11** · collegamenti: **65** · ipotesi: **0**
- motore: `sha256:d2bee2dca871`

## Fenomeni

La confidenza sale con la **replicazione su circuiti diversi**, non con la dimensione dell'effetto. Un fenomeno visto su una sola gara resta `basso`: è in-sample.

> **Cosa misura la confidenza:** quanto l'osservazione si **ripete** fra circuiti — non quanto la causa è capita. Un `non_classificabile` può essere `ALTO`: significa che il residuo ricompare ovunque, **non** che sappiamo perché.

| fenomeno | componente | mescola | circuiti | effetto (s/giro) | confidenza | natura | manca per salire |
|---|---|---|---|---|---|---|---|
| `FEN-degrado-HARD` | degrado | HARD | Australia, Belgio, Gran Bretagna, Miami, Spagna | +1.065 | **ALTO** | meccanismo candidato: degrado, non ancora validato | — |
| `FEN-degrado-SOFT` | degrado | SOFT | Australia, Belgio, Monaco, Spagna | +0.981 | **ALTO** | meccanismo candidato: degrado, non ancora validato | — |
| `FEN-non_classificabile-HARD` | non_classificabile | HARD | Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna | +0.905 | **ALTO** | osservazione riproducibile SENZA meccanismo identificato: la confidenza riguarda la ripetibilita', non la spiegazione | — |
| `FEN-degrado-MEDIUM` | degrado | MEDIUM | Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna | +0.584 | **ALTO** | meccanismo candidato: degrado, non ancora validato | — |
| `FEN-non_classificabile-SOFT` | non_classificabile | SOFT | Belgio, Miami, Spagna | +0.421 | **MEDIO** | osservazione riproducibile SENZA meccanismo identificato: la confidenza riguarda la ripetibilita', non la spiegazione | un terzo circuito concorde per salire ad "alto" |
| `FEN-traffico-MEDIUM` | traffico | MEDIUM | Australia | +0.626 | **BASSO** | meccanismo candidato: traffico, non ancora validato | una misura su un circuito diverso da Australia per passare da in-sample a replicato |
| `FEN-non_classificabile-MEDIUM` | non_classificabile | MEDIUM | Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna | +0.554 | **CONTESA** | osservazione riproducibile SENZA meccanismo identificato: la confidenza riguarda la ripetibilita', non la spiegazione | un esperimento che spieghi perche' il segno si inverte fra circuiti |
| `FEN-traffico-SOFT` | traffico | SOFT | Australia | +0.489 | **BASSO** | meccanismo candidato: traffico, non ancora validato | una misura su un circuito diverso da Australia per passare da in-sample a replicato |
| `FEN-traffico-HARD` | traffico | HARD | Belgio | +0.333 | **BASSO** | meccanismo candidato: traffico, non ancora validato | una misura su un circuito diverso da Belgio per passare da in-sample a replicato |
| `FEN-rumore-HARD` | rumore | HARD | Monaco | — | **NULLO** | assenza di effetto: il motore regge entro il rumore | — |
| `FEN-rumore-MEDIUM` | rumore | MEDIUM | Australia, Belgio | — | **NULLO** | assenza di effetto: il motore regge entro il rumore | — |

## Conflitti aperti

Segni opposti fra circuiti. La mappa **registra e non media**.

- `FEN-non_classificabile-MEDIUM` — osservazioni di segno opposto su circuiti diversi: la mappa registra il conflitto e NON lo media (circuiti: Australia, Belgio, Gran Bretagna, Miami, Monaco, Spagna)

## Ripetizioni fra gare diverse

È il meccanismo che fa crescere la conoscenza: lo stesso fenomeno ricompare altrove.

- **FEN-degrado-HARD** · `OSS-Australia-degrado-HARD` ↔ `OSS-Belgio-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +1.092 s/giro; Belgio +1.014 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Australia-degrado-HARD` ↔ `OSS-GranBretagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +1.092 s/giro; Gran Bretagna +0.605 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Australia-degrado-HARD` ↔ `OSS-Miami-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +1.092 s/giro; Miami +1.065 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Australia-degrado-HARD` ↔ `OSS-Spagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +1.092 s/giro; Spagna +1.230 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Belgio-degrado-HARD` ↔ `OSS-GranBretagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +1.014 s/giro; Gran Bretagna +0.605 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Belgio-degrado-HARD` ↔ `OSS-Miami-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +1.014 s/giro; Miami +1.065 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Belgio-degrado-HARD` ↔ `OSS-Spagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +1.014 s/giro; Spagna +1.230 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-GranBretagna-degrado-HARD` ↔ `OSS-Miami-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.605 s/giro; Miami +1.065 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-GranBretagna-degrado-HARD` ↔ `OSS-Spagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.605 s/giro; Spagna +1.230 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-HARD** · `OSS-Miami-degrado-HARD` ↔ `OSS-Spagna-degrado-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Miami +1.065 s/giro; Spagna +1.230 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-Belgio-degrado-MEDIUM` ↔ `OSS-GranBretagna-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.440 s/giro; Gran Bretagna +0.727 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-Belgio-degrado-MEDIUM` ↔ `OSS-Miami-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.440 s/giro; Miami +0.384 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-Belgio-degrado-MEDIUM` ↔ `OSS-Spagna-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.440 s/giro; Spagna +1.394 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-GranBretagna-degrado-MEDIUM` ↔ `OSS-Miami-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.727 s/giro; Miami +0.384 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-GranBretagna-degrado-MEDIUM` ↔ `OSS-Spagna-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.727 s/giro; Spagna +1.394 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-MEDIUM** · `OSS-Miami-degrado-MEDIUM` ↔ `OSS-Spagna-degrado-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Miami +0.384 s/giro; Spagna +1.394 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-SOFT** · `OSS-Belgio-degrado-SOFT` ↔ `OSS-Monaco-degrado-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +1.798 s/giro; Monaco +0.634 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-SOFT** · `OSS-Belgio-degrado-SOFT` ↔ `OSS-Spagna-degrado-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +1.798 s/giro; Spagna +0.981 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-degrado-SOFT** · `OSS-Monaco-degrado-SOFT` ↔ `OSS-Spagna-degrado-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Monaco +0.634 s/giro; Spagna +0.981 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Australia-non_classificabile-HARD` ↔ `OSS-Belgio-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +0.874 s/giro; Belgio +0.841 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Australia-non_classificabile-HARD` ↔ `OSS-GranBretagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +0.874 s/giro; Gran Bretagna +0.624 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Australia-non_classificabile-HARD` ↔ `OSS-Miami-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +0.874 s/giro; Miami +1.137 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Australia-non_classificabile-HARD` ↔ `OSS-Monaco-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +0.874 s/giro; Monaco +0.937 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Australia-non_classificabile-HARD` ↔ `OSS-Spagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Australia +0.874 s/giro; Spagna +1.358 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Belgio-non_classificabile-HARD` ↔ `OSS-GranBretagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.841 s/giro; Gran Bretagna +0.624 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Belgio-non_classificabile-HARD` ↔ `OSS-Miami-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.841 s/giro; Miami +1.137 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Belgio-non_classificabile-HARD` ↔ `OSS-Monaco-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.841 s/giro; Monaco +0.937 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Belgio-non_classificabile-HARD` ↔ `OSS-Spagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.841 s/giro; Spagna +1.358 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-GranBretagna-non_classificabile-HARD` ↔ `OSS-Miami-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.624 s/giro; Miami +1.137 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-GranBretagna-non_classificabile-HARD` ↔ `OSS-Monaco-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.624 s/giro; Monaco +0.937 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-GranBretagna-non_classificabile-HARD` ↔ `OSS-Spagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.624 s/giro; Spagna +1.358 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Miami-non_classificabile-HARD` ↔ `OSS-Monaco-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Miami +1.137 s/giro; Monaco +0.937 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Miami-non_classificabile-HARD` ↔ `OSS-Spagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Miami +1.137 s/giro; Spagna +1.358 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-HARD** · `OSS-Monaco-non_classificabile-HARD` ↔ `OSS-Spagna-non_classificabile-HARD`  
  stesso componente e stessa mescola su circuiti diversi (Monaco +0.937 s/giro; Spagna +1.358 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-Belgio-non_classificabile-MEDIUM` ↔ `OSS-GranBretagna-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.417 s/giro; Gran Bretagna +0.554 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-Belgio-non_classificabile-MEDIUM` ↔ `OSS-Miami-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.417 s/giro; Miami +0.621 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-Belgio-non_classificabile-MEDIUM` ↔ `OSS-Spagna-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.417 s/giro; Spagna +1.570 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-GranBretagna-non_classificabile-MEDIUM` ↔ `OSS-Miami-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.554 s/giro; Miami +0.621 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-GranBretagna-non_classificabile-MEDIUM` ↔ `OSS-Spagna-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Gran Bretagna +0.554 s/giro; Spagna +1.570 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-MEDIUM** · `OSS-Miami-non_classificabile-MEDIUM` ↔ `OSS-Spagna-non_classificabile-MEDIUM`  
  stesso componente e stessa mescola su circuiti diversi (Miami +0.621 s/giro; Spagna +1.570 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-SOFT** · `OSS-Belgio-non_classificabile-SOFT` ↔ `OSS-Miami-non_classificabile-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.345 s/giro; Miami +0.421 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-SOFT** · `OSS-Belgio-non_classificabile-SOFT` ↔ `OSS-Spagna-non_classificabile-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Belgio +0.345 s/giro; Spagna +1.422 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara
- **FEN-non_classificabile-SOFT** · `OSS-Miami-non_classificabile-SOFT` ↔ `OSS-Spagna-non_classificabile-SOFT`  
  stesso componente e stessa mescola su circuiti diversi (Miami +0.421 s/giro; Spagna +1.422 s/giro), stesso segno, entrambi sopra il rumore della rispettiva gara

## Mancate repliche e divergenze

- *divergenza* — **FEN-non_classificabile-MEDIUM**: stesso componente e stessa mescola ma segno OPPOSTO: Australia -1.284 s/giro contro Belgio +0.417 s/giro
- *divergenza* — **FEN-non_classificabile-MEDIUM**: stesso componente e stessa mescola ma segno OPPOSTO: Australia -1.284 s/giro contro Gran Bretagna +0.554 s/giro
- *divergenza* — **FEN-non_classificabile-MEDIUM**: stesso componente e stessa mescola ma segno OPPOSTO: Australia -1.284 s/giro contro Miami +0.621 s/giro
- *divergenza* — **FEN-non_classificabile-MEDIUM**: stesso componente e stessa mescola ma segno OPPOSTO: Australia -1.284 s/giro contro Spagna +1.570 s/giro
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Australia (-0.297 s/giro, nullo) e Belgio (+0.440 s/giro, debole): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Australia (-0.297 s/giro, nullo) e Gran Bretagna (+0.727 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Australia (-0.297 s/giro, nullo) e Miami (+0.384 s/giro, debole): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Australia (-0.297 s/giro, nullo) e Monaco (-0.363 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Australia (-0.297 s/giro, nullo) e Spagna (+1.394 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Belgio (+0.440 s/giro, debole) e Monaco (-0.363 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Gran Bretagna (+0.727 s/giro, marcato) e Monaco (-0.363 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Miami (+0.384 s/giro, debole) e Monaco (-0.363 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-MEDIUM**: FEN-degrado-MEDIUM misurato in Monaco (-0.363 s/giro, nullo) e Spagna (+1.394 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-SOFT**: FEN-degrado-SOFT misurato in Australia (+0.066 s/giro, nullo) e Belgio (+1.798 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-SOFT**: FEN-degrado-SOFT misurato in Australia (+0.066 s/giro, nullo) e Monaco (+0.634 s/giro, debole): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-degrado-SOFT**: FEN-degrado-SOFT misurato in Australia (+0.066 s/giro, nullo) e Spagna (+0.981 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-non_classificabile-MEDIUM**: FEN-non_classificabile-MEDIUM misurato in Australia (-1.284 s/giro, marcato) e Monaco (-0.221 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-non_classificabile-MEDIUM**: FEN-non_classificabile-MEDIUM misurato in Belgio (+0.417 s/giro, debole) e Monaco (-0.221 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-non_classificabile-MEDIUM**: FEN-non_classificabile-MEDIUM misurato in Gran Bretagna (+0.554 s/giro, debole) e Monaco (-0.221 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-non_classificabile-MEDIUM**: FEN-non_classificabile-MEDIUM misurato in Miami (+0.621 s/giro, marcato) e Monaco (-0.221 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-non_classificabile-MEDIUM**: FEN-non_classificabile-MEDIUM misurato in Monaco (-0.221 s/giro, nullo) e Spagna (+1.570 s/giro, marcato): in almeno una gara l'effetto resta dentro il rumore
- *non_replicato* — **FEN-rumore-MEDIUM**: FEN-rumore-MEDIUM misurato in Australia (-0.232 s/giro, nullo) e Belgio (-0.053 s/giro, nullo): in almeno una gara l'effetto resta dentro il rumore

## Ipotesi raccolte dai dossier

Nessuna ipotesi presente nei dossier letti. Motivi per dossier:

- `AUD-AUSTRA-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata
- `AUD-BELGIO-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata
- `AUD-GRANBR-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata
- `AUD-MIAMI-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata
- `AUD-MONACO-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata
- `AUD-SPAGNA-20260721-01`: dossier in modalita' deterministica: nessuna ipotesi formulata

*Le ipotesi sono riportate verbatim dai dossier: il Knowledge Extractor non le giudica e non ne deriva confidenza.*

## Limiti dichiarati

- le osservazioni vengono dalle stesse gare che alimentano i coefficienti del progetto: la replicazione qui e' fra circuiti, NON fuori campione
- un fenomeno "non_classificabile" resta tale: l'estrattore non scioglie ambiguita' che la misura non ha sciolto
- osservazioni con versioni diverse del motore non sono confrontabili
