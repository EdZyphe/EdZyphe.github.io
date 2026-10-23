// Coulisses : toutes les règles du jeu au même endroit.
// Valeurs réglées d'après l'audit de game design (simulation de parties) : au départ le filage est
// jouable, la première demande d'avoir exploré le portfolio, et aucune statistique n'écrase les autres.

const NB = ' ';
const FN = ' ';

export const VERSION = 1; // version du carnet enregistré
export const ENERGIE = { depart: 6, max: 10, cafe: 4, doses: 3, recharge: 3 * 60 * 1000 };
export const REACTION = 0.3; // temps de réaction accordé après « Top ! » sur réplique (s)
export const LATENCE = 0.03; // l'écran et le clavier font toujours appuyer un peu en retard (s)
export const RATTRAPAGE = 0.5; // un appui juste après un raté compte « en retard », sans coût (s)
export const SAUTE = 1.5; // une réplique sautée avance le top d'autant (s)

// ---------- Le spectacle : « Nouvelles Bien Tempérées » (Cie L’Ange du Bizarre), d’après son teaser ----------
// Deux nouvelles, deux interprètes, un pianiste, des décors vidéo projetés au lointain (ceux de Pierre).
// « Comment Wang-Fô fut sauvé » (Yourcenar), joué par le comédien : l’estampe, le soleil rouge, la colonnade et
// la scène du manteau ; puis, après un noir où les interprètes se relaient, « L’Ange du Bizarre » (Poe), jouée
// par la comédienne : la chambre, le port. Les tops tombent sur des actions précises (à vue), sur le texte
// (appelés à l’inter par le régisseur général) ou sur la bande (enchaînés). La conduite est imaginée pour le jeu,
// d’après le teaser ; le même spectacle se resserre du filage à la première.

// ---------- Les interprètes : leurs poses (comedien.png, comedienne.png, cases de 64 × 64) ----------
// Chaque top à vue attend une action précise ; les autres actions servent de leurres. Le comédien garde la cape
// (drape) une fois le manteau levé.
export const POSES = {
  comedien: { repos: 0, visiere: 1, montre: 2, merveille: 3, manteau: 4, drape: 5, dos: 6, salut: 7 },
  comedienne: { repos: 0, hanches: 1, verre: 2, bras: 3, ivre: 4, salut: 5 },
};
export const GESTES = {
  visiere: 'il met la main en visière',
  montre: 'il montre le lointain',
  merveille: 'il lève les bras, émerveillé',
  manteau: 'il lève le manteau',
  hanches: 'elle met les poings sur les hanches',
  verre: 'elle lève son verre',
  bras: 'elle ouvre grand les bras',
  ivre: 'elle titube',
};
export const GESTES_COURTS = { // pour les papiers
  visiere: 'main en visière', montre: 'il montre', merveille: 'bras levés', manteau: 'manteau levé',
  hanches: 'poings aux hanches', verre: 'verre levé', bras: 'bras ouverts', ivre: 'elle titube',
};
export const LEURRE = 0.8; // durée d'une fausse action isolée (s)
export const FEINTE = [1.05, 0.5]; // une hésitation occupe [t − 1,05 s ; t − 0,5 s] avant la vraie action
export const PRISE = 0.2; // on mord encore au leurre 0,2 s après la fin de la fausse action (temps de réaction)

// les états de lumière, et ce que la conduite en dit ; les décors vidéo se projettent sur l'écran du lointain
export const ETATS = { salle: 'Lumière salle', plein: 'Plateau', douche: 'Douche', bleu: 'Contre froid', ambre: 'Chaud', noir: 'Noir', service: 'Service' };
export const VIDEOS = { estampe: 'L’estampe', soleil: 'Le soleil rouge', colonnade: 'La colonnade', chambre: 'La chambre', port: 'Le port', noir: 'Noir vidéo' };
const VIDEOS_COURTS = { estampe: 'estampe', soleil: 'soleil', colonnade: 'colonnade', chambre: 'chambre', port: 'port', noir: 'noir' };

