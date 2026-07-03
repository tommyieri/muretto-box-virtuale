import pickle, statistics as st, csv
raw = pickle.load(open('data/_warmin_raw_multiyear.pkl','rb'))

# decay per stagione: 2026 pesa di piu' (coerente con firme_pace DECAY=0.6)
# 2026 non e' nel pkl storico -> uso i valori gia' ricostruiti puliti su tyre_observations:
val2026 = {'SOFT':{0:-0.175,1:0.559},'MEDIUM':{0:0.443,1:0.347},'HARD':{0:-0.173,1:-0.024}}
PESI = {'2023':0.6**3, '2024':0.6**2, '2025':0.6**1, '2026':1.0}  # piu' recente = piu' peso

righe=[]
for comp in ('SOFT','MEDIUM','HARD'):
    for gs in (0,1):
        num=den=0.0; n_tot=0
        for anno in ('2023','2024','2025'):
            v=raw.get((anno,comp,gs))
            if v:
                num += st.median(v)*PESI[anno]; den += PESI[anno]; n_tot += len(v)
        if comp in val2026 and gs in val2026[comp]:
            num += val2026[comp][gs]*PESI['2026']; den += PESI['2026']
        w = round(num/den,3) if den else None
        righe.append([comp, gs, w, n_tot])

with open('data/warmin_prior.csv','w',newline='') as f:
    wr=csv.writer(f); wr.writerow(['compound','giro_stint','warmin_s_pesato','n_stint_storici'])
    wr.writerows(righe)

print("=== warmin_prior.csv (aggregato 2023-2025 decay + 2026) ===")
print(f"{'comp':7} {'giro':>4} {'warmin_s':>9} {'n_hist':>7}")
for c,gs,w,n in righe:
    print(f"{c:7} {gs:>4} {str(w):>9} {n:>7}")

nota = """WARM-IN GOMMA — nota tecnica (misurato, NON usato nella UI)
Misurato su 3 stagioni consecutive (2023-2025, TracingInsights-Archive) + 2026,
~2000 stint di gara a secco, giri verdi, gomma fresh, out-lap escluso, fuel-corrected (0.03 s/kg).
Metodo: delta del primo giro lanciato (life=2) vs baseline caldo dello stesso stint (life 4-6).
RISULTATO: SOFT/MEDIUM +0.2/0.4s al primo giro; HARD ~0 (leggermente negativo). Coerente su tutte le stagioni.
VERDETTO: trascurabile ai fini della decisione di pit (pit-loss e' 20+ s). Conservato come prior nel motore
(data/warmin_prior.csv) per futuro degrado/undercut; NON mostrato nel pannello per la regola
'la UI mostra solo cio' che cambia una decisione'.
SMASCHERATO: il precedente warmin_model_2026.csv (+5.6s) era un artefatto: includeva l'out-lap (pit-lane)
scambiato per primo giro lanciato. Archiviato.
"""
open('data/WARMIN_NOTA.txt','w').write(nota)
print("\nscritto data/warmin_prior.csv + data/WARMIN_NOTA.txt")
