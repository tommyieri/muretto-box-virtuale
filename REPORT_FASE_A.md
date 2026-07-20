# REPORT — FASE A: scenari di degrado nel pannello pit (demo)

*Sessione 2026-07-20, branch claude/fase-a-scenari-demo. Da PIANO_DEGRADO_LIVE.md.
Obiettivo: alimentare il gancio v1.5 con le bande climatologiche e portare i tre scenari
nel pannello pit della demo, etichettati come scenari.*

## In una riga

**Meccanismo COMPLETO e verificato; visibilità DORMIENTE (flag `SCENARI_ATTIVI=false`)
perché la riesecuzione ha fatto emergere un DOPPIO CONTEGGIO del degrado nel gancio
congelato. Da validare in Fase B (replay) prima di accendere. Accensione = una riga,
decisione PO.**

## LA SCOPERTA (in cima, perché cambia il piano)

Verificando in browser (Austria, VER, giro 36) è emerso che il pannello base (pace
piatta) dà VER **P7** — rivale dietro NOR +0.3s; gli scenari con banda danno VER **P8**,
NOR passa davanti, dietro un buco di 20s. Indagando a livello Node:

- il mio modulo è corretto: **a banda-zero coincide bit-per-bit col base** (P7, HAD
  +2.78, NOR +0.29 identici);
- con banda reale, il **gancio congelato** applica
  `penalitaDegrado = rate · (età_gomma − 1)` — il degrado **assoluto-da-nuovo** — sopra
  la `pace_base`, che però è la **mediana di stint** (≈ pace a metà stint, degrado già
  in parte incorporato). Somma quindi ~`rate · (metà_stint)` di troppo: **~0.5-0.7 s/giro
  al freeze** su gomme vecchie (VER età 17, HARD, rate 0.083 → ~1.3 s/giro applicati, di
  cui ~0.7 già dentro pace_base). È ciò che fa scivolare VER P7→P8.

Modello corretto: `pace(età A) = pace_fresh + rate·(A−1)`; per proiettare da pace_base
(≈ pace a età media A₀) servirebbe `+ rate·(A − A₀)`, non `+ rate·(A−1)`. Il gancio è
**congelato e K4-validato** (K4 misurava l'ampiezza pess-ott, ~2.6 s, non lo scarto vs
base): non l'ho toccato. Questa è esattamente la domanda che la **Fase B (replay)** deve
quantificare e risolvere prima di mostrare numeri.

Perché dormiente e non semplicemente spedito: è lo stesso standard di tutto l'arco —
non si mostrano numeri di cui non ci si fida (banda-zero in produzione, 5 NULL onorati,
Monaco escluso). Il meccanismo però è pronto: `SCENARI_ATTIVI=true` lo accende all'istante.

## Cosa è stato costruito (e verificato)

1. **Gancio servibile dal browser**: `degrado_hook.mjs` spostato in `demo/`
   (import `./engine.mjs`), 3 importatori root aggiornati. Logica byte-identica: golden
   banda-zero **bit-identico** prima e dopo. Nessuna duplicazione (fonte unica).
2. **Bande per il browser**: `gen_bande_demo.py` deriva `demo/data/climatologia_bande.json`
   dal CSV climatologia (righe INFORMATIVA), mappa gara→cid da `gare_registro.json`.
   20 circuiti, 46 bande. Monaco assente (escluso). Auto-verifica riproducibile.
3. **`demo/pitbande.mjs`**: CHIAMA `treScenari` (mai modificato) + riusa `stessoGiroReale`
   (esportata da pitscenario.mjs — aggiunta di un `export`, nessun campo golden toccato).
   Interruttori di sicurezza: bande assenti → niente scenari; compound senza banda →
   [0,0,0]; sotto SC/VSC → sospeso.
4. **Pannello** (`gara.html`, build 200726a): blocco "SCENARI · banda storica, non una
   previsione" con tabella ottimistico/centrale/pessimistico (rientro, davanti, dietro),
   al posto del placeholder dormiente — quando `SCENARI_ATTIVI` è ON.

## Gate A — esiti

- **golden banda-zero bit-identico**: PASS (test_degrado_hook, K4, check_banda).
- **K4**: PASS (distinguibili+plausibili).
- **verifica UI in browser**: PASS sul MECCANISMO — con flag ON i tre scenari rendono
  correttamente (Austria VER giro 36: davanti +0.1/+0.2/+0.3 monotoni), l'interruttore
  di sicurezza sotto VSC (giro 53) NASCONDE gli scenari, Monaco non ha bande. Etichette
  "SCENARI · non una previsione" (nessun "previsto/previsione-affermativa"). Nessun errore
  console. Build 200726a caricata.
- **magnitudine**: **NON validata** (doppio conteggio) → flag OFF, rimandato a Fase B.

Verdetto: **Gate A PASS sul meccanismo, HOLD sulla visibilità**. Coerente col piano
(ogni fase col suo gate; attivazioni sempre del PO).

## Conseguenza sul piano

- **Fase B sale di priorità e si affila**: la domanda non è solo "la banda aggiornata
  tiene la copertura", ma **prima** "qual è la magnitudine corretta della penalità di
  proiezione, dato che pace_base è già degradata?". Candidato: proiettare da pace_base
  con `rate·(A − A₀)` dove A₀ = età media dello stint al freeze. Questo però tocca il
  gancio (congelato) o richiede un adattatore a monte: decisione di disegno del PO.
- Produzione: invariata, gancio a banda-zero.

## Golden (prima e dopo)

test_b.py 449/449 · test_b.mjs 449/449 · demo/test_pit.mjs 11/11 · test_degrado_hook
banda-zero bit-identica · check_banda_gancio PASS · verifica_k4_clim PASS ·
gen_bande_demo riproducibile. Kernel, modulo pit (logica), gancio (logica), produzione:
non toccati.
