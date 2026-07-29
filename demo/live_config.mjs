// live_config.mjs — UNICO punto di configurazione della sorgente live
// (Fase 3). Il collettore in --replay e' l'ambiente di sviluppo e
// collaudo: stesso protocollo, nessuna differenza di codice qui.
// Override per collaudo locale: ?ws=ws://127.0.0.1:8765 nell'URL.
export const WS_URL =
  new URLSearchParams(location.search).get('ws')
  || 'wss://ws.murettobox.com/ws';

// staleness pre-registrata (Fase 3): >10 s senza campioni -> puntino
// grigio; >60 s -> rimosso. Heartbeat LIVE: eventi entro 30 s.
export const STALE_GRIGIO_S = 10;
export const STALE_RIMOZIONE_S = 60;
export const HEARTBEAT_LIVE_S = 30;
