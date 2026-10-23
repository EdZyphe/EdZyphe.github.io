// Les tops : le jeu de régie lumière des coulisses.
// On envoie chaque top de la conduite au bon moment, sur « Nouvelles Bien Tempérées » (regles.js) : tops à vue,
// sur le texte appelés à l'inter, enchaînés sur la bande ; les décors vidéo se projettent au lointain. Les statistiques gagnées en parcourant le
// portfolio règlent la difficulté (voir regles.js) : fenêtre d'un top juste (Lumière), conduite
// visible à l'avance (Vidéo), « Attention » avant les tops appelés à l'inter (Son), prix des erreurs
// (Sang-froid) et risque d'incident (Chance).
// Direction artistique inspirée de Papers, Please (DIRECTION-ARTISTIQUE.md) : la cabine de régie vue
// de la place du régisseur, dans un seul canevas de pixel art ; des boutons transparents sont posés
// sur les touches dessinées, pour le clavier, le doigt et les lecteurs d'écran.
import { image, paver, neuf, CASE } from './pixels.js';
import { police } from './police.js';
import { SCENE, CONSOLE, PAYSAGE, PORTRAIT } from './plans.js';
import { NIVEAUX, ENERGIE, RATTRAPAGE, SAUTE, POSES, GESTES, GESTES_COURTS, LEURRE, FEINTE, PRISE, OBJETS, PLACES, VIDEOS, seuil, classer, limiteRetard, enScene, repos } from './regles.js';
import { allumerSon, couperSon, jouerSon } from './son.js';
import { RAMPE, FROID, palier, teinte, lisere } from './lumiere.js';

const NB = ' ';
const SL = SCENE.l;
const SH = SCENE.h;
const EL = CONSOLE.ecran.l; // l'écran vert de la console
const EH = CONSOLE.ecran.h;
const BH = 24; // la bande de conduite, en haut de l'écran vert
const PPS = 60; // défilement de la bande, en pixels par seconde
const LIGNE = 24; // ligne du top : le bord gauche d'un bloc la touche à l'instant du top
const BLOC = 15;
const CARTON = 1500; // le carton de la représentation, avant l'avant-spectacle (ms)
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)');
const grossier = matchMedia('(pointer: coarse)');

// la palette de la bible
const C = {
  encre: '#2A2724', papier: '#F4EEDA', papier3: '#C9C0A3', zinc: '#7E828B', acier: '#575A63', velours: '#141416',
  phosphore: '#BFD3E2', lcd: '#0E1318', lcd2: '#1C2630', fluo: '#F2E94E', carmin: '#8E2A2A', carmin2: '#C2453A', video: '#38C6D9', juste: '#6FA05F',
  ambre: '#D9A62E', ambreSombre: '#3A3214', chene: '#3B2E27', sortie: '#2EBE78',
};
const IMAGES = ['scene', 'scene-avant', 'comedien', 'comedienne', 'bouteilles', 'public', 'reflets', 'mur', 'vitre', 'console', 'touche-top', 'touche', 'fader', 'table',
  'feuille', 'post-it', 'rapport', 'tampons', 'haut-parleur', 'bulle', 'bulle-queue', 'thermos',
  ...Object.keys(VIDEOS).filter((v) => v !== 'noir').map((v) => `projection-${v}`)];

// ---------- La lumière : une carte multipliée sur la scène, les fondus en quatre paliers de trame ----------
const COULEURS = { plein: '#FFFFFF', noir: '#000000', bleu: '#3866D9', ambre: '#FFB861', service: '#40454F', salle: '#2C2A2E' };
const SOMBRES = new Set(['noir', 'douche', 'bleu', 'service', 'salle']);
const DUREES = { juste: 120, avance: 350, retard: 350, rate: 600, leurre: 600 }; // durée du fondu (ms)
// les faders suivent l'état de lumière en cours (8 circuits, de 0 à 1)
const FADERS = {
  service: [0.3, 0.3, 0, 0, 0, 0, 0.2, 0], noir: [0, 0, 0, 0, 0, 0, 0, 0], plein: [1, 1, 1, 1, 0.8, 0.8, 0.6, 0.6], salle: [0, 0, 0, 0, 0, 0, 0, 1],
  douche: [0, 0, 0, 1, 0, 0, 0, 0], bleu: [0, 0, 0, 0, 1, 1, 0, 0], ambre: [0.7, 0.7, 0, 0, 0, 0, 1, 1],
};
const toile = (l, h) => {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  return c;
};
let masqueDouche = null; // le cône de la douche, centré en x = SL, bord tramé ; calculé une fois
let trames = null; // 25, 50 et 75 % de pixels allumés (trame de Bayer 2 × 2)
const preparerLumiere = () => {
  if (masqueDouche) return;
  masqueDouche = toile(2 * SL, SH);
  const g = masqueDouche.getContext('2d');
  const img = g.createImageData(2 * SL, SH);
  for (let y = 0; y < SH; y++) {
    const demi = 14 + (y / SH) * 30;
    for (let x = 0; x < 2 * SL; x++) {
      const e = Math.abs(x - SL);
      const v = e < demi ? 255 : e < demi + 4 && (x + y) % 2 ? 230 : 18;
      img.data.set([v, v, v, 255], (y * 2 * SL + x) * 4);
    }
  }
  g.putImageData(img, 0, 0);
  const BAYER = [[0, 2], [3, 1]];
  trames = [1, 2, 3].map((q) => {
    const tuile = toile(2, 2);
    const tg = tuile.getContext('2d');
    tg.fillStyle = '#000';
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) if (BAYER[y][x] < q) tg.fillRect(x, y, 1, 1);
    const c = toile(SL, SH);
    const g2 = c.getContext('2d');
    g2.fillStyle = g2.createPattern(tuile, 'repeat');
    g2.fillRect(0, 0, SL, SH);
    return c;
  });
};

// ---------- La lumière de la cabine, la même que celle de l'étagère (lumiere.js) ----------
// La lampe de régie, derrière le régisseur, fait des flaques chaudes sur la table et la console ; le reste de la
// cabine est dans une ombre froide. La scène déborde par la vitre, de sa couleur, sur le cadre, le rebord, la console
// et le haut de la table : chaque top se voit aussi dans la cabine. L'écran vert luit autour de lui. La vitre (la scène,
// éclairée par sa propre carte) et ce qui émet de la lumière (écran, voyants) ne sont pas assombris.
const DEBORD = { plein: ['#FFE2B8', 0.55], ambre: ['#FF9F45', 0.6], bleu: ['#4C7BFF', 0.6], douche: ['#FFF0D0', 0.14], service: ['#8494B8', 0.16], salle: ['#FFD9A8', 0.4], noir: ['#000000', 0] };
const LISERE = { plein: 0.45, ambre: 0.6, bleu: 0.55, douche: 0.75, service: 0.2, salle: 0.1, noir: 0 }; // le contre-jour sur l'interprète
const cabines = new Map();
const cabine = (plan) => {
  if (cabines.has(plan.nom)) return cabines.get(plan.nom);
  const { L, H } = plan;
  const v = plan.verre;
  const bas = v.y + v.h;
  const e = { x: plan.console.x + CONSOLE.ecran.x, y: plan.console.y + CONSOLE.ecran.y, l: CONSOLE.ecran.l, h: CONSOLE.ecran.h };
  const cartes = { mult: toile(L, H), froid: toile(L, H), lueur: toile(L, H), debord: toile(L, H) };
  const d = Object.fromEntries(Object.keys(cartes).map((k) => [k, new ImageData(L, H)]));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 4;
      if (x >= v.x && x < v.x + v.l && y >= v.y && y < bas) { d.mult.data.set([255, 255, 255, 255], i); continue; } // la scène
      let I = 0.12;
      plan.flaques.forEach((f) => { I += f.k / (1 + (Math.hypot(x - f.x, (y - f.y) / 0.8) / f.r) ** 2); });
      const n = palier(Math.min(1, I), x, y);
      d.mult.data.set([...RAMPE[n], 255], i);
      const fr = 1 - n / 4;
      d.froid.data.set([FROID[0] * fr, FROID[1] * fr, FROID[2] * fr, 255], i);
      const de = Math.hypot(Math.max(e.x - x, 0, x - (e.x + e.l - 1)), Math.max(e.y - y, 0, y - (e.y + e.h - 1)));
      const ng = de > 0 && de < 14 ? palier(0.55 * (1 - de / 14) ** 2, x, y, 3) : 0;
      d.lueur.data.set([40 * ng, 56 * ng, 72 * ng, 255], i);
      const hors = Math.max(v.x - x, 0, x - (v.x + v.l - 1));
      const s = y >= bas ? Math.exp(-(y - bas) / 26) * Math.exp(-hors / 14) : 0; // la lumière de la scène descend dans la cabine
      const ns = palier(s, x, y, 3);
      d.debord.data.set([85 * ns, 85 * ns, 85 * ns, 255], i);
    }
  }
  Object.entries(cartes).forEach(([k, c]) => c.getContext('2d').putImageData(d[k], 0, 0));
  cabines.set(plan.nom, cartes);
  return cartes;
};

