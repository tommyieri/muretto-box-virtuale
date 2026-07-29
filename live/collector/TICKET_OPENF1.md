# Bozza ticket OpenF1 — MQTT rifiuta le connessioni (dal 20/07 03:43 UTC)

Per il PO: da inviare a OpenF1 (support/Discord) OGGI. Prima dell'invio
vale la pena un controllo di 2 minuti sul pannello account OpenF1: lo
stato dell'abbonamento realtime (l'add-on MQTT e' a pagamento; il quadro
sotto e' compatibile con un entitlement decaduto lato server — OAuth
funziona, l'autorizzazione MQTT no). Evidenza raccolta senza toccare il
servizio; dettagli diagnostici in REPORT_MQTT_INGRESS.md alla radice.

---

Subject: MQTT connections rejected since 2026-07-20 03:43 UTC (CONNACK
0x85/0x87) — OAuth token issuance still working

Hi,

our MQTT client (account <OPENF1_USERNAME>) has been unable to connect
to mqtt.openf1.org:8883 since 2026-07-20 03:43:38 UTC. Details:

**What works**
- OAuth: POST https://api.openf1.org/token keeps returning 200 with a
  valid Firebase ID token (RS256, project openf1-fb-0, expires_in 3600).
- The same client code had been connecting fine since 2026-07-19 ~20:13
  UTC, reconnecting proactively every ~50 min for token renewal (client
  process unchanged and running since 2026-07-19 21:53 UTC — no client
  change, deploy or restart at the time the failures started).

**What fails**
- From 2026-07-20 03:43:38 UTC every MQTT CONNECT is rejected by the
  broker. Our long-running service sees MQTT v5 CONNACK reason
  "Client identifier not valid" (0x85). Fresh test connections from the
  same host/account around 09:49-09:57 UTC get "Not authorized" (0x87)
  instead — 9/9 attempts, with BOTH an empty (server-assigned) and an
  explicit client id, over BOTH MQTT v5 and v3.1.1, each with a freshly
  issued token.
- One connection spontaneously succeeded at 09:30:49 UTC, subscribed to
  all 10 topics normally, and was dropped at 09:36:22 UTC — exactly at
  the token expiry. Rejections resumed right after. This inconsistency
  (0x85 vs 0x87 vs one success) suggests a server-side state issue.

**Client details**
- Source IP: 167.233.236.186 (VPS). mqtt.openf1.org resolves to
  34.34.151.228 from here.
- paho-mqtt (callback API v2), MQTT v5 over TLS, port 8883, keepalive
  60, username = account username, password = OAuth access token,
  clean_start first-only.
- Single client instance; we verified no other process or machine uses
  this account.

Could you check the account's realtime/MQTT entitlement state and the
broker-side auth logs for this account/IP around 2026-07-20 03:43 UTC?
The Hungarian GP weekend starts Friday, so we would greatly appreciate a
quick look.

Thanks!
