// Portfolio de Pierre Weill — séance de lanterne magique
document.documentElement.classList.add('js');

const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- Séance : fondu enchaîné entre les plaques du premier écran ----------
const seance = document.querySelector('[data-seance]');
if (seance) {
  const vues = [...seance.querySelectorAll('.vue')];
  const commandes = seance.querySelector('.commandes');
  const boutonPause = seance.querySelector('[data-pause]');
  const textePause = seance.querySelector('[data-pause-texte]');
  const compteur = seance.querySelector('[data-compteur]');
  const legende = document.querySelector('[data-legende-lien]');
  const DUREE = 6500;
  let courante = 0;
  let minuterie = null;
  let enPause = mouvementReduit.matches;

  const lireVideo = (vue, oui) => {
    const video = vue.querySelector('video');
    if (!video) return;
    if (oui && !mouvementReduit.matches) video.play().catch(() => {});
    else video.pause();
  };

  const montrer = (i) => {
    const ancienne = vues[courante];
    courante = (i + vues.length) % vues.length;
    const vue = vues[courante];
    ancienne.classList.remove('est-active');
    vue.classList.add('est-active');
    lireVideo(ancienne, false);
    lireVideo(vue, !enPause);
    compteur.textContent = `${courante + 1} / ${vues.length}`;
    legende.textContent = vue.dataset.legende;
    legende.href = vue.dataset.lien;
  };

  const arreter = () => { clearInterval(minuterie); minuterie = null; };
  const relancer = () => {
    arreter();
    if (!enPause) minuterie = setInterval(() => montrer(courante + 1), DUREE);
  };
  const basculerPause = (pause) => {
    enPause = pause;
    boutonPause.setAttribute('aria-pressed', String(pause));
    textePause.textContent = pause ? 'Reprendre le défilement' : 'Arrêter le défilement';
    lireVideo(vues[courante], !pause);
    relancer();
  };

  commandes.hidden = false;
  seance.querySelector('[data-prec]').addEventListener('click', () => { montrer(courante - 1); relancer(); });
  seance.querySelector('[data-suiv]').addEventListener('click', () => { montrer(courante + 1); relancer(); });
  boutonPause.addEventListener('click', () => basculerPause(!enPause));
  document.addEventListener('visibilitychange', () => (document.hidden ? arreter() : relancer()));

  basculerPause(enPause);
}