// ---------- Les faisceaux des projecteurs, visibles dans l'air de la salle ----------
// Chaque état a ses projecteurs : [x en haut, x au sol, demi-largeur au sol]. La douche suit l'interprète.
const PROJECTEURS = {
  plein: [[70, 120, 30], [170, 190, 30], [286, 266, 30], [386, 336, 30]],
  ambre: [[10, 150, 40], [446, 306, 40]],
  bleu: [[120, 150, 34], [228, 228, 34], [336, 306, 34]],
  service: [[228, 228, 64]],
  douche: [[SL, SL, 40]],
};
const faisceaux = new Map();
const faisceau = (etat) => {
  if (faisceaux.has(etat)) return faisceaux.get(etat);
  let f = null;
  if (PROJECTEURS[etat]) {
    const l = etat === 'douche' ? 2 * SL : SL;
    const c = toile(l, SH);
    const data = new ImageData(l, SH);
    const sol = SH - 18;
    for (let y = 0; y < sol; y++) {
      const k = y / sol;
      for (let x = 0; x < l; x++) {
        let I = 0;
        PROJECTEURS[etat].forEach(([xh, xs, ds]) => {
          const e = Math.abs(x - (xh + (xs - xh) * k)) / (3 + (ds - 3) * k);
          if (e < 1) I = Math.max(I, (1 - e * e) * (0.55 + 0.45 * (1 - k)));
        });
        const n = palier(I, x, y, 3);
        if (n) data.data.set([85 * n, 85 * n, 85 * n, 255], (y * l + x) * 4);
      }
    }
    c.getContext('2d').putImageData(data, 0, 0);
    f = { c, l, dedans: (x, y) => x >= 0 && x < l && y >= 0 && y < SH && data.data[(y * l + x) * 4] > 0 };
  }
  faisceaux.set(etat, f);
  return f;
};
// le reflet de la lampe de régie dans la vitre : une tache chaude, tramée
let reflet = null;
const refletLampe = () => {
  if (reflet) return reflet;
  const c = toile(44, 24);
  const data = new ImageData(44, 24);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 44; x++) {
      const n = palier(Math.max(0, 1 - Math.hypot((x - 22) / 22, (y - 12) / 12)) ** 1.5, x, y, 3);
      if (n) data.data.set([255 * n / 3, 214 * n / 3, 160 * n / 3, 255], (y * 44 + x) * 4);
    }
  }
  c.getContext('2d').putImageData(data, 0, 0);
  reflet = c;
  return c;
};

// ---------- Signes de verdict (7 × 7) sur la ligne du top ----------
const GLYPHES = {
  juste: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....', '.......'],
  avance: ['...##..', '..##...', '.##....', '##.....', '.##....', '..##...', '...##..'],
  retard: ['..##...', '...##..', '....##.', '.....##', '....##.', '...##..', '..##...'],
  rate: ['##...##', '.##.##.', '..###..', '..###..', '.##.##.', '##...##', '.......'],
};
const TEINTE_VERDICT = { juste: '#6FA05F', avance: '#D9A62E', retard: '#D9A62E', rate: '#C2453A', trop: '#C2453A', leurre: '#C2453A' };
const MOTS = { juste: 'juste', avance: 'en avance', retard: 'en retard', rate: 'raté', trop: 'en trop', leurre: 'leurre' };
const glyphe = (ctx, nom, x, y, couleur) => {
  ctx.fillStyle = couleur;
  GLYPHES[nom].forEach((ligne, j) => { for (let c = 0; c < 7; c++) if (ligne[c] === '#') ctx.fillRect(x + c, y + j, 1, 1); });
};
const CARTONS = { filage: 'J−3 · Nouvelles Bien Tempérées · filage', generale: 'J−1 · Nouvelles Bien Tempérées · générale', premiere: 'Nouvelles Bien Tempérées · soir de première' };

let lancement = false;
export async function jouer(options) {
  if (lancement || document.querySelector('dialog.regie')) return;
  if (options.carnet.energie <= 0) { options.echec?.('Trop fatigué pour la régie : un café d’abord.'); return; }
  lancement = true;
  try {
    // les objets portés sont posés sur la table
    const portes = PLACES.map((place) => options.carnet.porte?.[place]).filter((id) => OBJETS[id]);
    const noms = [...IMAGES, ...portes.map((id) => OBJETS[id].sprite)];
    const [imgs, papier, ecran] = await Promise.all([Promise.all(noms.map(image)), police('police-papier'), police('police-console')]);
    ouvrir({ ...options, im: Object.fromEntries(noms.map((n, i) => [n, imgs[i]])), portes, polices: { papier, ecran } });
  } catch (e) {
    console.error('[coulisses]', e);
    options.echec?.('Le décor n’est pas arrivé. Réessayez dans un instant.');
  } finally {
    lancement = false;
  }
}

