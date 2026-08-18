#!/usr/bin/env python3
"""sentinella.py — Sentinella Unificata di Integrità & Invarianti del Muretto.

Orchestra e valida in un solo comando l'intero set di invarianti di calcolo,
test golden, integrità dei dati, coerenza delle fonti e assenza di regressioni.

Uso:
    python3 sentinella.py

Exit code:
    0 = TUTTI I CONTROLLI PASSATI (Verde)
    1 = ALMENO UN CONTROLLO FALLITO (Rosso)
"""

import os
import sys
import subprocess
import json
import csv
from pathlib import Path

# Colori per il terminale
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

ROOT_DIR = Path(__file__).resolve().parent

class SentinellaRunner:
    def __init__(self):
        self.results = []
        self.total_checks = 0
        self.passed_checks = 0

    def run_check(self, name: str, cmd: list[str], cwd: Path = ROOT_DIR, expect_in_output: str | None = None) -> bool:
        self.total_checks += 1
        print(f"\n{BOLD}[{self.total_checks}] {name}...{RESET}")
        try:
            res = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                check=False
            )
            stdout = res.stdout.strip()
            stderr = res.stderr.strip()
            
            ok = (res.returncode == 0)
            if expect_in_output and expect_in_output not in stdout and expect_in_output not in stderr:
                ok = False

            if ok:
                self.passed_checks += 1
                print(f"    {GREEN}✓ PASS{RESET}")
                if stdout:
                    summary = stdout.splitlines()[-1] if stdout.splitlines() else ""
                    print(f"      {CYAN}» {summary}{RESET}")
                self.results.append((name, True, ""))
                return True
            else:
                print(f"    {RED}✗ FAIL (exit code {res.returncode}){RESET}")
                if stdout:
                    print(f"      {YELLOW}[STDOUT]{RESET} {stdout[:400]}")
                if stderr:
                    print(f"      {RED}[STDERR]{RESET} {stderr[:400]}")
                self.results.append((name, False, stderr or stdout))
                return False
        except Exception as e:
            print(f"    {RED}✗ EXCEPTION: {e}{RESET}")
            self.results.append((name, False, str(e)))
            return False

    def check_pitloss_sources_coherence(self) -> bool:
        """Verifica coerenza delle due fonti pit-loss (demo/data/pitloss.json vs data/pit_loss_circuito_f1db.csv)."""
        self.total_checks += 1
        name = "Coerenza Doppia Fonte Pit-Loss (JSON vs CSV f1db)"
        print(f"\n{BOLD}[{self.total_checks}] {name}...{RESET}")

        try:
            json_path = ROOT_DIR / "demo" / "data" / "pitloss.json"
            csv_path = ROOT_DIR / "data" / "pit_loss_circuito_f1db.csv"
            meta_path = ROOT_DIR / "demo" / "data" / "pitloss_meta.json"

            if not json_path.exists() or not csv_path.exists():
                print(f"    {RED}✗ File sorgenti mancanti{RESET}")
                self.results.append((name, False, "File mancanti"))
                return False

            with open(json_path) as f:
                pl_json = json.load(f)

            meta = {}
            if meta_path.exists():
                with open(meta_path) as f:
                    meta = json.load(f)

            pl_csv = {}
            with open(csv_path) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    pl_csv[row["cid"]] = float(row["pit_loss_s"])

            # Mappa gran premio -> cid
            gp_to_cid = {
                "Australia": "melbourne",
                "Cina": "shanghai",
                "Giappone": "suzuka",
                "Miami": "miami",
                "Canada": "montreal",
                "Monaco": "monaco",
                "Spagna": "catalunya",
                "Austria": "spielberg",
                "Gran Bretagna": "silverstone",
                "Belgio": "spa-francorchamps",
                "Ungheria": "hungaroring"
            }

            discrepanze = []
            for gp, val_json in pl_json.items():
                cid = gp_to_cid.get(gp)
                if not cid or cid not in pl_csv:
                    continue
                val_csv = pl_csv[cid]
                is_realizzato = meta.get(gp, {}).get("provenienza") == "realizzato"
                if not is_realizzato and abs(float(val_json) - float(val_csv)) > 0.001:
                    discrepanze.append(f"{gp} (cid={cid}): JSON={val_json} vs CSV={val_csv}")

            # Controlli espliciti obbligatori di produzione (Silverstone e Spa)
            if abs(float(pl_json.get("Gran Bretagna", 0)) - 20.80) > 0.001:
                discrepanze.append(f"Silverstone JSON non allineato a 20.80 (trovato {pl_json.get('Gran Bretagna')})")
            if abs(float(pl_csv.get("silverstone", 0)) - 20.80) > 0.001:
                discrepanze.append(f"Silverstone CSV non allineato a 20.80 (trovato {pl_csv.get('silverstone')})")
            if abs(float(pl_json.get("Belgio", 0)) - 23.36) > 0.001:
                discrepanze.append(f"Spa JSON non allineato a 23.36 (trovato {pl_json.get('Belgio')})")
            if abs(float(pl_csv.get("spa-francorchamps", 0)) - 23.36) > 0.001:
                discrepanze.append(f"Spa CSV non allineato a 23.36 (trovato {pl_csv.get('spa-francorchamps')})")

            if discrepanze:
                print(f"    {RED}✗ FAIL — Discrepanze rilevate tra le fonti:{RESET}")
                for d in discrepanze:
                    print(f"      {RED}» {d}{RESET}")
                self.results.append((name, False, "\n".join(discrepanze)))
                return False
            else:
                self.passed_checks += 1
                print(f"    {GREEN}✓ PASS{RESET}")
                print(f"      {CYAN}» 11 Gran Premi controllati, Silverstone (20.80) e Spa (23.36) certificati al centesimo{RESET}")
                self.results.append((name, True, ""))
                return True
        except Exception as e:
            print(f"    {RED}✗ EXCEPTION: {e}{RESET}")
            self.results.append((name, False, str(e)))
            return False

    def check_orphan_consumption(self) -> bool:
        """Verifica statica: nessun file attivo consuma file archiviati o orfani non autorizzati."""
        self.total_checks += 1
        name = "Sentinella Consumo Orfani e File Archiviati"
        print(f"\n{BOLD}[{self.total_checks}] {name}...{RESET}")

        forbidden_patterns = [
            "data/archivio/",
            "pit_loss_circuito.csv",
            "sc_safety_car.csv",
            "neutralization_model_2026.csv",
            "telemetria_proto_data.json"
        ]

        violations = []
        scan_paths = [ROOT_DIR / "demo", ROOT_DIR / "simulatore", ROOT_DIR / "live"]
        root_scripts = [f for f in ROOT_DIR.glob("*.py")] + [f for f in ROOT_DIR.glob("*.mjs")]

        files_to_check = root_scripts.copy()
        for p in scan_paths:
            if p.exists():
                files_to_check.extend(p.rglob("*.py"))
                files_to_check.extend(p.rglob("*.mjs"))
                files_to_check.extend(p.rglob("*.html"))

        for file_path in files_to_check:
            if file_path.name in ["sentinella.py", "audit_inventario.csv"] or ".git" in file_path.parts:
                continue
            try:
                content = file_path.read_text(errors="ignore")
                for pat in forbidden_patterns:
                    if pat in content and not ("# " in content and "archiviato" in content.lower()):
                        if 'open(' in content and pat in content:
                            violations.append(f"{file_path.relative_to(ROOT_DIR)} apre {pat}")
            except Exception:
                pass

        if violations:
            print(f"    {RED}✗ FAIL — Rilevati consumi di file orfani/archiviati in produzione:{RESET}")
            for v in violations:
                print(f"      {RED}» {v}{RESET}")
            self.results.append((name, False, "\n".join(violations)))
            return False
        else:
            self.passed_checks += 1
            print(f"    {GREEN}✓ PASS{RESET}")
            print(f"      {CYAN}» Zero consumi di file orfani o archiviati nel codice vivo{RESET}")
            self.results.append((name, True, ""))
            return True

    def summary(self) -> int:
        print(f"\n{'='*70}")
        print(f"{BOLD}RIEPILOGO SENTINELLA MURETTO{RESET}")
        print(f"{'='*70}")

        all_ok = True
        for name, ok, err in self.results:
            status = f"{GREEN}[PASS]{RESET}" if ok else f"{RED}[FAIL]{RESET}"
            print(f"  {status} {name}")
            if not ok and err:
                for line in err.splitlines()[:2]:
                    print(f"         {YELLOW}└─ {line}{RESET}")
            if not ok:
                all_ok = False

        print(f"{'='*70}")
        if all_ok:
            print(f"{GREEN}{BOLD}✓ STATO DI SALUTE: 100% VERDE ({self.passed_checks}/{self.total_checks} verifiche superate){RESET}")
            print(f"{GREEN}Il sistema è conforme a tutte le invarianti, golden e contratti dati.{RESET}\n")
            return 0
        else:
            failed = self.total_checks - self.passed_checks
            print(f"{RED}{BOLD}✗ STATO DI SALUTE: {failed} CONTROLLI FALLITI su {self.total_checks}{RESET}\n")
            return 1