// ---------- Les niveaux : filage, générale, première ----------
// c : top enchaîné, sur la bande ; a : top à vue, sur une action ; r : top sur le texte, appelé à l'inter.
// Chaque top porte une mémoire lumière (etat) et parfois un départ vidéo (video). relais : l'instant, dans le noir
// entre les deux nouvelles, où la comédienne prend la place du comédien.
// le nom complet (lu à l'écran) et la ligne de la feuille de conduite (une trentaine de signes)
const libelle = (n, etat, video) => [etat && `Mém ${n} · ${ETATS[etat]}`, video && `Vidéo · ${VIDEOS[video]}`].filter(Boolean).join(' + ');
const ligne = (etat, video) => `${ETATS[etat]}${video ? ` + vidéo ${VIDEOS_COURTS[video]}` : ''}`;
const c = (t, n, etat, video = null) => ({ t, etat, video, type: 'conduite', nom: libelle(n, etat, video), court: ligne(etat, video) });
const a = (t, n, etat, geste, extra = {}) => ({
  t, etat, video: null, type: 'replique', geste, replique: null, nom: 'à vue',
  texte: `À vue${NB}: ${GESTES[geste]}.`, court: `À vue${NB}: ${GESTES_COURTS[geste]}`, mem: libelle(n, etat, extra.video), ...extra,
});
const r = (t, n, etat, replique, extra = {}) => ({
  t, etat, video: null, type: 'replique', geste: null, replique, nom: 'sur le texte',
  texte: `Sur le texte${NB}: «${FN}${replique.join(' ')}${FN}»`, court: `Texte${NB}: «${FN}${replique[1]}${FN}»`, mem: libelle(n, etat, extra.video), ...extra,
});
// sur le texte, on attend un mot : un nom de la nouvelle (pas de citation)
const WANG = ['…', 'Wang-Fô.'];
const LING = ['…', 'Ling.'];
const ANGE = ['…', 'l’Ange.'];

export const NIVEAUX = [
  {
    id: 'filage', nom: 'Le filage', resume: 'Huit tops, bien espacés. Une fausse action.', coef: 1.2, reussite: 0.7, relais: 21.5,
    // au filage, le premier top à vue est appelé tôt : on apprend, puis on est testé
    tops: [c(3, 1, 'plein', 'estampe'), a(7.5, 2, 'douche', 'visiere', { attention: 2 }), c(12, 3, 'bleu', 'colonnade'), a(16.5, 4, 'douche', 'manteau'),
      r(19.5, 5, 'noir', WANG, { video: 'noir' }), c(24, 6, 'ambre', 'chambre'), a(28.5, 7, 'douche', 'verre'), c(33, 8, 'noir', 'noir')],
    // une fausse action isolée, sans « Attention » : on apprend à attendre l'appel
    leurres: [{ t: 9.6, pose: 'montre' }],
  },
  {
    id: 'generale', nom: 'La générale', resume: 'Dix tops, plus serrés. Le comédien hésite avant d’agir.', coef: 1, reussite: 0.7, relais: 16.5,
    tops: [c(3, 1, 'plein', 'estampe'), a(6, 2, 'douche', 'visiere'), c(9.5, 3, 'bleu', 'colonnade'), a(12.5, 4, 'douche', 'manteau', { feinte: 'montre' }),
      r(15, 5, 'noir', WANG, { video: 'noir' }), c(18, 6, 'ambre', 'chambre'), a(21, 7, 'douche', 'verre'), c(24, 8, 'bleu', 'port'),
      a(27, 9, 'ambre', 'bras'), c(30.5, 10, 'noir', 'noir')],
    leurres: [{ t: 28.4, pose: 'ivre' }],
  },
  {
    id: 'premiere', nom: 'La première', resume: 'Douze tops, sans filet. Deux hésitations.', coef: 0.8, reussite: 0.8, relais: 18,
    tops: [c(3, 1, 'plein', 'estampe'), a(5.5, 2, 'douche', 'visiere'), c(8, 3, 'ambre', 'soleil'), r(10, 4, 'bleu', LING, { video: 'colonnade' }),
      c(12.5, 5, 'plein'), a(14.5, 6, 'douche', 'manteau', { feinte: 'merveille' }), c(17, 7, 'noir', 'noir'), c(19, 8, 'ambre', 'chambre'),
      r(21.5, 9, 'bleu', ANGE, { video: 'port' }), c(24, 10, 'plein'), a(26, 11, 'douche', 'bras', { feinte: 'verre' }), c(29, 12, 'noir', 'noir')],
    // le comédien met la main en visière dès son entrée : le joueur impulsif part avant le premier top
    leurres: [{ t: 1, pose: 'visiere' }],
  },
];
// qui est en scène à l'instant t, et la pose où il revient entre deux actions
export const enScene = (niveau, t) => (t < niveau.relais ? 'comedien' : 'comedienne');
export const repos = (niveau, t) => {
  const manteau = niveau.tops.find((x) => x.geste === 'manteau');
  return enScene(niveau, t) === 'comedien' && manteau && t > manteau.t + 0.9 ? 'drape' : 'repos';
};
export const seuil = (niveau) => Math.ceil(niveau.tops.length * niveau.reussite);