// ---------- Plaques : changement de plaque dans le passe-vues ----------
const changer = (sortante, entrante, sens) => {
  sortante.classList.remove('est-active');
  entrante.classList.add('est-active');
  const video = sortante.querySelector('video');
  if (video) video.pause();
  if (mouvementReduit.matches || !entrante.animate) return;
  const d = 18 * sens;
  sortante.style.visibility = 'visible';
  sortante.animate(
    [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${-d}%)`, opacity: 0 }],
    { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  ).finished.then(() => { sortante.style.visibility = ''; });
  entrante.animate(
    [{ transform: `translateX(${d}%)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
    { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
  );
};

document.querySelectorAll('[data-projecteur]').forEach((ecran) => {
  const pieces = [...ecran.querySelectorAll('.piece')];
  const boutons = [...ecran.closest('.plaque').querySelectorAll('.vignette')];
  pieces.forEach((p) => {
    const legende = p.querySelector('figcaption');
    if (!legende) return;
    const texte = document.createElement('span');
    texte.className = 'legende-texte';
    texte.append(...legende.childNodes);
    legende.append(texte);
  });
  let courante = 0;

  // Bouton « projeter en grand », placé dans la légende de l'œuvre projetée
  const agrandir = document.createElement('button');
  agrandir.type = 'button';
  agrandir.className = 'commande agrandir';
  agrandir.innerHTML = '<svg><use href="#i-agrandir"/></svg><span class="lecteur">Projeter en grand</span>';
  const majAgrandir = () => {
    const piece = pieces[courante];
    agrandir.hidden = !piece.querySelector('img[data-grand]');
    piece.querySelector('figcaption')?.append(agrandir);
  };

  const projeter = (i) => {
    if (i === courante) return;
    changer(pieces[courante], pieces[i], i > courante ? 1 : -1);
    boutons[courante]?.setAttribute('aria-pressed', 'false');
    boutons[i]?.setAttribute('aria-pressed', 'true');
    courante = i;
    majAgrandir();
    ecran.closest('.plaque').dispatchEvent(new Event('plaque:change'));
  };
  boutons.forEach((b, i) => b.addEventListener('click', () => projeter(i)));
  majAgrandir();
  agrandir.addEventListener('click', () => ouvrirSalle(pieces, courante, projeter, agrandir));
});

// ---------- Étiquettes : jamais plus larges que l'œuvre projetée ----------
document.querySelectorAll('.plaque').forEach((plaque) => {
  const mesurer = () => {
    const media = plaque.querySelector('.piece.est-active :is(img, video, .yt-cadre)');
    const largeur = media ? Math.round(media.getBoundingClientRect().width) : 0;
    // image pas encore chargée (chargement différé) : l'étiquette garde la largeur de l'écran
    if (largeur > 120) plaque.style.setProperty('--largeur-oeuvre', `${largeur}px`);
    else plaque.style.removeProperty('--largeur-oeuvre');
  };
  const observateur = new ResizeObserver(mesurer);
  plaque.querySelectorAll('.piece :is(img, video, .yt-cadre)').forEach((m) => observateur.observe(m));
  plaque.addEventListener('plaque:change', mesurer);
});

// ---------- La salle : projection en grand, la salle s'éteint ----------
const salle = document.querySelector('.salle');
const salleFigure = salle.querySelector('.salle-figure');
const salleLegende = salle.querySelector('figcaption');
const salleImage = document.createElement('img');
salleFigure.prepend(salleImage);
let salleEtat = null;

const montrerDansSalle = (i) => {
  const { pieces } = salleEtat;
  const n = pieces.length;
  // on saute les pièces sans version grande (vidéos, YouTube)
  for (let k = 0; k < n; k++) {
    const j = (i + k * salleEtat.sens + n * n) % n;
    const img = pieces[j].querySelector('img[data-grand]');
    if (img) {
      salleEtat.i = j;
      salleImage.src = img.dataset.grand;
      salleImage.alt = img.alt;
      salleLegende.textContent = pieces[j].querySelector('.legende-texte')?.textContent ?? '';
      salleEtat.projeter(j);
      return;
    }
  }
};

function ouvrirSalle(pieces, i, projeter, retour) {
  salleEtat = { pieces, i, projeter, retour, sens: 1 };
  const plusieurs = pieces.filter((p) => p.querySelector('img[data-grand]')).length > 1;
  salle.querySelector('[data-salle-prec]').hidden = !plusieurs;
  salle.querySelector('[data-salle-suiv]').hidden = !plusieurs;
  montrerDansSalle(i);
  salle.showModal();
}
const naviguerSalle = (sens) => { salleEtat.sens = sens; montrerDansSalle(salleEtat.i + sens); };
salle.querySelector('[data-salle-prec]').addEventListener('click', () => naviguerSalle(-1));
salle.querySelector('[data-salle-suiv]').addEventListener('click', () => naviguerSalle(1));
salle.querySelector('[data-salle-fermer]').addEventListener('click', () => salle.close());
salle.addEventListener('click', (e) => { if (e.target === salle) salle.close(); });
salle.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') naviguerSalle(-1);
  if (e.key === 'ArrowRight') naviguerSalle(1);
});
salle.addEventListener('close', () => salleEtat?.retour.focus());

// ---------- YouTube chargé seulement au clic (pas de traceurs avant lecture) ----------
document.querySelectorAll('button.yt').forEach((btn) => {
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1`;
    iframe.title = 'Teaser de La Fresque (YouTube)';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    btn.replaceWith(iframe);
    iframe.focus();
  });
});

document.querySelector('[data-annee]').textContent = new Date().getFullYear();
