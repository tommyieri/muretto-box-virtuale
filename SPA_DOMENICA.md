# SPA — checklist per domenica 19/07/2026 sera

Scritta il 16/07 (branch `att6-v2-taratura`). ATTENZIONE: il protocollo v2 a verdetto
automatico (`att6_v2.mjs`) NON è adottato — la validazione retroattiva ha violato l'attesa
T1 (vedi `REPORT_ATT6_V2.md`). Questa checklist è ancorata al **protocollo vigente su
main**: `PREREG_SESSIONE_ATT6_V2.md` (ADDENDUM 4) + `demo/att6.mjs`.

## Numeri già pronti (dai generatori FF committati, calcolati il 16/07)

- Tipico Spa (FF4, engine-ready, 6 blocchi dry 2018–2024): **18,58 s**
- Gara del 19 **giudicabile se il loss mediano è in [16,58; 20,58]** (tipico ± 2,0)
- Grappolo stretto (blocchi in 18,09–19,25): un'atipicità sarà evidente, non marginale
- Produzione/staging attuale per Spa: f1db **23,36** (`data/pit_loss_circuito_f1db.csv`)
- 2025 era WET: se il 19 piove, il parametro dry non si giudica — decisione umana, stop

## La sequenza (ordine obbligato)

1. **Aggiorna la gara demo**: `python3 pipeline_gara.py aggiorna "Belgio" "Belgian Grand Prix" spa-francorchamps`
   (checkpoint umano al prompt 'pubblica'; guardrail completezza/dry/sanità inclusi).
2. **Rigenera gli stop per-gara** (FF5, aggiunge le righe 2026 di Spa):
   `python3 gen_pitloss_pergara.py` — con la cache in `~/muretto_shared/ff1_cache/`.
   Verifica che compaiano righe `spa-francorchamps,2026` in `data/pergara_stops.csv`.
3. **Candidato**: il valore FF engine-ready di Spa (tipico 18,58, o il realizzato per-gara
   se la politica demo = realizzato, come per Miami/Silverstone — due parametri, vedi
   `NOTA_PITLOSS_PERGARA.md`).
4. **Smoke test col protocollo vigente**: da root,
   `node demo/att6.mjs spa-francorchamps 2026 <CANDIDATO>`
   - tipicità ATIPICA → né attivazione né rollback: il candidato aspetta; fine.
   - caso SENSIBILE peggiorato → si guarda e si spiega PRIMA di attivare (regola dura).
   - altrimenti → attivazione possibile al checkpoint umano.
5. **Micro-attivazione (protocollo Silverstone)**, solo se il punto 4 non blocca:
   - branch dedicato, **due fonti**: `demo/data/pitloss.json` ("Belgio") e
     `data/pit_loss_circuito_f1db.csv` (spa-francorchamps) — mai una sola;
   - tag pre-attivazione, nota di attivazione (modello `NOTA_SILVERSTONE.md`);
   - golden: rigenerare i casi golden toccati, `node test_pit.mjs` da `demo/` 11/11,
     `node test_b.mjs` 449/449;
   - **merge solo DOPO la tabella nel report** — il merge è il checkpoint, decisione PO.
6. **Se qualcosa sorprende**: fermarsi e scrivere la sorpresa. È il risultato.

## Cosa NON fare domenica

- Non usare `att6_v2.mjs` per decidere: non adottato (T1 violata, metrica con denominatori
  disallineati sui casi sensibili). Se il PO vorrà un v3, serve un nuovo prereg PRIMA.
- Non ricalibrare soglie o metodo a gara in corso; non toccare kernel/gancio/telemetria.
- Non attivare su gara wet o atipica: il candidato può aspettare la prossima Spa.
