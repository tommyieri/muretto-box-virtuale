# Muretto Box Virtuale — Memory & Istruzioni Progetto

## Profilo & Principi
- **Tommi**: Product Owner del progetto **Muretto Box Virtuale** (simulatore di strategia F1, analisi tecnica, live timing). Non legge codice direttamente: pretende rigore, verità numerica e trasparenza.
- **La fonte dati è la verità**: I dati derivano SOLO da **f1db / FastF1 / TI / OpenF1**, MAI trascritti a mano. Ogni valore in produzione deve avere generatore committato e nota di metodo.
- **Pre-registrazione obbligatoria**: I criteri di successo e le soglie di stop si fissano PRIMA dei numeri e si onorano sempre (nessun aggiustamento post-hoc).
- **Comunicazione**: Rigorosamente in italiano.

---

## Sentinella & Validazione Obbligatoria
Prima di chiudere ogni sessione o proporre merge, eseguire SEMPRE il comando unificato di validazione:
```bash
python3 sentinella.py
```
La sentinella esegue 9 verifiche:
1. Golden Motore JS (`test_b.mjs`, 443/443 casi, diff < 1e-9)
2. Golden Modulo Pit (`demo/test_pit.mjs`, 33/33 casi)
3. Hook Degrado & Banda-Zero (`test_degrado_hook.mjs`)
4. Checksum f1db (`test_f1db_checksum.mjs`)
5. Guard Anti-Travaso Pit-Loss (`test_guard_travaso.py`)
6. Coerenza Doppia Fonte Pit-Loss (`demo/data/pitloss.json` vs `data/pit_loss_circuito_f1db.csv`)
7. Sentinella Statistiche & Web UI (`demo/test_stat.mjs`, 0 link 404, livree al 100%)
8. Sigilli Numerici del Simulatore (`simulatore/gen_numeri_ereditati.py --verifica`)
9. Sentinella Consumo Orfani e File Archiviati

---

## Stato del Repository & File Chiave
- **File Archiviati**: `data/pit_loss_circuito.csv` è stato spostato in `data/archivio/` (insieme a `sc_safety_car.csv`, `neutralization_model_2026.csv`, `telemetria_proto_*`). Nessun codice vivo li consuma.
- **File Scratch**: Tutti i vecchi script `diag_*`, `patch_*`, `apply_patch.py`, `.bak2` sono stati rimossi. Non ricrearli nella root: usa test formali o moduli dedicati.
- **Riproducibilità**: `data/_warmin_raw_multiyear.pkl` è tracciato per consentire a `finalize_warmin.py` di riprodurre `data/warmin_prior.csv` in modo deterministico e offline.
- **CI/CD**: `sentinella.py` è integrato nel workflow GitHub Actions [`.github/workflows/banco.yml`](.github/workflows/banco.yml).

---

## Avanzamenti Recenti (Cantieri Completati)
1. **Cantiere 1 (UX Sezione Analisi & Articoli Correlati)**:
   - `demo/analisi.html`: Nuova barra filtri a due livelli (Gara + Team & Tema) con pillole attive e conteggio dinamico.
   - `ai_lab/redazione/statico.py`: Generatore automatico della sezione `<section class="art-correlati">` in calce a ciascun articolo pre-renderizzato.
   - `demo/muro.css`: Stili responsive dark mode per `.art-correlati`, `.art-correlati-grid`, `.art-correlato-card`, e `.filtri-wrap`.
2. **Cantiere 2 (Rilevatori Telemetrici)**:
   - `ai_lab/redazione/genera_hun_frenata_trail.py`: Rilevatore telemetrico di staccata e trail-braking in ingresso curva, con fatti JSON e grafico SVG a barre.
   - `ai_lab/redazione/registro.py`: Registrato tra i generatori ufficiali e validato con `python3 ai_lab/redazione/test_redazione.py` (22/22 PASS).
3. **Cantiere 3 (Simulatore Interattivo What-If & Sliding Doors)**:
   - `demo/whatif.html` e `demo/whatif.mjs`: Simulatore interattivo di strategie controfattuali ($L_{\text{alt}} = L \pm n$, mescole Hard/Medium/Soft) con calcolo rientro nel traffico, baseline reale vs simulata e delta tempo finale $\Delta T$.
   - Integrato nella sezione strumenti di `demo/analisi.html`, registrato in `PAGINE_FISSE` e validato da `demo/test_stat.mjs`.

---

## Co-working tra Agenti (Claude Code / Antigravity IDE)
- Il codice e Git sono l'unico punto di verità condiviso.
- A ogni avanzamento significativo o modifica strutturale, aggiornare questo file (`CLAUDE.md`) e `AGENTS.md` per mantenere tutti gli agenti allineati al 100%.
