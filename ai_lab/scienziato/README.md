# Lo Scienziato

Un agente **deterministico** (nessun LLM) che, dato un MATTONE, sa fare tre cose:

| | capacità | che cosa fa |
|---|---|---|
| **B1** | `cosa_so_fare` | ricostruisce la grandezza partendo **solo dal fondo**, per regime, con intervallo su **blocchi indipendenti** e null di permutazione |
| **B2** | `confronto` | la mette a confronto col mattone che il progetto già ha: **UGUALE** o **DIVERSO**. Se DIVERSO, si ferma |
| **B3** | `cosa_mi_manca` | dove la ricostruzione è debole e che cosa servirebbe per stringerla. Dichiara il fronte, non monta nulla |

**L'ossatura non cambia col fenomeno.** Per portarla su un altro mattone (degrado,
traffico, pit-loss) si scrive un nuovo `fenomeno_*.py` che implementa il contratto in testa
a `scheletro.py` — `blocchi()`, `stima()`, `valore_kernel()`, `null()` — e nient'altro.
È questo che sopravvive ai cambi di regolamento; il coefficiente del 2026, no.

```
fondo.py            l'unico modulo che tocca i dati. SOLO cronometria grezza, pit reali,
                    posizioni, status. Non importa engine/, non legge CSV derivati.
scheletro.py        le tre capacità + gli attrezzi: OLS cluster-robust, bootstrap a
                    blocchi, confronto fra regimi, dispersione, replica out-of-sample.
fenomeno_fuel.py    il mattone di questa sessione: la correzione carburante.
run_scienziato.py   la CLI.
```

```bash
python3 ai_lab/scienziato/run_scienziato.py                  # B1 + B2 (+ B3 se UGUALE)
python3 ai_lab/scienziato/run_scienziato.py --senza-null     # veloce
python3 ai_lab/scienziato/run_scienziato.py --controllo-fondo  # eta dai pit vs `life`
```

## Due regole non negoziabili

1. **Nessun exit-code decide.** `run_scienziato.py` esce sempre 0. B2 produce una
   *proposta*; il giudice è il tavolo umano (Tommi + Claude).
2. **Il fondo è l'unica cosa usabile senza riverifica.** Qualunque numero sopra il fondo —
   fuel-corretto, cap del traffico, pit-loss, bande di degrado — è ipotesi:
   [RETROCESSIONE.md](RETROCESSIONE.md).

Preregistrazione: [PREREG_scienziato_fuel.md](PREREG_scienziato_fuel.md) ·
esito: [../../REPORT_SCIENZIATO_FUEL.md](../../REPORT_SCIENZIATO_FUEL.md)
