// glossario.mjs — spiega il gergo IN CONTESTO, senza toccare chi genera il testo (muretto.mjs
// resta intatto). attaccaGlossario(container) trova la PRIMA occorrenza di ogni termine noto nel
// testo del contenitore e la rende toccabile: hover (desktop) o tap/focus (mobile) -> tooltip in
// parole piane. Idempotente per-render: si richiama dopo ogni innerHTML del pannello.

const TERMINI = {
  'pit-loss': 'I secondi persi passando dai box invece di restare in pista. Qui è misurato su questa gara, quando si può.',
  'undercut': 'Fermarti PRIMA di un rivale: con le gomme nuove gli recuperi giri mentre lui è ancora sulle vecchie, e provi a uscirgli davanti.',
  'overcut': 'Il contrario dell’undercut: resti fuori più a lungo, sperando che il tuo passo basti a scavalcarlo quando si ferma lui.',
  'a pari giro': 'Fra i piloti che hanno completato i tuoi stessi giri (non i doppiati): è la posizione che conta davvero.',
  'degrado': 'Il calo delle gomme col passare dei giri: più invecchiano, più diventi lento.',
  'stint': 'Il tratto di gara percorso con lo stesso set di gomme, da una sosta alla successiva.',
  'virtual safety car': 'Rallentamento imposto a tutti senza vettura in pista: come la Safety Car, ma “virtuale”.',
  'safety car': 'La vettura di sicurezza: la gara rallenta e il gruppo si compatta. Fermarsi ora costa meno secondi.',
  'mescola': 'Il tipo di gomma: soft (morbida, veloce ma dura poco), medium, hard (dura, più lenta ma resiste).',
  'gomma nuova': 'Il guadagno di passo montando gomme fresche, misurato dalle soste già viste in questa gara.',
  'neutralizzazione': 'Quando la gara è rallentata (Safety Car, VSC, bandiera): i distacchi non valgono come a gara piena.',
};

const CHIAVI = Object.keys(TERMINI).sort((a, b) => b.length - a.length);   // i più lunghi prima
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = new RegExp('\\b(' + CHIAVI.map(esc).join('|') + ')\\b', 'i');    // niente flag g: exec da 0

let tip = null;
const conListener = new WeakSet();

function mostra(g) {
  if (!tip) { tip = document.createElement('div'); tip.className = 'gloss-tip'; document.body.appendChild(tip); }
  tip.textContent = g.dataset.tip || '';
  tip.style.display = 'block'; tip.style.left = '0'; tip.style.top = '0';
  const r = g.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
  let y = r.top - th - 8; if (y < 8) y = r.bottom + 8;   // sotto se sopra non c'è spazio
  tip.style.left = (x + scrollX) + 'px'; tip.style.top = (y + scrollY) + 'px';
}
function nascondi() { if (tip) tip.style.display = 'none'; }

export function attaccaGlossario(container) {
  if (!container) return;
  const usati = new Set();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // non dentro un termine già glossato, un link, un bottone o un controllo mescola
      if (n.parentElement && n.parentElement.closest('.gloss, a, button, [data-mesc]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodi = []; let n; while ((n = walker.nextNode())) nodi.push(n);
  for (const nodo of nodi) {
    const testo = nodo.nodeValue;
    let da = 0, trov = null, m;
    while ((m = RX.exec(testo.slice(da)))) {          // primo termine NON ancora usato nel nodo
      const term = m[1].toLowerCase(), at = da + m.index;
      if (!usati.has(term)) { trov = { term, at, len: m[1].length }; break; }
      da = at + m[1].length;
    }
    if (!trov) continue;
    usati.add(trov.term);
    const span = document.createElement('span');
    span.className = 'gloss'; span.tabIndex = 0; span.setAttribute('role', 'button');
    span.dataset.tip = TERMINI[trov.term];
    span.textContent = testo.slice(trov.at, trov.at + trov.len);
    const frag = document.createDocumentFragment();
    if (trov.at) frag.appendChild(document.createTextNode(testo.slice(0, trov.at)));
    frag.appendChild(span);
    const coda = testo.slice(trov.at + trov.len);
    if (coda) frag.appendChild(document.createTextNode(coda));
    nodo.parentNode.replaceChild(frag, nodo);
  }
  if (!conListener.has(container)) {          // eventi delegati, una volta sola per contenitore
    conListener.add(container);
    container.addEventListener('mouseover', e => { const g = e.target.closest('.gloss'); if (g) mostra(g); });
    container.addEventListener('mouseout', e => { if (e.target.closest('.gloss')) nascondi(); });
    container.addEventListener('focusin', e => { const g = e.target.closest('.gloss'); if (g) mostra(g); });
    container.addEventListener('focusout', e => { if (e.target.closest('.gloss')) nascondi(); });
    container.addEventListener('click', e => {   // tap mobile: toggle
      const g = e.target.closest('.gloss'); if (!g) return;
      (tip && tip.style.display === 'block') ? nascondi() : mostra(g);
    });
    container.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.gloss')) { e.preventDefault(); mostra(e.target); }
      if (e.key === 'Escape') nascondi();
    });
  }
}