// ---------- Les statistiques et leur effet sur la régie ----------
export const STATS = [
  { cle: 'lumiere', nom: 'Lumière', teinte: '#F2B10C', base: 1 },
  { cle: 'son', nom: 'Son', teinte: '#A8173F', base: 1 },
  { cle: 'video', nom: 'Vidéo', teinte: '#1F5A8A', base: 1 },
  { cle: 'sangfroid', nom: 'Sang-froid', teinte: '#2E6E58', base: 1 },
  { cle: 'chance', nom: 'Chance', teinte: '#2A2E36', base: 4 },
];
// ce que l'on gagne en parcourant le portfolio (un fait noté par le carnet de script.js)
export const SOURCES = [
  { stat: 'lumiere', fait: 'salle', texte: 'Projets projetés en grand', max: 4 },
  { stat: 'video', fait: 'video', texte: `Vidéos regardées 5${NB}s au moins`, max: 4 },
  { stat: 'son', fait: 'son', texte: 'Vidéos écoutées à moitié, avec le son', max: 3 },
  { stat: 'sangfroid', fait: 'apropos', texte: `«${FN}À propos${FN}» lu`, max: 1 },
  { stat: 'sangfroid', fait: 'contact', texte: 'Contact consulté', max: 1 },
  { stat: 'chance', fait: 'filtre', texte: 'Métiers essayés dans le filtre', max: 2 },
];
export const SOURCES_CALCULEES = [
  { stat: 'sangfroid', cle: 'retours', texte: 'Retours sur le site', max: 2, valeur: (c) => (c.visites || 1) - 1 },
  { stat: 'sangfroid', cle: 'trac', texte: 'Le trac passe (une représentation sur deux)', max: 2, valeur: (c) => Math.floor((c.representations || 0) / 2) },
];

export const effets = (st, niveau) => ({
  fenetre: (0.09 + 0.012 * st.lumiere) * (niveau?.coef ?? 1), // demi-fenêtre d'un top juste (s)
  avance: 1 + 0.2 * st.video, // conduite visible à l'avance (s)
  attention: 1 + 0.25 * st.son, // « Attention » avant un top sur réplique (s)
  repliquesVisibles: st.video >= 6, // les tops sur réplique apparaissent en pointillés sur la bande
  imprecisGratuit: st.sangfroid >= 3,
  tropGratuit: st.sangfroid >= 5, // tops en trop et leurres
  rateLeger: st.sangfroid >= 7,
  incident: Math.max(0, 0.3 - 0.04 * st.chance), // probabilité par top
});

// Classement d'un appui (fonction pure, testable) : d = instant de l'appui − instant du top
export const limiteRetard = (top, w) => 2 * w + (top.type === 'replique' ? REACTION : 0);
export const classer = (d, top, w) => {
  const dd = top.type === 'conduite' ? d - LATENCE : d;
  const marge = top.type === 'replique' ? REACTION : 0;
  if (dd >= -w && dd <= w + marge) return 'juste';
  return dd < -w ? 'avance' : 'retard';
};

// ---------- Les objets : deux sur l'étagère, puis un caché dans chaque projet ----------
// Main et Poche offrent un vrai choix : un pouvoir (objet de départ) ou un bonus (objet trouvé).
export const OBJETS = {
  cle: { nom: 'Clé de 13', f: true, sprite: 'cle13', place: 'Main', depart: true, bonus: {}, pouvoir: 'Une coupure du retour vidéo ne dure qu’1 s au lieu de 3.' },
  lampe: { nom: 'Lampe bleue de coulisse', f: true, sprite: 'lampe', place: 'Poche', depart: true, bonus: {}, pouvoir: 'Pendant les noirs, on lit la conduite aussi loin qu’en pleine lumière.' },
  lentille: { nom: 'Lentille de Fresnel', sprite: 'lentille', plaque: 'plaque-1', bonus: { lumiere: 2 } },
  gaffer: { nom: 'Rouleau de gaffer', sprite: 'gaffer', plaque: 'plaque-2', bonus: { chance: 2 } },
  casque: { nom: 'Casque d’inter', sprite: 'casque', plaque: 'plaque-3', place: 'Tête', bonus: { son: 2 } },
  contre: { nom: 'Carnet de Contre', sprite: 'contre', plaque: 'plaque-4', place: 'Poche', bonus: { sangfroid: 2 } },
  eclat: { nom: 'Éclat de Chronox', sprite: 'eclat', plaque: 'plaque-5', bonus: { video: 2 } },
  frontale: { nom: 'Frontale', f: true, sprite: 'frontale', plaque: 'plaque-6', place: 'Cou', bonus: { lumiere: 3, chance: -3 }, note: 'Au cou, toujours prête. Un coup de frontale dans la salle est vite arrivé.' },
  cable: { nom: 'Câble réseau', sprite: 'cable', plaque: 'plaque-7', place: 'Main', bonus: { video: 1, lumiere: 1 } },
};
export const PLACES = ['Tête', 'Cou', 'Main', 'Poche'];
export const GRADES = ['Stagiaire', 'Électro', 'Pupitreur', 'Régisseur lumière', 'Directeur technique'];
