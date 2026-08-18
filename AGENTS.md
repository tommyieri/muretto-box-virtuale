# AGENTS.md — Muretto Box Virtuale

> ## → Le istruzioni di progetto stanno in [`CLAUDE.md`](CLAUDE.md). Leggilo prima di lavorare.
>
> Questo file **non è una copia**: è un rimando. Fino al 17/08/2026 `AGENTS.md` e `CLAUDE.md`
> erano due documenti identici mantenuti a mano — cioè due sorgenti di verità che sarebbero
> divergute alla prima modifica fatta su una sola delle due. Adesso il contenuto vive in un
> posto solo.

## Perché qui sotto c'è comunque qualcosa

Le poche righe che seguono sono le regole che **non cambiano mai** e che non devono dipendere
dal fatto che tu abbia seguito un link. Tutto il resto — lo stato del motore, i rami chiusi, i
divieti, le decisioni aperte, i cantieri — sta in `CLAUDE.md` e **solo** lì.

## La carta, in cinque righe

1. **La fonte dati è la verità.** I dati vengono SOLO da f1db / FastF1 / TI / OpenF1, MAI
   trascritti a mano. Ogni valore in produzione ha un generatore committato e una nota di
   metodo. Una targhetta di provenienza deve citare il sigillo di **chi ha fatto quel conto**.
2. **L'assenza è una risposta** (regola 6). Un dato che manca è `null` e si dichiara. Non
   esiste un ripiego che inventi un valore plausibile.
3. **Pre-registrazione obbligatoria.** Criteri di successo e soglie di stop si fissano PRIMA
   dei numeri e si onorano sempre. Nessun aggiustamento post-hoc.
4. **Prima di chiudere una sessione o proporre un merge**, sempre:
   ```bash
   python3 sentinella.py
   ```
   Verde non vuol dire vero: se hai creato una pagina che produce numeri, la sua sentinella
   nasce con lei.
5. **Comunicazione in italiano**, con Tommi (Product Owner) che non legge codice: rigore,
   verità numerica, trasparenza.

## Le accensioni non sono degli agenti

Costruire una cosa e **accenderla** sono due gesti diversi. Scenari-degrado, traffico live
(veto McLaren), la pagina What-If: sono pronti e spenti apposta. L'elenco aggiornato delle
decisioni aperte sta in `CLAUDE.md` — **decide il PO**.
