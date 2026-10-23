// Coulisses : la lumière commune à l'étagère et à la régie, à la manière d'Eastward (DIRECTION-ARTISTIQUE.md).
// Une seule rampe, de l'ombre froide au cœur chaud, en paliers tramés (Bayer 4 × 4), avec une touche bleue
// ajoutée dans l'ombre. Les cartes de lumière sont calculées une fois par écran et gardées.

export const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export const RAMPE = [[52, 58, 92], [104, 96, 116], [168, 136, 118], [226, 186, 138], [255, 232, 188]];
export const FROID = [18, 24, 39];

// une intensité (0 à 1) devient un palier entier (0 à max), tramé selon la place du pixel
export const palier = (I, x, y, max = 4) => Math.max(0, Math.min(max, Math.floor(I * max + BAYER[y % 4][x % 4] / 16 - 0.5)));

export const toile = (l, h) => {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  return c;
};

// une carte en niveaux de gris, teinte d'une couleur (pour la lumière ajoutée) ; gardée par couleur
const teintes = new WeakMap();
export const teinte = (gris, couleur) => {
  if (!teintes.has(gris)) teintes.set(gris, new Map());
  const parCouleur = teintes.get(gris);
  if (!parCouleur.has(couleur)) {
    const c = toile(gris.width, gris.height);
    const g = c.getContext('2d');
    g.drawImage(gris, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = couleur;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(gris, 0, 0);
    parCouleur.set(couleur, c);
  }
  return parCouleur.get(couleur);
};

// les bords d'une silhouette tournés vers la lumière (directions [dx, dy] vers la source) : le liseré du contre-jour, en blanc
export const lisere = (img, sx, sy, l, h, directions) => {
  const c = toile(l, h);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, sx, sy, l, h, 0, 0, l, h);
  const a = g.getImageData(0, 0, l, h).data;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < l && y < h && a[(y * l + x) * 4 + 3] > 0;
  const id = g.createImageData(l, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) if (opaque(x, y) && directions.some(([dx, dy]) => !opaque(x + dx, y + dy))) id.data.set([255, 255, 255, 255], (y * l + x) * 4);
  }
  g.putImageData(id, 0, 0);
  return c;
};
