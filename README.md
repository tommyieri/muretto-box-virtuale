# MurettoBox — ricostruzione da zero

Il simulatore di strategia F1 di MurettoBox: l'utente congela la gara
(**BOX NOW**), sceglie quando e come fermarsi, il motore risponde con posizione
di rientro, curva del "quando conviene", degrado e incertezza dichiarata.

**Codice da zero. Dati e lezioni si ereditano.** Il vecchio arco vive sul ramo
`main` di questo repo (l'archivio: si legge, non si copia); questo ramo riparte
dalla costituzione in [`CLAUDE.md`](CLAUDE.md), che è la legge del progetto —
regole della casa, numeri ereditati con targhetta, catalogo §Errori.

## Struttura (i 6 dipartimenti)

| cartella | dipartimento |
|---|---|
| `data/` + `provenienza/` | Dati & Provenienza — grezzo pinnato (`data/MANIFEST.sha256`), UNA definizione di verde, contratti dati |
| `fisica/` + `engine/` | Physics Lab — la stima (py→JSON con targhetta) e il kernel runtime (`.mjs`, monolingua) |
| `scenario/` | Strategy Lab — costruttore di scenari UNICO, curva del quando, economia SC/VSC |
| `banco/` | Replay Lab — sentinelle, golden, cancelli; l'arbitro |
| `scenario/director.mjs` | Simulation Director — guardrail runtime sull'output |
| `web/` | UX & Product — BOX NOW (fase successiva) |

## Comandi

```sh
npm test          # corre tutte le sentinelle del banco (esce 1 se una fallisce)
```

Nessuna dipendenza: Node ≥ 18, niente `node_modules`.
