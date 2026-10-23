// Coulisses : les images du jeu caché et leur cadre technique.
// Direction artistique inspirée de Papers, Please (voir DIRECTION-ARTISTIQUE.md) : écran natif de
// 480 × 270 (270 × 480 en portrait), agrandi sans lissage ; personnages en cases de 64 × 64, objets
// en 32 × 32 ; papiers et cadres découpés en neuf, bois et murs en motifs répétés.
// Les PNG de sprites/ sont des gabarits provisoires : Pierre les remplace par ses dessins,
// aux mêmes noms et aux mêmes tailles, sans toucher au code.

export const CASE = 64;
export const OBJET = 32;

const BASE = new URL('./sprites/', import.meta.url);
export const url = (nom) => new URL(`${nom}.png`, BASE).href;

const cache = new Map();
export const image = (nom) => {
  if (!cache.has(nom)) {
    cache.set(nom, new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      // un échec n'est pas gardé : la prochaine partie retentera le chargement
      i.onerror = () => { cache.delete(nom); ko(new Error(`Sprite introuvable : ${nom}`)); };
      i.src = url(nom);
    }));
  }
  return cache.get(nom);
};

// l'agrandissement d'un écran de jeu (L × H) dans la place disponible : des pixels égaux, un nombre entier de pixels
// de l'écran par pixel du jeu (Windows à 125 %, écrans denses), tant que cela remplit au moins 90 % de la place ;
// sinon l'écran remplit la place, toujours sans lissage, plutôt que de rester petit au milieu de bandes noires
export const agrandissement = (al, ah, L, H) => {
  const dpr = devicePixelRatio || 1;
  const k = Math.min(al / L, ah / H);
  const entier = Math.floor(k * dpr) / dpr;
  return entier > 0 && entier >= 0.9 * k ? entier : k;
};

// une icône d'objet, posée derrière une vitre
export const icone = (nom) => {
  const i = document.createElement('img');
  i.src = url(nom);
  i.width = OBJET;
  i.height = OBJET;
  i.alt = '';
  i.className = 'px';
  return i;
};

// paver un rectangle avec un morceau d'image, sans l'étirer (le dernier carreau est coupé)
export const paver = (ctx, img, sx, sy, sl, sh, x, y, l, h) => {
  if (sl <= 0 || sh <= 0) return;
  for (let j = 0; j < h; j += sh) {
    for (let i = 0; i < l; i += sl) {
      const a = Math.min(sl, l - i);
      const b = Math.min(sh, h - j);
      ctx.drawImage(img, sx, sy, a, b, x + i, y + j, a, b);
    }
  }
};

// une image découpée en neuf : coins fixes, bords et centre répétés ; [haut, droite, bas, gauche] comme en CSS
export const neuf = (ctx, img, [h, d, b, g], x, y, l, ht) => {
  const cl = img.width - g - d;
  const ch = img.height - h - b;
  ctx.drawImage(img, 0, 0, g, h, x, y, g, h);
  ctx.drawImage(img, img.width - d, 0, d, h, x + l - d, y, d, h);
  ctx.drawImage(img, 0, img.height - b, g, b, x, y + ht - b, g, b);
  ctx.drawImage(img, img.width - d, img.height - b, d, b, x + l - d, y + ht - b, d, b);
  paver(ctx, img, g, 0, cl, h, x + g, y, l - g - d, h);
  paver(ctx, img, g, img.height - b, cl, b, x + g, y + ht - b, l - g - d, b);
  paver(ctx, img, 0, h, g, ch, x, y + h, g, ht - h - b);
  paver(ctx, img, img.width - d, h, d, ch, x + l - d, y + h, d, ht - h - b);
  paver(ctx, img, g, h, cl, ch, x + g, y + h, l - g - d, ht - h - b);
};
