// Coulisses : l'étagère au-dessus du bureau du régisseur (la caisse de régie, en pixel art).
// Composition à la manière d'Unpacking : on regarde dans l'étagère en vue isométrique 2:1, une seule
// planche, du bazar. Lumière à la manière d'Eastward : la servante éclaire la niche (lumière calculée par
// surface, en paliers tramés, avec une touche froide dans l'ombre), une LED de service éclaire le panneau
// perforé (verte, rouge quand quelque chose demande l'attention). Contre-jour, ombres portées, poussière,
// vacillement rare, parallaxe ; tout s'arrête en mouvement réduit. Des boutons transparents sont posés sur
// tout ce qui se manipule ; le canevas sait quel pixel est touché.
import { image, paver, neuf, agrandissement } from './pixels.js';
import { police } from './police.js';
import { allumerSon, jouerSon } from './son.js';
import { BAYER, RAMPE, FROID } from './lumiere.js';

const NB = ' ';
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)');
const grossier = matchMedia('(pointer: coarse)');

// la niche (etagere.png) : x = u − v, y = (u + v) / 2 − w, à partir du coin du fond, au sol
const W = 190;
const D = 70;
const HN = 96;
const EP = 8;
const OX = D + 2;
const OY = HN + 3;
const IPS = 15; // la poussière et le vacillement avancent à 15 images par seconde

const C = {
  encre: '#2A2724', gris: '#575A63', imprime: '#45576B', papier3: '#C9C0A3', vert: '#3F6B3A', rouge: '#8E2A2A', rouge2: '#C2453A',
  fluo: '#F2E94E', survol: '#E8F0FF', nuit: '#0E1220', ficelle: '#B9A88A', craie: '#EDE6D6', dymo: '#E2E4DE', dymoEteint: '#6A6C70',
};

// ---------- Les deux plans ----------
const PLANS = {
  paysage: {
    nom: 'paysage', L: 480, H: 270, pas: 12, ruban: 12, etiquette: 180,
    niche: { x: 6, y: 18 },
    panneau: { x: 276, y: 0, l: 204, h: 270 },
    led: { x: 366, y: 2 },
    crochets: { x: 290, y: 13, pas: 48 },
    fiche: { x: 282, y: 70, l: 192, h: 126 },
    planning: { x: 282, y: 199, l: 192, h: 57 },
    lire: { x: 282, y: 258 },
    fermer: { x: 432, y: 258 },
    note: { x: 8, y: 204, l: 100 }, // dans le coin sombre, sous la planche
  },
  portrait: {
    nom: 'portrait', L: 270, H: 480, pas: 17, ruban: 16, etiquette: 176,
    niche: { x: 3, y: 238 },
    panneau: { x: 0, y: 0, l: 270, h: 236 },
    led: { x: 123, y: 2 },
    crochets: { x: 14, y: 13, pas: 48 },
    fiche: { x: 4, y: 72, l: 150, h: 162 },
    planning: { x: 158, y: 72, l: 108, h: 74 },
    lire: { x: 158, y: 150 },
    fermer: { x: 158, y: 170 },
    note: { x: 158, y: 190, l: 108 },
  },
};

// ---------- Ce qui est posé sur la planche (u le long de la planche, v vers le devant) ----------
// Chaque place est le coin de devant de l'emprise au sol du dessin : son point le plus bas. L'emprise se lit
// sur la silhouette (voir masque) : ce qui est à gauche de ce point s'enfonce le long de la planche, ce qui est
// à droite s'enfonce vers le fond. Places calculées pour que tout tienne sur la planche sans traverser un mur
// ni se chevaucher au sol, les objets du jeu dans la lumière, la servante dégagée, et aucune chose cliquable
// cachée à plus de 8 %. Le bazar longe les murs et le bord ; le petit carton est posé sur le grand.
const DECOR = [
  { img: 'bazar-carton', u: 34, v: 26 },
  { img: 'bazar-carton-petit', u: 31, v: 23, w: 22 },
  { img: 'bazar-bonbons', u: 52, v: 18 },
  { img: 'bazar-cable', u: 70, v: 18 },
  { img: 'bazar-multiprise', u: 186, v: 9 },
  { img: 'bazar-micro', u: 10, v: 52 },
  { img: 'bazar-cable-orange', u: 16, v: 68 },
  { img: 'bazar-bonbons-vrac', u: 45, v: 68, plat: true },
  { img: 'bazar-adaptateurs', u: 160, v: 68 },
  { img: 'bazar-casque-audio', u: 187, v: 68 },
];
const POSTES = { servante: { u: 105, v: 37 }, thermos: { u: 101, v: 14 }, corbeille: { u: 75, v: 33 } };
const PLACES_OBJETS = {
  gaffer: { u: 61, v: 37 }, lentille: { u: 165, v: 61 }, contre: { u: 151, v: 29 }, frontale: { u: 69, v: 67 }, cable: { u: 116, v: 64 },
  eclat: { u: 41, v: 58 }, cle: { u: 122, v: 30 }, casque: { u: 178, v: 22 }, lampe: { u: 132, v: 65 },
};
const AMPOULE = 24; // l'ampoule de la servante est à 24 px au-dessus du bas de son image, au milieu
const TOUJOURS = ['etagere', 'panneau', 'crochet', 'dymo', 'pince', 'punaise', 'post-it', 'etiquette', 'rapport', 'note',
  'servante', 'thermos', 'corbeille'];
const FACULTATIFS = ['bazar-cable-pendu', ...new Set(DECOR.map((d) => d.img))]; // un bazar manquant n'empêche rien

const toile = (l, h) => {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  return c;
};

// ---------- Masques d'un dessin, calculés une fois : silhouette, contours, contre-jour, empreinte ----------
const masques = new Map();
const masque = (nom, img) => {
  if (masques.has(nom)) return masques.get(nom);
  const l = img.width;
  const h = img.height;
  const c = toile(l, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, l, h).data;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < l && y < h && a[(y * l + x) * 4 + 3] > 0;
  let bas = h - 1;
  while (bas > 0 && ![...Array(l).keys()].some((x) => opaque(x, bas))) bas--;
  // le point de contact : le milieu de la rangée la plus basse ; l'emprise : la largeur de part et d'autre
  let x0 = l;
  let x1 = 0;
  let xmin = l;
  let xmax = 0;
  for (let x = 0; x < l; x++) if (opaque(x, bas)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  for (let y = 0; y <= bas; y++) for (let x = 0; x < l; x++) if (opaque(x, y)) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
  const xc = (x0 + x1) / 2;
  let haut = 0;
  while (haut < bas && ![...Array(l).keys()].some((x) => opaque(x, haut))) haut++;
  const peindre = (test, [r, v, b], marge = 0) => {
    const t = toile(l + 2 * marge, h + 2 * marge);
    const tg = t.getContext('2d');
    const id = tg.createImageData(t.width, t.height);
    for (let y = -marge; y < h + marge; y++) {
      for (let x = -marge; x < l + marge; x++) {
        if (!test(x, y)) continue;
        id.data.set([r, v, b, 255], ((y + marge) * t.width + x + marge) * 4);
      }
    }
    tg.putImageData(id, 0, 0);
    return t;
  };
  const bord = (x, y) => !opaque(x, y) && (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1));
  const rims = new Map();
  const m = {
    opaque, bas, haut, xc, a: xc - xmin, b: xmax + 1 - xc,
    silhouette: peindre(opaque, [0, 0, 0]),
    contour: { survol: peindre(bord, [232, 240, 255], 1), choix: peindre(bord, [242, 233, 78], 1) },
    // le contre-jour, à l'intérieur de la silhouette : les pixels du bord tourné vers la lumière
    rim: (dx, dy) => {
      const k = `${dx},${dy}`;
      if (!rims.has(k)) rims.set(k, peindre((x, y) => opaque(x, y) && !opaque(x + dx, y + dy), [255, 200, 120]));
      return rims.get(k);
    },
  };
  masques.set(nom, m);
  return m;
};

// ---------- La lumière, calculée par surface et mise en cache (par plan, palier de vacillement, place de l'ampoule) ----------
// la lumière de service, une LED verte : une teinte légère, les papiers restent lisibles et leurs couleurs reconnaissables
const RAMPE_LED = [[116, 124, 126], [160, 174, 166], [202, 216, 206], [234, 244, 236]];
const PIECE = [170, 178, 200]; // la pénombre de la pièce, autour de l'étagère

