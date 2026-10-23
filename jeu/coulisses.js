// Coulisses : le jeu caché du portfolio. On l'ouvre sur l'étagère du régisseur (etagere.js).
// Les statistiques ne s'obtiennent qu'en parcourant le portfolio (regles.js : SOURCES) et grâce aux
// objets cachés, un par projet. Elles règlent la difficulté du jeu des tops (tops.js, chargé au
// premier lancement d'une représentation).
import { icone } from './pixels.js';
import { creerEtagere } from './etagere.js';
import { OBJETS, PLACES, STATS, SOURCES, SOURCES_CALCULEES, NIVEAUX, GRADES, ENERGIE, VERSION, seuil, effets } from './regles.js';

const { carnet, garder, idPiece, CARNET } = window.coulisses;
const servante = document.querySelector('[data-servante]');
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)');
const NB = ' ';
const FN = ' ';

const feuille = document.createElement('link');
feuille.rel = 'stylesheet';
feuille.href = new URL('./coulisses.css', import.meta.url).href;
document.head.append(feuille);

const signe = (n) => (n > 0 ? `+${n}` : `−${-n}`);
const virgule = (x) => x.toFixed(2).replace(/0$/, '').replace('.', ',');
const ent = (x, min, max, defaut) => (Number.isFinite(Number(x)) ? Math.max(min, Math.min(max, Math.round(Number(x)))) : defaut);
const NOMS = Object.fromEntries(STATS.map((s) => [s.cle, s.nom]));

// ---------- Le carnet, remis en ordre avant tout usage ----------
const connu = (id) => typeof id === 'string' && Object.hasOwn(OBJETS, id);
// l'écharpe verte (et sa superstition) est devenue la frontale : un ancien carnet la retrouve au même crochet
const RENOMMES = { echarpe: 'frontale' };
const normaliser = () => {
  if (Array.isArray(carnet.possede)) carnet.possede = carnet.possede.map((id) => RENOMMES[id] ?? id);
  if (carnet.porte && typeof carnet.porte === 'object') Object.keys(carnet.porte).forEach((place) => { carnet.porte[place] = RENOMMES[carnet.porte[place]] ?? carnet.porte[place]; });
  if (typeof carnet.choisi === 'string') carnet.choisi = RENOMMES[carnet.choisi] ?? carnet.choisi;
  const f = carnet.faits && typeof carnet.faits === 'object' && !Array.isArray(carnet.faits) ? carnet.faits : {};
  Object.keys(f).forEach((k) => { f[k] = (Array.isArray(f[k]) ? f[k] : []).filter((v) => typeof v === 'string'); });
  carnet.faits = f;
  const possede = (Array.isArray(carnet.possede) ? carnet.possede : []).filter((id) => connu(id));
  ['cle', 'lampe'].forEach((id) => { if (!possede.includes(id)) possede.push(id); });
  carnet.possede = [...new Set(possede)];
  const porte = carnet.porte && typeof carnet.porte === 'object' ? carnet.porte : { Main: 'cle', Poche: 'lampe' };
  carnet.porte = Object.fromEntries(Object.entries(porte).filter(([place, id]) => PLACES.includes(place) && connu(id) && OBJETS[id].place === place && carnet.possede.includes(id)));
  carnet.energie = ent(carnet.energie, 0, ENERGIE.max, ENERGIE.depart);
  carnet.doses = ent(carnet.doses, 0, ENERGIE.doses, 2);
  carnet.representations = ent(carnet.representations, 0, 99999, 0);
  carnet.visites = ent(carnet.visites, 1, 99999, 1);
  carnet.cafeCumul = ent(carnet.cafeCumul, 0, ENERGIE.recharge, 0);
  const m = carnet.meilleur && typeof carnet.meilleur === 'object' ? carnet.meilleur : {};
  carnet.meilleur = Object.fromEntries(NIVEAUX.filter((n) => m[n.id] !== undefined).map((n) => [n.id, ent(m[n.id], 0, n.tops.length, 0)]));
  delete carnet.echarpeJouee;
  delete carnet.echarpeBannie;
  if (!connu(carnet.choisi)) delete carnet.choisi;
  if (typeof carnet.veille !== 'string') delete carnet.veille;
  else carnet.veille = carnet.veille.slice(0, 400);
  carnet.v = VERSION;
};

