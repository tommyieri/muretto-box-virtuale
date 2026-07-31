#!/usr/bin/env python3
"""stima_v2.py — stima di rho (degrado) e delta70 (carburante) sul 2026.

Regola 8: questo file NON simula. Stima i coefficienti e produce
data/modelli/modello_v2.json con targhetta; il kernel JavaScript li consuma.
Regola 1 / E12: non ri-definisce "verde" — legge la vista esportata da
provenienza/esporta_vista_verde.mjs, che applica l'unica definizione del repo.

MODELLO (CLAUDE.md §Modello):

    t(pilota, giro) = base(pilota) + delta*(giro-1) + rho*eta_gomma
    delta (s/giro) = -delta70 / N_giri_gara

con delta70 = carburante totale in secondi su 70 kg (convenzione ereditata:
a bordo al giro L ci sono 70 - (70/N)*(L-1) kg, che pesano delta70/70 s/kg).

IDENTIFICAZIONE. Dentro uno stint eta e giro salgono insieme: presi da soli
sarebbero indistinguibili. L'AZZERAMENTO ALLA SOSTA li separa — eta ricomincia
da 1 mentre il giro prosegue. Percio' la stima ha senso solo se i blocchi hanno
piu' stint, e la guardia qui sotto lo verifica invece di darlo per scontato.

EFFETTI FISSI per (gara, pilota): la base cambia per pista e per pilota, quindi
si elimina entro-blocco. Nessun pooling fra gare nell'incertezza: il bootstrap
ricampiona GARE INTERE (E11).

GUARDIA DI RANGO (E10): niente pinv silenziosa. Si guardano autovalori,
numero di condizionamento e correlazione dei regressori dopo la
trasformazione entro-blocco; se il disegno e' degenere la stima si ferma.
"""

import hashlib
import json
import os
import sys

import numpy as np

RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VISTA = os.path.join(RADICE, "data", "viste", "vista_verde_2026.json")
USCITA = os.path.join(RADICE, "data", "modelli", "modello_v2.json")

RIPETIZIONI = 2000
SEME = 20260729
# Sotto questo rapporto fra autovalori il disegno entro-blocco e' degenere:
# eta e giro non sarebbero piu' separabili e la stima sarebbe un artefatto.
TOLLERANZA_RANGO = 1e-8


def muori(messaggio):
    print(f"STIMA RIFIUTATA: {messaggio}", file=sys.stderr)
    sys.exit(1)


