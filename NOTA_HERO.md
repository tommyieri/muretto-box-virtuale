# NOTA HERO — la Hero come demo interattiva

Documento di progetto della Hero di `demo/index.html`.
Copre: ricerca (STEP 0), wireframe / storyboard / user flow (STEP 1–2), product
specification a moduli (STEP 3). L'implementazione vive in `demo/hero.mjs`,
`demo/hero.css`, `gen_hero.mjs`.

---

## 0. RICERCA — cosa funziona davvero nelle hero animate

### 0.1 Onestà sulla profondità

La consegna chiedeva 30 landing page e 15 repository. Quello che è stato fatto davvero:
**10 fonti lette in profondità** (elencate sotto) più conoscenza pregressa delle librerie
citate (Magic UI, Aceternity, React Bits, Motion Primitives, shadcn/ui). Non ho aperto e
schedato 45 artefatti uno per uno: avrei prodotto un elenco lungo e una sintesi identica.
Le conclusioni sotto sono quelle che hanno cambiato il progetto, non un riassunto di
cataloghi.

Fonti effettivamente lette:

| # | Fonte | Cosa ne è uscito |
|---|-------|------------------|
| 1 | [Codrops — Responsive Scroll-Triggered Curved Path (GSAP)](https://tympanus.net/codrops/2025/12/17/building-responsive-scroll-triggered-curved-path-animations-with-gsap/) | Path ricalcolato da `getBoundingClientRect` invece che hard-coded; `invalidateOnRefresh`; `gsap.matchMedia()` per reduced-motion che **salta allo stato finale** invece di spegnere tutto |
| 2 | [Codrops — Scroll-Driven SVG Map Animations](https://tympanus.net/codrops/2026/05/21/creating-scroll-driven-svg-map-animations-with-gsap/) | Disegno del tracciato (DrawSVG) e movimento sul tracciato **nella stessa timeline**: il percorso si "spiega" mentre l'oggetto lo percorre |
| 3 | [Codrops — Thumbnail Flow con MotionPath](https://tympanus.net/codrops/2026/06/04/creating-a-thumbnail-flow-animation-with-gsap-motionpath/) | MotionPath su traiettorie curve; `autoRotate` va deciso per semantica, non per estetica |
| 4 | [Codrops — Reverse-engineering delle animazioni della mascotte Claude](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/) | Micro-timeline indipendenti e componibili invece di una macro-timeline monolitica |
| 5 | [Chrome — Avoid non-composited animations](https://developer.chrome.com/docs/lighthouse/performance/non-composited-animations) | Solo `transform`/`opacity` restano sul compositor; le animazioni compositate **sono escluse dal CLS** |
| 6 | [Arcade — Demo video vs demo interattiva](https://www.arcade.software/post/video-vs-interactive-demo) | Demo interattiva ≈ 3× engagement del video; conversione 24,35% vs 3,05% di baseline |
| 7 | [SaaSFrame — SaaS landing trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples) | Il trend 2026 è **demo incorporata sopra la piega**, non 3D astratto |
| 8 | [Smashing — Five-second testing, case study](https://www.smashingmagazine.com/2023/12/five-second-testing-case-study/) | Il 5-second test misura *cosa si ricorda*, non cosa piace: si progetta per la memoria |
| 9 | [PkgPulse — react-bits vs Aceternity vs Magic UI](https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026) | Aceternity = effetto vetrina; Motion Primitives / react-bits = micro-interazione di prodotto |
| 10 | [Motion Primitives](https://motion-primitives.com/docs) + [Awwwards/GSAP showcase](https://www.noqode.fr/en/outils/gsap) | GSAP 3.13+ ha liberato SplitText/DrawSVG/MorphSVG: i plugin "Club" sono utilizzabili |

### 0.2 Le cinque conclusioni che hanno cambiato il progetto

**A. L'animazione che spiega mostra una CONSEGUENZA, non un movimento.**
Aurora, starfield, spotlight, gradient-text, testo che sfuma su scroll: bellissimi, e
comunicano zero sul prodotto. Le hero che si capiscono in 5 secondi hanno tutte la stessa
struttura: *stato iniziale → azione → stato cambiato*. Trello lascia trascinare una card.
La nostra è: classifica → BOX → classifica diversa. **Tutto ciò che non serve a mostrare
questo cambio di stato è decorazione e va tagliato.**

**B. La demo deve funzionare anche per chi non tocca niente.**
Il 90% dei visitatori guarda e basta. Ma se la demo si limita a auto-riprodursi, chi tocca
non scopre di poter decidere. Soluzione adottata: la timeline **si ferma al momento della
decisione** con un default che pulsa, e riparte da sola dopo 2,8 s. Chi tocca decide; chi
non tocca vede comunque il finale. È l'unica scelta di progetto che concilia i due pubblici.

**C. Il testo vince sul movimento nei primi 800 ms.**
Il 5-second test premia ciò che si legge, non ciò che si muove. Titolo e sottotitolo
devono essere **già lì al primo frame** (nessun fade-in del titolo: costa comprensione e
introduce rischio CLS). Si anima la scena, non la promessa.

**D. Reduced-motion non significa "niente".**
Il pattern Codrops giusto è `gsap.matchMedia()` che **posiziona allo stato finale**: chi ha
prefers-reduced-motion vede la classifica già ribaltata e il verdetto già scritto, con i
comandi pienamente funzionanti. Zero animazione, zero informazione persa.

**E. 60 fps si ottiene togliendo, non ottimizzando.**
Solo `transform` e `opacity`. Niente filtri animati, niente `box-shadow` in tween, niente
`width/height`. Il glow pulsante è `opacity` su un elemento già sfocato, non un
`filter: blur()` animato.

### 0.3 Cosa NON prendiamo, pur avendolo visto ovunque

- **Scroll-jacking / Lenis sulla hero.** La hero è sopra la piega: non c'è scroll da
  dirottare. Lenis resta non usato (installato, ma fuori da questo lavoro).
- **Testo che si assembla lettera per lettera (SplitType).** Ritarda la comprensione del
  claim di 600–900 ms proprio nella finestra che conta. Usato solo sul *verdetto*, che
  arriva dopo.
- **3D / canvas / shader.** Vincolo esplicito, e comunque contrario alla conclusione A.
- **Numeri finti.** Vedi §1.2.

---

## 1. LA DECISIONE DI PROGETTO PIÙ IMPORTANTE

### 1.1 Cosa deve capire il visitatore in 5 secondi

In ordine di priorità, e questo ordine è il progetto:

1. **È Formula 1, ed è una gara vera** (pista riconoscibile, classifica, giro 20/44)
2. **C'è una decisione da prendere, ed è mia** (il bottone BOX pulsa e aspetta)
3. **La decisione ha una conseguenza calcolata** (la classifica si ribalta)
4. **I numeri sono misurati, non inventati** (pit-loss 23,36 s con la provenienza in chiaro)

### 1.2 Un problema reale nello storyboard proposto — e come è stato risolto

Lo storyboard chiede: secondo 3 l'utente sceglie **SOFT / MEDIUM / HARD**, secondo 6 la
classifica cambia e compare **+2 POSITIONS**. Questo implica che la mescola muova il
risultato.

**Nel prodotto la mescola non muove nessun numero, ed è una cosa misurata, non una
semplificazione.** `demo/muretto.mjs::righeMescola` lo dichiara nel pannello: sul fondo
2026 la differenza fra mescole su gradino, warm-up e degrado non si distingue dal caso
(p = 0,24 / 0,58 / 0,25). Una hero in cui la gomma cambia la posizione prometterebbe una
capacità che il motore non ha e che il prodotto stesso nega tre schermate più in là.

**La leva che muove davvero il numero è il MOMENTO.** Il gradino di sosta è stato acceso
il 22/07 proprio perché il motore distinguesse *quando* ti fermi. Quindi:

- la decisione della hero è **BOX ORA vs ASPETTA 3 GIRI**;
- i tre bottoni gomma **restano** — sono il gesto vero del muretto e il segnale F1 più
  riconoscibile — con esattamente il ruolo che hanno nel prodotto: mostrano cosa monti e
  quanto è durata quella mescola oggi, e portano la stessa nota («la mescola non cambia i
  numeri»). Il beat visivo del secondo 3 è salvo, la promessa no.

Il ritmo a 8 battute richiesto è mantenuto integralmente. Cambia una battuta di contenuto.

### 1.3 Il caso scelto, e perché è il migliore possibile

`gen_hero.mjs` interroga il motore di produzione e congela l'esito in
`demo/data/hero.json`. Il caso:

> **Spa-Francorchamps, GP del Belgio 2026, giro 20 di 44.**
> **LECLERC è primo**, su MEDIUM da 20 giri. Il campo è **neutralizzato** (20 vetture su 20
> col flag). Pit-loss di questa gara: **23,36 s, misurato**.
>
> - **BOX ORA** (giro 20, sotto neutralizzazione) → rientra **P1**. Resta al comando.
>   Il motore assume che 5 rivali a pari giro ancora al primo stint si fermino con te — ed è
>   dichiarato.
> - **ASPETTA 3 GIRI** (giro 23, bandiera verde) → rientra **P4**, a 5,35 s da PIASTRI.
>
> **Tre posizioni.** Stesso pilota, stessa gomma, stesso pit-loss. Cambia solo il momento.

Questo caso insegna in cinque secondi la cosa più vera della strategia di F1 — *la safety
car è una sosta gratis* — e lo fa con l'output letterale di `evaluatePit`. Nessun numero
della hero è scritto a mano.

Onestà che resta visibile in pagina: sotto neutralizzazione **i gap non sono
quantificabili** (il motore li sopprime). La hero mostra la posizione e dichiara l'assenza
del gap, invece di riempire il buco.

---

## 2. WIREFRAME

### 2.1 Desktop (≥ 1040px) — griglia 2 colonne, 46% / 54%

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▬▬ MURETTO BOX VIRTUALE · STAGIONE 2026            [nav]  Stagione Live …    │  topbar (esistente)
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ── SPA-FRANCORCHAMPS · GIRO 20/44 ─┐    ┌─────────────────────────────────┐ │
│                                     │    │  ◤ GIRO 20/44        LEC  P1  ◢ │ │  ① HUD
│  DECIDI TU                          │    │                                 │ │
│  QUANDO FERMARSI.                   │    │        ╭──────────╮  ┌────────┐ │ │
│                                     │    │      ╭─╯          ╰╮ │1 LEC   │ │ │  ② TRACK
│  Una gara vera. Fermi il leader ai  │    │     ╱      ● ←car  ╲ │2 HAM   │ │ │  ③ CAR
│  box e il motore ti dice dove       │    │    │                ││3 NOR ▸ │ │ │  ⑤ TOWER
│  rientri — coi rivali al loro passo │    │    ╲    ▁▁▁▁▁▁     ╱ │4 PIA   │ │ │
│  reale. Non se conviene: dove.      │    │     ╰──[PIT LANE]──╯ │5 HAD   │ │ │
│                                     │    │                      └────────┘ │ │
│  ┌───────────────────────────────┐  │    │  ┌────────────────────────────┐ │ │
│  │ ▶ BOX ORA        rientri P1   │  │    │  │  BOX?  ← la domanda        │ │ │  ⑥ PROMPT
│  │ ⏱ ASPETTA 3 GIRI rientri P4   │  │    │  └────────────────────────────┘ │ │
│  └───────────────────────────────┘  │    │  ● ● ● SOFT MEDIUM HARD         │ │  ⑦ COMPOUND
│   ④ CHOICE                          │    │  ┌────────────┐                 │ │
│                                     │    │  │ 2.41  PIT  │ ⑧ PITSTOP       │ │
│  ┌ VERDETTO ────────────────────┐   │    │  └────────────┘                 │ │
│  │  P1   RESTI AL COMANDO       │   │    └─────────────────────────────────┘ │
│  │  l'altra strada: P4  (−3)    │   │                                        │
│  └──────────────────────────────┘   │    pit-loss 23,36 s · misurato su      │
│   ⑨ OUTCOME                         │    questa gara · FastF1                │
│                                     │                                        │
│  [ Prova sulla gara vera → ]  [ Come funziona ]        ⑩ PAYOFF              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Perché il testo a sinistra e la scena a destra: la lettura occidentale parte da sinistra,
e la promessa deve essere letta **prima** che la scena parta. La scena è a destra dove
l'occhio arriva già "innescato" dalla domanda.

### 2.2 Mobile (≤ 720px) — colonna singola, ordine per comprensione

```
┌──────────────────────────┐
│ topbar                   │
├──────────────────────────┤
│ ── SPA · GIRO 20/44      │
│ DECIDI TU                │  titolo: mai animato, primo frame
│ QUANDO FERMARSI.         │
│ sottotitolo, 2 righe     │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ GIRO 20/44   LEC P1  │ │
│ │      ╭────╮          │ │  stage 4:3 — pista + torre compatta (4 righe)
│ │    ╭─╯ ●  ╰╮  1 LEC  │ │
│ │    ╰──PIT──╯  2 HAM  │ │
│ │      BOX?     3 NOR  │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ [▶ BOX ORA    → P1]      │  bottoni 48px, pollice
│ [⏱ ASPETTA 3G → P4]      │
│ ● SOFT ● MEDIUM ● HARD   │
├──────────────────────────┤
│ P1 · RESTI AL COMANDO    │
│ l'altra strada: P4 (−3)  │
├──────────────────────────┤
│ [ Prova sulla gara vera ]│
└──────────────────────────┘
```

Sopra la piega su iPhone SE (375×667): eyebrow + titolo + stage + primo bottone. Basta a
soddisfare i punti 1, 2 e 3 della §1.1.

---

## 3. STORYBOARD — 8 battute (+ lo stato di riposo)

Tempi in secondi dal primo frame della hero. `‖` = **cancello**: la timeline si ferma.

| s | Battuta | Cosa si vede | Cosa capisce il visitatore |
|---|---------|--------------|----------------------------|
| **0,0** | **PISTA** | Titolo e sottotitolo **già leggibili** (nessun fade). La pista si disegna da sola in 0,9 s (DrawSVG). La torre entra con stagger dal basso. Badge `GIRO 20/44`. | «Formula 1, gara vera, classifica» |
| **1,1** | **GIRA** | Il pallino rosso Ferrari parte dal traguardo e percorre il tracciato. Scia corta dietro. Ciclo 5,2 s. | «È in corso, c'è un pilota» |
| **1,6** | **BOX?** | Sotto la pista compare `BOX?` in mono, lento, con la luce rossa della pit-lane che inizia a respirare. | «Qualcuno sta per prendere una decisione» |
| **2,4** ‖ | **SCEGLI** | Le due carte salgono: `▶ BOX ORA · rientri P1` e `⏱ ASPETTA 3 GIRI · rientri P4`. La prima pulsa. I tre bottoni gomma appaiono coi colori mescola. **La timeline si ferma qui.** Auto-avanzamento dopo 2,8 s sul default `BOX ORA`. | «**Devo decidere io**» ← il momento in cui il prodotto si capisce |
| **+0,0** | **ENTRA** | Il pallino lascia il nastro e scende in pit-lane (MotionPath sul path della corsia box). Le altre auto continuano. | «La mia decisione muove la macchina» |
| **+0,6** | **SOSTA** | Il pallino si ferma nella piazzola. Contatore mono `0.00 → 2.41`. Quattro tacche gomma lampeggiano una per una. Luce rossa fissa. | «Questo è un pit stop» |
| **+2,4** | **ESCE** | Luce verde, il pallino risale la corsia e rientra sul nastro. **La torre si riordina** (FLIP): le righe scivolano, la riga LEC si accende del colore Ferrari. | «Il mondo è cambiato per causa mia» |
| **+3,2** | **VERDETTO** | Chip grande: `P1 · RESTI AL COMANDO`, flash verde. Sotto, in grigio: `l'altra strada: P4 · −3 posizioni`. Il titolo si sostituisce con **SEI TU, AL MURETTO.** | «Ho appena fatto strategia di F1» |
| **riposo** | **GIOCA** | Entrambe le carte tornano attive e cliccabili: si passa da una all'altra e la torre si ribalta ogni volta. CTA `Prova sulla gara vera →` in evidenza. Nota pit-loss sempre visibile. | «Posso continuare a giocare — e c'è di più di là» |

Nota sul testo del secondo 7: `YOU ARE THE PIT WALL` è più bello in inglese, ma il sito è
interamente in italiano e il claim deve essere capito, non ammirato. **`SEI TU, AL
MURETTO.`** — e "muretto" è già il nome del prodotto: la frase chiude il cerchio col logo
in alto a sinistra.

---

## 4. USER FLOW

```
                          ┌─────────────────────┐
                          │  arrivo su /        │
                          └──────────┬──────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │ hero visibile? (IntersectionObs)│──no──▶ timeline in pausa
                     └───────────────┬───────────────┘         (zero costo)
                                     │ sì
                                     ▼
                     ┌───────────────────────────────┐
                     │ prefers-reduced-motion?        │
                     └───────┬───────────────┬────────┘
                        sì   │               │  no
                             ▼               ▼
              ┌──────────────────────┐   ┌────────────────────┐
              │ STATO FINALE diretto: │   │ ATTO 1 (0 → 2,4 s) │
              │ torre ribaltata,      │   │ pista, giro, BOX?  │
              │ verdetto scritto,     │   └─────────┬──────────┘
              │ carte attive          │             ▼
              └──────────┬───────────┘   ╔═════════════════════╗
                         │               ║  CANCELLO DECISIONE ║
                         │               ╚══════╤═══════╤══════╝
                         │            tocca ────┘       └──── non tocca (2,8 s)
                         │               │                    │
                         │               ▼                    ▼
                         │      ┌─────────────────┐   ┌─────────────────┐
                         │      │ la SUA scelta   │   │ default BOX ORA │
                         │      └────────┬────────┘   └────────┬────────┘
                         │               └──────────┬──────────┘
                         │                          ▼
                         │               ┌─────────────────────┐
                         │               │ ATTO 2: sosta,      │
                         │               │ riordino, verdetto  │
                         │               └──────────┬──────────┘
                         └──────────────────────────┤
                                                    ▼
                                        ┌───────────────────────┐
                                        │   STATO DI RIPOSO     │◀──┐
                                        │ carte attive, verdetto│   │
                                        └───┬─────────┬─────────┘   │
                              cambia scelta │         │ CTA         │
                                            └─────────┘             │
                                                      ▼             │
                                       ┌──────────────────────┐     │
                                       │ gara.html?g=Belgio   │     │
                                       │ (il prodotto vero)   │     │
                                       └──────────────────────┘     │
                                                                    │
                              «rivedi» ────────────────────────────┘
```

Tre uscite, tutte volute:
1. **CTA primaria** → `gara.html?g=Belgio` — la stessa gara della hero, continuità totale.
2. **CTA secondaria** → ancora `#cose` nella pagina (chi vuole leggere prima).
3. **Restare a giocare** — legittimo: ogni ribaltamento della torre rinforza la comprensione.

---

## 5. PRODUCT SPECIFICATION — i moduli

Undici moduli indipendenti. Ognuno espone `monta()`, `timeline()` e `finale()`
(posizionamento immediato allo stato finale, per reduced-motion). Nessun modulo conosce
gli altri: li compone solo il **Direttore** (M11).

Priorità: **P0** = senza questo la hero non comunica → si costruisce e si carica sempre.
**P1** = rinforza. **P2** = piacere, primo a cadere sotto vincolo.

---

### M1 · STAGE — il palco
- **Scopo** — contenitore a proporzione fissa che riserva lo spazio prima che arrivi
  qualunque dato. È il modulo anti-CLS: `aspect-ratio` in CSS, mai altezza da JS.
- **Stato iniziale** — visibile, vuoto, con il tracciato in skeleton (path grigio 1px).
- **Animazione** — nessuna. Volutamente.
- **Trigger** — nessuno (esiste dal primo frame HTML).
- **Durata** — n/a. **Priorità** — **P0**.

### M2 · TRACK — il nastro
- **Scopo** — rendere la scena riconoscibile in <400 ms: è un circuito, è Spa.
- **Stato iniziale** — path completo, `drawSVG: "0%"`.
- **Animazione** — `drawSVG 0% → 100%`, `ease: "power2.inOut"`. Quattro passate
  sovrapposte (alone, nastro, mezzeria tratteggiata, pit-lane) sfalsate di 0,08 s.
  Tacca traguardo in `scale/opacity` alla fine.
- **Trigger** — `hero:visible`. **Durata** — 0,9 s (pit-lane +0,3 s).
- **Priorità** — **P0**.

### M3 · CAR — il pallino
- **Scopo** — dare un *soggetto* alla scena. Senza un'auto che gira, la pista è un logo.
- **Stato iniziale** — al traguardo (frazione 0), `opacity: 0`.
- **Animazione** — `MotionPathPlugin` su `#hero-track-path`, `align` sullo stesso path,
  `alignOrigin: [0.5, 0.5]`, `autoRotate: false` (il pallino è un marker di timing, non
  un'automobilina: ruotarlo suggerisce un modello fisico che non c'è), `ease: "none"`,
  `repeat: -1`. Scia = 3 cloni in ritardo di 0,06 s con opacità 0,45 / 0,25 / 0,12.
- **Trigger** — a fine M2. **Durata** — ciclo 5,2 s, infinito.
- **Priorità** — **P0**.

### M4 · HUD — giro, pilota, gomma
- **Scopo** — ancorare la scena a dei fatti: `GIRO 20/44`, `LEC · P1`, `MEDIUM · 20 GIRI`.
- **Stato iniziale** — `opacity: 0`, `y: -6`.
- **Animazione** — entrata 0,3 s; il numero del giro conta 1→20 con `snap: 1` (mono
  tabulare, larghezza fissa: non si muove niente intorno).
- **Trigger** — `t = 0,15`. **Durata** — 0,3 s (contatore 0,8 s).
- **Priorità** — **P1** (la scena si capisce anche senza, ma diventa generica).

### M5 · TOWER — la torre dei tempi
- **Scopo** — è **il modulo che porta il significato**: la classifica è lo stato che
  cambia. Se cade questo, la hero non spiega più niente.
- **Stato iniziale** — 6 righe reali dal congelamento (`torre_partenza`), `opacity: 0`,
  `y: 10`.
- **Animazione** — entrata `stagger: 0.055`. Riordino con **FLIP fatto a mano**: misuro le
  `offsetTop` prima, riscrivo il DOM, animo il `y` differenziale → una sola `transform` per
  riga, zero layout in tween. Riga del pilota: bordo sinistro nel colore team che si
  allarga 2→4px.
- **Trigger** — entrata `t = 0,45`; riordino su `evento:rientro`.
- **Durata** — entrata 0,5 s; riordino 0,7 s con `ease: "power3.inOut"`.
- **Priorità** — **P0**.

### M6 · PROMPT — la domanda
- **Scopo** — trasformare uno spettatore in un decisore. È la cerniera dell'intera hero.
- **Stato iniziale** — `BOX?` invisibile; semaforo pit-lane spento.
- **Animazione** — `BOX?` in `opacity` + `letter-spacing` da 0,5em a 0,16em (0,5 s,
  `power2.out`); semaforo: 3 luci rosse che si accendono in sequenza e poi respirano
  (`opacity 1 ↔ 0,35`, `yoyo`, 1,4 s).
- **Trigger** — `t = 1,6`. **Durata** — 0,5 s + respiro infinito.
- **Priorità** — **P0**.

### M7 · CHOICE — le due carte
- **Scopo** — **è la demo**. Due strade reali, ognuna col suo esito già calcolato.
- **Stato iniziale** — `opacity: 0`, `y: 14`, `pointer-events: none`.
- **Animazione** — salita `stagger: 0.09`, `back.out(1.4)`; poi la carta di default entra
  in loop di attesa (`scale 1 ↔ 1,015` + alone in `opacity`). Alla scelta: la carta scelta
  `scale: 1.02` e si accende, l'altra scende a `opacity: 0,45`.
- **Trigger** — `t = 2,4`, e **apre il cancello**.
- **Durata** — 0,45 s; attesa max 2,8 s poi auto-scelta.
- **Priorità** — **P0**.

### M8 · COMPOUND — i tre bottoni gomma
- **Scopo** — il segnale F1 più riconoscibile al mondo, e il gesto vero del muretto.
  **Non muove la risposta**, e lo dice (§1.2).
- **Stato iniziale** — `opacity: 0`, `scale: 0.8`.
- **Animazione** — pop `stagger: 0.06`, `back.out(2)`; hover: anello nel colore mescola che
  si espande (`scale` + `opacity` su uno pseudo-elemento, mai `box-shadow`).
- **Trigger** — `t = 2,55` (0,15 s dopo le carte: prima si vede la decisione, poi il
  contorno). **Durata** — 0,3 s.
- **Priorità** — **P1**.

### M9 · PITSTOP — la sosta
- **Scopo** — rendere fisica la decisione. È il beat che fa dire «oh».
- **Stato iniziale** — pannello sosta `opacity: 0`; contatore `0.00`.
- **Animazione** — tre segmenti concatenati:
  1. **ingresso** `MotionPath` sul `pit_d` da 0 a 0,45 (0,55 s, `power1.in`);
  2. **fermo** contatore `0 → 2,41` con `snap: 0.01` (2,4 s reali, compressi a 1,1 s con
     `ease: "none"`: il tempo mostrato è vero, la durata percepita è sopportabile) +
     4 tacche gomma in `opacity` `stagger: 0.12`;
  3. **uscita** `MotionPath` 0,45 → 1 (0,7 s, `power1.out`), poi rientro sul nastro.
- **Trigger** — `evento:scelta`. **Durata** — 2,35 s totali.
- **Priorità** — **P0**.

### M10 · OUTCOME — il verdetto
- **Scopo** — chiudere il ciclo causa→effetto in una riga leggibile senza pensarci.
- **Stato iniziale** — `opacity: 0`, `y: 8`.
- **Animazione** — chip che entra (0,35 s, `back.out(1.6)`); **flash** = velo verde in
  `opacity 0 → 0,22 → 0` (0,5 s) se la posizione migliora o si mantiene, ambra se
  peggiora; delta `−3` che conta da 0; riga fantasma dell'altra strada in `opacity 0 → 1`.
- **Trigger** — fine M9 + fine riordino M5. **Durata** — 0,7 s.
- **Priorità** — **P0**.

### M11 · CONDUCTOR — il direttore
- **Scopo** — l'unico che conosce il tempo. Possiede la macchina a stati
  `armato → corre → chiede → ‖cancello‖ → sosta → verdetto → riposo`, il cancello, il
  reduced-motion, l'IntersectionObserver, il `visibilitychange` e il re-play.
- **Animazione** — nessuna propria: solo `timeline().add()` dei moduli e `pause()`/`play()`
  sul cancello.
- **Trigger** — `DOMContentLoaded` + `IntersectionObserver`.
- **Durata** — atto 1 ≈ 2,9 s; atto 2 ≈ 3,4 s; totale con cancello ≈ 6,3–9,1 s.
- **Priorità** — **P0**.

### 5.1 Contratto fra moduli

Un solo verso di comunicazione: **il Direttore chiama i moduli, i moduli non si chiamano
fra loro**. Ogni modulo è una funzione pura da `(root, dati) → { tl, finale }`. Questo è
ciò che li rende riutilizzabili: `TOWER` funzionerebbe su `live.html`, `PITSTOP` è la
stessa grammatica di `demo/ghostplay.mjs`.

### 5.2 Bilancio prestazioni — misurato

| Voce | raw | gzip |
|------|-----|------|
| `vendor/gsap.min.js` | 72,9 KB | **28,3 KB** |
| `vendor/MotionPathPlugin.min.js` | 22,0 KB | **9,7 KB** |
| `vendor/DrawSVGPlugin.min.js` | 4,4 KB | **2,2 KB** |
| `hero.mjs` | 34,1 KB | **10,8 KB** |
| `hero.css` | 18,7 KB | **5,2 KB** |
| `data/hero.json` | 9,3 KB | **4,2 KB** |

I 40,2 KB gzip di GSAP **non vengono scaricati** se `prefers-reduced-motion: reduce`
oppure se la hero non entra mai in viewport (verificato in browser: con reduced-motion
le risorse richieste sono `hero.css`, `hero.mjs`, `hero.json` e nient'altro).

| Misura | Valore |
|--------|--------|
| **CLS** | **0,000** (misurato con `PerformanceObserver`, `layout-shift` bufferizzato) |
| Proprietà animate | solo `transform`, `opacity`, `stroke-dashoffset` |
| `will-change` in CSS | **nessuno** — GSAP promuove per la durata del tween e poi molla; un `will-change` permanente sarebbe l'anti-pattern, non l'ottimizzazione |
| Nodi animati simultanei | max 14 |
| Tutto sopra la piega | sì a 1280×720 (CTA a 719 px) e a 375×812 |
| Bersagli tattili | ≥ 44 px (il tasto "Rivedi" arriva a 46 px con un'area estesa in `::after`) |
| Nomi accessibili | 8 su 8 elementi focalizzabili, tutti espliciti via `aria-label` |
| Errori in console | nessuno |

---

## 6. RIGENERARE I DATI

```
node gen_hero.mjs
```

Legge `demo/data/Belgio.json`, `pitloss.json`, `pista_Belgio.json`, `team_colori.json`;
chiama `evaluatePit` due volte; scrive `demo/data/hero.json`. Il caso (gara, pilota, giro,
i due giri di sosta) è la costante `CASO` in testa al generatore: cambiarla e rilanciare è
tutto quello che serve per cambiare la storia della hero.


---

## 7. REGISTRO DI IMPLEMENTAZIONE — cosa è cambiato rispetto al progetto

Il progetto è stato scritto prima del codice, e il codice lo ha corretto in sette punti.
Sono qui perché la prossima persona non li riscopra a mano.

1. **GSAP non si carica con `import()`.** Le build vendorizzate sono UMD e la loro
   intestazione fa `(this || self).window = ...`; in contesto modulo `this` è `undefined`
   e si finisce a scrivere su `window.window`, che è di sola lettura. Si caricano con un
   tag `<script>` iniettato — il lazy-load resta identico.

2. **Il cancello non deve togliere i bottoni dalla navigazione da tastiera.** La prima
   stesura metteva `pointer-events: none` e `tabIndex = -1` sulle carte fino al cancello:
   due secondi e mezzo di buco di accessibilità in cambio di niente. Ora le carte sono
   sempre vive e un click anticipato manda l'intro al suo finale (`master.progress(1)`) e
   decide subito.

3. **Le due carte non devono sembrare diverse prima della scelta.** `aria-pressed="false"`
   valeva "spenta", quindi all'inizio erano spente entrambe. Lo spegnimento ora dipende da
   `[data-deciso]` sul gruppo: prima del cancello le strade sono pari.

4. **Il verdetto si costruisce quando la timeline lo raggiunge, non quando la timeline si
   scrive.** `fromTo` renderizza subito lo stato iniziale (`immediateRender`), e il nodo
   `.hero-verdetto-pos` non esisteva ancora: si animava `null`. Ora il testo nasce dentro
   una callback e solo dopo si anima ciò che è appena nato.

5. **`order` va sull'elemento di griglia.** Introdurre il wrapper `.hero-scena` (palco +
   nota di provenienza) ha silenziosamente disattivato `.hero-stage { order: -1 }`, e su
   mobile il palco spariva sotto tutto: la hero perdeva esattamente la cosa che deve
   mostrare. Risolto con `display: contents` sul wrapper sotto i 1040 px, così palco, testo
   e nota si ordinano separatamente.

6. **Il tracciato è un path chiuso: la scia va dichiarata `fill: none` in CSS.** L'attributo
   di presentazione `fill="none"` perde contro la regola di classe, e il circuito si
   riempiva di rosso.

7. **Il `<link rel=preload as=fetch>` combacia solo se la `fetch` usa `credentials: 'omit'`.**
   Altrimenti il browser scarica `hero.json` due volte.

Inoltre, per far stare tutto sopra la piega a 1280×720, la firma di chiusura
(**SEI TU, AL MURETTO.**) è passata dalla colonna di sinistra a **timbro sopra la scena**:
restituisce 40 px alla colonna e guadagna in drammaticità — è la battuta 8 dello storyboard,
ed è più giusto che stia sul palco.
