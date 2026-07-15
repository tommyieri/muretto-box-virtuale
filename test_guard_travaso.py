"""test_guard_travaso.py — i TRE casi del guard anti-travaso (pipeline_gara.guard_travaso).

Il guard protegge il protocollo per-gara FF5 (NOTA_PITLOSS_PERGARA.md): pubblica()
travasa il TIPICO dal CSV in pitloss.json, ma una gara marcata 'realizzato' in
pitloss_meta.json non deve tornare al tipico per una ri-pubblicazione.

SOLA LETTURA: usa i file veri di demo/data/ senza scriverli (il guard e' una funzione
pura). Exit 0 = tre casi verdi, 1 = guard rotto. Da eseguire dalla root.
"""
import json
import sys
from pipeline_gara import guard_travaso

pl = json.load(open('demo/data/pitloss.json'))
prov = json.load(open('demo/data/pitloss_meta.json'))
fail = 0


def caso(nome_caso, atteso_ok, dettaglio):
    global fail
    stato = 'PASS' if atteso_ok else 'FAIL'
    if not atteso_ok:
        fail += 1
    print(f"  ({nome_caso}) {stato}: {dettaglio}")


print("TEST GUARD ANTI-TRAVASO — tre casi dichiarati\n")

# (a) gara 'realizzato' (Miami, dati VERI): il restaging col tipico CSV (22,63)
#     NON deve sovrascrivere il realizzato in uso; avviso stampato.
v, bloccato, avviso = guard_travaso('Miami', pl['Miami'], 22.63, prov)
ok_a = (bloccato is True and v == pl['Miami'] and pl['Miami'] == 20.11
        and avviso is not None and 'GUARD' in avviso and 'BLOCCATO' in avviso)
caso('a', ok_a, f"Miami realizzato {pl['Miami']} mantenuto, travaso 22.63 bloccato")
if avviso:
    print(f"      avviso: {avviso}")

# (b) gara NUOVA assente dal meta (Belgio, staging Spa): pubblicazione normale dal CSV.
v, bloccato, avviso = guard_travaso('Belgio', None, 23.36, prov)
ok_b = (bloccato is False and v == 23.36 and avviso is None)
caso('b', ok_b, "Belgio assente dal meta -> scrive il tipico CSV 23.36, nessun avviso")

# (c) gara 'non_misurato' (Austria, dati VERI): pubblicazione normale dal CSV.
assert prov['Austria']['provenienza'] == 'non_misurato'
v, bloccato, avviso = guard_travaso('Austria', pl['Austria'], 21.63, prov)
ok_c = (bloccato is False and v == 21.63 and avviso is None)
caso('c', ok_c, "Austria non_misurato -> travaso normale dal CSV 21.63, nessun avviso")

# controprova: realizzato con valore IDENTICO al CSV non deve scattare (no-op legittimo)
v, bloccato, _ = guard_travaso('Miami', 20.11, 20.11, prov)
ok_d = (bloccato is False and v == 20.11)
caso('controprova', ok_d, "realizzato == CSV: nessun blocco (scrittura no-op legittima)")

if fail:
    print(f"\n✗ test_guard_travaso: {fail} casi falliti")
    sys.exit(1)
print("\n✓ test_guard_travaso: 3 casi + controprova verdi")
