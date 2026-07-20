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