// ---------- Les projets, lus dans la page (un projet absent est simplement ignoré) ----------
const plaque = (id) => document.getElementById(id);
const piecesDe = (id) => [...(plaque(id)?.querySelectorAll('.piece') ?? [])].map((p) => `${id}:${idPiece(p)}`);
const vuesDe = (id) => { const vues = new Set(carnet.faits.vue || []); return piecesDe(id).filter((p) => vues.has(p)).length; };
const trouve = (id) => { const o = OBJETS[id]; if (o.depart) return true; const n = piecesDe(o.plaque).length; return n > 0 && vuesDe(o.plaque) >= n; };
const titreDe = (id) => {
  const p = plaque(id);
  if (!p) return 'un projet';
  return `N°${NB}${p.querySelector('.plaque-ref .no')?.textContent.replace(/\D/g, '') ?? ''}, ${p.querySelector('h3')?.textContent ?? ''}`;
};
const estPorte = (id) => Object.values(carnet.porte).includes(id);
const objetsCaches = Object.keys(OBJETS).filter((id) => OBJETS[id].plaque);
const objetsTrouves = () => objetsCaches.filter((id) => carnet.possede.includes(id)).length;

// ---------- Les statistiques, avec chaque source et son plafond ----------
const statistiques = () => {
  const lignes = Object.fromEntries(STATS.map((s) => [s.cle, [{ cle: 'base', texte: 'Au départ', valeur: s.base }]]));
  SOURCES.forEach((s) => {
    const n = new Set(carnet.faits[s.fait] || []).size;
    lignes[s.stat].push({ cle: s.fait, texte: `${s.texte} ${Math.min(n, s.max)}/${s.max}`, valeur: Math.min(n, s.max) });
  });
  SOURCES_CALCULEES.forEach((s) => {
    const n = Math.max(0, s.valeur(carnet));
    lignes[s.stat].push({ cle: s.cle, texte: `${s.texte} ${Math.min(n, s.max)}/${s.max}`, valeur: Math.min(n, s.max) });
  });
  carnet.possede.forEach((id) => {
    const o = OBJETS[id];
    if (o.place && !estPorte(id)) return;
    Object.entries(o.bonus).forEach(([k, v]) => lignes[k].push({ cle: `objet:${id}`, texte: o.nom, valeur: v }));
  });
  return Object.fromEntries(STATS.map(({ cle }) => {
    const total = lignes[cle].reduce((a, l) => a + l.valeur, 0);
    return [cle, { valeur: Math.max(0, Math.min(10, total)), lignes: lignes[cle] }];
  }));
};
const valeurs = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => [k, v.valeur]));
const EFFET = {
  lumiere: (e) => `Fenêtre d’un top juste${NB}: ±${virgule(e.fenetre)}${NB}s à la générale`,
  video: (e) => `Conduite visible ${virgule(e.avance)}${NB}s à l’avance${e.repliquesVisibles ? ', tops appelés en pointillés' : ''}`,
  son: (e) => `«${FN}Attention${FN}» ${virgule(e.attention)}${NB}s avant un top appelé à l’inter`,
  sangfroid: (e) => (e.rateLeger ? 'Erreurs presque gratuites' : e.tropGratuit ? 'Tops imprécis, en trop et leurres gratuits' : e.imprecisGratuit ? 'Tops imprécis gratuits' : 'Chaque erreur coûte de l’énergie'),
  chance: (e) => `${Math.round(e.incident * 100)}${NB}% de risque d’incident par top`,
};

