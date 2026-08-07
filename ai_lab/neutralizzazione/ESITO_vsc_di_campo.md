# ESITO — la VSC di campo NON risana R_lap: veto confermato, diagnosi nuova

**Data: 07/08/2026.** Esegue `PREREG_vsc_di_campo.md`, scritta prima dei numeri.
Dati: `ESITO_vsc_di_campo.json`. Generatore: `misura_vsc_di_campo.mjs`.

## Il verdetto

**V1 NON PASSA.** VSC di campo sulle 11 gare 2026: pooled R_lap **1,116** (n 362),
**0 circuiti su 7** dentro il range fisico [1,20–1,50]. Il veto della Sessione N —
«nessuno costruisca sulla neutralizzazione VSC» — **resta pieno**, e per la regola
scritta nella prereg non c'è terza lettura su questa fonte.

## La diagnosi, che è la parte nuova

1. **L'ipotesi della località è FALSA.** I giri VSC «solo locali» (cella '6' col campo
   non in VSC) valgono R_lap **1,128** — indistinguibili dal campo (1,116). Il guasto
   non sta nella soglia ≥2-auto della classificazione evento: leggere di campo non
   cambia niente.
2. **Il metro è sano**: la SC di campo, stesso stimatore, dà **1,434** — dentro il suo
   range. Quello che si rompe è la VSC, non il modo di misurare.
3. **Il candidato che resta è la diluizione del giro parziale**: una VSC che copre
   mezzo giro marca la cella '6' ma lascia correre in verde l'altra metà — e il fondo
   (147 gare, n 2.188) dà **1,199**, a un soffio dal bordo del range: più la finestra è
   lunga rispetto ai suoi bordi, più il numero sale. È un'osservazione, non un esito:
   inseguirla su questa fonte sarebbe la terza lettura vietata.

## La strada futura, dichiarata (per chi avrà la fonte)

Il simbolo '6' è una lettura PER GIRO di un fenomeno A TEMPO. La fonte giusta per una
prereg futura sono le **finestre a tempo del race control** (deploy/ending con orario,
`race_control_2026.json` e feed equivalenti): con quelle si può dire QUANTA parte del
giro era sotto VSC, e il R_lap atteso diventa una funzione della frazione coperta —
un test con potere vero. È una fonte DIVERSA dal segnale '6', quindi una prereg là è
legittima. Fino ad allora: il veto sta, e adesso si sa anche perché.
