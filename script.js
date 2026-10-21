// Agrandissement des images
const box = document.getElementById('lightbox');
const boxImg = box.querySelector('img');
document.querySelectorAll('a.zoom').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const img = a.querySelector('img');
    boxImg.src = a.href;
    boxImg.alt = img ? img.alt : '';
    box.showModal();
  });
});
box.addEventListener('click', () => box.close());

// Vidéo YouTube chargée seulement au clic (pas de traceurs avant lecture)
document.querySelectorAll('button.yt').forEach((btn) => {
  btn.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1`;
    iframe.title = btn.getAttribute('aria-label');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    btn.replaceChildren(iframe);
    btn.removeAttribute('aria-label');
  });
});

document.getElementById('y').textContent = new Date().getFullYear();
