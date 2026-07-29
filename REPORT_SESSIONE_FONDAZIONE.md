# Report di sessione — Fondazione (2026-07-29)

## Cosa è cambiato

Questo ramo (`claude/murettobox-f1-simulator-sbc368`) è diventato la
ricostruzione da zero: **codice azzerato, dati e lezioni ereditati**.
L'archivio resta intero e leggibile sul ramo `main`.

1. **Fondazione** (`24e2d5f`) — via tutto il codice del vecchio arco
   (676 file, ~168.000 righe). Restano: `CLAUDE.md` (la legge del progetto,
   alla root), `data/` ereditata e pinnata (`data/MANIFEST.sha256`,
   **1.085 file**), i numeri ereditati con targhetta
   (`fisica/stime/parametri_v2.json`) e i prior esterni di pit-loss
   (`data/priors/pitloss_priors.json`).
2. **Il cancello prima del codice** (`781508f`) — 10 sentinelle scritte
   PRIMA dei moduli, banco ROSSO per costruzione a quel commit. Ognuna esce 1
   al fallimento e dichiara nel testo cosa la farebbe fallire; l'arbitro
   (`banco/corri.mjs`) rifiuta le sentinelle senza condizione dichiarata.
3. **I dipartimenti** (`dc17613`) — `provenienza/` (contratto, frontiera,
   inventario, verifica manifest), `engine/` (kernel v2 monolingua + misure
   al congelamento), `scenario/` (costruttore UNICO + director).

## Cosa è stato misurato (con targhetta)

| cosa | esito | targhetta |
|---|---|---|
| suite del banco | **VERDE: 10 sentinelle, 136 verifiche** | misurato su questo repo, 2026-07-29, `npm test` |
| manifest dati | 1.085 file sha256 verificati, 0 difformi/mancanti/intrusi | misurato su questo repo, 2026-07-29 (s06) |
| inventario 2026 | 11 gare, file raw presenti, celle a contratto, alfabeto status ⊆ {1,2,4,5,6,7} | misurato sul grezzo ereditato (s10) |
| invarianza al troncamento | griglia identica su byLap intero vs troncato, Lf ∈ {10, 25, 40}, Miami 2026, ≥10 piloti con passo | misurato (s01) |
| stessa equazione | parametri sintetici recuperati a <1e-9; cum simulato = cum generato a <1e-6; disegno collineare rifiutato | misurato su gara sintetica dichiarata (s09) |
| ottimo a una sosta | argmin = Lf + (R−e)/2 su 6 casi incluso il bordo e≥R | verifica analitica (s04) |

Parametri: ρ = 0,0389 [0,0220; 0,0629] ereditato con targhetta; **δ resta
null** — il conflitto storico 3,111 vs implicato-2026 2,468 è DICHIARATO nel
file parametri e il kernel con δ null si rifiuta con motivo (s03 lo pretende).

## A referto (disciplina E08)

La verifica di stabilità dell'argmin in s04, prima stesura, era **mal
specificata**: età 8 su R=37 dà x\* = 14,5 — pareggio analitico ESATTO fra i
giri 34 e 35, e l'argmin di un pareggio lo decidono le briciole float, non la
fisica. Il fallimento era del banco, non del kernel. Ri-dichiarata su x\*
intero (età 7 → giro 35), correzione nel commit `dc17613`.

## Cosa resta aperto

- **PROMPT 03 — esperimento decisivo su δ** (prima di qualunque numero in
  pagina): i due IC non si sovrappongono, non si sceglie in silenzio (E21).
- **`web/`** non esiste ancora: BOX NOW arriva quando il motore ha δ.
- **Corsa notturna del banco** (l'auto-verifica contro le gare vere): la
  suite c'è, manca lo scheduling.
- **Promozione dei prior di pit-loss** a misura interna sul fondo.
- Selettore Wet: da costruire visibile ma spento, con targhetta (fase dedicata).