// ---------- Messages : des étiquettes en file, au-dessus de tout (popover) ----------
const toast = document.createElement('div');
toast.className = 'coulisses-toast';
toast.setAttribute('role', 'status');
const popover = typeof toast.showPopover === 'function';
if (popover) toast.setAttribute('popover', 'manual'); else toast.hidden = true;
document.body.append(toast);
const file = [];
let minuterieToast = null;
const montrerToast = () => {
  const suivant = file.shift();
  if (!suivant) {
    if (popover) { if (toast.matches(':popover-open')) toast.hidePopover(); } else toast.hidden = true;
    minuterieToast = null;
    return;
  }
  const [sprite, titre, detail] = suivant;
  const mini = document.createElement('span');
  mini.className = 'mini';
  mini.append(icone(sprite));
  const texte = document.createElement('span');
  const fort = document.createElement('strong');
  fort.textContent = titre;
  const fin = document.createElement('span');
  fin.textContent = detail;
  texte.append(fort, fin);
  toast.replaceChildren(mini, texte);
  // remis en tête de la couche supérieure, pour passer au-dessus d'une fenêtre ouverte entre-temps
  if (popover) { if (toast.matches(':popover-open')) toast.hidePopover(); toast.showPopover(); } else toast.hidden = false;
  minuterieToast = setTimeout(montrerToast, file.length ? 1600 : 3200);
};
const annoncer = (sprite, titre, detail = '') => {
  // un même message déjà en attente n'est pas répété
  if (!file.some(([, t, d]) => t === titre && d === detail)) file.push([sprite, titre, detail]);
  // sous une fenêtre modale, le message du site n'est pas lu : l'étagère le redit
  etagere?.dire(`${titre}. ${detail}`);
  if (!minuterieToast) montrerToast();
};

// ---------- Les cachettes : une ligne sur l'étiquette de chaque projet ----------
const cachettes = () => {
  objetsCaches.forEach((id) => {
    const o = OBJETS[id];
    const etiquette = plaque(o.plaque)?.querySelector('.etiquette-plaque');
    if (!etiquette) return;
    let el = etiquette.querySelector('.cachette');
    if (!el) { el = document.createElement('p'); el.className = 'cachette'; etiquette.append(el); }
    el.hidden = !carnet.allume;
    if (!carnet.allume) return; // éteinte ou effacée : le carnet peut être vide
    const a = carnet.possede.includes(id);
    const mini = document.createElement('span');
    mini.className = 'mini';
    mini.append(icone(a ? o.sprite : 'inconnu'));
    const texte = document.createElement('span');
    texte.textContent = a
      ? `${o.nom}, sur l’étagère${NB}: ${Object.entries(o.bonus).map(([k, v]) => `${signe(v)} ${NOMS[k]}`).join(', ')}.`
      : `Objet caché${NB}: ${vuesDe(o.plaque)}/${piecesDe(o.plaque).length} pièces vues.`;
    el.replaceChildren(mini, texte);
  });
};
// ramassage automatique : trouver l'objet, c'est déjà l'avoir mérité
const ramasser = () => {
  objetsCaches.forEach((id) => {
    if (carnet.possede.includes(id) || !trouve(id)) return;
    carnet.possede.push(id);
    const o = OBJETS[id];
    if (o.place && !carnet.porte[o.place]) carnet.porte[o.place] = id;
    annoncer(o.sprite, `Objet trouvé${NB}: ${o.nom}`, `${Object.entries(o.bonus).map(([k, v]) => `${signe(v)} ${NOMS[k]}`).join(', ')}. Posé sur l’étagère du régisseur.`);
  });
};

const reussi = (id) => (carnet.meilleur[id] ?? 0) >= seuil(NIVEAUX.find((n) => n.id === id));
const rang = () => {
  let g = 0;
  if (Object.values(carnet.meilleur).some((v) => v > 0)) g = 1;
  if (reussi('filage')) g = 2;
  if (reussi('generale')) g = 3;
  if (reussi('premiere') && objetsTrouves() === objetsCaches.length) g = 4;
  return g;
};
// ce qu'il faut pour le grade suivant, toujours écrit sur la fiche du régisseur
const prochainGrade = (g) => {
  const n = (id) => NIVEAUX.find((x) => x.id === id);
  const viser = (id) => `réussir ${n(id).nom.toLowerCase()} (${seuil(n(id))} tops justes sur ${n(id).tops.length})`;
  const conditions = [
    'envoyer un premier top juste',
    viser('filage'),
    viser('generale'),
    [!reussi('premiere') && viser('premiere'), objetsTrouves() < objetsCaches.length && `retrouver les objets cachés dans les projets (${objetsTrouves()}/${objetsCaches.length})`].filter(Boolean).join(', puis '),
  ];
  return g < GRADES.length - 1 ? `Prochain grade${NB}: ${GRADES[g + 1]}. Pour l’obtenir${NB}: ${conditions[g]}.` : 'Le plus haut grade de la régie.';
};
let gradeVu = null; // pour annoncer une montée en grade une seule fois

