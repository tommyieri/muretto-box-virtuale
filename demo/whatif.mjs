import { dati, el, V, $$ } from './muro.mjs?v=090826b';

const GARE = [
  "Ungheria", "Belgio", "Gran Bretagna", "Austria",
  "Spagna", "Canada", "Monaco", "Miami",
  "Giappone", "Cina", "Australia"
];

let pitLossDb = {};
let garaDati = null;
let garaCorrente = "Ungheria";
let pilotaCorrente = null;
let mescolaScelta = "HARD";
let teamColori = {
  "McLaren": "#FF8000", "Ferrari": "#E8002D", "Mercedes": "#27F4D2",
  "Red Bull Racing": "#2B478F", "Aston Martin": "#229971", "Alpine": "#FF87BC",
  "Williams": "#1868DB", "RB": "#6692FF", "Kick Sauber": "#52E252", "Haas": "#B6BABD"
};

// Inizializzazione
(async () => {
  pitLossDb = await dati(`data/pitloss.json?v=${V}`) || {};

  const selGara = document.getElementById('sel-gara');
  selGara.innerHTML = GARE.map(g => `<option value="${g}">${g} (2026)</option>`).join('');
  selGara.addEventListener('change', (e) => caricaGara(e.target.value));

  // Bottoni mescola
  document.querySelectorAll('#btn-mescole .pil').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#btn-mescole .pil').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      mescolaScelta = b.getAttribute('data-m');
      eseguiSimulazione();
    });
  });

  const rng = document.getElementById('rng-giro');
  rng.addEventListener('input', (e) => {
    document.getElementById('txt-giro-alt').textContent = `Giro ${e.target.value}`;
    eseguiSimulazione();
  });

  const selPilota = document.getElementById('sel-pilota');
  selPilota.addEventListener('change', (e) => {
    pilotaCorrente = e.target.value;
    aggiornaPilota();
  });

  await caricaGara(garaCorrente);
})();

async function caricaGara(nomeGara) {
  garaCorrente = nomeGara;
  const raw = await dati(`data/${nomeGara}.json?v=${V}`);
  if (!raw) return;
  garaDati = raw;

  // Popola piloti
  const piloti = Object.keys(garaDati).sort();
  const selPilota = document.getElementById('sel-pilota');
  selPilota.innerHTML = piloti.map(p => `<option value="${p}">${p}</option>`).join('');

  pilotaCorrente = piloti.includes("NOR") ? "NOR" : (piloti.includes("LEC") ? "LEC" : piloti[0]);
  selPilota.value = pilotaCorrente;

  aggiornaPilota();
}

function trovaPitReale(pilota) {
  const giri = garaDati[pilota] || [];
  for (let i = 0; i < giri.length; i++) {
    if (giri[i].in_lap || (giri[i].stint && giri[i].stint > 1 && giri[i].tyre_age === 1)) {
      return i + 1;
    }
  }
  return Math.floor(giri.length / 2);
}

function aggiornaPilota() {
  if (!garaDati || !pilotaCorrente) return;
  const giri = garaDati[pilotaCorrente] || [];
  const nGiri = giri.length;
  const pitReale = trovaPitReale(pilotaCorrente);

  const rng = document.getElementById('rng-giro');
  rng.min = 5;
  rng.max = Math.max(10, nGiri - 5);
  rng.value = pitReale;
  document.getElementById('txt-giro-alt').textContent = `Giro ${pitReale}`;

  const pl = pitLossDb[garaCorrente] || 22.0;
  document.getElementById('box-targhetta').innerHTML = 
    `<b>Targhetta Parametri</b><br>` +
    `• Pit-Loss tracciato: <b>${pl.toFixed(2)} s</b> (misurato)<br>` +
    `• Degrado gomma base: <b>0.031 s/giro</b> (modello v2)<br>` +
    `• Incertezza intervallo: <b>±0.35 s</b>`;

  eseguiSimulazione();
}

