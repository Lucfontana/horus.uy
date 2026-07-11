// ---------- Hamburger menu ----------
const navToggle = document.getElementById('nav-toggle');
const navClose = document.getElementById('nav-close');
const nav = document.getElementById('nav');
const navOverlay = document.getElementById('nav-overlay');

function closeNav() {
  nav.classList.remove('is-open');
  navOverlay.classList.remove('is-active');
  navToggle.setAttribute('aria-expanded', 'false');
}

function toggleNav() {
  const isOpen = nav.classList.toggle('is-open');
  navOverlay.classList.toggle('is-active', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
}

navToggle.addEventListener('click', toggleNav);
navClose.addEventListener('click', closeNav);
navOverlay.addEventListener('click', closeNav);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeNav);
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 700) closeNav();
});

// ---------- Header background on scroll ----------
const header = document.getElementById('site-header');

function updateHeader() {
  header.classList.toggle('is-scrolled', window.scrollY > 40);
}
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

// ---------- Scroll-reveal ----------
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}



// CARRUSEL

let dataCarrusel = {
  resenas: [
    {
      title: "Envío rápido",
      content: "Pedí un conjunto y llegó en menos de 48 horas. Todo perfecto y bien embalado.",
      author: "- Martín G."
    },
    {
      title: "Excelente calidad",
      content: "El producto es de excelente calidad y me ha servido muy bien.",
      author: "- Valentina R."
    },
    {
      title: "Atención personalizada",
      content: "Tuve una duda con el talle y el asistente me ayudó al instante. Muy buena experiencia de compra.",
      author: "- Camila F."
    },
    {
      title: "Excelente calidad",
      content: "El producto es de excelente calidad y me ha servido muy bien.",
      author: "- Carlos P."
    },
  ]
}

currentIndex = 0;

let navReviews = document.getElementById('nav_reviews');

function fillNavReviews(dataCarrusel, navReviews){
  let largo = dataCarrusel.resenas.length;

  for(let i = 0; i < largo; i++){
    let dot = document.createElement('div');
    dot.innerHTML = ".";
    dot.id = i;
    dot.classList.add('dot');
    navReviews.appendChild(dot);
  }
}

function updateCarrusel(dataCarrusel, item){
  let buttonPrev = document.getElementById('prev');
  let buttonNext = document.getElementById('next');

  let container = document.querySelector('.review-card');
  container.id = item;

  let title = document.getElementById('title-review');
  let content = document.getElementById('content-review');
  let author = document.querySelector('.review-card__author');
  currentIndex = item;
  
  if (item === 0){
    buttonPrev.disabled = true;
  } else {
    buttonPrev.disabled = false;
  }
  if (item === dataCarrusel.resenas.length - 1){
    buttonNext.disabled = true;
  } else {
    buttonNext.disabled = false;
  }

  title.textContent = dataCarrusel.resenas[item].title;
  content.textContent = dataCarrusel.resenas[item].content;
  author.textContent = dataCarrusel.resenas[item].author;

}

let buttonPrev = document.getElementById('prev');
let buttonNext = document.getElementById('next');

buttonPrev.addEventListener('click', () => {
  updateCarrusel(dataCarrusel, currentIndex - 1);
});
buttonNext.addEventListener('click', () => {
  updateCarrusel(dataCarrusel, currentIndex + 1);
});

fillNavReviews(dataCarrusel, navReviews);

//Actualizar las reseñas según botoncito apretado
navReviews.addEventListener('click', (event) => {
  if (event.target.classList.contains('dot')) {
    updateCarrusel(dataCarrusel, event.target.id);
  }
});
          // <article class="review-card">
          //   <h3>Envío rápido</h3>
          //   <p>
          //     Pedí un conjunto y llegó en menos de 48 horas. Todo perfecto y bien
          //     embalado.
          //   </p>
          //   <p class="review-card__author">— Martín G.</p>
          // </article>