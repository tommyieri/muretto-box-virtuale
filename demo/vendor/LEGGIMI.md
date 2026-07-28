# vendor/ — GSAP 3.15.0, copiato qui a mano

Il sito è statico: niente `package.json`, niente bundler, niente `node_modules` da
servire. Questi tre file sono le build **UMD minificate** di GSAP 3.15.0, copiate da
`node_modules/gsap/dist/`:

| file | a cosa serve nella hero | gzip |
|------|------------------------|------|
| `gsap.min.js` | il core: timeline, tween, `matchMedia`, ticker | 28,3 KB |
| `MotionPathPlugin.min.js` | il pallino che segue il nastro e la corsia box (M3, M9) | 9,7 KB |
| `DrawSVGPlugin.min.js` | il tracciato che si disegna da solo (M2) | 2,2 KB |

**Licenza**: GSAP «Standard "no charge" license» — <https://gsap.com/standard-license>.
Dalla 3.13 anche i plugin un tempo riservati al Club (DrawSVG fra questi) sono coperti.
L'intestazione `@license` è dentro ciascun file minificato e non va rimossa.

**Si caricano con un tag `<script>`, non con `import()`.** Sono UMD: la loro
intestazione fa `(this || self).window = ...`, e in contesto modulo `this` è `undefined`,
quindi si finisce a scrivere su `window.window`, che è di sola lettura. Il caricamento
avviene in `demo/hero.mjs::carica()`, solo quando la hero entra in viewport e solo se il
movimento è consentito.

**Per aggiornare**: `npm i gsap` da qualche parte, poi ricopiare i tre `.min.js` da
`node_modules/gsap/dist/` e aggiornare la versione qui sopra.
