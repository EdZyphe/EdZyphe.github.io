// Coulisses : les deux mises en page de la régie, en pixels natifs.
// Paysage (480 × 270) : la vitre sur la scène en haut, la console à gauche, la table à droite.
// Portrait (270 × 480) : la vitre, la console, puis la table en dessous.
// Les éléments de la console sont placés par rapport à son coin.

// la scène vue par la vitre (scene.png) : l'écran du lointain où se projettent les décors (projection-*.png)
export const SCENE = { l: 456, h: 108, ecran: { x: 24, y: 4, l: 408, h: 80 } };

export const CONSOLE = {
  l: 204,
  h: 144,
  ecran: { x: 10, y: 8, l: 184, h: 34 },
  faders: { x: 10, y: 48, pas: 13, course: 32 },
  jauge: { x: 126, y: 54, l: 70, h: 10, legende: [160, 70] }, // l'énergie, en barre de diodes
  voyants: { juste: [8, 88], faute: [16, 88] },
  touches: {
    top: { x: 124, y: 88, l: 72, h: 48 },
    son: { x: 8, y: 98, l: 36, h: 32 },
    cafe: { x: 46, y: 98, l: 36, h: 32 },
    quitter: { x: 84, y: 98, l: 36, h: 32 },
  },
};

export const PAYSAGE = {
  nom: 'paysage',
  L: 480,
  H: 270,
  murs: [{ x: 0, y: 0, l: 480, h: 126 }],
  cadre: { x: 8, y: 4, l: 464, h: 116 },
  verre: { x: 12, y: 8, l: 456, h: 108, sx: 0 },
  rebord: { x: 0, y: 120, l: 480 },
  console: { x: 0, y: 126 },
  tables: [{ x: 204, y: 126, l: 276, h: 144 }],
  feuille: { x: 212, y: 131 },
  hautParleur: { x: 354, y: 131 },
  notes: { x: 352, y: 176, l: 86 },
  thermos: { x: 446, y: 180 },
  objets: [{ x: 350, y: 234 }, { x: 382, y: 234 }, { x: 414, y: 234 }, { x: 446, y: 234 }],
  rapport: { x: 210, y: 130, l: 264, h: 136 },
  // la lampe de régie, derrière le régisseur : une flaque sur la table, une sur la console ; son reflet dans la vitre
  flaques: [{ x: 300, y: 198, r: 150, k: 1 }, { x: 96, y: 214, r: 116, k: 0.72 }],
  reflet: { x: 388, y: 22 },
};

export const PORTRAIT = {
  nom: 'portrait',
  L: 270,
  H: 480,
  murs: [{ x: 0, y: 0, l: 270, h: 126 }, { x: 0, y: 126, l: 33, h: 144 }, { x: 237, y: 126, l: 33, h: 144 }],
  cadre: { x: 8, y: 4, l: 254, h: 116 },
  verre: { x: 12, y: 8, l: 246, h: 108, sx: 105 }, // le centre de la scène, là où joue le comédien
  rebord: { x: 0, y: 120, l: 270 },
  console: { x: 33, y: 126 },
  tables: [{ x: 0, y: 270, l: 270, h: 210 }],
  feuille: { x: 8, y: 276 },
  hautParleur: { x: 148, y: 276 },
  notes: { x: 150, y: 322, l: 80 },
  thermos: { x: 238, y: 330 },
  objets: [{ x: 8, y: 440 }, { x: 42, y: 440 }, { x: 76, y: 440 }, { x: 110, y: 440 }],
  rapport: { x: 6, y: 276, l: 258, h: 198 },
  flaques: [{ x: 135, y: 372, r: 165, k: 1 }, { x: 135, y: 206, r: 112, k: 0.72 }],
  reflet: { x: 196, y: 22 },
};
