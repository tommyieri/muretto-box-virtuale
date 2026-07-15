# MOCKUP — Race control nella demo (LIVELLO 1: mostrare, non simulare)

Proposta per decisione PO. NIENTE di questo è applicato alla demo pubblica: il prototipo
statico è `mockup_race_control.html` (autonomo, dati Silverstone cablati a mano, nessun
import dai moduli demo). Fonte dati a regime: `data/race_control_2026.csv` (generatore
committato) + una fonte di CLASSIFICA ufficiale per la vista finale (v. verdetto RC2:
la rettifica automatica è STOP; la vista ufficiale si prende da una fonte, non si calcola).

## 1. Feed race control nella timeline eventi
Aggancio: la barra eventi esiste già (`demo/gara.html`, `drawEvtl` — bande SC/VSC/rossa da
`bands()`, tacche pit da `pitLaps`). Proposta:
- nuova classe di tacche `rcm` sulla stessa barra: **giallo** = bandiera gialla/doppia
  gialla (categoria Flag), **§ viola** = annuncio penalità, **grigio** = altri messaggi
  rilevanti (investigazione, track limits deleted);
- click/hover sulla tacca = tooltip col testo del messaggio e il giro (stesso pattern del
  tooltip pit della strip strategia, `strat-tip`);
- densità: SOLO categorie selezionate (Flag gialle, penalità, investigazioni); le verdi
  "TRACK CLEAR" e i messaggi di sistema restano fuori (rumore).
- il banner di fase esistente (SC/VSC/RF) NON cambia: le finestre restano quelle di
  `neutralizzazione.json` (verità del kernel), il feed è un layer informativo sopra.

## 2. Badge penalità in tabella
Aggancio: la riga pilota ha già il badge BOX/OUT (`paintRow`). Proposta:
- badge **"+5s"** (viola, stile `plbadge`) accanto alla sigla DAL giro dell'annuncio in
  poi (campo `giro` del CSV); più penalità = somma mostrata ("+15s"), tooltip con
  l'elenco (giro, motivo);
- il badge è SOLO informativo: gap, ordine e motore restano al reale (livello 1);
- a fine replay il badge resta, così la tabella finale "in pista" mostra chi ha pendenze.

## 3. Classifica finale a doppia vista
Nuovo pannello (o tab accanto a "Classifica"/"Strategia gomme") attivo a fine gara:
- colonna sinistra "**in pista**" = ordine dei dati demo (quello che i pallini hanno
  mostrato); colonna destra "**ufficiale**" = classifica FIA da fonte di classifica
  (FastF1 results / f1db aggiornato — NON la rettifica: verdetto RC2);
- frecce di scostamento tra le due colonne; i piloti con badge penalità evidenziati;
- zona punti demarcata (top 10): **il caso Antonelli si legge in un colpo: P9 in pista,
  badge +5s, P15 ufficiale, sotto la linea dei punti**;
- nota a piè di pannello, onestà sulla fonte: "la classifica ufficiale include decisioni
  FIA post-gara che non transitano dal race control (es. Miami)".

## Decisioni chieste al PO
1. le tre componenti entrano tutte, o solo feed+badge (la doppia vista richiede una nuova
   fonte dati in demo/data — un generatore nuovo, `classifiche ufficiali per gara`)?
2. il CSV race control va servito alla demo così com'è (demo/data/race_control_2026.json
   ridotto alle categorie usate) o si tiene tutto in data/ finché non si decide?
3. badge penalità anche durante il live futuro, o solo nel replay storico?

## DECISIONI PO (2026-07-16): SÌ a tutte e tre — IMPLEMENTATO
1. Tutte e tre le componenti in demo: `gen_classifiche_ufficiali.py` →
   `demo/data/ufficiali_2026.json` (fonte di classifica FIA, riportata non ricostruita).
2. `gen_rc_feed.py` → `demo/data/race_control_2026.json` (feed ridotto alle categorie
   decise + penalità di tempo per i badge). Il CSV completo resta in `data/`.
3. Sì anche nel live futuro: registrato nella nota del mock (`demo/live.html`); si
   implementa quando il live esisterà.
Implementazione in `demo/gara.html` + `demo/stile.css` (solo presentazione: gap, ordine e
motore restano al reale; kernel/modulo pit/golden intatti).