const lancer = async (niveau) => {
  const depuis = etagere;
  depuis?.chargement(niveau.id, true);
  try {
    const { jouer } = await import('./tops.js');
    // fermée, éteinte ou effacée pendant le chargement : la représentation n'a plus lieu
    if (!etagere || etagere !== depuis || !carnet.allume) return;
    etagere.alerte('');
    await jouer({
      niveau,
      effets: effets(valeurs(statistiques()), niveau),
      carnet,
      garder,
      porte: estPorte,
      conseil,
      echec: (texte) => { etagere?.reprendre(); etagere?.alerte(texte); },
      surOuverture: () => etagere?.suspendre(),
      allerA: (id) => {
        const cible = document.getElementById(id);
        focusApres = cible;
        etagere?.fermer();
        cible?.scrollIntoView({ behavior: mouvementReduit.matches ? 'instant' : 'smooth' });
      },
      surFin: (id) => {
        annoncerGains();
        etagere?.reprendre();
        rendreTout(`niveau:${id}`);
      },
    });
  } catch (e) {
    console.error('[coulisses]', e);
    etagere?.reprendre();
    etagere?.alerte('La régie n’a pas pu s’ouvrir. Réessayez dans un instant.');
  } finally {
    depuis?.chargement(niveau.id, false);
  }
};

// le conseil du régisseur, à la fin d'une représentation : la statistique qui manque, et où la gagner
const conseil = (bilan) => {
  const st = valeurs(statistiques());
  const premierAvec = (test) => objetsCaches.map((id) => OBJETS[id].plaque).find((p) => plaque(p) && test(p));
  const avecVideo = (p) => plaque(p).querySelector('video:not([data-boucle]), [data-yt]');
  let texte;
  let cible;
  if (bilan.leurre) {
    const video = st.video < 6;
    if (video) cible = premierAvec((p) => avecVideo(p) && !(carnet.faits.video || []).some((v) => plaque(p).innerHTML.includes(v)));
    texte = `Une fausse action vous a eu${NB}: attendez l’action appelée à l’inter, pas le premier mouvement.${video ? ' À Vidéo 6, les tops appelés apparaissent en pointillés sur la bande : regardez les teasers.' : ''}`;
  } else if (bilan.retardReplique >= 2 && st.son < 10) {
    cible = premierAvec((p) => avecVideo(p) && !(carnet.faits.son || []).some((v) => plaque(p).innerHTML.includes(v)));
    texte = 'Les tops appelés à l’inter vous prennent de court. Écoutez un teaser avec le son (Son +1) : l’« Attention » viendra plus tôt.';
  } else if (bilan.imprecisConduite >= 2 && st.lumiere < 10) {
    cible = premierAvec((p) => !(carnet.faits.salle || []).includes(p) && plaque(p).querySelector('img[data-grand]'));
    texte = 'Vos tops tombent à côté. Projetez en grand les œuvres d’un projet (Lumière +1) : la fenêtre s’élargit.';
  } else if (bilan.coupures) {
    cible = premierAvec((p) => !carnet.possede.includes(objetsCaches.find((id) => OBJETS[id].plaque === p)));
    texte = 'Le retour vidéo a lâché. Les objets cachés dans les projets donnent de la Chance et de la Vidéo.';
  } else if (objetsTrouves() < objetsCaches.length) {
    cible = premierAvec((p) => !carnet.possede.includes(objetsCaches.find((id) => OBJETS[id].plaque === p)));
    texte = 'Il reste des objets cachés : parcourez toutes les pièces d’un projet pour trouver le sien.';
  } else return null;
  return { texte, plaque: cible, titre: cible ? titreDe(cible) : '' };
};