function ouvrir(options) {
  const { niveau, effets: ef, carnet, garder, porte, conseil, surFin, im, portes, polices } = options;
  const P = polices.papier;
  const E = polices.ecran;
  const tops = niveau.tops.map((top, i) => ({ ...top, n: i + 1 }));
  const leurres = (niveau.leurres || []).map((l) => ({ ...l }));
  const premiereFois = !carnet.regieVue;
  carnet.regieVue = true;
  preparerLumiere();

  const dlg = document.createElement('dialog');
  dlg.className = 'regie';
  dlg.setAttribute('aria-labelledby', 'regie-titre');
  dlg.innerHTML = `
    <h2 id="regie-titre" class="lecteur">Régie · ${niveau.nom}</h2>
    <div class="regie-ecran" data-ecran>
      <canvas data-canvas aria-hidden="true"></canvas>
      <button type="button" class="regie-touche" data-top>Go : envoyer le top</button>
      <button type="button" class="regie-touche" data-son aria-pressed="false">Son</button>
      <button type="button" class="regie-touche" data-cafe>Café</button>
      <button type="button" class="regie-touche" data-quitter>Quitter</button>
      <button type="button" class="regie-touche" data-aller hidden></button>
    </div>
    <p class="lecteur" data-annonce aria-live="assertive"></p>
    <div class="lecteur" data-rapport></div>
    <p class="lecteur">Espace${NB}: top. C${NB}: café. M${NB}: son. Échap${NB}: quitter.</p>`;
  document.body.append(dlg);
  const $ = (sel) => dlg.querySelector(sel);
  const ecranEl = $('[data-ecran]');
  const canvas = $('[data-canvas]');
  const g = canvas.getContext('2d');
  const annonce = $('[data-annonce]');
  const touches = { top: $('[data-top]'), son: $('[data-son]'), cafe: $('[data-cafe]'), quitter: $('[data-quitter]') };
  const aller = $('[data-aller]');

  const lampe = porte('lampe');
  const cle = porte('cle');
  const bilan = { juste: 0, avance: 0, retard: 0, rate: 0, trop: 0, leurre: 0, retardReplique: 0, imprecisConduite: 0, coupures: 0 };
  const retours = []; // signes de verdict en cours d'affichage sur l'écran vert
  const notes = []; // les notes de service posées sur la table, la plus récente en dernier
  let lumiere = { de: 'salle', vers: 'salle', debut: 0, duree: 0 }; // le public entre : lumière salle
  let video = { etat: null, depuis: -1e9 };
  let plan = null;
  let enCours = true;
  let fini = false;
  let finA = 0;
  let coupure = null;
  let neigeA = 0;
  let debut = performance.now() + CARTON;
  let pauseDepuis = null;
  let trame = null;
  let dernierAppui = 0;
  let appuiA = -1e9;
  let appuiClavier = false;
  let dernierRate = null;
  let coupDit = -1;
  let appelA = -1e9; // l'inter appelle : son voyant s'allume
  let poseVue = 'repos';
  let nettoye = false;
  let ordre = '';
  let effacerOrdre = null;
  let ecranVerdict = null;
  const voyants = { juste: -1e9, faute: -1e9 };
  let quitterArme = false;
  let rapport = null;
  let rejouerPret = false; // Rejouer attend 600 ms : un appui encore en cours ne relance pas la partie
  let avis = null;

  const temps = (now) => (now - debut) / 1000 - 3; // trois secondes d'avant-spectacle, appelées à l'inter
  const marquerZero = () => { dlg.dataset.zero = String(debut + 3000); }; // l'instant t = 0 (pour les essais)
  const sonner = (nom, ...a) => jouerSon(nom, ...a);
  // le haut-parleur d'ordres affiche l'ordre court ; les lecteurs d'écran entendent la version longue
  const dire = (court, long = court) => {
    clearTimeout(effacerOrdre);
    ordre = court;
    annonce.textContent = long;
    rafraichir();
  };
  const taire = (dans = 0) => {
    clearTimeout(effacerOrdre);
    effacerOrdre = setTimeout(() => { ordre = ''; rafraichir(); }, dans);
  };
  const allumer = (etat, duree, now = performance.now()) => {
    const k = lumiere.duree ? Math.min(1, (now - lumiere.debut) / lumiere.duree) : 1;
    lumiere = { de: k >= 0.5 ? lumiere.vers : lumiere.de, vers: etat, debut: now, duree: mouvementReduit.matches ? 0 : duree };
  };
  let depense = 0; // l'énergie payée pendant cette représentation (rendue si on la quitte avant la fin)
  const coute = (n) => { const avant = carnet.energie; carnet.energie = Math.max(0, carnet.energie - n); depense += avant - carnet.energie; }; // l'énergie ne coupe jamais une représentation
  const COUTS = () => ({ avance: ef.imprecisGratuit ? 0 : 1, retard: ef.imprecisGratuit ? 0 : 1, rate: ef.rateLeger ? 1 : 2, trop: ef.tropGratuit ? 0 : 1, leurre: ef.tropGratuit ? 0 : 1, juste: 0 });
  const ms = (ecart) => `${ecart > 0 ? '+' : '−'}${Math.abs(Math.round(ecart * 1000))}${NB}ms`;

  // un post-it du régisseur général se pose sur la table ; les trois derniers restent
  const noter = (titre, lignes, papier = 'post-it') => {
    notes.push({ titre, lignes: lignes.filter(Boolean), papier, debut: performance.now() });
    if (notes.length > 3) notes.shift();
    sonner('papier');
  };
  const afficherVerdict = (verdict, top, ecart) => {
    const now = performance.now();
    ecranVerdict = { texte: (top && verdict !== 'rate' && verdict !== 'leurre' ? `${MOTS[verdict]} ${ms(ecart)}` : MOTS[verdict]).toUpperCase(), couleur: TEINTE_VERDICT[verdict], debut: now };
    retours.push({ glyphe: verdict === 'trop' || verdict === 'leurre' ? 'rate' : verdict, teinte: TEINTE_VERDICT[verdict], debut: now });
    voyants[verdict === 'juste' ? 'juste' : 'faute'] = now;
  };
  const juger = (verdict, top, t, detail = null) => {
    bilan[verdict] += 1;
    if (top) {
      top.resolu = verdict;
      top.resoluA = t;
      top.ecart = t - top.t;
      allumer(top.etat, DUREES[verdict]);
      if (top.video) video = { etat: top.video === 'noir' ? null : top.video, depuis: performance.now() };
      if (top.type === 'replique' && (verdict === 'retard' || verdict === 'rate')) bilan.retardReplique += 1;
      if (top.type === 'conduite' && (verdict === 'avance' || verdict === 'retard')) bilan.imprecisConduite += 1;
      if (verdict === 'rate') dernierRate = top;
    }
    const cout = COUTS()[verdict];
    coute(cout);
    afficherVerdict(verdict, top, top ? t - top.t : 0);
    sonner(verdict === 'juste' ? 'juste' : verdict === 'rate' || verdict === 'trop' || verdict === 'leurre' ? 'rate' : 'imprecis');
    annonce.textContent = `${top ? `Top ${top.n}, ${top.nom}` : 'Top'}${NB}: ${MOTS[verdict]}${cout ? `, −${cout} énergie` : ''}.`;
    // chaque faute vaut un post-it du régisseur général, comme les avertissements de Papers, Please
    if (verdict !== 'juste') {
      noter('Retour RG', [
        top ? `Top ${top.n} · ${MOTS[verdict]}` : verdict === 'leurre' ? 'Fausse action' : 'Top en trop',
        detail ?? (verdict === 'rate' ? 'Lancé par le RG' : top ? ms(t - top.t) : null),
        cout ? `Énergie −${cout}` : 'Sans retenue',
      ]);
    }
    // le retour vidéo peut lâcher après un top de conduite (la Chance en décide)
    if (top?.type === 'conduite' && !coupure && Math.random() < ef.incident) {
      coupure = { debut: t + 0.4, fin: t + 0.4 + (cle ? 1 : 3) };
      bilan.coupures += 1;
      sonner('coupure');
      dire(cle ? `Coupure du retour vidéo${NB}: clé de 13 en main.` : `Coupure du retour vidéo${NB}!`);
      taire(1600);
    }
  };
  // un appui juste après un raté : le top compte « en retard », et le raté est remboursé
  const rattraper = (top, t) => {
    const rendu = COUTS().rate - COUTS().retard;
    bilan.rate -= 1;
    bilan.retard += 1;
    if (top.type === 'replique') { /* déjà compté parmi les retards sur réplique */ } else bilan.imprecisConduite += 1;
    top.resolu = 'retard';
    top.ecart = t - top.t;
    dernierRate = null;
    carnet.energie = Math.min(ENERGIE.max, carnet.energie + rendu);
    depense = Math.max(0, depense - rendu);
    afficherVerdict('retard', top, t - top.t);
    sonner('imprecis');
    noter('Rectificatif', [`Top ${top.n} rattrapé, en retard`, rendu ? `Énergie rendue +${rendu}` : null], 'rapport');
    annonce.textContent = `Top ${top.n}${NB}: rattrapé, en retard.`;
  };

  // ---------- Les leurres : l'interprète fait une autre action que celle de la conduite ----------
  const piege = (t) => {
    for (const x of tops) if (x.feinte && !x.surprise && !x.resolu && t >= x.t - FEINTE[0] && t <= x.t - FEINTE[1] + PRISE) return { cible: x, pose: x.feinte };
    for (const l of leurres) if (!l.pris && t >= l.t && t <= l.t + LEURRE + PRISE) return { leurre: l, pose: l.pose };
    return null;
  };
  // mordre à une feinte envoie le vrai top sur le mauvais geste : il est perdu
  const mordre = ({ cible = null, leurre, pose }, t) => {
    if (leurre) leurre.pris = true;
    juger('leurre', cible, t, GESTES_COURTS[pose]);
    dire(cible ? `Trop tôt${NB}: ${GESTES_COURTS[pose]}. Top ${cible.n} parti.` : `Pas de top${NB}: ${GESTES_COURTS[pose]}.`,
      `Leurre${NB}: ${GESTES[pose]}${cible ? `. Le top ${cible.n} est parti sur la mauvaise action` : `, ce n’est pas l’action de la conduite`}.`);
    taire(1800);
  };

  // ---------- Envoyer le top ----------
  const top = (now, auClavier = false) => {
    if (!enCours || fini) return;
    const t = temps(now);
    if (t < -0.2) return;
    dernierAppui = performance.now();
    appuiA = performance.now();
    sonner('appui');
    if (auClavier) appuiClavier = true;
    const w = ef.fenetre;
    const p = piege(t);
    if (p) { mordre(p, t); return; }
    const proches = tops.filter((x) => !x.resolu && t >= x.t - 2 * w && t <= x.t + limiteRetard(x, w));
    // la vraie action d'un top déjà parti sur une hésitation : rien ne se passe, sans coût
    const parti = tops.find((x) => x.resolu === 'leurre' && t >= x.t - 2 * w && t <= x.t + limiteRetard(x, w));
    if (!proches.length && parti) { dire(`Top ${parti.n} déjà parti.`); taire(1200); return; }
    if (!proches.length) {
      if (dernierRate && t - dernierRate.resoluA <= RATTRAPAGE) { rattraper(dernierRate, t); return; }
      juger('trop', null, t);
      return;
    }
    const cible = proches.reduce((a, b) => (Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b));
    juger(classer(t - cible.t, cible, w), cible, t);
  };

  // ---------- L'interprète ----------
  // elle s'arrête pour chaque action, vraie ou fausse, puis repart d'où elle s'était arrêtée
  const arrets = () => [
    ...tops.filter((x) => x.geste).map((x) => [x.t - (x.feinte && !x.surprise ? FEINTE[0] + 0.3 : 0.6), x.t + 0.9]),
    ...leurres.map((l) => [l.t - 0.3, l.t + LEURRE]),
  ].sort((a, b) => a[0] - b[0]);
  const posX = (t) => {
    if (mouvementReduit.matches) return 196;
    let pause = 0;
    for (const [a, b] of arrets()) {
      if (t >= b) pause += b - a;
      else if (t >= a) { pause += t - a; break; }
    }
    return Math.round(196 + 46 * Math.sin(Math.max(0, t - pause) / 4));
  };
  const poseA = (t) => {
    if (fini) return 'salut';
    for (const x of tops) {
      if (!x.geste) continue;
      if (t >= x.t - 0.15 && t <= x.t + 0.9) return x.geste;
      if (x.feinte && !x.surprise && t >= x.t - FEINTE[0] && t < x.t - FEINTE[1]) return x.feinte;
    }
    for (const l of leurres) if (t >= l.t && t < l.t + LEURRE) return l.pose;
    return repos(niveau, t);
  };

  // ---------- La scène, derrière la vitre ----------
  // le contre-jour : les bords d'un interprète tournés vers les projecteurs (en haut et sur les côtés), par pose
  const liseres = new Map();
  const lisereDe = (qui, caseX) => {
    const cle = `${qui}:${caseX}`;
    if (!liseres.has(cle)) liseres.set(cle, lisere(im[qui], caseX, 0, CASE, CASE, [[0, -1], [-1, 0], [1, 0]]));
    return liseres.get(cle);
  };
  // la case d'une pose dans la planche de l'interprète ; une planche incomplète garde la pose de repos
  const caseDe = (qui, pose) => {
    const n = POSES[qui][pose] ?? 0;
    return n * CASE < im[qui].naturalWidth ? n * CASE : 0;
  };
  const poussiere = Array.from({ length: 56 }, (_, i) => ({ x: (i * 97) % SL, y: (i * 53) % (SH - 18), v: 2 + (i % 4), p: i * 1.7 }));
  const scene = toile(SL, SH);
  const sg = scene.getContext('2d');
  const carte = toile(SL, SH);
  const gc = carte.getContext('2d');
  const carteVers = toile(SL, SH);
  const gv = carteVers.getContext('2d');
  const peindreEtat = (ctx, etat, cx) => {
    if (etat === 'douche') ctx.drawImage(masqueDouche, SL - cx, 0, SL, SH, 0, 0, SL, SH);
    else { ctx.fillStyle = COULEURS[etat]; ctx.fillRect(0, 0, SL, SH); }
  };
  // où en est le fondu : quatre paliers ; les états de lumière en cours, avec leur part
  const fondu = (now) => (lumiere.duree ? Math.max(0, Math.min(4, Math.floor(((now - lumiere.debut) / lumiere.duree) * 4))) : 4);
  const etatsEnCours = (now) => {
    const p = fondu(now);
    return p >= 4 || lumiere.vers === lumiere.de ? [[lumiere.vers, 1]] : [[lumiere.de, 1 - p / 4], [lumiere.vers, p / 4]];
  };
  const peindreLumiere = (now, cx) => {
    const etape = fondu(now);
    if (etape >= 4) lumiere.de = lumiere.vers;
    peindreEtat(gc, lumiere.de, cx);
    if (etape > 0 && etape < 4 && lumiere.vers !== lumiere.de) {
      peindreEtat(gv, lumiere.vers, cx);
      gv.globalCompositeOperation = 'destination-in';
      gv.drawImage(trames[etape - 1], 0, 0);
      gv.globalCompositeOperation = 'source-over';
      gc.drawImage(carteVers, 0, 0);
    }
  };
  // les interprètes et ce qui est devant l'écran sont éclairés à part : la projection passe derrière eux
  const acteur = toile(CASE, CASE);
  const ag = acteur.getContext('2d');
  const avant = toile(SL, SH);
  const vg = avant.getContext('2d');
  const eclairer = (ctx, img, sx, sy, l, h, x, y) => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, l, h);
    ctx.drawImage(img, sx, sy, l, h, 0, 0, l, h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(carte, x, y, l, h, 0, 0, l, h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, sx, sy, l, h, 0, 0, l, h);
  };
  // le plateau devant l'écran : le piano, le pianiste, le fauteuil ; les bouteilles dans la nouvelle de Poe
  const plateauAvant = (qui) => {
    const b = im.bouteilles;
    if (qui !== 'comedienne') return im['scene-avant'];
    if (!plateauAvant.poe) {
      plateauAvant.poe = toile(SL, SH);
      const pg = plateauAvant.poe.getContext('2d');
      pg.drawImage(im['scene-avant'], 0, 0);
      pg.drawImage(b, 368, 93 - b.height);
    }
    return plateauAvant.poe;
  };
  // la lumière salle : les têtes du public sortent de l'ombre (calculé une fois)
  let publicEclaire = null;
  const publicSalle = () => {
    if (publicEclaire) return publicEclaire;
    const h = im.public.height;
    publicEclaire = toile(SL, h);
    const pg = publicEclaire.getContext('2d');
    paver(pg, im.public, 0, 0, im.public.width, h, 0, 0, SL, h);
    pg.globalCompositeOperation = 'source-in';
    pg.fillStyle = '#4A3C33';
    pg.fillRect(0, 0, SL, h);
    pg.globalCompositeOperation = 'source-over';
    pg.drawImage(teinte(lisere(publicEclaire, 0, 0, SL, h, [[0, -1]]), '#9A7A58'), 0, 0);
    return publicEclaire;
  };
  let quiVu = null;
  const dessinerScene = (now, t) => {
    sg.drawImage(im.scene, 0, 0);
    const x = posX(t);
    const pose = poseA(t);
    const qui = enScene(niveau, Math.max(0, t));
    // au salut, les deux interprètes reviennent côte à côte ; sinon celui de la nouvelle en cours
    const enPlace = fini ? [['comedien', 160], ['comedienne', 232]] : [[qui, x]];
    // les lecteurs d'écran entendent chaque action, vraie ou fausse, et le relais
    if (qui !== quiVu && !fini) {
      if (quiVu) annonce.textContent = 'Dans le noir, la comédienne prend la place du comédien.';
      quiVu = qui;
    }
    if (pose !== poseVue) {
      poseVue = pose;
      if (GESTES[pose] && !fini) annonce.textContent = `${GESTES[pose][0].toUpperCase()}${GESTES[pose].slice(1)}.`;
    }
    peindreLumiere(now, x + CASE / 2);
    sg.globalCompositeOperation = 'multiply';
    sg.drawImage(carte, 0, 0);
    // le décor vidéo sur l'écran : de la lumière projetée, qui s'ajoute ; le projecteur se cale en deux pas
    if (video.etat) {
      const E = SCENE.ecran;
      sg.globalCompositeOperation = 'lighter';
      sg.globalAlpha = mouvementReduit.matches || now - video.depuis > 160 ? 0.85 : 0.4;
      sg.drawImage(im[`projection-${video.etat}`], E.x, E.y);
      sg.globalAlpha = 1;
    }
    sg.globalCompositeOperation = 'source-over';
    // devant l'écran, éclairés par la même carte que le plateau : le piano et le fauteuil, puis les interprètes
    const devant = plateauAvant(qui);
    eclairer(vg, devant, 0, 0, SL, SH, 0, 0);
    sg.drawImage(avant, 0, 0);
    enPlace.forEach(([q, xq]) => {
      eclairer(ag, im[q], caseDe(q, pose), 0, CASE, CASE, xq, 36);
      sg.drawImage(acteur, xq, 36);
    });
    // la lumière dans l'air : les faisceaux des projecteurs, le contre-jour de l'interprète, la poussière
    sg.globalCompositeOperation = 'lighter';
    const etats = etatsEnCours(now);
    const cx = x + CASE / 2;
    etats.forEach(([etat, part]) => {
      const f = faisceau(etat);
      if (f) {
        sg.globalAlpha = 0.2 * part;
        sg.drawImage(teinte(f.c, DEBORD[etat][0]), etat === 'douche' ? SL - cx : 0, 0, SL, SH, 0, 0, SL, SH);
      }
      if (LISERE[etat]) {
        sg.globalAlpha = LISERE[etat] * part;
        enPlace.forEach(([q, xq]) => sg.drawImage(teinte(lisereDe(q, caseDe(q, pose)), DEBORD[etat][0]), xq, 36));
      }
    });
    const [etat] = etats[etats.length - 1];
    const f = faisceau(etat);
    if (f && !mouvementReduit.matches) {
      sg.fillStyle = DEBORD[etat][0];
      const sec = now / 1000;
      poussiere.forEach((p) => {
        const px = Math.round(p.x + Math.sin(sec * 0.7 + p.p) * 3);
        const py = Math.round(SH - 18 - ((p.y + sec * p.v) % (SH - 18)));
        if (!f.dedans(etat === 'douche' ? px + SL - Math.round(cx) : px, py)) return;
        sg.globalAlpha = 0.35 + 0.35 * Math.sin(sec * 2 + p.p);
        sg.fillRect(px, py, 1, 1);
      });
    }
    sg.globalAlpha = 1;
    sg.globalCompositeOperation = 'source-over';
    // les blocs de sortie restent allumés, en vert, quoi qu'il arrive
    if (SOMBRES.has(lumiere.vers)) { sg.fillStyle = C.sortie; sg.fillRect(9, 67, 6, 3); sg.fillRect(SL - 15, 67, 6, 3); }
    paver(sg, im.public, 0, 0, im.public.width, im.public.height, 0, SH - im.public.height, SL, im.public.height);
    const salle = etats.find(([e]) => e === 'salle');
    if (salle) { sg.globalAlpha = salle[1]; sg.drawImage(publicSalle(), 0, SH - im.public.height); sg.globalAlpha = 1; }
    sg.drawImage(im.reflets, 0, 0);
    // la bulle au-dessus de l'interprète : « ! » à l'appel, la réplique sur le top
    let texte = '';
    for (const x2 of tops) {
      if (x2.type !== 'replique' || (x2.resolu && t > x2.t + 0.8)) continue;
      const att = x2.attention ?? ef.attention;
      if (x2.replique && t >= x2.t - 0.6 && t < x2.t) texte = x2.replique[0];
      else if (x2.replique && t >= x2.t && t < x2.t + 0.8) texte = x2.replique[1];
      else if (!x2.surprise && t >= x2.t - att && t < x2.t) texte = '!';
    }
    if (texte && !fini) {
      const l = P.mesurer(texte) + 6;
      const bx = Math.round(x + CASE / 2 - l / 2);
      neuf(sg, im.bulle, [3, 3, 3, 3], bx, 22, l, 11);
      sg.drawImage(im['bulle-queue'], Math.round(x + CASE / 2 - 2), 33);
      P.ecrire(sg, texte, bx + 3, 25, C.encre);
    }
  };

  // ---------- L'écran de la console : la bande de conduite ----------
  const ecran = toile(EL, EH);
  const eg = ecran.getContext('2d');
  const tuile = toile(5, 5);
  const gt = tuile.getContext('2d');
  gt.fillStyle = C.lcd;
  gt.fillRect(0, 0, 5, 5);
  gt.fillStyle = C.lcd2;
  [[0, 0], [3, 1], [1, 2], [4, 3], [2, 4]].forEach(([x, y]) => gt.fillRect(x, y, 1, 1));
  const brouillard = eg.createPattern(tuile, 'repeat');
  const neige = toile(EL, BH);
  const peindreNeige = () => {
    const ng = neige.getContext('2d');
    ng.fillStyle = C.lcd;
    ng.fillRect(0, 0, EL, BH);
    ng.fillStyle = C.phosphore;
    for (let i = 0; i < 260; i++) ng.fillRect((Math.random() * EL) | 0, (Math.random() * BH) | 0, 1, 1);
  };
  const BLOC_COULEUR = { plein: '#F4EEDA', noir: '#575A63', douche: '#D9A62E', bleu: '#3866D9', ambre: '#E07B24' };
  const dessinerEcran = (now, t) => {
    eg.fillStyle = C.lcd;
    eg.fillRect(0, 0, EL, EH);
    const enPanne = coupure && t >= coupure.debut && t < coupure.fin;
    if (enPanne) {
      // la neige change dix fois par seconde (figée en mouvement réduit)
      if (now - neigeA > 100 && (!mouvementReduit.matches || !neigeA)) { peindreNeige(); neigeA = now; }
      eg.drawImage(neige, 0, 0);
      const mot = 'PAS D’IMAGE';
      eg.fillStyle = C.lcd;
      eg.fillRect((EL - E.mesurer(mot)) / 2 - 3, 7, E.mesurer(mot) + 6, 9);
      E.ecrire(eg, mot, Math.round((EL - E.mesurer(mot)) / 2), 9, C.phosphore);
    } else {
      neigeA = 0;
      const w = ef.fenetre;
      // la zone « juste » autour de la ligne : la statistique Lumière se voit
      eg.fillStyle = C.ambreSombre;
      eg.fillRect(Math.round(LIGNE - w * PPS), 0, Math.max(2, Math.round(2 * w * PPS)), BH);
      eg.fillStyle = C.lcd2;
      for (let x = 0; x < EL; x += 4) eg.fillRect(x, 11, 2, 1);
      // dans le noir, sans lampe bleue, on lit la conduite moitié moins loin
      const vue = ef.avance * (lumiere.vers === 'noir' && !lampe ? 0.5 : 1);
      tops.forEach((x) => {
        const dt = x.t - t;
        if ((x.resolu && t - x.resoluA > 0.4) || dt < -0.6 || dt > vue) return;
        const bx = Math.round(LIGNE + dt * PPS);
        if (x.type === 'replique') {
          if (!ef.repliquesVisibles || x.resolu) return;
          eg.fillStyle = C.phosphore;
          for (let i = 0; i < BLOC; i += 2) { eg.fillRect(bx + i, 4, 1, 1); eg.fillRect(bx + i, 18, 1, 1); }
          for (let j = 4; j < 19; j += 2) { eg.fillRect(bx, j, 1, 1); eg.fillRect(bx + BLOC - 1, j, 1, 1); }
          return;
        }
        eg.fillStyle = BLOC_COULEUR[x.etat];
        eg.fillRect(bx, 4, BLOC, 15);
        // un départ vidéo : une barre cyan sur le bloc
        if (x.video) { eg.fillStyle = C.video; eg.fillRect(bx, 4, BLOC, 3); }
        const n = String(x.n);
        E.ecrire(eg, n, bx + Math.round((BLOC - E.mesurer(n)) / 2), 9, x.etat === 'noir' || x.etat === 'bleu' ? C.papier : C.encre);
      });
      // au-delà de ce que l'on voit : la conduite est dans le brouillard
      const xv = Math.max(LIGNE + 4, Math.round(LIGNE + vue * PPS));
      eg.fillStyle = brouillard;
      eg.fillRect(xv, 0, EL - xv, BH);
    }
    // la ligne du top s'épaissit à chaque appui
    eg.fillStyle = C.ambre;
    const epais = now - appuiA < 100 ? 4 : 2;
    eg.fillRect(LIGNE - (epais >> 1) + 1, 0, epais, BH);
    // signes de verdict : ils montent de 3 px, par pas
    for (let i = retours.length - 1; i >= 0; i--) {
      const r = retours[i];
      const k = (now - r.debut) / 450;
      if (k >= 1) { retours.splice(i, 1); continue; }
      glyphe(eg, r.glyphe, LIGNE - 3, 8 - (mouvementReduit.matches ? 0 : Math.floor(k * 4)), r.teinte);
    }
    eg.fillStyle = C.lcd2;
    eg.fillRect(0, BH, EL, 1);
    E.ecrire(eg, `TOP ${tops.filter((x) => x.resolu).length}/${tops.length}`, 3, 27, C.phosphore);
    const s = Math.max(0, Math.floor(t));
    E.ecrire(eg, `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, 52, 27, C.phosphore);
    if (ecranVerdict && now - ecranVerdict.debut < 1500) {
      E.ecrire(eg, ecranVerdict.texte, EL - 3 - E.mesurer(ecranVerdict.texte), 27, ecranVerdict.couleur);
    }
  };

  // ---------- La console ----------
  const rectTouche = (nom) => {
    const r = CONSOLE.touches[nom];
    return { x: plan.console.x + r.x, y: plan.console.y + r.y, l: r.l, h: r.h };
  };
  const dessinerTouche = (nom, libelle, enfonce, inactif) => {
    const r = rectTouche(nom);
    const img = nom === 'top' ? im['touche-top'] : im.touche;
    const l = img.width / 2;
    g.drawImage(img, enfonce ? l : 0, 0, l, img.height, r.x, r.y, l, img.height);
    const e = nom === 'top' && P.mesurer(libelle, 2) <= r.l - 8 ? 2 : 1;
    const x = r.x + Math.round((r.l - P.mesurer(libelle, e)) / 2);
    const y = r.y + Math.round((r.h - 3 - 5 * e) / 2) + (enfonce ? 2 : 0);
    P.ecrire(g, libelle, x, y, inactif ? '#34363D' : C.papier, e); // inactive : le mot s'efface dans la touche
  };
  const cafeInactif = () => !carnet.doses || carnet.energie >= ENERGIE.max || fini;
  const dessinerConsole = (now, t) => {
    const o = plan.console;
    const f = CONSOLE.faders;
    (FADERS[lumiere.vers] ?? FADERS.service).forEach((n, i) => {
      g.drawImage(im.fader, o.x + f.x + i * f.pas, o.y + f.y + Math.round((1 - n) * f.course));
    });
    const sonAllume = touches.son.getAttribute('aria-pressed') === 'true';
    if (fini) dessinerTouche('top', 'REJOUER', false, !rejouerPret);
    else dessinerTouche('top', 'GO', now - appuiA < 90, false);
    dessinerTouche('son', 'SON', sonAllume, false);
    dessinerTouche('cafe', `CAFÉ ${carnet.doses}`, false, cafeInactif());
    dessinerTouche('quitter', fini ? 'RETOUR' : quitterArme ? 'ENCORE ?' : 'QUITTER', false, false);
  };

  // ---------- La table : feuille de conduite, haut-parleur, notes de service, rapport ----------
  const FL = 138;
  const feuille = toile(FL, 9 + 9 * (tops.length + 1) + 4);
  const fg = feuille.getContext('2d');
  let feuilleVue = '';
  let fluoA = 0;
  const peindreFeuille = (now) => {
    const i = tops.findIndex((x) => !x.resolu);
    const cle2 = `${i}:${tops.map((x) => (x.resolu ? 1 : 0)).join('')}`;
    if (cle2 !== feuilleVue) { feuilleVue = cle2; fluoA = now; }
    else if (now - fluoA > 300) return;
    fg.clearRect(0, 0, FL, feuille.height);
    neuf(fg, im.feuille, [9, 3, 4, 14], 0, 0, FL, feuille.height);
    P.ecrire(fg, `Conduite · ${niveau.nom}`, 15, 11, C.encre);
    tops.forEach((x, j) => {
      const y = 9 + 9 * (j + 1) + 2;
      const fait = Boolean(x.resolu);
      const l = P.mesurer(x.court);
      // le prochain top, surligné au stabilo : le trait se pose en quatre pas
      if (j === i) {
        const part = mouvementReduit.matches ? 1 : Math.min(1, Math.ceil(((now - fluoA) / 240) * 4) / 4);
        fg.fillStyle = C.fluo;
        fg.fillRect(13, y - 1, Math.max(1, Math.round((l + 4) * part)), 7);
      }
      const n = String(x.n);
      P.ecrire(fg, n, 10 - P.mesurer(n), y, fait ? C.papier3 : C.encre);
      P.ecrire(fg, x.court, 15, y, fait ? C.papier3 : C.encre);
      if (fait) { fg.fillStyle = C.papier3; fg.fillRect(15, y + 2, l, 1); }
    });
  };
  const dessinerNotes = (now) => {
    const n = plan.notes;
    notes.forEach((note, i) => {
      const rang = notes.length - 1 - i; // 0 : la plus récente, posée sur les autres
      const lignes = [note.titre, ...note.lignes.flatMap((l) => P.couper(l, n.l - 8))];
      const h = 4 + lignes.length * 9 + 3;
      const pas = mouvementReduit.matches ? 3 : Math.min(3, Math.floor((now - note.debut) / 60));
      const x = n.x + rang * 4 + Math.round(((3 - pas) / 3) * 48);
      const y = n.y + rang * 4;
      g.fillStyle = C.chene;
      g.fillRect(x + 2, y + 2, n.l, h);
      neuf(g, im[note.papier], [4, 4, 4, 4], x, y, n.l, h);
      papiersPoses.push([x, y, n.l + 2, h + 2]);
      lignes.forEach((l, j) => P.ecrire(g, l, x + 4, y + 5 + j * 9, j === 0 && note.papier === 'note' ? C.carmin : C.encre));
    });
  };
  // l'inter : son afficheur émet sa propre lumière (dessiné après la lumière de la cabine)
  const dessinerHautParleur = () => {
    const hp = plan.hautParleur;
    if (!ordre) return;
    P.couper(ordre, 90).slice(0, 3).forEach((l, i) => P.ecrire(g, l, hp.x + 24, hp.y + 7 + i * 10, '#CFE3FF'));
  };
  // l'énergie : une barre de dix diodes sur un petit afficheur de la console
  const dessinerEnergie = () => {
    const o = plan.console;
    const j = CONSOLE.jauge;
    const pas = Math.floor(j.l / ENERGIE.max);
    for (let i = 0; i < ENERGIE.max; i++) {
      const allumee = i < carnet.energie;
      g.fillStyle = !allumee ? '#1C2228' : i < 2 ? C.carmin2 : i < 4 ? C.ambre : C.juste;
      g.fillRect(o.x + j.x + i * pas, o.y + j.y, pas - 1, j.h);
    }
    const legende = `ÉNERGIE ${carnet.energie}/${ENERGIE.max}`;
    E.ecrire(g, legende, o.x + j.legende[0] - Math.round(E.mesurer(legende) / 2), o.y + j.legende[1], carnet.energie <= 2 ? C.carmin2 : C.phosphore);
  };
  const dessinerRapport = (now) => {
    const r = plan.rapport;
    const ecoule = now - rapport.debut;
    const pas = mouvementReduit.matches ? 3 : Math.min(3, Math.floor(ecoule / 80));
    const y0 = r.y + Math.round(((3 - pas) / 3) * (plan.H - r.y));
    g.fillStyle = C.chene;
    g.fillRect(r.x + 2, y0 + 2, r.l, r.h);
    neuf(g, im.rapport, [4, 4, 4, 4], r.x, y0, r.l, r.h);
    papiersPoses.push([r.x, y0, r.l + 2, r.h + 2]);
    // le rapport se tape ligne par ligne, puis le tampon frappe
    const visibles = mouvementReduit.matches ? Infinity : Math.floor((ecoule - 240) / 90);
    rapport.lignes.forEach((l, i) => {
      if (i > visibles) return;
      const y = y0 + 6 + i * 9;
      if (l.releve) tops.forEach((x, k) => glyphe(g, { juste: 'juste', avance: 'avance', retard: 'retard' }[x.resolu] ?? 'rate', r.x + 6 + k * 9, y - 1, TEINTE_VERDICT[x.resolu] ?? TEINTE_VERDICT.rate));
      else P.ecrire(g, l.texte, r.x + 6, y, l.couleur ?? C.encre);
      if (l.trait) { g.fillStyle = C.papier3; g.fillRect(r.x + 4, y + 7, r.l - 8, 1); }
    });
    if (mouvementReduit.matches || ecoule > rapport.tamponA) {
      if (!rapport.frappe) { rapport.frappe = true; sonner('tampon'); }
      const tl = im.tampons.width / 2;
      g.drawImage(im.tampons, rapport.valide ? 0 : tl, 0, tl, im.tampons.height, r.x + r.l - tl - 6, y0 + r.h - im.tampons.height - 6, tl, im.tampons.height);
    }
  };

  // ---------- Le carton de la représentation ----------
  const dessinerCarton = () => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, plan.L, plan.H);
    const titre = niveau.nom.toUpperCase();
    const e = P.mesurer(titre, 3) <= plan.L - 20 ? 3 : 2;
    P.ecrire(g, titre, Math.round((plan.L - P.mesurer(titre, e)) / 2), Math.round(plan.H / 2) - 5 * e, C.papier, e);
    // le sous-titre passe sur deux lignes, coupé au point médian, s'il ne tient pas (en portrait)
    const sous = CARTONS[niveau.id] ?? '';
    const lignes = P.mesurer(sous) <= plan.L - 16 ? [sous] : sous.split(' · ');
    lignes.forEach((l, i) => P.ecrire(g, l, Math.round((plan.L - P.mesurer(l)) / 2), Math.round(plan.H / 2) + 8 + i * 10, C.zinc));
  };

  // ---------- Dessiner l'écran entier ----------
  const fond = document.createElement('canvas');
  const peindreFond = () => {
    fond.width = plan.L;
    fond.height = plan.H;
    const f = fond.getContext('2d');
    f.fillStyle = C.velours;
    f.fillRect(0, 0, plan.L, plan.H);
    for (const m of plan.murs) paver(f, im.mur, 0, 0, im.mur.width, im.mur.height, m.x, m.y, m.l, m.h);
    for (const t of plan.tables) paver(f, im.table, 0, 0, im.table.width, im.table.height, t.x, t.y, t.l, t.h);
    f.fillStyle = C.zinc;
    f.fillRect(plan.rebord.x, plan.rebord.y, plan.rebord.l, 1);
    f.fillStyle = C.acier;
    f.fillRect(plan.rebord.x, plan.rebord.y + 1, plan.rebord.l, 5);
    neuf(f, im.vitre, [4, 4, 4, 4], plan.cadre.x, plan.cadre.y, plan.cadre.l, plan.cadre.h);
    f.drawImage(im.console, plan.console.x, plan.console.y);
    // les objets de la table : leur ombre posée, puis eux ; leurs bords tournés vers la vitre prendront la lumière de la scène
    const poses = [['haut-parleur', plan.hautParleur], ['thermos', plan.thermos], ...portes.map((id, i) => [OBJETS[id].sprite, plan.objets[i]])];
    rebords = toile(plan.L, plan.H);
    const rg = rebords.getContext('2d');
    poses.forEach(([nom, p]) => {
      const img = im[nom];
      const ombre = toile(img.width, img.height);
      const og = ombre.getContext('2d');
      og.drawImage(img, 0, 0);
      og.globalCompositeOperation = 'source-in';
      og.fillStyle = '#000';
      og.fillRect(0, 0, img.width, img.height);
      f.globalAlpha = 0.4;
      f.drawImage(ombre, p.x + 2, p.y + 2);
      f.globalAlpha = 1;
      f.drawImage(img, p.x, p.y);
      rg.drawImage(lisere(img, 0, 0, img.width, img.height, [[0, -1]]), p.x, p.y);
    });
  };
  let rebords = null;
  const couche = toile(1, 1); // les bords éclairés des objets, sauf là où un papier les couvre
  const papiersPoses = [];
  // tout ce que la lumière demande est calculé à l'ouverture, pendant le carton : rien ne coûte au moment d'un top
  const prechauffer = () => {
    const cab = cabine(plan);
    const cases = Object.entries(POSES).flatMap(([qui, poses]) => Object.keys(poses).map((pose) => [qui, caseDe(qui, pose)]));
    Object.entries(DEBORD).forEach(([etat, [couleur, force]]) => {
      if (!force) return;
      teinte(cab.debord, couleur);
      teinte(rebords, couleur);
      const f = faisceau(etat);
      if (f) teinte(f.c, couleur);
      if (LISERE[etat]) cases.forEach(([qui, caseX]) => teinte(lisereDe(qui, caseX), couleur));
    });
    refletLampe();
    plateauAvant('comedienne');
    publicSalle();
  };
  // ce qui émet de la lumière : l'écran vert, les voyants, la diode du haut-parleur ; avec leur lueur
  const lueur = (x, y, l, h, couleur, r = 3) => {
    g.fillStyle = couleur;
    for (let k = r; k >= 1; k--) {
      g.globalAlpha = 0.1 + (0.12 * (r - k)) / r;
      g.fillRect(x - k, y - k, l + 2 * k, h + 2 * k);
    }
    g.globalAlpha = 1;
  };
  const dessinerEmissifs = (now, t) => {
    const o = plan.console;
    dessinerEcran(now, t);
    g.drawImage(ecran, o.x + CONSOLE.ecran.x, o.y + CONSOLE.ecran.y);
    const v = CONSOLE.voyants;
    g.globalCompositeOperation = 'lighter';
    if (now - voyants.juste < 250) lueur(o.x + v.juste[0], o.y + v.juste[1], 4, 3, C.phosphore);
    if (now - voyants.faute < 250) lueur(o.x + v.faute[0], o.y + v.faute[1], 4, 3, C.carmin2);
    // la touche TOP s'illumine sous le doigt
    if (!fini && now - appuiA < 90) { const r = rectTouche('top'); lueur(r.x + 4, r.y + 4, r.l - 8, r.h - 10, '#7CF0A0', 4); }
    g.globalCompositeOperation = 'source-over';
    if (now - voyants.juste < 250) { g.fillStyle = C.phosphore; g.fillRect(o.x + v.juste[0], o.y + v.juste[1], 4, 3); }
    if (now - voyants.faute < 250) { g.fillStyle = C.carmin2; g.fillRect(o.x + v.faute[0], o.y + v.faute[1], 4, 3); }
    dessinerEnergie();
    dessinerHautParleur();
    // le voyant d'appel de l'inter : allumé quand le régisseur général parle
    if (ordre || now - appelA < 400) { const hp = plan.hautParleur; g.fillStyle = C.carmin2; g.fillRect(hp.x + 114, hp.y + 3, 2, 2); }
  };
  // la lumière de la cabine, sur tout ce qui n'est pas la scène ni ce qui émet
  const eclairerCabine = (now) => {
    const cab = cabine(plan);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(cab.mult, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(cab.froid, 0, 0);
    g.drawImage(cab.lueur, 0, 0);
    etatsEnCours(now).forEach(([etat, part]) => {
      const [couleur, force] = DEBORD[etat];
      if (!force) return;
      g.globalAlpha = force * part;
      g.drawImage(teinte(cab.debord, couleur), 0, 0);
      if (couche.width !== plan.L || couche.height !== plan.H) { couche.width = plan.L; couche.height = plan.H; }
      const cg = couche.getContext('2d');
      cg.globalCompositeOperation = 'source-over';
      cg.clearRect(0, 0, plan.L, plan.H);
      cg.drawImage(teinte(rebords, couleur), 0, 0);
      cg.globalCompositeOperation = 'destination-out';
      papiersPoses.forEach(([x, y, l, h]) => cg.fillRect(x, y, l, h));
      g.globalAlpha = 0.7 * force * part;
      g.drawImage(couche, 0, 0);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  };
  const dessiner = (now) => {
    if (!plan) return;
    g.imageSmoothingEnabled = false;
    const t = temps(now);
    if (t < -3 && !fini) { dessinerCarton(); return; }
    g.drawImage(fond, 0, 0);
    dessinerScene(now, t);
    const v = plan.verre;
    g.drawImage(scene, v.sx, 0, v.l, v.h, v.x, v.y, v.l, v.h);
    // le reflet de la lampe de régie dans la vitre
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.22;
    g.drawImage(refletLampe(), plan.reflet.x, plan.reflet.y);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    dessinerConsole(now, t);
    papiersPoses.length = 0;
    peindreFeuille(now);
    g.drawImage(feuille, plan.feuille.x, plan.feuille.y);
    dessinerNotes(now);
    if (rapport) dessinerRapport(now);
    eclairerCabine(now);
    dessinerEmissifs(now, t);
    // après le carton, la cabine s'allume en quatre paliers, comme l'étagère
    const allume = Math.floor(((t + 3) * 1000) / 62);
    if (!fini && !mouvementReduit.matches && allume < 4) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = ['#101010', '#404040', '#808080', '#C0C0C0'][Math.max(0, allume)];
      g.fillRect(0, 0, plan.L, plan.H);
      g.globalCompositeOperation = 'source-over';
    }
  };
  // hors de la boucle (fin de partie, changement de taille) : un dessin à la demande
  const rafraichir = () => { if (!enCours && !nettoye && plan) dessiner(performance.now()); };

  // ---------- La boucle de jeu ----------
  // l'avant-spectacle : le régisseur général appelle à l'inter, l'annonce passe, puis noir salle
  const APPELS = [
    ['Attention noir salle.', 'À l’inter, le régisseur général : attention noir salle.'],
    ['Annonce téléphones.', 'L’annonce passe en salle : téléphones éteints.'],
    ['Attention… top.', 'À l’inter : attention… top.'],
  ];
  const boucle = (now) => {
    if (!enCours) return;
    const t = temps(now);
    if (!fini && t >= -3) {
      if (t < 0) {
        const k = Math.min(2, Math.floor(t + 3));
        if (k !== coupDit) {
          coupDit = k;
          appelA = now;
          sonner('inter');
          dire(...APPELS[k]);
        }
      } else if (coupDit < 3) {
        coupDit = 3;
        allumer('noir', 600, now);
        dire('Noir salle. Le spectacle commence.');
        taire(1500);
      }
      for (const x of tops) {
        if (fini) break;
        if (x.resolu) continue;
        const att = x.attention ?? ef.attention;
        // la Chance décide si l'interprète saute une phrase (le top arrive plus tôt, sans « Attention »)
        if (x.type === 'replique' && !x.jete && t >= x.t - att - 1.2) {
          x.jete = true;
          if (Math.random() < ef.incident) { x.t -= SAUTE; x.surprise = true; }
        }
        if (x.type === 'replique' && !x.surprise && !x.annonce && t >= x.t - att) {
          x.annonce = true;
          sonner('attention');
          appelA = now;
          dire(`Attention ${x.n}${NB}: ${x.geste ? `à vue, ${GESTES_COURTS[x.geste]}` : 'sur le texte'}`, `Attention top ${x.n}${NB}: ${x.texte}`);
        }
        if (x.type === 'replique' && !x.dit && t >= x.t) {
          x.dit = true;
          appelA = now;
          dire(x.surprise ? `Texte sauté${NB}! Top ${x.n}${NB}!` : `Top ${x.n}${NB}!`);
          taire(1200);
        }
        // bips d'avertissement des tops de conduite, quand le son est allumé
        if (x.type === 'conduite') {
          if (!x.bip1 && t >= x.t - 1) { x.bip1 = true; sonner('avertir'); }
          if (!x.bip2 && t >= x.t - 0.5) { x.bip2 = true; sonner('avertir'); }
          if (!x.bip3 && t >= x.t) { x.bip3 = true; sonner('maintenant'); }
        }
        // trop tard : le top est raté, le régisseur général l'envoie à votre place
        if (t > x.t + limiteRetard(x, ef.fenetre)) juger('rate', x, t);
      }
      // une fausse action laissée passer ; au filage, le régisseur général le fait remarquer
      for (const l of leurres) {
        if (l.pris || l.vu || t <= l.t + LEURRE + PRISE) continue;
        l.vu = true;
        if (niveau.id === 'filage') {
          dire(`Bien vu${NB}: ${GESTES_COURTS[l.pose]}, pas d’appel.`, `Bien vu${NB}: ${GESTES[l.pose]}, mais ce n’est pas l’action de la conduite.`);
          taire(2400);
        }
      }
      if (coupure && t >= coupure.fin) coupure = null;
      if (tops.every((x) => x.resolu) && t > tops[tops.length - 1].t + 1.2) terminer(now);
    }
    dessiner(now);
    // après la fin : le rapport se tape, le tampon frappe, puis la boucle s'arrête
    if (fini && now - finA > (rapport?.tamponA ?? 0) + 400) { enCours = false; return; }
    trame = requestAnimationFrame(boucle);
  };

  // ---------- Fin de représentation : le rapport de régie ----------
  const PHRASES = [
    [1, 'Conduite parfaite. Le metteur en scène ne touche à rien.'],
    [0.7, 'Bonne conduite. Deux ou trois tops à reprendre au raccord.'],
    [0.4, 'On refait un filage demain, 9 h, au plateau.'],
    [0, 'Les interprètes ont joué dans le noir.'],
  ];
  const terminer = (now) => {
    if (fini) return;
    fini = true;
    finA = now;
    coupure = null;
    allumer('plein', 400, now);
    const justes = bilan.juste;
    const part = justes / tops.length;
    const avant = carnet.meilleur[niveau.id];
    carnet.representations += 1;
    carnet.meilleur[niveau.id] = Math.max(avant ?? 0, justes);
    const record = avant !== undefined && justes > avant;
    const suivant = NIVEAUX[NIVEAUX.indexOf(niveau) + 1];
    const ouvre = (avant ?? 0) < seuil(niveau) && justes >= seuil(niveau) && suivant;
    garder();
    sonner('applaudir', part);
    avis = conseil?.(bilan);
    const pieges = leurres.length + tops.filter((x) => x.feinte && !x.surprise).length;
    const r = plan.rapport;
    const largeur = r.l - 12;
    const lignes = [
      { texte: `Rapport de régie · ${niveau.nom}`, trait: true },
      { texte: `Tops justes${NB}: ${justes}/${tops.length}${part === 1 ? ' · conduite parfaite' : ''}` },
      { releve: true },
      { texte: `Avance ${bilan.avance} · retard ${bilan.retard} · raté ${bilan.rate} · en trop ${bilan.trop}` },
      pieges ? { texte: `Leurres évités${NB}: ${pieges - bilan.leurre}/${pieges}` } : null,
      record || ouvre ? { texte: [record && 'Record battu', ouvre && `${ouvre.nom} est ouverte`].filter(Boolean).join(' · '), couleur: '#3F6B3A' } : null,
      ...P.couper(PHRASES.find(([s]) => part >= s)[1], largeur).map((texte) => ({ texte, couleur: C.encre })),
      ...(avis ? P.couper(`Conseil${NB}: ${avis.texte}`, largeur).slice(0, 4).map((texte) => ({ texte, couleur: '#575A63', conseil: true })) : []),
      avis?.plaque ? { texte: `» Voir le ${avis.titre}`, couleur: C.carmin, lien: true } : null,
      { texte: `Représentation n° ${Number(carnet.representations)}${carnet.energie <= 0 ? ` · ${carnet.doses ? 'un café d’abord' : 'thermos vide'}` : ''}`, couleur: '#575A63' },
    ].filter(Boolean);
    rapport = { lignes, debut: now, tamponA: 240 + lignes.length * 90 + 250, valide: justes >= seuil(niveau), frappe: false };
    // la version lue par les lecteurs d'écran
    $('[data-rapport]').innerHTML = '';
    const lu = lignes.filter((l) => !l.conseil && !l.lien).map((l) => (l.releve ? tops.map((x) => `Top ${x.n}${NB}: ${MOTS[x.resolu] ?? 'raté'}`).join(', ') : l.texte));
    if (avis) lu.splice(-1, 0, `Conseil du régisseur${NB}: ${avis.texte}`);
    lu.forEach((texte) => {
      const p = document.createElement('p');
      p.textContent = texte;
      $('[data-rapport]').append(p);
    });
    annonce.textContent = `Fin de la représentation. Tops justes${NB}: ${justes} sur ${tops.length}. ${rapport.valide ? 'Validé' : 'À revoir'}.`;
    // les touches changent de rôle : GO devient Rejouer, Quitter devient Retour
    touches.top.textContent = carnet.energie > 0 ? 'Rejouer' : carnet.doses ? 'Un café, et on rejoue' : 'Thermos vide';
    touches.quitter.textContent = 'Retour à l’étagère';
    touches.top.setAttribute('aria-disabled', 'true');
    setTimeout(() => {
      rejouerPret = carnet.energie > 0 || carnet.doses > 0;
      touches.top.setAttribute('aria-disabled', String(!rejouerPret));
      rafraichir();
    }, 600);
    const i = lignes.findIndex((l) => l.lien);
    if (i >= 0) {
      aller.hidden = false;
      aller.textContent = `Voir le ${avis.titre}`;
      rapport.lien = { x: r.x + 4, y: r.y + 3 + i * 9, l: P.mesurer(lignes[i].texte) + 4, h: 11 };
    }
    placerTouches();
    touches.top.focus({ preventScroll: true });
  };

  // ---------- Commandes ----------
  const fermer = () => { nettoyer(); };
  const rejouer = () => {
    if (carnet.energie <= 0 && carnet.doses) { carnet.doses -= 1; carnet.energie = ENERGIE.cafe; garder(); }
    nettoyer();
    jouer(options);
  };
  const boire = () => {
    if (cafeInactif()) return;
    carnet.doses -= 1;
    carnet.energie = Math.min(ENERGIE.max, carnet.energie + ENERGIE.cafe);
    garder();
    touches.top.focus({ preventScroll: true });
    dire(`Café de régie${NB}: +${ENERGIE.cafe} énergie.`);
    taire(1200);
  };
  const basculerSon = () => {
    const allume = touches.son.getAttribute('aria-pressed') !== 'true';
    if (allume && !allumerSon()) return;
    if (!allume) couperSon();
    touches.son.setAttribute('aria-pressed', String(allume));
    carnet.son = allume;
    garder();
    rafraichir();
  };
  touches.top.addEventListener('pointerdown', (e) => { if (e.button || fini) return; e.preventDefault(); top(e.timeStamp); });
  touches.top.addEventListener('click', (e) => {
    if (fini) { if (rejouerPret) rejouer(); return; }
    // activation sans pointeur ni clavier (lecteur d'écran) : le clic compte comme un top
    if (e.detail === 0 && !appuiClavier && performance.now() - dernierAppui > 200) top(performance.now());
  });
  // au doigt, la vitre et l'écran vert comptent aussi comme la touche TOP
  canvas.addEventListener('pointerdown', (e) => {
    if (!grossier.matches || e.button || fini) return;
    const x = (e.offsetX / canvas.clientWidth) * plan.L;
    const y = (e.offsetY / canvas.clientHeight) * plan.H;
    const dans = (r) => x >= r.x && x < r.x + r.l && y >= r.y && y < r.y + r.h;
    const ec = { x: plan.console.x + CONSOLE.ecran.x, y: plan.console.y + CONSOLE.ecran.y, l: EL, h: EH };
    if (dans(plan.verre) || dans(ec)) { e.preventDefault(); top(e.timeStamp); }
  });
  touches.cafe.addEventListener('click', boire);
  touches.son.addEventListener('click', basculerSon);
  touches.quitter.addEventListener('click', () => {
    if (fini) { fermer(); return; }
    // au doigt, quitter demande un second appui dans les 2 s
    if (grossier.matches && !quitterArme) {
      quitterArme = true;
      touches.quitter.textContent = 'Quitter : confirmer';
      setTimeout(() => { quitterArme = false; touches.quitter.textContent = 'Quitter'; rafraichir(); }, 2000);
      return;
    }
    fermer();
  });
  aller.addEventListener('click', () => { fermer(); options.allerA?.(avis.plaque); });
  const clavier = (e) => {
    if (!dlg.open) return;
    const lettre = e.key.length === 1 ? e.key.toLowerCase() : '';
    const sansModif = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!fini && (e.key === ' ' || (e.key === 'Enter' && (e.target === touches.top || !e.target.closest?.('button, a'))))) {
      e.preventDefault();
      if (!e.repeat) top(e.timeStamp, true);
    } else if (lettre === 'c' && sansModif && !e.repeat) boire();
    else if (lettre === 'm' && sansModif && !e.repeat) basculerSon();
  };
  const relache = (e) => { if (e.key === ' ' || e.key === 'Enter') appuiClavier = false; };
  document.addEventListener('keydown', clavier, true);
  document.addEventListener('keyup', relache, true);
  const pause = () => {
    if (document.hidden && enCours && !fini) { pauseDepuis = performance.now(); enCours = false; cancelAnimationFrame(trame); }
    else if (!document.hidden && pauseDepuis !== null && !fini && !nettoye) {
      debut += performance.now() - pauseDepuis;
      pauseDepuis = null;
      marquerZero();
      enCours = true;
      trame = requestAnimationFrame(boucle);
    }
  };
  document.addEventListener('visibilitychange', pause);

  // ---------- Taille : un agrandissement entier, et le plan qui convient à l'écran ----------
  const placer = (el, r) => {
    Object.assign(el.style, { left: `${(r.x / plan.L) * 100}%`, top: `${(r.y / plan.H) * 100}%`, width: `${(r.l / plan.L) * 100}%`, height: `${(r.h / plan.H) * 100}%` });
  };
  const placerTouches = () => {
    Object.entries(touches).forEach(([nom, el]) => placer(el, rectTouche(nom)));
    if (rapport?.lien) placer(aller, rapport.lien);
  };
  const ajuster = () => {
    const al = Math.max(120, dlg.clientWidth - 12);
    const ah = Math.max(120, dlg.clientHeight - 12);
    const p = al < ah ? PORTRAIT : PAYSAGE;
    if (p !== plan) {
      plan = p;
      canvas.width = p.L;
      canvas.height = p.H;
      peindreFond();
      prechauffer();
      if (rapport) terminerPlan();
      placerTouches();
    }
    let k = Math.min(al / p.L, ah / p.H);
    // des pixels égaux : un nombre entier de pixels de l'écran par pixel du jeu (Windows à 125 %, écrans denses)
    const dpr = devicePixelRatio || 1;
    if (k * dpr >= 1) k = Math.floor(k * dpr) / dpr;
    ecranEl.style.width = `${Math.round(p.L * k)}px`;
    ecranEl.style.height = `${Math.round(p.H * k)}px`;
    rafraichir();
  };
  // le rapport change de largeur avec le plan : on recoupe ses lignes
  const terminerPlan = () => {
    const r = plan.rapport;
    const i = rapport.lignes.findIndex((l) => l.lien);
    if (i >= 0) rapport.lien = { x: r.x + 4, y: r.y + 3 + i * 9, l: P.mesurer(rapport.lignes[i].texte) + 4, h: 11 };
  };
  addEventListener('resize', ajuster);

  const nettoyer = () => {
    if (nettoye) return;
    nettoye = true;
    // quittée avant la fin : la représentation ne compte pas, l'énergie payée est rendue
    if (!fini && depense) { carnet.energie = Math.min(ENERGIE.max, carnet.energie + depense); depense = 0; }
    enCours = false;
    cancelAnimationFrame(trame);
    clearTimeout(effacerOrdre);
    document.removeEventListener('keydown', clavier, true);
    document.removeEventListener('keyup', relache, true);
    document.removeEventListener('visibilitychange', pause);
    removeEventListener('resize', ajuster);
    couperSon();
    garder();
    if (dlg.open) dlg.close();
    dlg.remove();
    surFin?.(niveau.id);
  };
  dlg.addEventListener('close', nettoyer);

  // la consigne, posée sur la table au premier passage et au filage
  if (premiereFois || niveau.id === 'filage') {
    notes.push({ titre: 'Consigne', lignes: ['Top quand le bord d’un bloc touche la ligne.', 'Les autres tops sont annoncés au haut-parleur.'], papier: 'rapport', debut: -1e9 });
  }
  dlg.showModal();
  options.surOuverture?.();
  ajuster();
  if (carnet.son && allumerSon()) touches.son.setAttribute('aria-pressed', 'true');
  touches.top.focus({ preventScroll: true });
  annonce.textContent = `${niveau.nom}, ${CARTONS[niveau.id] ?? ''}.`;
  debut = performance.now() + CARTON;
  marquerZero();
  trame = requestAnimationFrame(boucle);
}