def carica():
    """Righe verdi -> array; blocchi (gara, pilota); regressori u e a."""
    with open(VISTA, encoding="utf-8") as f:
        vista = json.load(f)
    gare, blocchi, u, a, t = [], [], [], [], []
    chiavi = {}
    stint_per_blocco = {}
    for nome, gara in sorted(vista["gare"].items()):
        n_giri = gara["n_giri"]
        if not isinstance(n_giri, int) or n_giri < 2:
            muori(f"{nome}: n_giri assurdo ({n_giri})")
        for r in gara["righe"]:
            chiave = (nome, r["drv"])
            if chiave not in chiavi:
                chiavi[chiave] = len(chiavi)
                stint_per_blocco[chiave] = set()
            stint_per_blocco[chiave].add(r["stint"])
            gare.append(nome)
            blocchi.append(chiavi[chiave])
            u.append((r["lap"] - 1) / n_giri)
            a.append(r["eta"])
            t.append(r["t"])
    with open(VISTA, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    return {
        "gare": np.array(gare),
        "blocchi": np.array(blocchi),
        "X": np.column_stack([np.array(u, float), np.array(a, float)]),
        "y": np.array(t, float),
        "stint_per_blocco": stint_per_blocco,
        "sha256_vista": sha,
        "nomi_gare": sorted(vista["gare"].keys()),
    }


def entro_blocco(M, codici):
    """Toglie la media di blocco da ogni colonna (effetti fissi)."""
    n = np.bincount(codici)
    fuori = M - (np.stack([np.bincount(codici, weights=M[:, j]) for j in range(M.shape[1])], axis=1) / n[:, None])[codici]
    return fuori


def stima(X, y, codici, con_guardie=False):
    """Minimi quadrati entro-blocco. Restituisce (coeff_u, coeff_eta, guardie)."""
    Md = entro_blocco(np.column_stack([X, y]), codici)
    Xd, yd = Md[:, :2], Md[:, 2]
    S = Xd.T @ Xd
    autovalori = np.linalg.eigvalsh(S)
    guardie = None
    if autovalori.min() <= 0 or autovalori.min() / autovalori.max() < TOLLERANZA_RANGO:
        muori(
            "disegno entro-blocco a rango non pieno: eta e giro non sono separabili "
            f"(autovalori {autovalori}). Serve piu' di uno stint per blocco: "
            "e' l'azzeramento alla sosta che identifica il modello."
        )
    if con_guardie:
        sd = Xd.std(axis=0)
        corr = float(np.corrcoef(Xd[:, 0], Xd[:, 1])[0, 1]) if sd.min() > 0 else float("nan")
        guardie = {
            "rango": int(np.linalg.matrix_rank(S)),
            "autovalori_XtX": [float(v) for v in autovalori],
            "condizionamento": float(np.sqrt(autovalori.max() / autovalori.min())),
            "correlazione_giro_eta_entro_blocco": corr,
            "nota": "il condizionamento e la correlazione misurano quanto l'azzeramento alla sosta separa davvero eta e giro; niente pinv, niente lstsq: solve esplicita su matrice verificata (E10)",
        }
    # solve esplicita: se S fosse singolare qui, numpy alza — non inventa una pinv
    beta = np.linalg.solve(S, Xd.T @ yd)
    return float(beta[0]), float(beta[1]), guardie


def stima_su(dati, gare_scelte=None, ripetizioni_gara=None):
    """Stima su un sottoinsieme di gare (per LORO) o su un ricampionamento."""
    if ripetizioni_gara is None:
        maschera = np.isin(dati["gare"], gare_scelte) if gare_scelte is not None else np.ones(len(dati["y"]), bool)
        X, y, codici = dati["X"][maschera], dati["y"][maschera], dati["blocchi"][maschera]
        _, codici = np.unique(codici, return_inverse=True)
        return stima(X, y, codici)
    # bootstrap a blocchi: ogni estrazione di una gara e' un blocco a se',
    # con i suoi effetti fissi (una gara estratta due volte conta due volte)
    pezzi_X, pezzi_y, pezzi_c, offset = [], [], [], 0
    for gara in ripetizioni_gara:
        m = dati["gare"] == gara
        c = dati["blocchi"][m]
        _, c = np.unique(c, return_inverse=True)
        pezzi_X.append(dati["X"][m])
        pezzi_y.append(dati["y"][m])
        pezzi_c.append(c + offset)
        offset += c.max() + 1
    return stima(np.vstack(pezzi_X), np.concatenate(pezzi_y), np.concatenate(pezzi_c))


def main():
    dati = carica()
    nomi = dati["nomi_gare"]
    n_blocchi = len(dati["stint_per_blocco"])
    multi_stint = sum(1 for s in dati["stint_per_blocco"].values() if len(s) >= 2)
    if multi_stint == 0:
        muori("nessun blocco con piu' di uno stint: senza soste, eta e giro sono la stessa cosa")

    c_u, rho, guardie = stima(dati["X"], dati["y"], dati["blocchi"], con_guardie=True)
    delta70 = -c_u
    guardie.update({
        "blocchi_gara_pilota": n_blocchi,
        "blocchi_con_almeno_due_stint": multi_stint,
        "frazione_blocchi_identificanti": round(multi_stint / n_blocchi, 4),
    })

    rng = np.random.default_rng(SEME)
    boot_rho, boot_delta = [], []
    for _ in range(RIPETIZIONI):
        estratte = rng.choice(nomi, size=len(nomi), replace=True)
        cu_b, rho_b, _ = stima_su(dati, ripetizioni_gara=estratte)
        boot_rho.append(rho_b)
        boot_delta.append(-cu_b)
    ic = lambda v: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]

    loro = {}
    for gara in nomi:
        cu_l, _, _ = stima_su(dati, gare_scelte=[g for g in nomi if g != gara])
        loro[gara] = round(-cu_l, 6)

    modello = {
        "_targhetta": {
            "tipo": "misurato sul fondo 2026 (11 gare) — modello v2",
            "modello": "t(pilota,giro) = base(pilota) + delta*(giro-1) + rho*eta_gomma ; delta = -delta70/N_giri",
            "delta70": "carburante totale in secondi su 70 kg (a bordo al giro L: 70-(70/N)(L-1) kg, a delta70/70 s/kg)",
            "stimatore": "minimi quadrati entro-blocco, effetti fissi per (gara, pilota)",
            "identificazione": "eta e giro separati dall'azzeramento dell'eta alla sosta; guardia di rango esplicita, niente pinv (E10)",
            "incertezza": f"bootstrap {RIPETIZIONI} ripetizioni, blocchi = gare (E11), seme {SEME}",
            "data": "2026-07-29",
            "fonte": "data/viste/vista_verde_2026.json",
            "sha256_vista": dati["sha256_vista"],
            "prodotto_da": "fisica/stima_v2.py",
            "n_giri_verdi": int(len(dati["y"])),
            "avvertenza": "niente curve per mescola e niente cliff: al giorno 1 le mescole non separano il degrado (p=0,209). Fase 3, con cancello fuori campione.",
        },
        "rho": {
            "valore": round(rho, 6),
            "ic95": [round(v, 6) for v in ic(boot_rho)],
            "unita": "s/giro per giro di eta gomma",
            "targhetta": "misurato, fondo 2026, bootstrap 2.000, blocchi = gare",
        },
        "delta_70": {
            "stimato_libero": round(delta70, 6),
            "ic95": [round(v, 6) for v in ic(boot_delta)],
            "unita": "s su 70 kg",
            "leave_one_race_out": loro,
            "scelto": None,
            "nota": "il valore da usare lo decide l'esperimento pre-registrato (banco/prereg/PREREG_delta.md); finche' 'scelto' e' null, il modello NON e' cablabile",
        },
        "guardie": guardie,
    }
    os.makedirs(os.path.dirname(USCITA), exist_ok=True)
    with open(USCITA, "w", encoding="utf-8") as f:
        json.dump(modello, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"righe verdi: {len(dati['y'])}  blocchi (gara,pilota): {n_blocchi}  con >=2 stint: {multi_stint}")
    print(f"rango {guardie['rango']}  condizionamento {guardie['condizionamento']:.2f}  corr(giro,eta) entro blocco {guardie['correlazione_giro_eta_entro_blocco']:+.4f}")
    print(f"rho      = {rho:.6f}  IC95 {ic(boot_rho)}")
    print(f"delta70  = {delta70:.4f}  IC95 {ic(boot_delta)}")
    print(f"scritto: {os.path.relpath(USCITA, RADICE)}")


if __name__ == "__main__":
    main()
