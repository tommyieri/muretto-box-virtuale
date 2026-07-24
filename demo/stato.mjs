// stato.mjs — stati di caricamento ed errore condivisi tra le pagine.
// Regola (audit UX S1): mentre i dati arrivano si mostra uno scheletro; se il
// caricamento fallisce l'utente vede un messaggio in italiano piano + "Riprova",
// MAI un errore tecnico (status HTTP, err.message, pagina bianca).

// Scheletro pulsante nel contenitore, in attesa dei dati.
export function scheletro(el, righe = 6) {
  if (!el) return;
  const r = Array.from({ length: righe }, () =>
    `<div class="ld-row"><span class="ld-line"></span></div>`).join('');
  el.innerHTML = `<div class="ld-skel" aria-busy="true" aria-live="polite">${r}</div>`;
}

// Messaggio d'errore umano + bottone che rilancia la funzione di caricamento.
export function mostraErrore(el, riprova, msg) {
  if (!el) return;
  el.innerHTML =
    `<div class="err-box" role="alert">
       <div class="err-ico" aria-hidden="true">⚠</div>
       <div class="err-txt">
         <b>${msg || 'Non riesco a caricare i dati adesso.'}</b>
         <span>Controlla la connessione e riprova.</span>
       </div>
       <button type="button" class="err-btn">Riprova</button>
     </div>`;
  const b = el.querySelector('.err-btn');
  if (b && typeof riprova === 'function') b.addEventListener('click', () => riprova());
}

// Fetch JSON che fallisce in modo pulito anche sugli HTTP non-ok (fetch da solo
// NON rigetta su 404/500: senza questo controllo .json() darebbe un errore oscuro).
export async function prendiJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' su ' + url);
  return res.json();
}