// ---------- L'étagère du régisseur : ce qu'elle montre, ce qu'on y fait ----------
let etagere = null;
let ouverture = null;
let focusApres = null; // après « Voir le N° … » : le projet, plutôt que la servante
const JOURS = { filage: 'J−3', generale: 'J−1', premiere: 'Soir' };
const equiper = (id) => {
  const o = OBJETS[id];
  carnet.porte[o.place] = id;
  garder();
  const bonus = Object.entries(o.bonus).map(([k, v]) => `${signe(v)} ${NOMS[k]}`).join(', ');
  annoncer(o.sprite, `${o.nom}, équipé${o.f ? 'e' : ''}`, bonus || o.pouvoir);
  etagere?.equipe(id);
  majApres();
  rendreTout(`objet:${id}`);
};
const ranger = (id) => { delete carnet.porte[OBJETS[id].place]; garder(); majApres(); rendreTout(`objet:${id}`); };
const boire = () => {
  if (!carnet.doses || carnet.energie >= ENERGIE.max) return;
  carnet.doses -= 1;
  carnet.energie = Math.min(ENERGIE.max, carnet.energie + ENERGIE.cafe);
  garder();
  annoncer('thermos', 'Café de régie', `+${ENERGIE.cafe} énergie. Il reste ${carnet.doses} dose${carnet.doses > 1 ? 's' : ''}.`);
  rendreTout('action:boire');
};
// les actions d'un objet possédé, sur son étiquette
const actionsObjet = (id) => {
  const o = OBJETS[id];
  if (!o.place || !carnet.possede.includes(id)) return [];
  if (!estPorte(id)) return [{ cle: 'equiper', texte: 'Équiper', faire: () => equiper(id) }];
  return [{ cle: 'ranger', texte: 'Ranger', faire: () => ranger(id) }];
};
const etatEtagere = () => {
  const st = statistiques();
  const ef = effets(valeurs(st), NIVEAUX[1]);
  const g = rang();
  return {
    st,
    effet: Object.fromEntries(STATS.map((s) => [s.cle, EFFET[s.cle](ef)])),
    grade: g,
    prochain: prochainGrade(g),
    representations: Number(carnet.representations),
    energie: carnet.energie,
    doses: carnet.doses,
    trouves: objetsTrouves(),
    caches: objetsCaches.length,
    // la prochaine répétition à jouer : la première jouable pas encore réussie
    prochaine: (NIVEAUX.find((n, i) => (!NIVEAUX[i - 1] || reussi(NIVEAUX[i - 1].id)) && !reussi(n.id) && carnet.energie > 0) ?? null)?.id ?? null,
    niveaux: NIVEAUX.map((n, i) => {
      const precedent = NIVEAUX[i - 1];
      const ouvert = !precedent || reussi(precedent.id);
      const meilleur = carnet.meilleur[n.id];
      const etat = !ouvert
        ? `S’ouvre à ${seuil(precedent)} tops justes sur ${precedent.tops.length} (${precedent.nom.toLowerCase()})`
        : carnet.energie <= 0 ? `Trop fatigué${NB}: un café d’abord`
          : meilleur !== undefined ? `Meilleure conduite${NB}: ${meilleur}/${n.tops.length}${meilleur === n.tops.length ? ', parfaite' : ''}` : 'Jamais joué';
      return {
        id: n.id,
        nom: n.nom,
        resume: n.resume,
        seuil: `Réussi à ${seuil(n)} tops justes sur ${n.tops.length}.`,
        etat,
        jour: JOURS[n.id] ?? '',
        court: !ouvert ? 'fermée' : carnet.energie <= 0 ? 'café' : meilleur !== undefined ? `${meilleur}/${n.tops.length}` : 'à jouer',
        ouvert,
        reussi: reussi(n.id),
        jouable: ouvert && carnet.energie > 0,
        lu: `${n.nom}. ${n.resume} Réussi à ${seuil(n)} tops justes sur ${n.tops.length}. ${etat}.`,
      };
    }),
  };
};
const apiEtagere = () => ({
  carnet, garder, OBJETS, PLACES, STATS, NIVEAUX, GRADES, ENERGIE, seuil, NOMS, signe,
  etat: etatEtagere,
  estPorte,
  titreDe,
  progression: (id) => [vuesDe(OBJETS[id].plaque), piecesDe(OBJETS[id].plaque).length],
  rival: (id) => { const o = OBJETS[id]; return o.place && Object.keys(OBJETS).find((x) => x !== id && OBJETS[x].place === o.place && carnet.possede.includes(x)); },
  actionsObjet,
  actions: { boire, lancer, eteindre: () => eteindre(), effacer: () => toutEffacer() },
  surFermer: () => {
    etagere = null;
    const cible = focusApres;
    focusApres = null;
    if (cible) { cible.setAttribute('tabindex', '-1'); cible.focus({ preventScroll: true }); }
    else if (!document.querySelector('dialog.regie')) servante.focus();
  },
});

