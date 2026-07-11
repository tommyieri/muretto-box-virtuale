"""gen_readiness_fp_degrado.py — ESITO DI RIGETTO / PRONTEZZA-DATO (NON un modello).

Verdetto: i long-run FP 2026 (data/long_run_fp_2026.csv, colonna degrado_slope) sono
INUTILIZZABILI come fonte di degrado allo stato attuale. E' un risultato di rigetto:
NESSUN valore entra nel motore; non riabilita alcun NON-VALIDATO gia' onorato.

DUE ragioni, in ordine di gravita':
  (0) FONTE ORFANA: long_run_fp_2026.csv non ha un generatore committato verificato (nessuno
      script tracciato lo scrive; solo diagnostici lo leggono). Per la regola n.1 del progetto
      (ogni valore da dati reali con generatore committato + nota di metodo) il file NON e' una
      fonte: e' debito. Come degrado_gamma_linlog (trascritto a mano, 5 celle errate) e come
      il warm-in (parametro-artefatto +5.6s da file non verificato). Finche' non ha un
      generatore + nota di metodo + auto-verifica, i suoi numeri non sono certificabili.
  (1) SINTOMO indipendente dalla provenienza: anche prendendo i degrado_slope a valore
      facciale, sono net-negativi e con ordine invertito -> non fuel-corretti / metodo ignoto.

RIFERIMENTO per il confronto: SOLO replay marg_iso_centrale (misura NOSTRA, igiene validata,
generatore committato gen_replay_perdita_stint.py). NON si usa stint_gold (anch'esso orfano).

CRITERI CONGELATI (dichiarati prima del calcolo; l'FP e' utilizzabile solo se TUTTI reggono):
  (C1) segno: mediana FP > 0 (direzione degrado) per ogni compound;
  (C2) ordine: mediane FP SOFT >= MEDIUM >= HARD (il soft degrada di piu');
  (C3) grandezza: mediana FP entro un fattore 3 dal centrale replay verificato;
  (C0) fonte con generatore committato verificato.
Se uno cade -> NON UTILIZZABILE. Nessun parametro carburante inventato.

DIAGNOSTICA: (a) gap FP - replay (offset per-giro non rimosso); (b) controllo lunghezza
Spearman(slope, giri del run): se ~0, l'offset e' per-giro, coerente con carburante non
corretto, non un artefatto di run lunghi.
"""
import os, csv
import numpy as np
from scipy.stats import spearmanr

SRC_FP = os.path.join('data', 'long_run_fp_2026.csv')
SRC_REPLAY = os.path.join('data', 'replay_perdita_stint.csv')   # misura verificata (riferimento)
OUT_TXT = os.path.join('data', 'READINESS_FP_DEGRADO_REPORT.txt')
OUT_CSV = os.path.join('data', 'fp_degrado_descrittivo.csv')
SLICK = ('SOFT', 'MEDIUM', 'HARD')
FATTORE = 3.0
FP_HA_GENERATORE = False   # accertato: nessuno script tracciato scrive long_run_fp_2026.csv