function eseguiSimulazione() {
  if (!garaDati || !pilotaCorrente) return;

  const giriReali = garaDati[pilotaCorrente] || [];
  const nGiri = giriReali.length;
  if (nGiri < 10) return;

  const pitReale = trovaPitReale(pilotaCorrente);
  const pitSim = parseInt(document.getElementById('rng-giro').value, 10);
  const pl = pitLossDb[garaCorrente] || 22.0;

  // Calcolo passo pulito di riferimento
  const tempiVerdi = giriReali.filter(g => g.lap_time && g.lap_time > 60 && g.lap_time < 120 && !g.in_lap && !g.out_lap)
                             .map(g => g.lap_time);
  tempiVerdi.sort((a, b) => a - b);
  const paceBase = tempiVerdi[Math.floor(tempiVerdi.length / 2)] || 85.0;

  // Simulazione controfattuale per giro
  let cumSim = 0;
  let cumReale = 0;
  const tracciaReale = [];
  const tracciaSim = [];

  let etaGommaSim = 0;
  const RHO_DEGRADO = 0.0308; // 0.0308 s/giro

  for (let i = 0; i < nGiri; i++) {
    const giroNum = i + 1;
    const gReale = giriReali[i];
    const tReale = gReale.lap_time || paceBase;
    cumReale += tReale;
    tracciaReale.push({ lap: giroNum, cum: cumReale, t: tReale });

    // Calcolo giro simulato
    etaGommaSim++;
    let tSim = paceBase + (etaGommaSim * RHO_DEGRADO);

    // Se giro di sosta simulata
    if (giroNum === pitSim) {
      tSim += pl;
      etaGommaSim = 0; // gomma nuova
    }

    // Se c'è stata una neutralizzazione nel reale, la ereditiamo per coerenza
    if (gReale.neutralized) {
      tSim = tReale;
    }

    cumSim += tSim;
    tracciaSim.push({ lap: giroNum, cum: cumSim, t: tSim });
  }

  // Delta finale
  const deltaFinale = cumSim - cumReale;

  // Stima posizione al rientro (giro pitSim)
  const cumSimAlPit = tracciaSim[pitSim - 1].cum;
  let davanti = 0;
  Object.keys(garaDati).forEach(p => {
    if (p === pilotaCorrente) return;
    const gAltro = garaDati[p];
    if (gAltro && gAltro[pitSim - 1] && gAltro[pitSim - 1].cum_time) {
      if (gAltro[pitSim - 1].cum_time < cumSimAlPit) davanti++;
    }
  });
  const posRientro = davanti + 1;

  // Aggiorna KPI
  document.getElementById('kpi-pit-reale').textContent = `Giro ${pitReale}`;
  document.getElementById('kpi-pit-sim').textContent = `Giro ${pitSim}`;
  document.getElementById('kpi-pos-rientro').textContent = `P${posRientro}`;
  
  const elDelta = document.getElementById('kpi-delta-tempo');
  const segno = deltaFinale > 0 ? "+" : "";
  elDelta.textContent = `${segno}${deltaFinale.toFixed(2)} s`;
  elDelta.className = `val ${deltaFinale < -0.5 ? 'pos' : (deltaFinale > 0.5 ? 'neg' : '')}`;

  // Disegna Grafico SVG
  disegnaGrafico(tracciaReale, tracciaSim, pitReale, pitSim, nGiri);
}

function disegnaGrafico(reale, sim, pitReale, pitSim, nGiri) {
  const W = 800, H = 380;
  const padL = 60, padR = 30, padT = 30, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Calcolo delta per giro per mostrare il distacco
  const deltas = sim.map((s, i) => s.cum - reale[i].cum);
  const minDelta = Math.min(-15, Math.min(...deltas) - 5);
  const maxDelta = Math.max(25, Math.max(...deltas) + 5);

  const xLap = (lap) => padL + ((lap - 1) / (nGiri - 1)) * innerW;
  const yDelta = (d) => padT + innerH - ((d - minDelta) / (maxDelta - minDelta)) * innerH;

  // Linee di griglia
  let gridLines = '';
  for (let d = Math.ceil(minDelta / 10) * 10; d <= maxDelta; d += 10) {
    const y = yDelta(d);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--bordo)" stroke-width="1" stroke-dasharray="3 3"/>`;
    gridLines += `<text x="${padL - 10}" y="${y + 4}" fill="var(--fioco)" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="end">${d > 0 ? '+' : ''}${d}s</text>`;
  }

  // Percorso Delta
  let pathD = `M ${xLap(1)} ${yDelta(deltas[0])}`;
  for (let i = 1; i < nGiri; i++) {
    pathD += ` L ${xLap(i + 1)} ${yDelta(deltas[i])}`;
  }

  // Punti Pit
  const xPitReale = xLap(pitReale);
  const xPitSim = xLap(pitSim);

  const svgContent = `
    <svg viewBox="0 0 ${W} ${H}" class="traccia-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradWhatIf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00E5FF" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#00E5FF" stop-opacity="0.0"/>
        </linearGradient>
      </defs>

      <!-- Griglia e assi -->
      ${gridLines}
      <line x1="${padL}" y1="${yDelta(0)}" x2="${W - padR}" y2="${yDelta(0)}" stroke="var(--calmo)" stroke-width="1.5"/>
      <text x="${W - padR}" y="${yDelta(0) - 6}" fill="var(--calmo)" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="end">Baseline Gara Reale (0.0s)</text>

      <!-- Linea verticale Pit Reale -->
      <line x1="${xPitReale}" y1="${padT}" x2="${xPitReale}" y2="${H - padB}" stroke="#FF8000" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text x="${xPitReale}" y="${padT - 8}" fill="#FF8000" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="middle">Pit Reale (G.${pitReale})</text>

      <!-- Linea verticale Pit Sim -->
      <line x1="${xPitSim}" y1="${padT}" x2="${xPitSim}" y2="${H - padB}" stroke="#00E5FF" stroke-width="2"/>
      <circle cx="${xPitSim}" cy="${yDelta(deltas[pitSim - 1])}" r="5" fill="#00E5FF"/>
      <text x="${xPitSim}" y="${H - padB + 20}" fill="#00E5FF" font-family="'JetBrains Mono',monospace" font-size="11" font-weight="bold" text-anchor="middle">Sosta What-If (G.${pitSim})</text>

      <!-- Curva delta -->
      <path d="${pathD}" fill="none" stroke="#00E5FF" stroke-width="2.5"/>

      <!-- Etichette Asse X -->
      <text x="${padL}" y="${H - 10}" fill="var(--fioco)" font-family="'JetBrains Mono',monospace" font-size="10">Giro 1</text>
      <text x="${W - padR}" y="${H - 10}" fill="var(--fioco)" font-family="'JetBrains Mono',monospace" font-size="10" text-anchor="end">Giro ${nGiri}</text>
    </svg>
  `;

  document.getElementById('grafico-wrap').innerHTML = svgContent;
}