const rendreTout = (focus) => {
  const g = rang();
  if (gradeVu !== null && g > gradeVu) annoncer('servante', `Nouveau grade${NB}: ${GRADES[g]}`, prochainGrade(g));
  gradeVu = Math.max(gradeVu ?? g, g);
  cachettes();
  etagere?.rendre(focus);
};

// ---------- Ce que l'on gagne en parcourant le site ----------
let avant = null; // valeur de chaque source, pour annoncer la bonne
const sourcesActuelles = () => {
  const st = statistiques();
  const m = new Map();
  Object.entries(st).forEach(([stat, { lignes }]) => lignes.forEach((l) => m.set(`${stat}|${l.cle}`, { stat, ...l })));
  return m;
};
const majApres = () => { avant = sourcesActuelles(); };
const annoncerGains = () => {
  const maintenant = sourcesActuelles();
  maintenant.forEach((l, k) => {
    const gain = l.valeur - (avant?.get(k)?.valeur ?? 0);
    if (gain > 0 && !k.includes('|objet:')) annoncer('inconnu', `${signe(gain)} ${NOMS[l.stat]}`, l.texte);
  });
  avant = maintenant;
};
const surFait = () => {
  if (!carnet.allume) return;
  ramasser();
  annoncerGains();
  garder();
  rendreTout();
};

// ---------- Allumer, ouvrir, éteindre ----------
let installe = false;
let minuterieCafe = null;
let dernierTic = 0;
const cafetiere = () => {
  // la cafetière avance au temps réellement passé sur le site, page visible
  const maintenant = Date.now();
  const ecoule = document.hidden || !dernierTic ? 0 : Math.min(maintenant - dernierTic, 10000);
  dernierTic = maintenant;
  if (!carnet.allume || carnet.doses >= ENERGIE.doses) return;
  carnet.cafeCumul += ecoule;
  if (carnet.cafeCumul >= ENERGIE.recharge) {
    carnet.cafeCumul -= ENERGIE.recharge;
    carnet.doses += 1;
    garder();
    etagere?.rendre();
  }
};
const ADOPTES = ['porte', 'energie', 'doses', 'cafeCumul', 'choisi', 'visites', 'visitesComptees', 'derniere', 'regieVue', 'son'];
const fusionner = (e) => {
  if (e.key !== CARNET) return;
  // effacé dans un autre onglet : on oublie tout ici aussi, sans rien réécrire
  if (e.newValue === null) { oublier(); return; }
  try {
    const autre = JSON.parse(e.newValue);
    if (!autre || typeof autre !== 'object' || Array.isArray(autre)) return;
    // éteint dans un autre onglet : on éteint ici, sans rien réécrire
    if (autre.allume === false) { carnet.allume = false; arreter(); return; }
    // l'autre onglet vient d'écrire : son état est le plus récent ; seuls les faits, les objets et les records s'additionnent
    ADOPTES.forEach((k) => { if (k in autre) carnet[k] = autre[k]; else delete carnet[k]; });
    Object.entries(autre.faits || {}).forEach(([k, v]) => { if (Array.isArray(v)) carnet.faits[k] = [...new Set([...(carnet.faits[k] || []), ...v])]; });
    if (Array.isArray(autre.possede)) carnet.possede = [...new Set([...carnet.possede, ...autre.possede])];
    Object.entries(autre.meilleur || {}).forEach(([k, v]) => { carnet.meilleur[k] = Math.max(carnet.meilleur[k] ?? 0, Number(v) || 0); });
    carnet.representations = Math.max(carnet.representations, Number(autre.representations) || 0);
    normaliser();
    majApres();
    rendreTout();
  } catch (err) { console.error('[coulisses]', err); }
};