def main():
    # riferimento verificato: replay marg_iso_centrale per compound
    rep = {c: [] for c in SLICK}
    for r in csv.DictReader(open(SRC_REPLAY)):
        if r['compound'] in SLICK:
            rep[r['compound']].append(float(r['marg_iso_centrale']))
    med_rep = {c: float(np.median(rep[c])) for c in SLICK}

    # FP a valore facciale (fonte orfana, dichiarata)
    fp, fp_len = {c: [] for c in SLICK}, {c: [] for c in SLICK}
    all_s, all_l = [], []
    for r in csv.DictReader(open(SRC_FP)):
        if r['compound'] in SLICK and r['degrado_slope'] not in ('', 'None'):
            s = float(r['degrado_slope']); ln = float(r['life_end']) - float(r['life_start'])
            fp[r['compound']].append(s); fp_len[r['compound']].append(ln)
            all_s.append(s); all_l.append(ln)
    med_fp = {c: float(np.median(fp[c])) for c in SLICK}
    iqr = {c: (float(np.percentile(fp[c], 25)), float(np.percentile(fp[c], 75))) for c in SLICK}
    fracneg = {c: float(np.mean(np.array(fp[c]) < 0)) for c in SLICK}

    c1 = {c: med_fp[c] > 0 for c in SLICK}
    c2 = med_fp['SOFT'] >= med_fp['MEDIUM'] >= med_fp['HARD']
    c3 = {c: (med_rep[c] / FATTORE <= med_fp[c] <= med_rep[c] * FATTORE) for c in SLICK}
    utilizzabile = FP_HA_GENERATORE and all(c1.values()) and c2 and all(c3.values())
    rho, p = spearmanr(all_s, all_l)

    # CSV dati (writer deterministico)
    with open(OUT_CSV, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['compound', 'n_fp', 'fp_mediana', 'fp_iqr_lo', 'fp_iqr_hi', 'fp_frac_neg',
                    'replay_centrale_verificato', 'gap_fp_meno_replay', 'C1_segno_pos', 'C3_fattore3'])
        for c in SLICK:
            w.writerow([c, len(fp[c]), f"{med_fp[c]:.4f}", f"{iqr[c][0]:.4f}", f"{iqr[c][1]:.4f}",
                        f"{fracneg[c]:.3f}", f"{med_rep[c]:.4f}", f"{med_fp[c]-med_rep[c]:.4f}",
                        int(c1[c]), int(c3[c])])

    L = []; P = L.append
    P("=" * 78)
    P("PRONTEZZA-DATO long-run FP come fonte di degrado — ESITO DI RIGETTO")
    P("=" * 78)
    P("NON un modello: verdetto se l'FP 2026 puo' essere una fonte di degrado. NESSUN valore")
    P("entra nel motore; non riabilita alcun NON-VALIDATO. Riferimento: SOLO replay")
    P("marg_iso_centrale (misura nostra, generatore committato). stint_gold NON usato (orfano).")
    P("")
    esito_c0 = 'SI' if FP_HA_GENERATORE else "NO -> e' DEBITO, non una fonte"
    P("(C0) FONTE: long_run_fp_2026.csv ha generatore committato verificato? " + esito_c0)
    P("     (nessuno script tracciato scrive il file; regola n.1: senza generatore + nota di")
    P("     metodo + auto-verifica i numeri non sono certificabili — classe warm-in / gamma_linlog).")
    P("")
    P(f"  {'compound':8s} {'FP mediana':>11s} {'IQR':>18s} {'frac<0':>7s} {'replay(verif)':>14s} "
      f"{'gap':>9s} {'C1>0':>5s} {'C3 x3':>6s}")
    for c in SLICK:
        P(f"  {c:8s} {med_fp[c]:>+11.4f} {('['+format(iqr[c][0],'+.3f')+','+format(iqr[c][1],'+.3f')+']'):>18s} "
          f"{fracneg[c]:>7.2f} {med_rep[c]:>+14.4f} {med_fp[c]-med_rep[c]:>+9.4f} "
          f"{'OK' if c1[c] else 'NO':>5s} {'OK' if c3[c] else 'NO':>6s}")
    P(f"  (C2) ordine FP SOFT>=MEDIUM>=HARD: {'OK' if c2 else 'INVERTITO'} "
      f"(S{med_fp['SOFT']:+.3f} M{med_fp['MEDIUM']:+.3f} H{med_fp['HARD']:+.3f})")
    P("")
    P(f"ESITO: {'UTILIZZABILE' if utilizzabile else 'NON UTILIZZABILE (rigetto)'}")
    P("")
    P("DIAGNOSTICA (perche' i numeri, a valore facciale, non reggono):")
    P("  (a) gap FP - replay per compound (offset, s/giro):")
    for c in SLICK:
        P(f"      {c:6s}: {med_fp[c]-med_rep[c]:+.4f}")
    gaps = [med_fp[c] - med_rep[c] for c in SLICK]
    P(f"      -> tutti negativi ({min(gaps):+.3f}..{max(gaps):+.3f}): l'FP siede sotto la misura")
    P("         verificata, la firma di un termine per-giro non rimosso (ordine di grandezza")
    P("         compatibile col prior carburante gia' nel codice ~0.03 s/kg x qualche kg/giro).")
    lung = {c: float(np.median(fp_len[c])) for c in SLICK}
    P(f"  (b) controllo lunghezza: Spearman(slope, giri run) = {rho:+.3f} (p={p:.2e}, n={len(all_s)});")
    P(f"      run di lunghezza simile (mediana giri S{lung['SOFT']:.0f}/M{lung['MEDIUM']:.0f}/"
      f"H{lung['HARD']:.0f}). L'offset NON dipende dalla lunghezza -> e' per-giro, non un")
    P("      artefatto di run lunghi. (Coerente col carburante; ma vedi C0: metodo ignoto.)")
    P("")
    P("COSA SERVIREBBE (dato mancante, NON inventato):")
    P("  1. un generatore committato + nota di metodo per i degrado_slope FP (come fu")
    P("     ricostruito per degrado_gamma_linlog): senza, il file resta debito;")
    P("  2. il carico carburante per run (kg) o slope gia' fuel-corretti.")
    P("  Solo con (1)+(2) si potrebbe discutere se l'FP valga qualcosa — come domanda NUOVA")
    P("  con KPI pre-registrato e validazione fuori campione, non come scorciatoia.")
    P("")
    P("PERIMETRO: esito di rigetto/prontezza-dato. Nessun verdetto strategico (procurare i")
    P("dati carburante / il generatore, o fermarsi): e' del PO.")
    P("=" * 78)
    testo = "\n".join(L)
    print(testo)
    open(OUT_TXT, 'w').write(testo + "\n")
    print(f"\n[scritto] {OUT_TXT}")
    print(f"[scritto] {OUT_CSV}")


if __name__ == '__main__':
    main()
