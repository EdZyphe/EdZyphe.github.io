// Coulisses : le son du jeu des tops, coupé par défaut (bouton « Son » ou touche M).
// Tout est synthétisé avec Web Audio, sans fichier. Bus des effets à −12 dB, sortie à −6 dB,
// un compresseur en guise de limiteur.

let ctx = null;
let bus = null;

export const allumerSon = () => {
  if (!ctx) {
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return false;
    ctx = new Contexte();
    const limiteur = ctx.createDynamicsCompressor();
    limiteur.threshold.value = -6;
    limiteur.ratio.value = 20;
    const sortie = ctx.createGain();
    sortie.gain.value = 0.5;
    bus = ctx.createGain();
    bus.gain.value = 0.25;
    bus.connect(limiteur).connect(sortie).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
};
export const couperSon = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };

const bip = (f, duree, type = 'sine', volume = 1, dans = 0) => {
  const t = ctx.currentTime + dans;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + duree + 0.02);
};
const souffle = (duree, filtre, f, volume = 1, dans = 0) => {
  const t = ctx.currentTime + dans;
  const tampon = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duree), ctx.sampleRate);
  const data = tampon.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = tampon;
  const passe = ctx.createBiquadFilter();
  passe.type = filtre;
  passe.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  source.connect(passe).connect(g).connect(bus);
  source.start(t);
};

const SONS = {
  inter: () => { bip(1175, 0.04, 'square', 0.18); bip(1175, 0.04, 'square', 0.18, 0.07); }, // l'appel de l'inter
  attention: () => { bip(1046, 0.035); bip(1046, 0.035, 'sine', 1, 0.09); },
  avertir: () => bip(988, 0.05, 'sine', 0.6), // tops de conduite : t − 1 s et t − 0,5 s
  maintenant: () => bip(1318, 0.06, 'sine', 0.7), // tops de conduite : t
  appui: () => souffle(0.012, 'highpass', 3000 * (0.96 + Math.random() * 0.08), 0.8), // clic de pupitre
  juste: () => bip(880, 0.12, 'triangle'),
  imprecis: () => bip(660, 0.12, 'triangle', 0.8),
  rate: () => bip(220, 0.2, 'square', 0.3),
  coupure: () => souffle(0.6, 'bandpass', 2000, 0.06),
  tampon: () => { souffle(0.09, 'lowpass', 240, 2); bip(70, 0.09, 'sine', 0.8); }, // le tampon frappe le rapport
  papier: () => souffle(0.14, 'highpass', 1800, 0.25), // un papier glisse sur la table
  applaudir: (part) => {
    const n = Math.round(6 + 34 * part);
    for (let i = 0; i < n; i++) souffle(0.05, 'bandpass', 1500 + Math.random() * 1500, 0.4, Math.random() * 1.8);
  },
};
export const jouerSon = (nom, ...args) => { if (ctx && ctx.state === 'running') SONS[nom]?.(...args); };