export const installer = () => {
  normaliser();
  // la servante a veillé pendant l'absence : café refait et repos
  if (carnet.absence && carnet.visitesComptees !== carnet.visites) {
    carnet.visitesComptees = carnet.visites;
    carnet.doses = ENERGIE.doses;
    carnet.energie = Math.min(ENERGIE.max, carnet.energie + 3);
    const min = Math.round(carnet.absence / 60000);
    const h = Math.round(min / 60);
    const duree = min < 90 ? `${min}${NB}min` : h < 48 ? `${h}${NB}h` : `${Math.round(h / 24)}${NB}jours`;
    carnet.veille = `Pendant votre absence, la servante a veillé ${duree} sur le plateau${NB}: café refait, +3 d’énergie.`;
  }
  ramasser();
  garder();
  if (!installe) {
    installe = true;
    avant = sourcesActuelles();
    gradeVu = rang();
    document.addEventListener('coulisses:fait', surFait);
    addEventListener('storage', fusionner);
    dernierTic = Date.now();
    minuterieCafe = setInterval(cafetiere, 5000);
    // la régie se charge en avance, quand la page est au repos : la première représentation part sans attendre
    (window.requestIdleCallback ?? setTimeout)(() => import('./tops.js').catch(() => {}));
  }
  cachettes();
};

export const ouvrir = async () => {
  if (!carnet.allume) {
    carnet.allume = true;
    carnet.v = VERSION;
    garder();
    servante.setAttribute('aria-pressed', 'true');
    if (!mouvementReduit.matches) { servante.classList.remove('allumage'); void servante.offsetWidth; servante.classList.add('allumage'); }
    annoncer('servante', 'Servante allumée.', 'Les coulisses sont ouvertes : la régie vous attend.');
  }
  installer();
  if (etagere || ouverture) return;
  servante.setAttribute('aria-busy', 'true');
  try {
    ouverture = creerEtagere(apiEtagere());
    etagere = await ouverture;
    etagere.ouvrir({ veille: carnet.veille || '', alerte: window.coulisses.nonGarde ? 'Votre navigateur refuse de garder la progression : elle sera perdue en quittant la page.' : '' });
    delete carnet.veille;
    garder();
  } catch (e) {
    console.error('[coulisses]', e);
    etagere?.fermer();
    etagere = null;
    annoncer('servante', 'L’étagère n’a pas pu s’ouvrir', 'Réessayez dans un instant.');
    return;
  } finally {
    ouverture = null;
    servante.removeAttribute('aria-busy');
  }
  // le message passe au-dessus de l'étagère qui vient de s'ouvrir
  if (minuterieToast && popover && toast.matches(':popover-open')) { toast.hidePopover(); toast.showPopover(); }
};

const ecrire = () => { try { localStorage.setItem(CARNET, JSON.stringify(carnet)); } catch (e) { /* rien à faire */ } };
// la servante s'éteint (ici ou dans un autre onglet) : plus de cafetière ni d'écouteurs
const arreter = () => {
  clearInterval(minuterieCafe);
  minuterieCafe = null;
  installe = false;
  gradeVu = null;
  document.removeEventListener('coulisses:fait', surFait);
  removeEventListener('storage', fusionner);
  servante.setAttribute('aria-pressed', 'false');
  cachettes();
  etagere?.fermer();
};
const eteindre = () => {
  carnet.allume = false;
  ecrire();
  etagere?.fermer({ eteindre: true });
  arreter();
};
// tout oublier : l'étagère se ferme d'abord, puis le carnet se vide
const oublier = () => {
  etagere?.fermer();
  Object.keys(carnet).forEach((k) => delete carnet[k]);
  carnet.faits = {};
  arreter();
  document.querySelectorAll('.cachette').forEach((c) => c.remove());
};
const toutEffacer = () => {
  try { localStorage.removeItem(CARNET); } catch (e) { /* rien à faire */ }
  oublier();
};