def main():
    print(f"{BOLD}{CYAN}")
    print("  =======================================================")
    print("       MURETTO BOX VIRTUALE — SENTINELLA DI VALIDAZIONE")
    print("  =======================================================")
    print(f"{RESET}")

    runner = SentinellaRunner()

    # 1. Golden Motore JS (443/443, diff < 1e-9)
    runner.run_check(
        name="Golden Motore JS col-traffico (test_b.mjs)",
        cmd=["node", "test_b.mjs"],
        expect_in_output="PASS: motore JS allineato"
    )

    # 2. Modulo Pit (33 casi golden)
    runner.run_check(
        name="Golden Modulo Pit (demo/test_pit.mjs)",
        cmd=["node", "test_pit.mjs"],
        cwd=ROOT_DIR / "demo",
        expect_in_output="combaciano col golden"
    )

    # 3. Hook Degrado e Invariante Banda-Zero
    runner.run_check(
        name="Hook Degrado & Invariante Banda-Zero (test_degrado_hook.mjs)",
        cmd=["node", "test_degrado_hook.mjs"],
        expect_in_output="PASS"
    )

    # 4. Checksum f1db Dataset Pinnato
    runner.run_check(
        name="Integrità Checksum f1db (test_f1db_checksum.mjs)",
        cmd=["node", "test_f1db_checksum.mjs"],
        expect_in_output="invariato"
    )

    # 5. Guard Anti-Travaso Pit-Loss
    runner.run_check(
        name="Guard Anti-Travaso Pit-Loss (test_guard_travaso.py)",
        cmd=["python3", "test_guard_travaso.py"],
        expect_in_output="test_guard_travaso: 3 casi + controprova verdi"
    )

    # 6. Coerenza Doppia Fonte Pit-Loss
    runner.check_pitloss_sources_coherence()

    # 7. Sentinella Sezione Statistiche, UI & Pagine
    runner.run_check(
        name="Sentinella Statistiche & Pagine Web (demo/test_stat.mjs)",
        cmd=["node", "test_stat.mjs"],
        cwd=ROOT_DIR / "demo"
    )

    # 8. Sigilli Numerici Ereditati Simulatore
    sigilli_script = ROOT_DIR / "simulatore" / "gen_numeri_ereditati.py"
    if sigilli_script.exists():
        runner.run_check(
            name="Integrità Sigilli Numerici (simulatore/gen_numeri_ereditati.py)",
            cmd=["python3", "simulatore/gen_numeri_ereditati.py", "--verifica"],
            expect_in_output="i numeri ereditati coincidono con i sigilli"
        )

    # 9. Sentinella Consumo Orfani e File Archiviati
    runner.check_orphan_consumption()

    # 10. Sentinella What-If: i NUMERI della pagina, non la sua esistenza.
    #
    # Nasce il 17/08/2026 da un buco misurato. La pagina whatif.html era andata online lo
    # stesso giorno leggendo l'archivio nella forma sbagliata: menù dei piloti coi campi del
    # file, passo base sul ripiego di 85,0 s, «posizione di rientro» sempre P1 — e la
    # sentinella restava 9/9 verde, perché il controllo 7 (test_stat.mjs) sorveglia che una
    # pagina esista, sia linkata e legga solo demo/data/, e dice di sé per iscritto che «non
    # apre un browser». Nessuno dei nove guardava un numero prodotto da una pagina.
    # L'invariante forte è lo zero: sposto la sosta dove già era, e i due bracci dello stesso
    # motore devono coincidere al miliardesimo.
    runner.run_check(
        name="Sentinella What-If (demo/test_whatif.mjs)",
        cmd=["node", "test_whatif.mjs"],
        cwd=ROOT_DIR / "demo",
        expect_in_output="sentinella what-if: tutto verde"
    )

    exit_code = runner.summary()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
