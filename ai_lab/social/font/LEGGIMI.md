# I font del Muretto sui social

Gli **stessi tre** del sito (`demo/muro.css`), qui in TTF perche' PIL non legge i
WOFF2 che usa il browser:

- **Barlow Condensed** — titoli ed etichette
- **Barlow** — prosa
- **JetBrains Mono** — ogni numero, sempre tabulare

Tutti e tre sono **SIL Open Font License 1.1**: si possono usare, modificare e
ridistribuire, e la licenza deve viaggiare con loro — sono i file `OFL-*.txt`
qui accanto.

Presi dal CDN ufficiale di Google Fonts il 17/08/2026. Una trappola, se mai
servisse rifarlo: `fonts.googleapis.com` serve formati diversi a seconda dello
user-agent, e con quello di Internet Explorer restituisce **EOT**, che PIL non
apre. Con uno user-agent Android vecchio restituisce TTF.

Se mancano, `genera.py` si ferma invece di sfornare post in Arial.
