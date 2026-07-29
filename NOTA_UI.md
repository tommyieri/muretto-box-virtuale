# NOTA_UI — dati della UI e comando unico

La UI (home, pagina-gara, classifiche, schede) e' un **consumatore**: legge solo
`demo/data/*` e `demo/assets/*`, tutti prodotti da generatori committati. Fonte esterna:
f1db (release CSV pinnata, cache `~/muretto_shared/f1db_csv/` — vedi `f1db_zip.py`) e
Wikimedia Commons per le foto (solo licenze libere CON autore: l'attribuzione e' in pagina,
`gen_foto.py`). Le classifiche vengono dagli **standings f1db canonici** (mai punti
ricalcolati a mano); le schede dagli aggregati canonici + conteggi sui risultati, con
cross-check sui nostri dati gara (divergenze riportate nel JSON — causa nota: il cum_time
demo e' il transito grezzo, f1db applica le penalita' post-gara).

## Flusso post-gara (riga definitiva)
**dopo `pubblica`: `python3 aggiorna_ui.py --gara <nome>`**

(python3 utente, NON venv. Esegue calendario → classifiche → schede → foto — le foto
saltano i piloti gia' scaricati — e, con `--gara`, la pista della gara nuova via
`gen_pista_svg.py`. Idempotente: la seconda esecuzione consecutiva non cambia nulla.
Per le piste vedi `NOTA_PISTE.md`.)
