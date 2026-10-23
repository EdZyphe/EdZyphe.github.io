// Coulisses : les polices bitmap du jeu (papiers et console).
// Une planche de 16 colonnes, cases de 8 × 10 : rangées 0-1 pour les accents, 2-6 pour le corps de 5 px,
// 7-8 pour les jambages. Les glyphes sont dessinés en blanc, calés à gauche ; le code mesure leur largeur.
// Les planches de sprites/ sont des gabarits : Pierre les redessine, dans l'ordre de JEU.
import { image } from './pixels.js';

export const JEU = ' !"\'()+,-./0123456789:;?%°ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÂÇÈÉÊËÎÏÔÙÛàâçèéêëîïôùû«»’…·−×±';
const ESPACE = { l: 0, avance: 3 };
const FINE = { l: 0, avance: 1 }; // espaces insécables fines, avant « : ! ? »
const FINES = new Set([' ', ' ', ' ']);
const polices = new Map();

const charger = async (nom) => {
  const planche = await image(nom);
  const c = document.createElement('canvas');
  c.width = planche.width;
  c.height = planche.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(planche, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; // une seule lecture, au chargement
  const glyphes = new Map();
  [...JEU].forEach((ch, i) => {
    const x0 = (i % 16) * 8;
    const y0 = Math.floor(i / 16) * 10;
    let l = 0;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 10; y++) if (d[((y0 + y) * c.width + x0 + x) * 4 + 3]) l = Math.max(l, x + 1);
    if (l) glyphes.set(ch, { x: x0, y: y0, l });
  });
  // un caractère absent : sa lettre sans accent, puis sa capitale, puis « ? »
  const trouver = (ch) => {
    if (ch === ' ') return ESPACE;
    if (FINES.has(ch)) return FINE;
    if (glyphes.has(ch)) return glyphes.get(ch);
    const base = ch.normalize('NFD')[0];
    return glyphes.get(base) ?? glyphes.get(base.toUpperCase()) ?? glyphes.get('?');
  };
  const avance = (gl) => gl.avance ?? gl.l + 1;
  // une copie de la planche par couleur, faite une fois
  const teintes = new Map();
  const teinte = (couleur) => {
    if (!teintes.has(couleur)) {
      const t = document.createElement('canvas');
      t.width = planche.width;
      t.height = planche.height;
      const tg = t.getContext('2d');
      tg.drawImage(planche, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = couleur;
      tg.fillRect(0, 0, t.width, t.height);
      teintes.set(couleur, t);
    }
    return teintes.get(couleur);
  };
  const mesurer = (texte, e = 1) => {
    let l = 0;
    for (const ch of texte) l += avance(trouver(ch)) * e;
    return Math.max(0, l - e);
  };
  // y désigne le haut du corps des lettres ; renvoie l'abscisse de fin
  const ecrire = (ctx, texte, x, y, couleur, e = 1) => {
    const src = teinte(couleur);
    let cx = x;
    for (const ch of texte) {
      const gl = trouver(ch);
      if (gl.l) ctx.drawImage(src, gl.x, gl.y, gl.l, 10, cx, y - 2 * e, gl.l * e, 10 * e);
      cx += avance(gl) * e;
    }
    return cx;
  };
  // retour à la ligne entre les mots (les espaces insécables tiennent les mots ensemble)
  const couper = (texte, largeur, e = 1) => {
    const lignes = [];
    let ligne = '';
    for (const mot of texte.split(' ')) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (!ligne || mesurer(essai, e) <= largeur) ligne = essai;
      else { lignes.push(ligne); ligne = mot; }
    }
    if (ligne) lignes.push(ligne);
    return lignes;
  };
  return { ecrire, mesurer, couper };
};

export const police = (nom) => {
  if (!polices.has(nom)) polices.set(nom, charger(nom).catch((e) => { polices.delete(nom); throw e; }));
  return polices.get(nom);
};
