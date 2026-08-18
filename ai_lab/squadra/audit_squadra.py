"""
audit_squadra.py — Regista & Orchestratore della Squadra Agenti del Muretto

Esegue l'audit completo multi-agente e genera il report unificato per il PO (Tommi):
1. Inquisitore del Simulatore (Fuzzing, tempi giro, coerenza soste)
2. Notaio dei Dati (Integrità fonti, checksum, pit-loss)
3. Collaudatore Web (Link 404, responsive, coerenza DOM)
4. Stratega del Prodotto (Proposte di nuove funzionalità e telemetrie)
"""
import os
import sys
import datetime

_QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _QUI)

from audit_simulatore import audit_simulatore_dati_gara
from audit_dati import audit_dati_integrita
from audit_web import audit_web_frontend


def esegui_audit_completo():
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Agente Simulatore
    res_sim = audit_simulatore_dati_gara()

    # 2. Agente Dati
    res_dati = audit_dati_integrita()

    # 3. Agente Web
    res_web = audit_web_frontend()

    # 4. Agente Stratega (Ideazione & Proposte Nuove Feature)
    proposte_stratega = [
        {
            "id": "STRAT-01",
            "titolo": "Modulo di Telemetria Lift & Coast (Risparmio Carburante & Batteria)",
            "descrizione": "Rilevatore che calcola per ogni pilota i metri percorsi a gas zero prima della frenata sul rettilineo principale (efficienza energetica).",
            "impatto": "Alto per GP con gestione consumi (Monza, Spa, Baku).",
            "stato": "PRONTO PER IMPLEMENTAZIONE"
        },
        {
            "id": "STRAT-02",
            "titolo": "Confronto Diretto Head-to-Head nel Simulatore What-If",
            "descrizione": "Consentire la selezione di DUE piloti contemporaneamente su whatif.html (es. Norris vs Leclerc) con sovrapposizione delle due strategie controfattuali.",
            "impatto": "Migliora l'engagement degli appassionati durante i duelli di testa.",
            "stato": "PROPOSTA DI DESIGN"
        }
    ]

    p0 = []
    p1 = []
    p2 = []

    # Categorizzazione anomalie
    for e in res_sim.get("errori", []):
        p0.append(f"[Simulatore] {e}")
    for e in res_dati.get("errori", []):
        p0.append(f"[Dati] {e}")
    for e in res_web.get("errori", []):
        p0.append(f"[Web/UX] {e}")

    for a in res_sim.get("avvisi", []):
        p1.append(f"[Simulatore] {a}")
    for a in res_dati.get("avvisi", []):
        p1.append(f"[Dati] {a}")
    for a in res_web.get("avvisi", []):
        p1.append(f"[Web/UX] {a}")

    for prop in proposte_stratega:
        p2.append(f"[{prop['id']}] **{prop['titolo']}**: {prop['descrizione']} ({prop['impatto']})")

    tutto_ok = len(p0) == 0

    report = f"""# REPORT DI AUDIT MULTI-AGENTE — MURETTO BOX VIRTUALE
Data esecuzione: {ts}

## 1. Stato della Squadra di Agenti

| Ruolo | Agente Specializzato | Controlli | Esito |
|---|---|---|---|
| **Agente 1** | Inquisitore del Simulatore | {res_sim.get('controlli_eseguiti', 0)} piloti / sessioni | {'✅ PASS' if res_sim['status'] == 'PASS' else '❌ FAIL'} |
| **Agente 2** | Notaio dei Dati & Contratti | {res_dati.get('controlli_eseguiti', 0)} verifiche contrattuali | {'✅ PASS' if res_dati['status'] == 'PASS' else '❌ FAIL'} |
| **Agente 3** | Collaudatore Web & UX | {res_web.get('controlli_eseguiti', 0)} pagine & sitemap | {'✅ PASS' if res_web['status'] == 'PASS' else '❌ FAIL'} |
| **Agente 4** | Stratega del Prodotto | 2 nuove feature formulate | 💡 PROPOSTE ATTIVE |

---

## 2. Sintesi Priorità per il Product Owner

### Priorità P0 (Bug Bloccanti & Corruzioni Dati)
"""

    if p0:
        for item in p0:
            report += f"- ❌ {item}\n"
    else:
        report += "✅ **Nessun bug bloccante rilevato.** Tutti i motori di calcolo, contratti e link web sono sani.\n"

    report += "\n### Priorità P1 (Avvisi di Qualità & Ottimizzazioni Minori)\n"
    if p1:
        for item in p1[:8]:
            report += f"- ⚠️ {item}\n"
        if len(p1) > 8:
            report += f"- *... e altri {len(p1)-8} avvisi minori.*"
    else:
        report += "✅ Nessun avviso di qualità.\n"

    report += "\n### Priorità P2 (Proposte di Nuove Feature dallo Stratega)\n"
    for item in p2:
        report += f"- 💡 {item}\n"

    return {
        "success": tutto_ok,
        "report_md": report,
        "p0": p0,
        "p1": p1,
        "p2": p2
    }


if __name__ == "__main__":
    esito = esegui_audit_completo()
    print(esito["report_md"])
