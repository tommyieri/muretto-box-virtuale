# Stato PRE-GARA dell'holdout — Zandvoort, 23/08/2026

Copia dei cinque modelli sigillati com'erano il **03/08/2026**, venti giorni prima del
primo fuori campione vero del progetto, con i loro sha256 in `SHA256.txt`.

## Perché esiste

`SIGILLO_holdout.json` dichiara gli hash attesi e `s32` li sorveglia. Ma la sorveglianza
dice *che* qualcosa è cambiato, non **com'era prima**. Questa cartella lo dice.

Il rischio concreto, misurato e non ipotetico: la macchina che pubblica invoca ancora il
python direttamente invece di `scheduling/auto_run.sh`, quindi **non aggiorna il codice**
— e `auto_gara.py` fa `fetch`/`rebase` solo *dentro* `commit_push`, cioè solo dopo aver
prodotto un commit. Fra oggi e Zandvoort non c'è nessuna gara: nessun commit, nessun
fetch. La prima ondata della domenica girerebbe col codice di fine luglio, **anteriore
alla guardia `_holdout_aperto()`**, e la ri-stima post-gara includerebbe Zandvoort nei
modelli.

Quello è l'unico danno **irreversibile** in vista: un holdout bruciato non si ricompra.
Questa cartella, più il tag `holdout-zandvoort-pregara`, lo trasformano in un danno
**ricostruibile con un checkout**.

## Come si usa, se serve

    git checkout holdout-zandvoort-pregara -- simulatore/data
    cd simulatore && node banco/sentinelle/s32_sigillo_holdout.mjs

Oppure, per controllare soltanto se qualcosa si è mosso:

    cd simulatore && shasum -a 256 -c ../ai_lab/confronto/pregara_zandvoort/SHA256.txt

## Cosa NON è

Non è un rimedio al guasto: il rimedio è cambiare la crontab del VPS. È la rete sotto il
trapezio, e serve proprio nello scenario in cui quella riga non viene cambiata in tempo.
