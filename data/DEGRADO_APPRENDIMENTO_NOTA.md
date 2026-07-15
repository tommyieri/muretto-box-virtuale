# NOTA APPRENDIMENTO — Degrado: da fisico (NO-GO) a operativo (banda)

*Da committare accanto a `data/DEGRADO_STORICO_CORE5_REPORT.txt`. Scopo: incidere il perché,
così non lo ri-scopriamo tra sei mesi e non ripercorriamo una strada già misurata come chiusa.*

## 1. Cosa abbiamo testato e con quale disciplina
Studio di stabilità cross-anno (2023-2025) dell'**ordinamento del degrado condizionato al
circuito**, sui 5 circuiti con 3 anni pienamente comparabili (terna consecutiva stabile,
nessuna riasfaltatura/modifica-layout): Abu Dhabi, Austria, Bahrain, Ungheria, Spagna. KPI
dichiarato PRIMA dei numeri: due rapporti adimensionali per circuito (r1 = γ_soft/γ_medium,
r2 = γ_medium/γ_hard), primario Cochran Q (omogeneità, p≥0.05) + secondario range relativo
≤0.25, entrambi su entrambi i rapporti; metodo VALIDATO se stabile ≥3/5.

Esito: **0/5 → NON-VALIDATO.** Onorato senza toccare la soglia dopo aver visto i numeri.

## 2. Il learning che vale più dello 0/5: due fallimenti indipendenti, non uno
- **r2 (medium/hard) — negativo GENUINO.** Rapporto ben identificabile, davvero testato:
  2 stabili (Austria, Spagna), 2 instabili (Abu Dhabi Q p=0.006 rr=0.68; Ungheria p=0.026
  rr=0.88), 1 non testabile (Bahrain). Anche la gomma da **gara**, sui circuiti più
  prevedibili del calendario, non mostra stabilità cross-anno.
- **r1 (soft/medium) — INCONCLUSIVO per identificabilità, non instabile.** Il SOFT è gomma da
  qualifica ad Abu Dhabi/Austria/Ungheria: non genera stint-gara → γ_soft NULL → r1 salta.
  Calcolabile solo alla Spagna (3 anni), dove poi sfora il range (rr=0.41).

## 3. Il muro strutturale (il vero apprendimento)
**I due criteri che definiscono il set pulito sono anti-correlati con il fatto che il soft si
corra.** Abbiamo scelto i circuiti dove Pirelli NON cambia assegnazione — ma quelli sono
esattamente i circuiti dove il soft NON è gomma da gara. Dove il soft si corre (Monaco, Baku,
Miami, Messico) Pirelli sperimenta di continuo (C6, terne con salto, riasfaltature), quindi
niente 3 anni comparabili. Formalmente:

> **assegnazione-stabile ⊥ soft-corso-in-gara** (finestra 2023-2025)

Conseguenza: il rapporto soft/medium condizionato al circuito **non è misurabile in modo
pulito a regolamento fermo**. NON è un problema di quantità di dati — più gare 2023-25 non lo
sbloccano. È lo stesso muro del NO-GO degrado originale, visto da un lato nuovo.

## 4. Caveat registrati (per non sovra-leggere il risultato)
- Le **4 violazioni d'ordinamento** (Austria'25, Bahrain'25, Ungheria'24, Spagna'24: soft che
  degrada ≤ medium) NON sono una scoperta fisica: sono il sintomo che i pochi γ_soft esistenti
  poggiano su stint minuscoli e non rappresentativi. Rafforzano la lettura "r1 inaffidabile
  qui", non la contraddicono.
- Alla **Spagna** il Q-test non rifiutava (p=0.426) ma il range sì (0.41): il **criterio
  doppio ha fatto il suo lavoro**, evitando un falso PASS guidato da barre d'errore enormi su
  dati rumorosi. Il KPI blindato ha tenuto.

## 5. Verdetto inciso
NO-GO degrado **confermato e meglio caratterizzato**: non "non ci abbiamo provato", ma
"provato, con esito robusto, per **due ragioni indipendenti**" (identificabilità strutturale
su r1 + instabilità genuina su r2). NULL credibile, coerente con lo "stretto e solido".

## 6. La svolta: degrado OPERATIVO, non fisico
Smettere di stimare il degrado fisico universale γ = f(circuito, compound) — appena dimostrato
non identificabile in modo robusto. Il motore non deve rispondere a "qual è il degrado della
gomma?" ma a **"se allungo di 5 giri, quanto perdo rispetto a fermarmi ora?"** (routing, non
predizione — la filosofia di sempre).

**Decisioni architetturali (vincolanti):**
1. **Il degrado è sempre una BANDA (min, centrale, max), mai un punto.** Un prior debole
   spacciato per numero singolo è la classe warm-in (sembra preciso, è artefatto). Una banda
   dichiarata non può mentire allo stesso modo: l'incertezza è nel tipo di dato, non nascosta.
2. **Meccanismo PRIMA dei numeri.** Si costruisce il gancio che riceve e propaga la banda
   senza NESSUna assunzione di magnitudine. L'ordine di grandezza vero lo misurano i replay
   storici; solo dopo si sceglie ampiezza della banda e KPI di copertura.
3. **La banda si propaga come tre scenari coerenti end-to-end**, non come ±rumore sul
   risultato finale: sotto SC/VSC, traffico al rientro, stint lunghi, l'effetto sul tempo non
   è lineare e tre run interi mantengono la coerenza fisica.
4. **Sotto SC/VSC il degrado va soppresso/congelato** (come i gap nel modulo pit, correzione
   C1): un'auto in regime neutralizzato non degrada come in verde, e applicare il degrado
   grezzo lì sarebbe un numero biased. Vale in **fase replay** (i giri neutralizzati escono
   dalla misura, `status != '1'`) e in **fase live** (la penalità si spegne sotto SC/VSC).

**Sequenza:** v1 (nessun degrado, oggi) → **v1.5** (gancio-banda additivo, zero magnitudine,
zero KPI) → replay (misura l'ordine di grandezza vero, 50-100 stint allungati 4-6 giri) →
v2 (banda stimata dai dati del weekend, NULL onesto sui compound non corsi) → v3 (AI stima il
prior da FP/Pirelli/meteo/temperature; l'AI NON decide, fornisce solo il prior con confidenza).

## 7. Cosa NON faremo (per iscritto)
- **Nessun γ = f(circuito, compound).** Riaprirlo rinnegherebbe questo NULL robusto.
- **Dopo un NULL, non si ridisegna il test per ottenere un'altra risposta** (no studio
  solo-r2, no ripescaggio di circuiti a 2 anni per inseguire un 3/5). Se un giorno si riapre,
  è una domanda NUOVA con KPI pre-registrato, non un aggiustamento di questa.
- **Nessuna magnitudine di degrado inventata a monte**, nemmeno "solo per calibrare una banda
  o una soglia": è il gesto warm-in. Prima il meccanismo, poi la misura, poi i numeri.
