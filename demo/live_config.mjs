// live_config.mjs — UNICO punto di configurazione della sorgente live
// (Fase 3). Il collettore in --replay e' l'ambiente di sviluppo e
// collaudo: stesso protocollo, nessuna differenza di codice qui.
// Override per collaudo locale: ?ws=ws://127.0.0.1:8765 nell'URL.
//
// L'OVERRIDE VALE SOLO VERSO LA PROPRIA MACCHINA (chiuso il 31/07/2026, audit di
// pre-pubblicazione). Prima accettava QUALUNQUE indirizzo: un link confezionato
// del tipo murettobox.com/live.html?ws=wss://ostile/ws mostrava la pagina vera, sul
// dominio vero, col lucchetto vero, e a riempirla era chi aveva scritto il link.
// Nel caso mite: numeri falsi spacciati per la diretta ufficiale. Nel caso serio:
// la torre metteva un campo del feed in innerHTML, quindi codice eseguito
// sull'origine del sito (chiuso anche quello, in live_timing.mjs).
//
// Il collaudo locale non ne soffre: l'uso dichiarato di questo override e' sempre
// stato "punta al collettore sulla mia macchina", ed e' esattamente cio' che resta
// permesso. Un indirizzo diverso non viene ignorato in silenzio — si dichiara in
// console e si usa la sorgente vera, perche' un override che sparisce senza dirlo
// e' il modo migliore per perdere un pomeriggio.
const SORGENTE_VERA = 'wss://ws.murettobox.com/ws';

function sorgenteRichiesta() {
  const chiesto = new URLSearchParams(location.search).get('ws');
  if (!chiesto) return SORGENTE_VERA;
  let u;
  try { u = new URL(chiesto); } catch (_) {
    console.warn(`?ws= non e' un indirizzo valido: ${chiesto} — uso la sorgente vera`);
    return SORGENTE_VERA;
  }
  const locale = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname === '::1';
  if (!locale || (u.protocol !== 'ws:' && u.protocol !== 'wss:')) {
    console.warn(`?ws= accetta solo un collettore sulla propria macchina (ws/wss su localhost): ${chiesto} rifiutato, uso la sorgente vera`);
    return SORGENTE_VERA;
  }
  return chiesto;
}

export const WS_URL = sorgenteRichiesta();

// staleness pre-registrata (Fase 3): >10 s senza campioni -> puntino
// grigio; >60 s -> rimosso. Heartbeat LIVE: eventi entro 30 s.
export const STALE_GRIGIO_S = 10;
export const STALE_RIMOZIONE_S = 60;
export const HEARTBEAT_LIVE_S = 30;