// ---------- La lumière des objets : chacun selon sa propre place, d'un ton uni ----------
// La carte de lumière éclaire les surfaces de la niche ; un objet n'en prend pas la lumière du mur ou du sol
// qui est derrière lui (le carton serait coupé par la limite du mur et voilé par sa trame). Il est éclairé
// d'après le milieu de son volume : distance à l'ampoule, et ses faces vues tournées vers elle ou non
// (un objet devant l'ampoule est à contre-jour, le liseré du contre-jour prend le relais).
const lumiereObjet = (BULBE, palier, u, v, w) => {
  const f = 1 - palier * 0.14;
  const du = BULBE.u - u;
  const dv = BULBE.v - v;
  const dw = BULBE.w + 4 - w;
  const d = Math.hypot(du, dv, dw) || 1;
  const face = Math.max(0, (du + dv) / (Math.SQRT2 * d));
  const I = 0.1 + (f * 1.15 * Math.sqrt(0.35 + 0.65 * face)) / (1 + (d / 80) ** 2);
  return Math.max(0, Math.min(4, I * 4)); // une place sur la rampe, de 0 (ombre froide) à 4 (cœur chaud)
};
const teintes = new Map();
const teinter = (nom, img, t) => {
  const q = Math.round(t * 8) / 8;
  const k = `${nom}:${q}`;
  if (teintes.has(k)) return teintes.get(k);
  const i = Math.min(3, Math.floor(q));
  const mul = RAMPE[i].map((c, j) => Math.round(c + (RAMPE[i + 1][j] - c) * (q - i)));
  const froid = FROID.map((c) => Math.round(c * (1 - q / 4)));
  const c = toile(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${mul})`;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = `rgb(${froid})`;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  teintes.set(k, c);
  return c;
};
const cartes = new Map();
const carteLumiere = (plan, palier, BULBE) => {
  const k = `${plan.nom}:${palier}:${BULBE.u},${BULBE.v},${BULBE.w}`;
  if (cartes.has(k)) return cartes.get(k);
  const { L, H } = plan;
  const mult = toile(L, H);
  const froid = toile(L, H);
  const im = mult.getContext('2d').createImageData(L, H);
  const fr = froid.getContext('2d').createImageData(L, H);
  const nx0 = plan.niche.x + OX;
  const ny0 = plan.niche.y + OY;
  const f = 1 - palier * 0.14;
  const pn = plan.panneau;
  const lx = plan.led.x + 12;
  const ly = plan.led.y + 6;
  const bx = nx0 + BULBE.u - BULBE.v;
  const by = ny0 + (BULBE.u + BULBE.v) / 2 - BULBE.w;
  const eclairer = (u, v, w, n) => {
    const du = BULBE.u - u;
    const dv = BULBE.v - v;
    const dw = BULBE.w + 4 - w;
    const d = Math.hypot(du, dv, dw) || 1;
    const cos = (n[0] * du + n[1] * dv + n[2] * dw) / d;
    if (cos <= 0) return 0.1;
    return 0.1 + (f * 1.4 * Math.sqrt(cos)) / (1 + (d / 80) ** 2);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 4;
      const seuil = BAYER[y % 4][x % 4] / 16 - 0.5;
      let couleur = PIECE;
      let froideur = 0;
      const dans = x >= pn.x && x < pn.x + pn.l && y >= pn.y && y < pn.y + pn.h;
      if (dans) {
        // la LED de service, et le chaud de la servante qui déborde sur le bord du panneau
        const iled = 0.35 + 0.65 / (1 + (Math.hypot(x - lx, (y - ly) * 0.8) / 140) ** 2);
        const nled = Math.max(0, Math.min(3, Math.floor(iled * 4 + seuil)));
        couleur = RAMPE_LED[nled];
        const is = (1.3 * f) / (1 + (Math.hypot(x - bx, y - by) / 70) ** 2);
        const ns = Math.max(0, Math.min(4, Math.floor(is * 4 + seuil)));
        if (ns >= 2) couleur = couleur.map((c, j) => Math.max(c, RAMPE[ns][j]));
      } else {
        const ax = x - nx0;
        const ay = y - ny0;
        let I = null;
        // le sol (w = 0), le fond (v = 0), le montant (u = 0), le chant de devant (v = D)
        let u = ay + ax / 2;
        let v = ay - ax / 2;
        if (u >= 0 && u <= W && v >= 0 && v <= D) I = eclairer(u, v, 0, [0, 0, 1]);
        else {
          u = ax;
          let w = u / 2 - ay;
          if (u >= 0 && u <= W && w >= 0 && w <= HN) I = eclairer(u, 0, w, [0, 1, 0]);
          else {
            v = -ax;
            w = v / 2 - ay;
            if (v >= 0 && v <= D && w >= 0 && w <= HN) I = eclairer(0, v, w, [1, 0, 0]);
            else {
              u = ax + D;
              w = (u + D) / 2 - ay;
              if (u >= 0 && u <= W && w >= -EP && w <= 0) I = 0.12;
            }
          }
        }
        if (I !== null) {
          const n = Math.max(0, Math.min(4, Math.floor(I * 4 + seuil)));
          couleur = RAMPE[n];
          froideur = 1 - n / 4;
        }
      }
      im.data.set([...couleur, 255], i);
      fr.data.set([FROID[0] * froideur, FROID[1] * froideur, FROID[2] * froideur, 255], i);
    }
  }
  mult.getContext('2d').putImageData(im, 0, 0);
  froid.getContext('2d').putImageData(fr, 0, 0);
  const c = { mult, froid };
  cartes.set(k, c);
  return c;
};

export async function creerEtagere(api) {
  const { OBJETS } = api;
  const necessaires = [...TOUJOURS, ...new Set(Object.values(OBJETS).map((o) => o.sprite))];
  const [imgs, facultatifs, P] = await Promise.all([
    Promise.all(necessaires.map(image)),
    Promise.all(FACULTATIFS.map((n) => image(n).catch(() => null))),
    police('police-papier'),
  ]);
  const im = Object.fromEntries([...necessaires.map((n, i) => [n, imgs[i]]), ...FACULTATIFS.map((n, i) => [n, facultatifs[i]])]);
  return monter(api, im, P);
}

function monter(api, im, P) {
  const { carnet, OBJETS, PLACES, STATS, NIVEAUX, GRADES, ENERGIE, NOMS, signe, actions } = api;
  const dlg = document.createElement('dialog');
  dlg.className = 'etagere';
  dlg.setAttribute('aria-labelledby', 'etagere-titre');
  dlg.setAttribute('aria-describedby', 'etagere-fiche');
  dlg.innerHTML = `
    <h2 id="etagere-titre" class="lecteur">Étagère du régisseur</h2>
    <div class="lecteur" id="etagere-fiche" data-fiche-lue></div>
    <div class="regie-ecran" data-ecran><canvas data-canvas aria-hidden="true"></canvas><div data-boutons></div></div>
    <p class="lecteur" data-lu aria-live="polite"></p>
    <p class="lecteur" data-alerte role="alert"></p>
    <p class="lecteur">Entrée${NB}: choisir ou agir. Échap${NB}: reposer l’étiquette, puis fermer l’étagère.</p>
    <section class="etagere-lecture" data-lecture hidden aria-labelledby="etagere-lecture-titre" tabindex="-1"></section>`;
  document.body.append(dlg);
  const ecranEl = dlg.querySelector('[data-ecran]');
  const canvas = dlg.querySelector('[data-canvas]');
  const g = canvas.getContext('2d');
  const boutonsEl = dlg.querySelector('[data-boutons]');
  const lu = dlg.querySelector('[data-lu]');
  const alerteEl = dlg.querySelector('[data-alerte]');
  const ficheLue = dlg.querySelector('[data-fiche-lue]');
  const lecture = dlg.querySelector('[data-lecture]');

  let plan = null;
  let etat = api.etat();
  let selection = carnet.choisi && Object.hasOwn(OBJETS, carnet.choisi) ? `objet:${carnet.choisi}` : null;
  let survol = null;
  let focusCle = null;
  let effacerArme = 0; // l'instant où la corbeille a été armée
  let minuterieEffacer = null;
  let alerte = '';
  let veille = '';
  let consigne = !carnet.etagereVue; // au premier passage, une note dit comment faire
  let chargementCle = null;
  let ouvert = true;
  let fermeture = null; // { t0, eteindre } pendant l'extinction
  let allumage = 0; // l'instant de l'ouverture : la lumière monte en quatre paliers
  let suspendu = false;
  let trame = null;
  let sale = true;
  let dernierPas = -1;
  let parallaxe = 0;
  let parallaxeCible = 0;
  let surPanneau = false;
  let prochainVacillement = performance.now() + 15000 + Math.random() * 25000;
  let vacillementT = null;
  let retours = []; // ce qui vient de changer : objet équipé, points gagnés ou perdus
  let valeursVues = Object.fromEntries(STATS.map((s) => [s.cle, etat.st[s.cle].valeur]));
  let rects = new Map(); // ce qui se manipule : clé → rectangle, en pixels natifs
  let els = [];
  let etiquette = null;
  const papiers = toile(1, 1);
  const etiquetteCv = toile(1, 1);
  const rimCv = toile(1, 1);
  const fond = toile(1, 1);
  const anime = () => !mouvementReduit.matches;

  // la niche et le panneau : la lumière de la niche bouge avec la planche, celle du panneau reste en place
  const zoneNiche = () => (plan === PLANS.paysage ? { x: 0, y: 0, l: plan.panneau.x - 4, h: plan.H } : { x: 0, y: plan.panneau.h, l: plan.L, h: plan.H - plan.panneau.h });
  const zonePanneau = () => (plan === PLANS.paysage ? { x: plan.panneau.x - 4, y: 0, l: plan.L - plan.panneau.x + 4, h: plan.H } : { x: 0, y: 0, l: plan.L, h: plan.panneau.h });
  const iso = (u, v, w = 0) => [plan.niche.x + OX + u - v, plan.niche.y + OY + (u + v) / 2 - w];
  // l'ampoule, au-dessus du milieu du pied de la servante : sa hauteur se lit sur le dessin
  const ms = masque('servante', im.servante);
  const BULBE = { u: POSTES.servante.u - ms.a / 2, v: POSTES.servante.v - ms.b / 2, w: ms.bas - (im.servante.height - AMPOULE) - (ms.a + ms.b) / 4 };
  const ampoule = () => { const [x, y] = iso(BULBE.u, BULBE.v, BULBE.w); return [Math.round(x), Math.round(y)]; };
  // l'emprise au sol d'un élément, en losange à l'écran : devant, gauche, fond, droite
  const losange = (e) => [iso(e.u, e.v, e.w), iso(e.u - e.a, e.v, e.w), iso(e.u - e.a, e.v - e.b, e.w), iso(e.u, e.v - e.b, e.w)].map(([x, y]) => [Math.round(x), Math.round(y)]);
  const remplirLosange = (ctx, pts, dx) => {
    const ys = pts.map(([, y]) => y);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      // les bords coupés par la rangée y
      const xs = [];
      pts.forEach(([xa, ya], i) => {
        const [xb, yb] = pts[(i + 1) % pts.length];
        if ((ya <= y && yb >= y) || (yb <= y && ya >= y)) xs.push(ya === yb ? xa : xa + ((y - ya) * (xb - xa)) / (yb - ya));
      });
      if (xs.length < 2) continue;
      const g0 = Math.round(Math.min(...xs));
      ctx.fillRect(g0 + dx, y, Math.round(Math.max(...xs)) - g0 + 1, 1);
    }
  };
  const sonner = (nom) => { if (carnet.son && allumerSon()) jouerSon(nom); };

  // ---------- Ce qu'il y a sur la planche, du fond vers le devant ----------
  const calculerElements = () => {
    const liste = DECOR.filter((d) => im[d.img]).map((d) => ({ type: 'decor', img: d.img, u: d.u, v: d.v, w: d.w ?? 0, plat: d.plat }));
    Object.entries(POSTES).forEach(([cle, p]) => liste.push({ type: 'poste', cle: `poste:${cle}`, img: cle, u: p.u, v: p.v, w: 0 }));
    Object.keys(OBJETS).forEach((id) => {
      const p = PLACES_OBJETS[id];
      if (!p) return;
      const possede = carnet.possede.includes(id);
      if (possede && api.estPorte(id)) return; // il pend à son crochet
      liste.push({ type: 'objet', cle: `objet:${id}`, id, img: OBJETS[id].sprite, u: p.u, v: p.v, w: 0, trace: !possede });
    });
    liste.forEach((e) => {
      const img = im[e.img];
      const m = masque(e.img, img);
      const [x, y] = iso(e.u, e.v, e.w);
      e.a = m.a;
      e.b = m.b;
      e.x = Math.round(x - m.xc); // le point le plus bas du dessin se pose sur le coin de devant de son emprise
      e.y = Math.round(y - m.bas);
      e.l = img.width;
      e.h = img.height;
      e.by = Math.round(y); // le bas, à l'écran
      const [cx, cy] = iso(e.u - e.a / 2, e.v - e.b / 2, e.w); // le milieu de l'emprise
      e.ax = Math.round(cx);
      e.ay = Math.round(cy);
      e.losange = losange(e);
      if (e.trace) {
        // une empreinte, et le « ? » à la craie au-dessus d'elle
        const xs = e.losange.map(([lx]) => lx);
        const ys = e.losange.map(([, ly]) => ly);
        e.zone = { x: Math.min(...xs) - 1, y: Math.min(e.ay - 20, ...ys), l: Math.max(...xs) - Math.min(...xs) + 3, h: Math.max(...ys) - Math.min(e.ay - 20, ...ys) + 2 };
      } else e.zone = { x: e.x, y: e.y, l: e.l, h: e.h };
    });
    return trier(liste);
  };
  // du fond vers le devant : une emprise entièrement derrière une autre (en u ou en v) passe avant elle ;
  // ce qui est posé sur un autre objet passe après lui ; le bazar à plat passe en premier
  const derriere = (p, q) => {
    if (p.plat !== q.plat) return Boolean(p.plat);
    const [pu0, pu1, pv0, pv1] = [p.u - p.a, p.u, p.v - p.b, p.v];
    const [qu0, qu1, qv0, qv1] = [q.u - q.a, q.u, q.v - q.b, q.v];
    const recouvre = pu0 < qu1 && qu0 < pu1 && pv0 < qv1 && qv0 < pv1;
    if (recouvre && p.w !== q.w) return p.w < q.w;
    if (pu1 <= qu0 + 0.5 || pv1 <= qv0 + 0.5) return true;
    if (qu1 <= pu0 + 0.5 || qv1 <= pv0 + 0.5) return false;
    return pu0 + pu1 + pv0 + pv1 < qu0 + qu1 + qv0 + qv1;
  };
  const trier = (liste) => {
    const reste = [...liste];
    const ordre = [];
    while (reste.length) {
      let i = reste.findIndex((e) => !reste.some((f) => f !== e && derriere(f, e)));
      if (i < 0) i = reste.reduce((k, e, j) => (e.u + e.v < reste[k].u + reste[k].v ? j : k), 0); // un cycle : le plus au fond
      ordre.push(...reste.splice(i, 1));
    }
    return ordre;
  };
  const crochets = () => PLACES.map((place, i) => {
    const id = carnet.porte[place];
    const x = plan.crochets.x + i * plan.crochets.pas;
    return { place, id, x, y: plan.crochets.y, cle: id ? `objet:${id}` : `crochet:${place}`, img: id ? OBJETS[id].sprite : null };
  });
  const leve = (e) => (anime() && e.cle && (e.cle === survol || e.cle === focusCle) && !e.trace ? 2 : 0);

  // ---------- Papiers du panneau : peints une fois par changement d'état, puis éclairés par la LED ----------
  const pg = () => papiers.getContext('2d');
  const papier = (ctx, x, y, l, h, nom = 'rapport') => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 2, y + 2, l, h);
    neuf(ctx, im[nom], [4, 4, 4, 4], x, y, l, h);
  };
  const ruban = (ctx, texte, x, y, h, actif = true, danger = false) => {
    const l = P.mesurer(texte) + 8;
    neuf(ctx, im.dymo, [2, 2, 2, 2], x, y, l, h);
    if (danger) { ctx.fillStyle = C.rouge2; ctx.fillRect(x, y, l, h); ctx.fillStyle = '#7A2020'; ctx.fillRect(x, y + h - 1, l, 1); }
    P.ecrire(ctx, texte, x + 4, y + Math.round((h - 5) / 2), actif ? C.dymo : C.dymoEteint);
    return { x, y, l, h };
  };
  const cadenas = (ctx, x, y) => {
    ctx.fillStyle = C.gris;
    ctx.fillRect(x + 1, y, 3, 1); ctx.fillRect(x, y + 1, 1, 2); ctx.fillRect(x + 4, y + 1, 1, 2); ctx.fillRect(x, y + 3, 5, 3);
  };
  const casesStats = {};
  const peindrePapiers = () => {
    papiers.width = plan.L;
    papiers.height = plan.H;
    const ctx = pg();
    const pas = plan.pas;
    // les pochoirs des crochets vides, et les étiquettes Dymo des crochets
    crochets().forEach((c) => {
      if (!c.id) {
        ctx.fillStyle = 'rgba(232, 226, 210, 0.55)';
        for (let i = 0; i < 28; i += 2) { ctx.fillRect(c.x + 2 + i, c.y + 13, 1, 1); ctx.fillRect(c.x + 2 + i, c.y + 42, 1, 1); }
        for (let j = 0; j < 30; j += 2) { ctx.fillRect(c.x + 2, c.y + 13 + j, 1, 1); ctx.fillRect(c.x + 29, c.y + 13 + j, 1, 1); }
      }
      const l = P.mesurer(c.place) + 8;
      ruban(ctx, c.place, c.x + 16 - Math.round(l / 2), c.y + 44, 11);
    });
    // la fiche du régisseur, sur sa pince
    const f = plan.fiche;
    papier(ctx, f.x, f.y, f.l, f.h);
    ctx.drawImage(im.pince, f.x + Math.round((f.l - im.pince.width) / 2), f.y - 5);
    let y = f.y + 7;
    P.ecrire(ctx, 'Fiche du régisseur', f.x + 6, y, C.imprime);
    ctx.fillStyle = C.papier3;
    ctx.fillRect(f.x + 5, y + 7, f.l - 10, 1);
    y += pas + 1;
    const ligne = (cle, dessin) => {
      const r = { x: f.x + 3, y: y - Math.round((pas - 5) / 2), l: f.l - 6, h: pas };
      if (cle === selection) { ctx.fillStyle = C.fluo; ctx.fillRect(r.x, r.y, r.l, r.h); }
      dessin(y);
      rects.set(cle, r);
      y += pas;
    };
    ligne('fiche:grade', (yy) => {
      const grade = GRADES[etat.grade];
      const lg = P.mesurer(grade);
      ctx.fillStyle = C.rouge2; // le grade, tamponné
      ctx.fillRect(f.x + 5, yy - 2, lg + 4, 1); ctx.fillRect(f.x + 5, yy + 6, lg + 4, 1); ctx.fillRect(f.x + 5, yy - 2, 1, 9); ctx.fillRect(f.x + 8 + lg, yy - 2, 1, 9);
      P.ecrire(ctx, grade, f.x + 7, yy, C.rouge);
      P.ecrire(ctx, `· ${etat.representations} représentation${etat.representations > 1 ? 's' : ''}`, f.x + 12 + lg, yy, C.encre);
    });
    ligne('fiche:energie', (yy) => {
      P.ecrire(ctx, 'Énergie', f.x + 6, yy, C.imprime);
      P.ecrire(ctx, `${etat.energie}/${ENERGIE.max} · café${NB}: ${etat.doses} dose${etat.doses > 1 ? 's' : ''}`, f.x + 58, yy, etat.energie <= 2 ? C.rouge : C.encre);
    });
    const barre = f.l - 6 - 52 - 14;
    const cote = Math.max(4, Math.floor((barre - 9) / 10));
    STATS.forEach((s) => {
      ligne(`stat:${s.cle}`, (yy) => {
        const v = etat.st[s.cle].valeur;
        P.ecrire(ctx, s.nom, f.x + 6, yy, C.imprime);
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = k < v ? s.teinte : '#D9D0B4';
          ctx.fillRect(f.x + 58 + k * (cote + 1), yy - 1, cote, 6);
        }
        casesStats[s.cle] = { x: f.x + 58, y: yy - 1, cote, h: 6 };
        P.ecrire(ctx, String(v), f.x + f.l - 6 - P.mesurer(String(v)), yy, C.encre);
      });
    });
    ligne('fiche:objets', (yy) => {
      P.ecrire(ctx, 'Objets', f.x + 6, yy, C.imprime);
      P.ecrire(ctx, `${etat.trouves}/${etat.caches} trouvés`, f.x + 58, yy, C.encre);
    });
    // le prochain grade, en une ligne ; le texte entier est sur l'étiquette du grade
    const prochain = GRADES[etat.grade + 1] ? `Prochain${NB}: ${GRADES[etat.grade + 1]}` : 'Le plus haut grade';
    if (y + 5 <= f.y + f.h - 3) P.ecrire(ctx, P.couper(prochain, f.l - 12)[0], f.x + 6, y, C.gris);
    // le planning des répétitions, punaisé
    const p = plan.planning;
    papier(ctx, p.x, p.y, p.l, p.h);
    ctx.drawImage(im.punaise, p.x + Math.round(p.l / 2) - 3, p.y - 2);
    P.ecrire(ctx, 'Planning des répétitions', p.x + 6, p.y + 7, C.imprime);
    etat.niveaux.forEach((n, i) => {
      const yy = p.y + 7 + pas + 1 + i * pas;
      const cle = `niveau:${n.id}`;
      const r = { x: p.x + 3, y: yy - Math.round((pas - 5) / 2), l: p.l - 6, h: pas };
      // la prochaine répétition à jouer, surlignée au stabilo
      if (cle === selection || n.id === etat.prochaine) { ctx.fillStyle = C.fluo; ctx.fillRect(r.x, r.y, r.l, r.h); }
      const couleur = !n.ouvert ? C.gris : n.reussi ? C.vert : C.encre;
      P.ecrire(ctx, n.jour, p.x + 6, yy, C.imprime);
      P.ecrire(ctx, n.nom.replace(/^L[ae] /, ''), p.x + 28, yy, couleur);
      if (!n.ouvert) cadenas(ctx, p.x + p.l - 12, yy);
      else P.ecrire(ctx, chargementCle === cle ? '…' : n.court, p.x + p.l - 6 - P.mesurer(chargementCle === cle ? '…' : n.court), yy, couleur);
      rects.set(cle, r);
    });
    rects.set('lire', ruban(ctx, 'Lire la fiche', plan.lire.x, plan.lire.y, plan.ruban));
    rects.set('fermer', ruban(ctx, 'Fermer', plan.fermer.x, plan.fermer.y, plan.ruban));
    // les notes : l'alerte (rose), la veille (post-it), la consigne du premier passage
    const no = plan.note;
    let yn = no.y;
    const noter = (texte, nom, couleur) => {
      const lignes = P.couper(texte, no.l - 8);
      const h = 8 + lignes.length * 9;
      papier(ctx, no.x, yn, no.l, h, nom);
      lignes.forEach((l, i) => P.ecrire(ctx, l, no.x + 4, yn + 5 + i * 9, couleur));
      yn += h + 4;
    };
    if (alerte) noter(alerte, 'note', C.rouge);
    if (veille) noter(veille, 'post-it', C.encre);
    if (consigne && !alerte && !veille) noter('Choisissez un objet pour le regarder. Le planning lance les répétitions.', 'post-it', C.encre);
  };

  // ---------- L'étiquette de ce qui est choisi ----------
  const contenu = () => {
    if (!selection) return null;
    const [type, id] = selection.split(':');
    const cafe = () => {
      const inutile = !carnet.doses || carnet.energie >= ENERGIE.max;
      return {
        titre: 'Café de régie',
        lignes: [[`Énergie ${carnet.energie}/${ENERGIE.max} · doses ${carnet.doses}/${ENERGIE.doses}.`, C.encre], [`Un café rend ${ENERGIE.cafe} d’énergie. La cafetière refait une dose toutes les 3 minutes, pendant que vous regardez les projets.`, C.gris]],
        actions: [{ cle: 'boire', texte: !carnet.doses ? 'Thermos vide' : carnet.energie >= ENERGIE.max ? 'Déjà en forme' : 'Boire un café', lu: 'Boire un café', inactif: inutile, faire: actions.boire }],
      };
    };
    if (type === 'objet') {
      const o = OBJETS[id];
      if (!carnet.possede.includes(id)) {
        const [vues, total] = api.progression(id);
        return { titre: 'Objet à trouver', lignes: [[`Encore caché dans le ${api.titreDe(o.plaque)}.`, C.encre], [`Regardez toutes ses pièces${NB}: ${vues} sur ${total} vues.`, C.gris]], actions: [] };
      }
      const lignes = Object.entries(o.bonus).map(([k, v]) => [`${signe(v)} ${NOMS[k]}`, v > 0 ? C.vert : C.rouge]);
      if (o.pouvoir) lignes.push([o.pouvoir, C.vert]);
      const rival = api.rival(id);
      lignes.push([o.place ? `Se porte${NB}: ${o.place}.${rival ? ` Concurrent${NB}: ${OBJETS[rival].nom}.` : ''}` : `Trésor${NB}: il compte tant qu’il est sur l’étagère.`, C.encre]);
      if (o.note) lignes.push([o.note, C.gris]);
      lignes.push([o.depart ? 'Sur l’étagère depuis toujours.' : `Trouvé dans le ${api.titreDe(o.plaque)}.`, C.gris]);
      return { titre: o.nom, lignes, actions: api.actionsObjet(id).map((a) => ({ ...a, lu: `${a.texte}${a.inactif ? '' : ` : ${o.nom}${o.place ? ` (${o.place})` : ''}`}` })) };
    }
    if (type === 'stat') {
      const s = STATS.find((x) => x.cle === id);
      const st = etat.st[id];
      return {
        titre: `${s.nom} · ${st.valeur} sur 10`,
        lignes: [[etat.effet[id], C.vert], ...st.lignes.map((l) => [l.valeur ? `${l.texte}${NB}: ${signe(l.valeur)}` : `À trouver${NB}: ${l.texte}`, C.encre])],
        actions: [],
      };
    }
    if (type === 'fiche' && id === 'grade') return { titre: GRADES[etat.grade], lignes: [[`${etat.representations} représentation${etat.representations > 1 ? 's' : ''}.`, C.encre], [etat.prochain, C.gris]], actions: [] };
    if (type === 'fiche' && id === 'energie') return cafe();
    if (type === 'fiche' && id === 'objets') {
      const trouves = Object.keys(OBJETS).filter((x) => OBJETS[x].plaque && carnet.possede.includes(x)).map((x) => OBJETS[x].nom);
      const caches = Object.keys(OBJETS).filter((x) => OBJETS[x].plaque && !carnet.possede.includes(x));
      return {
        titre: `Objets trouvés · ${etat.trouves} sur ${etat.caches}`,
        lignes: [[trouves.length ? `${trouves.join(', ')}.` : 'Aucun pour l’instant.', C.encre], ...(caches.length ? [[`À trouver${NB}: un objet caché dans ${caches.map((x) => `le ${api.titreDe(OBJETS[x].plaque)}`).join(', ')}.`, C.gris]] : [])],
        actions: [],
      };
    }
    if (type === 'niveau') {
      const n = etat.niveaux.find((x) => x.id === id);
      const niveau = NIVEAUX.find((x) => x.id === id);
      return {
        titre: `${n.jour} · ${n.nom}`,
        lignes: [[n.resume, C.encre], [n.seuil, C.encre], [n.etat + (n.etat.endsWith('.') ? '' : '.'), n.jouable ? C.gris : C.rouge]],
        actions: [{ cle: 'jouer', texte: chargementCle === selection ? 'Ouverture…' : 'Prendre la régie', lu: `Prendre la régie : ${n.nom}`, inactif: !n.jouable || chargementCle === selection, faire: () => actions.lancer(niveau) }],
      };
    }
    if (type === 'poste' && id === 'thermos') return cafe();
    if (type === 'poste' && id === 'servante') {
      return { titre: 'La servante', lignes: [['Elle veille sur le plateau et garde votre progression dans ce navigateur.', C.encre]], actions: [{ cle: 'eteindre', texte: 'Éteindre la servante', faire: actions.eteindre }] };
    }
    if (type === 'poste' && id === 'corbeille') {
      return {
        titre: 'La corbeille',
        // la même hauteur, armée ou non : les rubans ne bougent pas sous le doigt, et « Annuler » prend la place du premier
        lignes: [['Tout effacer : objets, statistiques, représentations.', C.encre], effacerArme ? ['Vraiment ? Il n’y aura pas de retour.', C.rouge] : ['Il faudra confirmer.', C.gris]],
        actions: effacerArme
          ? [{ cle: 'annuler', texte: 'Annuler', faire: desarmer }, {
            cle: 'effacer', texte: 'Confirmer : tout effacer', danger: true,
            // un double appui ne confirme pas : le second appui doit venir au moins 600 ms après le premier
            faire: () => { if (performance.now() - effacerArme >= 600) actions.effacer(); },
          }]
          : [{ cle: 'armer', texte: 'Effacer ma progression', faire: armer }],
      };
    }
    if (type === 'crochet') return { titre: `Crochet ${id}`, lignes: [[`Libre. Choisissez sur l’étagère un objet qui se porte ${id === 'Tête' ? 'sur la tête' : id === 'Cou' ? 'au cou' : id === 'Main' ? 'à la main' : 'en poche'}.`, C.encre]], actions: [] };
    return null;
  };
  const armer = () => {
    effacerArme = performance.now();
    clearTimeout(minuterieEffacer);
    minuterieEffacer = setTimeout(desarmer, 4000);
    construire('action:effacer');
    dire('Confirmer l’effacement : choisissez « Confirmer : tout effacer », ou Annuler.');
  };
  const desarmer = () => {
    if (!effacerArme) return;
    effacerArme = 0;
    clearTimeout(minuterieEffacer);
    construire(selection === 'poste:corbeille' ? 'action:armer' : undefined);
  };
  const croise = (a, b) => a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.h && b.y < a.y + a.h;
  const peindreEtiquette = () => {
    const c = contenu();
    etiquette = null;
    if (!c) return;
    const TL = plan.etiquette;
    const lignes = [[c.titre, C.encre, true], ...c.lignes.flatMap(([t, coul]) => P.couper(t, TL - 12).map((l) => [l, coul]))];
    const h = 8 + lignes.length * 9 + (c.actions.length ? plan.ruban + 4 : 0) + 3;
    // où pendre l'étiquette : sans couvrir l'ampoule ni ce qu'elle décrit
    const [bx, by] = ampoule();
    const interdit = [{ x: bx - 16, y: by - 16, l: 32, h: 40 }];
    const el = els.find((e) => e.cle === selection);
    const cr = crochets().find((k) => k.cle === selection);
    const ligne = rects.get(selection);
    const ni = { x: plan.niche.x, y: plan.niche.y, l: 264, h: 240 };
    let pos = null;
    let attache = null;
    if (el) {
      const cible = el.zone;
      interdit.push(cible);
      const x0 = Math.max(ni.x + 2, Math.min(ni.x + ni.l - TL - 2, el.ax - 24));
      const essais = [
        { x: x0, y: cible.y - h - 10 },
        { x: x0, y: el.by + 8 },
        { x: Math.max(ni.x + 2, cible.x - TL - 6), y: Math.max(2, cible.y - 20) },
        { x: Math.min(ni.x + ni.l - TL - 2, cible.x + cible.l + 6), y: Math.max(2, cible.y - 20) },
      ];
      const dedans = (p) => p.y >= 2 && p.y + h <= plan.H - 2 && p.x >= 0 && p.x + TL <= plan.L;
      pos = essais.find((p) => dedans(p) && !interdit.some((r) => croise(r, { ...p, l: TL, h }))) ?? essais.find(dedans);
      attache = [el.ax, pos && pos.y > el.by ? el.by - 1 : cible.y + 2];
    } else if (cr) {
      pos = { x: Math.max(plan.panneau.x + 4, Math.min(plan.panneau.x + plan.panneau.l - TL - 4, cr.x - 20)), y: cr.y + 48 };
      attache = [cr.x + 16, cr.y + 10];
    } else if (ligne) {
      const x = plan.panneau.x + Math.max(4, Math.round((plan.panneau.l - TL) / 2));
      const dessous = ligne.y + ligne.h + 3;
      pos = { x, y: dessous + h <= plan.panneau.y + plan.panneau.h - 2 ? dessous : Math.max(2, ligne.y - h - 3) };
    }
    if (!pos) pos = { x: ni.x + 4, y: plan === PLANS.paysage ? ni.y + 2 : ni.y - 4 };
    etiquetteCv.width = TL + 3;
    etiquetteCv.height = h + 3;
    const ctx = etiquetteCv.getContext('2d');
    papier(ctx, 0, 0, TL, h, 'etiquette');
    lignes.forEach(([l, coul, titre], i) => {
      P.ecrire(ctx, l, 8, 6 + i * 9, coul);
      if (titre) { ctx.fillStyle = C.papier3; ctx.fillRect(7, 13, TL - 14, 1); }
    });
    let ax = pos.x + 8;
    const ay = pos.y + 8 + lignes.length * 9 + 2;
    c.actions.forEach((a) => {
      const r = ruban(ctx, a.texte, ax - pos.x, ay - pos.y, plan.ruban, !a.inactif, a.danger);
      rects.set(`action:${a.cle}`, { x: ax, y: ay, l: r.l, h: r.h });
      ax += r.l + 6;
    });
    etiquette = { ...c, x: pos.x, y: pos.y, l: TL, h, attache, agrafe: !attache };
  };

  // ---------- Le fond : la pièce, le panneau, ses crochets, la LED ----------
  const peindreFond = () => {
    fond.width = plan.L;
    fond.height = plan.H;
    const f = fond.getContext('2d');
    f.fillStyle = C.nuit;
    f.fillRect(0, 0, plan.L, plan.H);
    const pn = plan.panneau;
    paver(f, im.panneau, 0, 0, im.panneau.width, im.panneau.height, pn.x, pn.y, pn.l, pn.h);
    f.fillStyle = '#2E241E';
    if (plan === PLANS.paysage) f.fillRect(pn.x - 4, 0, 4, plan.H);
    else f.fillRect(0, pn.y + pn.h, plan.L, 2);
    crochets().forEach((c) => f.drawImage(im.crochet, c.x + 12, c.y));
    // la LED de service : un petit boîtier, la diode est allumée par le code
    f.fillStyle = '#24252B';
    f.fillRect(plan.led.x, plan.led.y, 24, 6);
    f.fillStyle = '#383A42';
    f.fillRect(plan.led.x + 1, plan.led.y + 1, 22, 1);
  };

  // ---------- Dessiner une image ----------
  const palier = (now) => {
    if (!anime()) return 0;
    if (vacillementT === null && now >= prochainVacillement && !selection && !surPanneau) vacillementT = now;
    if (vacillementT === null) return 0;
    const i = Math.floor((now - vacillementT) / 83);
    if (i >= 4) { vacillementT = null; prochainVacillement = now + 15000 + Math.random() * 25000; return 0; }
    return [1, 2, 1, 0][i];
  };
  const grains = Array.from({ length: 24 }, (_, i) => ({ a: i * 2.4, r: 8 + ((i * 53) % 64), p: i * 0.7, v: 2 + (i % 5) }));
  const dessiner = (now) => {
    if (!plan) return;
    const t = Math.floor(((now - allumage) / 1000) * IPS) / IPS;
    g.imageSmoothingEnabled = false;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    // la parallaxe, lissée : le fond ne bouge pas, la planche d'1 px, le câble de 3, la poussière de 2
    parallaxe += (parallaxeCible - parallaxe) * 0.25;
    const dx = anime() ? Math.round(parallaxe) : 0;
    g.drawImage(fond, 0, 0);
    g.drawImage(papiers, 0, 0);
    g.drawImage(im.etagere, plan.niche.x + dx, plan.niche.y);
    const [lx, ly] = ampoule();
    // les empreintes des objets à trouver, dans la poussière de la planche
    els.forEach((e) => {
      if (!e.trace) return;
      // le bois plus clair là où l'objet a dormi, la poussière tramée tout autour
      g.fillStyle = '#B49478';
      remplirLosange(g, e.losange, dx);
      g.fillStyle = '#8E7058';
      e.losange.forEach(([x, y]) => g.fillRect(x + dx, y, 1, 1));
    });
    // les ombres : au contact, et portées loin de l'ampoule
    els.forEach((e) => {
      if (e.trace) return;
      const img = im[e.img];
      const m = masque(e.img, img);
      const ddx = e.ax - lx;
      const ddy = e.ay - (ly + BULBE.w);
      const dist = Math.hypot(ddx, ddy) || 1;
      if (e.w === 0 && e.img !== 'servante' && !e.plat) {
        const lon = Math.max(6, Math.min(24, dist * 0.2));
        let kd = ((-ddy / dist) * lon * 0.5) / (m.bas + 1);
        if (Math.abs(kd) < 0.12) kd = 0.12;
        g.save();
        g.globalAlpha = 0.4;
        g.setTransform(1, 0, ((-ddx / dist) * lon) / (m.bas + 1), kd, e.x + m.xc + dx, e.by);
        g.drawImage(m.silhouette, -m.xc, -m.bas);
        g.restore();
      }
      // l'ombre de contact : l'emprise au sol, assombrie
      if (!e.plat) {
        g.globalAlpha = 0.45;
        g.fillStyle = '#000';
        remplirLosange(g, e.losange, dx);
        g.globalAlpha = 1;
      }
    });
    // ce qui pend aux crochets ; l'objet qu'on vient d'accrocher se balance un peu
    crochets().forEach((c) => {
      if (!c.img) return;
      const img = im[c.img];
      const balance = anime() && retours.some((r) => r.type === 'equipe' && r.id === c.id && now - r.t0 >= 2000 / IPS && now - r.t0 < 4000 / IPS) ? 1 : 0;
      g.globalAlpha = 0.35;
      g.drawImage(masque(c.img, img).silhouette, c.x + 3 + balance, c.y + 12);
      g.globalAlpha = 1;
      g.drawImage(img, c.x + balance, c.y + 9 - ((survol === c.cle || focusCle === c.cle) && anime() ? 1 : 0));
    });

    // ---------- la lumière : d'abord les surfaces, puis chaque objet selon sa place ----------
    const pl = palier(now);
    const carte = carteLumiere(plan, pl, BULBE);
    const zn = zoneNiche();
    const zp = zonePanneau();
    [[carte.mult, 'multiply'], [carte.froid, 'lighter']].forEach(([c, mode]) => {
      g.globalCompositeOperation = mode;
      g.drawImage(c, zp.x, zp.y, zp.l, zp.h, zp.x, zp.y, zp.l, zp.h);
      g.drawImage(c, zn.x, zn.y, zn.l, zn.h, zn.x + dx, zn.y, zn.l, zn.h);
    });
    g.globalCompositeOperation = 'source-over';
    const eclaire = (nom, u, v, w) => {
      const img = im[nom];
      const m = masque(nom, img);
      const haut = Math.max(0, m.bas - m.haut - (m.a + m.b) / 2); // la hauteur du volume, sans la profondeur de son emprise
      return teinter(nom, img, lumiereObjet(BULBE, pl, u - m.a / 2, v - m.b / 2, w + haut / 2));
    };
    els.forEach((e) => {
      if (e.trace) return;
      g.drawImage(eclaire(e.img, e.u, e.v, e.w), e.x + dx, e.y - leve(e));
    });
    // l'objet qui vient d'être équipé quitte la planche : il se soulève, puis disparaît
    const nouveau = retours.find((r) => r.type === 'equipe' && now - r.t0 < 2000 / IPS);
    if (nouveau && anime()) {
      const p = PLACES_OBJETS[nouveau.id];
      const nom = OBJETS[nouveau.id].sprite;
      if (p && im[nom]) { const m = masque(nom, im[nom]); const [x, y] = iso(p.u, p.v); g.drawImage(eclaire(nom, p.u, p.v, 0), Math.round(x - m.xc) + dx, Math.round(y - m.bas) - 4); }
    }
    // le câble qui pend au premier plan, entre la niche et le panneau : dans la pénombre
    if (im['bazar-cable-pendu']) g.drawImage(teinter('bazar-cable-pendu', im['bazar-cable-pendu'], 1.5 - pl * 0.3), plan.niche.x + 256 + (anime() ? Math.round(parallaxe * 3) : 0), plan.niche.y - 18);
    // le contre-jour, dans l'ordre de tri : un objet de devant efface celui des objets qu'il cache
    const rg = rimCv.getContext('2d');
    rg.clearRect(0, 0, rimCv.width, rimCv.height);
    els.forEach((e) => {
      if (e.trace) return;
      const m = masque(e.img, im[e.img]);
      rg.globalCompositeOperation = 'destination-out';
      rg.globalAlpha = 1;
      rg.drawImage(m.silhouette, e.x + dx, e.y - leve(e));
      const ddx = lx - e.ax;
      const ddy = ly - (e.y + 8);
      const dist = Math.hypot(ddx, ddy);
      if (dist > 130 || e.img === 'servante') return;
      rg.globalCompositeOperation = 'source-over';
      rg.globalAlpha = dist < 50 ? 0.5 : dist < 90 ? 0.3 : 0.15;
      rg.drawImage(m.rim(Math.abs(ddx) > dist * 0.38 ? Math.sign(ddx) : 0, Math.abs(ddy) > dist * 0.38 ? Math.sign(ddy) : 0), e.x + dx, e.y - leve(e));
    });
    rg.globalAlpha = 1;
    rg.globalCompositeOperation = 'source-over';
    g.drawImage(rimCv, 0, 0);
    // le halo de l'ampoule, et la diode de la LED
    const force = 1 - pl * 0.2;
    [[11, 0.12], [7, 0.22], [4, 0.4]].forEach(([r, al]) => {
      g.globalAlpha = al * force;
      g.fillStyle = '#FFD08A';
      for (let y = -r; y <= r; y++) { const demi = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(lx + dx - demi, ly + y, 2 * demi, 1); }
    });
    g.globalAlpha = force;
    g.fillStyle = '#FFF6D8';
    g.fillRect(lx + dx - 1, ly - 1, 3, 3);
    g.globalAlpha = 0.35;
    g.fillStyle = '#6CF0A0';
    g.fillRect(plan.led.x + 4, plan.led.y + 2, 16, 4);
    g.globalAlpha = 1;
    g.fillRect(plan.led.x + 6, plan.led.y + 3, 12, 2);
    // la poussière dans le faisceau
    if (anime()) {
      g.fillStyle = '#FFE6B0';
      grains.forEach((p) => {
        const monte = (t * p.v + p.p * 10) % 60;
        const x = Math.round(lx + Math.cos(p.a) * p.r + Math.sin(t * 0.6 + p.p) * 3 + Math.round(parallaxe * 2));
        const y = Math.round(ly + 30 + Math.sin(p.a) * p.r * 0.5 - monte);
        const d = Math.hypot(x - lx, (y - ly) * 1.4);
        if (d > 80) return;
        g.globalAlpha = (1 - d / 80) * (0.5 + 0.5 * Math.sin(t * 2 + p.p)) * force;
        g.fillRect(x, y, 1, 1);
      });
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    // ---------- au-dessus de la lumière : les repères, lisibles ----------
    els.forEach((e) => {
      if (!e.trace) return;
      P.ecrire(g, '?', e.ax + dx - 1, e.ay - 13, '#1A1410');
      P.ecrire(g, '?', e.ax + dx - 2, e.ay - 14, C.craie); // à la craie, au-dessus de l'empreinte
    });
    const detourer = (nom, x, y, couleur) => g.drawImage(masque(nom, im[nom]).contour[couleur], x - 1, y - 1);
    // le focus clavier : des coins de visée, distincts du détourage de la sélection
    const viser = (r) => {
      const x0 = r.x - 3;
      const y0 = r.y - 3;
      const x1 = r.x + r.l + 2;
      const y1 = r.y + r.h + 2;
      [[C.encre, 1], [C.fluo, 0]].forEach(([couleur, e]) => {
        g.fillStyle = couleur;
        [[x0 - e, y0 - e, 1, 1], [x1 + e, y0 - e, -1, 1], [x0 - e, y1 + e, 1, -1], [x1 + e, y1 + e, -1, -1]].forEach(([x, y, sx, sy]) => {
          g.fillRect(Math.min(x, x + sx * 4), y, 5, 1);
          g.fillRect(x, Math.min(y, y + sy * 4), 1, 5);
        });
      });
    };
    els.forEach((e) => {
      if (!e.cle) return;
      const y = e.y - leve(e);
      if (e.trace) {
        // l'empreinte se détoure par son losange
        if (e.cle === selection || e.cle === survol) {
          g.fillStyle = e.cle === selection ? C.fluo : C.survol;
          e.losange.forEach(([xa, ya], i) => {
            const [xb, yb] = e.losange[(i + 1) % 4];
            const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya), 1);
            for (let k = 0; k < n; k++) g.fillRect(Math.round(xa + ((xb - xa) * k) / n) + dx, Math.round(ya + ((yb - ya) * k) / n), 1, 1);
          });
        }
      } else if (e.cle === selection) detourer(e.img, e.x + dx, y, 'choix');
      else if (e.cle === survol) detourer(e.img, e.x + dx, y, 'survol');
      if (e.cle === focusCle) viser(e.trace ? { ...e.zone, x: e.zone.x + dx } : { x: e.x + dx, y, l: e.l, h: e.h });
    });
    crochets().forEach((c) => {
      const r = { x: c.x + 1, y: c.y + 9, l: 30, h: 34 };
      if (c.img && c.cle === selection) detourer(c.img, c.x, c.y + 9, 'choix');
      else if (c.img && c.cle === survol) detourer(c.img, c.x, c.y + 9, 'survol');
      else if (!c.img && (c.cle === selection || c.cle === survol)) { g.fillStyle = c.cle === selection ? C.fluo : C.survol; g.fillRect(r.x, r.y + 3, r.l, 1); g.fillRect(r.x, r.y + r.h - 1, r.l, 1); g.fillRect(r.x, r.y + 3, 1, r.h - 3); g.fillRect(r.x + r.l - 1, r.y + 3, 1, r.h - 3); }
      if (c.cle === focusCle) viser(r);
    });
    // les lignes de la fiche et du planning : un cadre à l'encre pour le focus, en pointillé pour le survol
    rects.forEach((r, cle) => {
      if (!/^(stat|fiche|niveau):/.test(cle)) return;
      if (cle === focusCle) { g.fillStyle = C.encre; g.fillRect(r.x - 1, r.y - 1, r.l + 2, 1); g.fillRect(r.x - 1, r.y + r.h, r.l + 2, 1); g.fillRect(r.x - 1, r.y, 1, r.h); g.fillRect(r.x + r.l, r.y, 1, r.h); }
      else if (cle === survol) { g.fillStyle = C.encre; for (let x = r.x; x < r.x + r.l; x += 2) { g.fillRect(x, r.y - 1, 1, 1); g.fillRect(x, r.y + r.h, 1, 1); } }
    });
    // les points gagnés clignotent au fluo, les points perdus se cerclent de rouge (en mouvement réduit : une marque au crayon)
    retours.forEach((r) => {
      if (r.type !== 'stats') return;
      const age = now - r.t0;
      Object.entries(r.variations).forEach(([cle, dv]) => {
        const k = casesStats[cle];
        if (!k) return;
        const v = etat.st[cle].valeur;
        if (!anime() || age > 6000 / IPS) {
          if (age < 3000) P.ecrire(g, signe(dv), k.x - P.mesurer(signe(dv)) - 3, k.y + 1, dv > 0 ? C.vert : C.rouge);
          return;
        }
        const allume = Math.floor(age / (1000 / IPS)) % 2 === 0;
        for (let i = 0; i < Math.abs(dv); i++) {
          const n = dv > 0 ? v - 1 - i : v + i;
          if (n < 0 || n > 9) continue;
          const x = k.x + n * (k.cote + 1);
          if (dv > 0 && allume) { g.fillStyle = C.fluo; g.fillRect(x, k.y, k.cote, k.h); }
          if (dv < 0) { g.fillStyle = C.rouge2; g.fillRect(x, k.y, k.cote, 1); g.fillRect(x, k.y + k.h - 1, k.cote, 1); g.fillRect(x, k.y, 1, k.h); g.fillRect(x + k.cote - 1, k.y, 1, k.h); }
        }
      });
    });
    retours = retours.filter((r) => now - r.t0 < 3200);
    // l'étiquette, pendue par sa ficelle depuis son œillet (ou agrafée à la ligne qu'elle décrit)
    if (etiquette) {
      if (etiquette.attache) {
        const [fx, fy0] = etiquette.attache;
        const fx2 = fx + (els.some((e) => e.cle === selection) ? dx : 0);
        const ax = etiquette.x + 4;
        const ay = etiquette.y + 4;
        const n = Math.max(1, Math.abs(fy0 - ay), Math.abs(fx2 - ax));
        g.fillStyle = C.ficelle;
        for (let k = 0; k <= n; k++) g.fillRect(Math.round(ax + ((fx2 - ax) * k) / n), Math.round(ay + ((fy0 - ay) * k) / n), 1, 1);
      }
      g.drawImage(etiquetteCv, etiquette.x, etiquette.y);
      if (etiquette.agrafe) { g.fillStyle = C.gris; g.fillRect(etiquette.x + 5, etiquette.y + 2, 4, 1); }
    }
    // le focus des rubans Dymo : des coins de visée, comme pour les objets
    if (focusCle && /^(action:|lire$|fermer$)/.test(focusCle) && rects.has(focusCle)) viser(rects.get(focusCle));
    // l'allumage et l'extinction : la lumière monte (ou descend) en quatre paliers
    const ouverture = (now - allumage) / 62;
    const extinction = fermeture ? (now - fermeture.t0) / 62 : -1;
    const niveau = extinction >= 0 ? Math.max(0, 3 - Math.floor(extinction)) : Math.min(4, Math.floor(ouverture));
    if (anime() && niveau < 4) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = ['#101010', '#404040', '#808080', '#C0C0C0'][niveau];
      g.fillRect(0, 0, plan.L, plan.H);
      g.globalCompositeOperation = 'source-over';
    }
  };

  // ---------- La boucle : 15 images par seconde suffisent, et rien sous la régie ni onglet caché ----------
  const rafraichir = () => { sale = true; if (!trame && ouvert && plan) dessiner(performance.now()); };
  const boucle = (now) => {
    if (!ouvert || suspendu) { trame = null; return; }
    trame = requestAnimationFrame(boucle);
    const pas = Math.floor(now / (1000 / IPS));
    const bouge = Math.abs(parallaxeCible - parallaxe) > 0.05;
    if (pas === dernierPas && !sale) return;
    dernierPas = pas;
    sale = bouge;
    try { dessiner(now); } catch (e) { console.error('[coulisses]', e); cancelAnimationFrame(trame); trame = null; }
  };
  const demarrer = () => {
    cancelAnimationFrame(trame);
    trame = null;
    if (!ouvert || suspendu) return;
    if (anime() && !document.hidden) trame = requestAnimationFrame(boucle);
    else rafraichir();
  };

  // ---------- Les boutons transparents, dans l'ordre de l'écran ----------
  const placer = (el, r) => {
    Object.assign(el.style, { left: `${(r.x / plan.L) * 100}%`, top: `${(r.y / plan.H) * 100}%`, width: `${(r.l / plan.L) * 100}%`, height: `${(r.h / plan.H) * 100}%` });
  };
  const dire = (texte) => { lu.textContent = ''; requestAnimationFrame(() => { lu.textContent = texte; }); };
  const lireContenu = (c) => (c ? `${c.titre}. ${c.lignes.map(([l]) => l.replace(/\.$/, '')).join('. ')}.${c.actions.length ? ` Actions${NB}: ${c.actions.map((a) => a.texte).join(', ')}.` : ''}` : '');
  const choisir = (cle) => {
    if (effacerArme) { effacerArme = 0; clearTimeout(minuterieEffacer); } // changer de choix désarme la corbeille
    selection = selection === cle ? null : cle;
    if (cle.startsWith('objet:')) { carnet.choisi = selection ? cle.slice(6) : undefined; api.garder(); }
    if (selection) carnet.etagereVue = true;
    sonner('papier');
    construire(cle);
    const c = contenu();
    dire(c ? lireContenu(c) : 'Étiquette reposée.');
  };
  const nomDe = (e) => {
    if (e.type === 'objet') {
      const o = OBJETS[e.id];
      if (e.trace) { const [vues, total] = api.progression(e.id); return `Objet à trouver : caché dans le ${api.titreDe(o.plaque)}, ${vues} pièces vues sur ${total}`; }
      return `${o.nom}${o.place ? `, se porte ${o.place}` : ', trésor'}`;
    }
    return {
      'poste:servante': 'La servante : la regarder, l’éteindre',
      'poste:thermos': `Thermos : café de régie, ${carnet.doses} dose${carnet.doses > 1 ? 's' : ''}, énergie ${carnet.energie} sur ${ENERGIE.max}`,
      'poste:corbeille': 'Corbeille : effacer ma progression, avec confirmation',
    }[e.cle];
  };
  const construire = (focus) => {
    if (!plan || !ouvert) return;
    const garde = focus ?? document.activeElement?.closest?.('dialog.etagere [data-cle]')?.dataset.cle;
    etat = api.etat();
    // ce qui vient de changer dans les statistiques : on le montre
    const variations = {};
    STATS.forEach((s) => { const d = etat.st[s.cle].valeur - (valeursVues[s.cle] ?? etat.st[s.cle].valeur); if (d) variations[s.cle] = d; });
    if (Object.keys(variations).length) retours.push({ type: 'stats', variations, t0: performance.now() });
    valeursVues = Object.fromEntries(STATS.map((s) => [s.cle, etat.st[s.cle].valeur]));
    rects = new Map();
    els = calculerElements();
    if (selection && !els.some((e) => e.cle === selection) && !crochets().some((c) => c.cle === selection) && /^(objet|crochet):/.test(selection)) {
      // un crochet libre qui vient d'être garni, ou l'inverse : on suit l'objet
      const place = selection.split(':')[1];
      if (selection.startsWith('crochet:') && carnet.porte[place]) selection = `objet:${carnet.porte[place]}`;
    }
    peindrePapiers();
    peindreEtiquette();
    rimCv.width = plan.L;
    rimCv.height = plan.H;
    // la version lue : ce que dit la fiche, la veille, l'alerte
    ficheLue.textContent = [
      `${GRADES[etat.grade]}, ${etat.representations} représentation${etat.representations > 1 ? 's' : ''}.`,
      `Énergie ${etat.energie} sur ${ENERGIE.max}, ${etat.doses} dose${etat.doses > 1 ? 's' : ''} de café.`,
      `Objets trouvés : ${etat.trouves} sur ${etat.caches}.`,
      etat.prochain,
      veille,
      alerte,
    ].filter(Boolean).join(' ');
    // l'ordre des boutons suit l'écran ; les actions viennent juste après ce qu'on a choisi
    const liste = [];
    const planche = els.filter((e) => e.cle).sort((a, b) => a.ax - b.ax || a.ay - b.ay).map((e) => ({ cle: e.cle, nom: nomDe(e), r: e.zone, chose: true }));
    const panneau = [
      ...crochets().map((c) => ({ cle: c.cle, nom: c.id ? `${OBJETS[c.id].nom}, porté (${c.place})` : `Crochet ${c.place} : libre`, r: { x: c.x, y: c.y, l: 32, h: 44 }, chose: true })),
      { cle: 'fiche:grade', nom: `Grade : ${GRADES[etat.grade]}, ${etat.representations} représentation${etat.representations > 1 ? 's' : ''}. ${etat.prochain}` },
      { cle: 'fiche:energie', nom: `Énergie : ${etat.energie} sur ${ENERGIE.max}, ${etat.doses} dose${etat.doses > 1 ? 's' : ''} de café` },
      ...STATS.map((s) => ({ cle: `stat:${s.cle}`, nom: `${s.nom} : ${etat.st[s.cle].valeur} sur 10. ${etat.effet[s.cle]}` })),
      { cle: 'fiche:objets', nom: `Objets trouvés : ${etat.trouves} sur ${etat.caches}` },
      ...etat.niveaux.map((n) => ({ cle: `niveau:${n.id}`, nom: `${n.jour}, ${n.lu}` })),
      { cle: 'lire', nom: 'Lire la fiche en texte', faire: ouvrirLecture },
      { cle: 'fermer', nom: 'Fermer l’étagère', faire: () => fermer({ animer: true }) },
    ];
    (plan === PLANS.portrait ? [...panneau, ...planche] : [...planche, ...panneau]).forEach((b) => {
      liste.push({ ...b, r: b.r ?? rects.get(b.cle), presse: b.faire ? undefined : selection === b.cle });
      if (b.cle === selection && etiquette) etiquette.actions.forEach((a) => liste.push({ cle: `action:${a.cle}`, nom: a.lu ?? a.texte, r: rects.get(`action:${a.cle}`), inactif: a.inactif, faire: a.faire }));
    });
    boutonsEl.replaceChildren(...liste.filter((b) => b.r).map((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `regie-touche${b.chose ? ' etagere-chose' : ''}`;
      el.dataset.cle = b.cle;
      el.textContent = b.nom;
      if (b.presse !== undefined) el.setAttribute('aria-pressed', String(b.presse));
      if (b.inactif) el.setAttribute('aria-disabled', 'true');
      if (b.cle === `action:jouer` && chargementCle) el.setAttribute('aria-busy', 'true');
      placer(el, b.r);
      el.addEventListener('click', () => {
        if (b.inactif) return;
        if (b.faire) { sonner('appui'); b.faire(); } else choisir(b.cle);
      });
      el.addEventListener('pointerenter', () => { if (!b.chose) { survol = b.cle; surPanneau = true; rafraichir(); } });
      el.addEventListener('pointerleave', () => { if (survol === b.cle) survol = null; rafraichir(); });
      el.addEventListener('focus', () => { focusCle = b.cle; rafraichir(); });
      el.addEventListener('blur', () => { if (focusCle === b.cle) focusCle = null; rafraichir(); });
      return el;
    }));
    if (garde) boutonsEl.querySelector(`[data-cle="${CSS.escape(garde)}"]`)?.focus({ preventScroll: true });
    rafraichir();
  };

  // ---------- Le pointeur : au pixel près, l'étiquette arrête le clic, au doigt l'objet le plus proche ----------
  const natif = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * plan.L), Math.floor(((e.clientY - r.top) / r.height) * plan.H), r.width / plan.L];
  };
  const dx = () => (anime() ? Math.round(parallaxe) : 0);
  const toucher = (e) => {
    const [x, y, k] = natif(e);
    if (etiquette && x >= etiquette.x && x < etiquette.x + etiquette.l && y >= etiquette.y && y < etiquette.y + etiquette.h) return { bloque: true };
    for (const c of crochets()) if (x >= c.x && x < c.x + 32 && y >= c.y && y < c.y + 44) return { cle: c.cle };
    const essai = (px, py) => {
      for (const el of [...els].reverse()) {
        const m = masque(el.img, im[el.img]);
        if (el.trace) { const z = el.zone; if (px - dx() >= z.x && px - dx() < z.x + z.l && py >= z.y && py < z.y + z.h) return el.cle; continue; }
        if (m.opaque(px - el.x - dx(), py - el.y + leve(el))) return el.cle ?? null;
      }
      return undefined;
    };
    const direct = essai(x, y);
    if (direct !== undefined) return { cle: direct };
    // au doigt : la chose la plus proche, dans un rayon de 12 px d'écran
    if (e.pointerType === 'touch') {
      const rayon = Math.ceil(12 / k);
      for (let r = 1; r <= rayon; r++) {
        for (let a = 0; a < 16; a++) {
          const trouve = essai(Math.round(x + r * Math.cos((a * Math.PI) / 8)), Math.round(y + r * Math.sin((a * Math.PI) / 8)));
          if (trouve) return { cle: trouve };
        }
      }
    }
    return {};
  };
  canvas.addEventListener('pointermove', (e) => {
    if (!plan) return;
    const { cle } = toucher(e);
    canvas.style.cursor = cle ? 'pointer' : '';
    const [x, y] = natif(e);
    surPanneau = plan === PLANS.paysage ? x >= plan.panneau.x : y < plan.panneau.y + plan.panneau.h;
    if ((cle ?? null) !== survol) { survol = cle ?? null; rafraichir(); }
  });
  canvas.addEventListener('pointerleave', () => { survol = null; rafraichir(); });
  canvas.addEventListener('click', (e) => {
    const { cle, bloque } = toucher(e);
    if (bloque) return;
    if (!cle) { if (selection) choisir(selection); return; } // un clic dans le vide repose l'étiquette
    choisir(cle);
    boutonsEl.querySelector(`[data-cle="${CSS.escape(cle)}"]`)?.focus({ preventScroll: true });
  });
  dlg.addEventListener('pointermove', (e) => {
    if (grossier.matches || !plan) return;
    const r = canvas.getBoundingClientRect();
    parallaxeCible = ((e.clientX - r.left) / r.width - 0.5) * 2;
    sale = true;
  });

  // ---------- Lire la fiche : la même chose en texte HTML, qui suit le zoom du navigateur ----------
  function ouvrirLecture() {
    const e = api.etat();
    const h = (tag, texte, attrs = {}) => { const el = document.createElement(tag); el.textContent = texte; Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); return el; };
    const ul = (items) => { const l = document.createElement('ul'); items.forEach((i) => l.append(h('li', i))); return l; };
    const retour = h('button', 'Revenir à l’étagère', { type: 'button', class: 'bouton' });
    retour.addEventListener('click', fermerLecture);
    lecture.replaceChildren(
      h('h2', 'Fiche du régisseur', { id: 'etagere-lecture-titre' }),
      h('p', `${GRADES[e.grade]}, ${e.representations} représentation${e.representations > 1 ? 's' : ''}. ${e.prochain}`),
      h('p', `Énergie ${e.energie} sur ${ENERGIE.max}, ${e.doses} dose${e.doses > 1 ? 's' : ''} de café. Objets trouvés : ${e.trouves} sur ${e.caches}.`),
      ...[veille, alerte].filter(Boolean).map((t) => h('p', t)),
      h('h3', 'Statistiques'),
      ...STATS.flatMap((s) => [h('h4', `${s.nom} : ${e.st[s.cle].valeur} sur 10`), h('p', e.effet[s.cle]), ul(e.st[s.cle].lignes.map((l) => (l.valeur ? `${l.texte} : ${signe(l.valeur)}` : `À trouver : ${l.texte}`)))]),
      h('h3', 'Planning des répétitions'),
      ul(e.niveaux.map((n) => `${n.jour}, ${n.lu}`)),
      retour,
    );
    lecture.hidden = false;
    lecture.focus();
  }
  function fermerLecture() {
    lecture.hidden = true;
    boutonsEl.querySelector('[data-cle="lire"]')?.focus({ preventScroll: true });
  }

  // ---------- Échap : d'abord la lecture, puis l'étiquette, puis l'étagère ----------
  // Pris sur la touche elle-même : Chrome cesse d'honorer l'annulation de « cancel » après quelques Échap de suite.
  // « cancel » reste pour les autres demandes de fermeture (bouton retour d'Android).
  const echap = (e) => {
    if (!lecture.hidden) { e.preventDefault(); fermerLecture(); return; }
    if (selection) {
      e.preventDefault();
      const cle = selection;
      choisir(cle);
      boutonsEl.querySelector(`[data-cle="${CSS.escape(cle)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (anime()) { e.preventDefault(); fermer({ animer: true }); }
  };
  dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.repeat) echap(e); else if (e.key === 'Escape') e.preventDefault(); });
  dlg.addEventListener('cancel', echap);

  // ---------- Taille : toute la place, en pixels égaux quand c'est possible (pixels.js) ----------
  const ajuster = () => {
    if (!ouvert) return;
    const al = Math.max(120, dlg.clientWidth);
    const ah = Math.max(120, dlg.clientHeight);
    const p = al < ah ? PLANS.portrait : PLANS.paysage;
    if (p !== plan) {
      plan = p;
      canvas.width = p.L;
      canvas.height = p.H;
      peindreFond();
      construire();
    }
    const k = agrandissement(al, ah, p.L, p.H);
    ecranEl.style.width = `${Math.round(p.L * k)}px`;
    ecranEl.style.height = `${Math.round(p.H * k)}px`;
    rafraichir();
  };
  addEventListener('resize', ajuster);
  const visibilite = () => demarrer();
  document.addEventListener('visibilitychange', visibilite);
  mouvementReduit.addEventListener?.('change', demarrer);

  // ---------- Fermer : la boucle s'arrête avant tout, puis la lumière s'éteint ----------
  const fermer = ({ eteindre = false, animer = false } = {}) => {
    if (!ouvert || fermeture) return;
    if ((eteindre || animer) && anime() && plan && !document.hidden) {
      fermeture = { t0: performance.now(), eteindre };
      sale = true;
      if (!trame) demarrer();
      setTimeout(() => { if (ouvert) dlg.close(); }, 4 * 62 + 20);
      return;
    }
    ouvert = false;
    cancelAnimationFrame(trame);
    trame = null;
    dlg.close();
  };
  dlg.addEventListener('close', () => {
    ouvert = false;
    cancelAnimationFrame(trame);
    trame = null;
    clearTimeout(minuterieEffacer);
    document.removeEventListener('visibilitychange', visibilite);
    mouvementReduit.removeEventListener?.('change', demarrer);
    removeEventListener('resize', ajuster);
    dlg.remove();
    api.surFermer?.();
  });

  return {
    dlg,
    ouvrir: ({ veille: v = '', alerte: a = '' } = {}) => {
      veille = v;
      alerte = a;
      alerteEl.textContent = a;
      dlg.showModal();
      allumage = performance.now();
      ajuster();
      // le focus va à la prochaine répétition à jouer, sinon au premier objet
      const premier = etat.prochaine ? `niveau:${etat.prochaine}` : boutonsEl.querySelector('.etagere-chose')?.dataset.cle;
      construire(premier ?? 'fermer');
      demarrer();
    },
    rendre: (focus) => { if (ouvert) construire(focus); },
    alerte: (texte) => { alerte = texte || ''; alerteEl.textContent = alerte; if (ouvert) construire(); },
    dire: (texte) => { if (ouvert) dire(texte); },
    chargement: (id, oui) => { chargementCle = oui ? `niveau:${id}` : null; if (ouvert) construire(); },
    suspendre: () => { suspendu = true; cancelAnimationFrame(trame); trame = null; },
    reprendre: () => { if (!suspendu) return; suspendu = false; demarrer(); },
    equipe: (id) => { retours.push({ type: 'equipe', id, t0: performance.now() }); sale = true; },
    fermer,
  };
}
