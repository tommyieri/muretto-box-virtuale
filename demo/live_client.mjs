// live_client.mjs — client WebSocket del collettore (Fase 3).
// Alla connessione il collettore manda uno snapshot completo, poi il
// flusso eventi (position_frame, timing_update, driver_list,
// track_status, session_status). Riconnessione automatica con backoff
// 1->30 s; lo snapshot ricevuto dopo una riconnessione RIALLINEA tutto
// (kill test: riavvio del collettore a meta' replay -> si riprende da li').

export function creaLiveClient({ url, onEvento, onStato }) {
  let ws = null, backoff = 1, chiuso = false, timerRiconn = null;
  let ultimoEventoWall = 0;

  function stato(s) { try { onStato && onStato(s); } catch {} }

  function connetti() {
    stato(ws ? 'riconnessione' : 'connessione');
    try { ws = new WebSocket(url); }
    catch { return riprova(); }

    ws.onopen = () => { backoff = 1; stato('connesso'); };
    ws.onmessage = (m) => {
      ultimoEventoWall = Date.now();
      let e; try { e = JSON.parse(m.data); } catch { return; }
      try { onEvento(e); } catch (err) { console.error('evento live:', err); }
    };
    ws.onclose = () => { if (!chiuso) riprova(); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  function riprova() {
    stato('riconnessione');
    clearTimeout(timerRiconn);
    timerRiconn = setTimeout(connetti, backoff * 1000);
    backoff = Math.min(backoff * 2, 30);
  }

  connetti();
  return {
    // eta' dell'ultimo evento ricevuto, in secondi (per il badge LIVE)
    etaUltimoEvento() {
      return ultimoEventoWall ? (Date.now() - ultimoEventoWall) / 1000 : Infinity;
    },
    chiudi() { chiuso = true; clearTimeout(timerRiconn); try { ws.close(); } catch {} },
  };
}
