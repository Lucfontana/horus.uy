// CARRUSEL
//Datos hardcodeados de reseñas actuales, podrían ser un fetch a la BD más adelante
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

let currentIndex = 0;
let isAnimating = false; //Sirve para bloquear clicks mientras se ejecuta la animación
const ANIMATION_DURATION = 400; // ms — debe coincidir con la transición del CSS (.review-slide)

let navReviews = document.getElementById('nav_reviews');
let reviewViewport = document.getElementById('review-viewport');
let buttonPrev = document.getElementById('prev');
let buttonNext = document.getElementById('next');

//Crea los puntitos de la navegación para moverse entre las reseñas dinamicamente
function fillNavReviews(dataCarrusel, navReviews){
  let largo = dataCarrusel.resenas.length;

  for(let i = 0; i < largo; i++){
    //Por cada indice de dataCarrusel, crea un puntito para naveghar entre las reseñas
    let dot = document.createElement('div');
    dot.innerHTML = ".";
    dot.id = `${i}dot`;
    dot.classList.add('dot');
    navReviews.appendChild(dot);
  }
}

// Arma el HTML interno de una tarjeta a partir de los datos de una reseña
function crearContenidoCard(resena) {
  return `
    <h3 class="review-card__title">${resena.title}</h3>
    <p class="review-card__content">${resena.content}</p>
    <p class="review-card__author">${resena.author}</p>
  `;
}

// Mide la reseña más alta y fija esa altura en el viewport, para que ninguna
// reseña quede recortada por el overflow:hidden ni el carrusel "salte" de alto
function ajustarAlturaViewport() {
  const medidor = document.createElement('article');
  medidor.className = 'review-card'; //adjunta la clase de los contenedores de las reseñas normales para que herede el espaciado (padding, margin) y asi lograr medir bien
  medidor.style.position = 'absolute'; //Permite poder adjuntarlo luego al reviewViewport sin que desacomode cosas
  medidor.style.visibility = 'hidden';
  medidor.style.pointerEvents = 'none';
  medidor.style.top = '0';
  medidor.style.left = '0';
  medidor.style.height = 'auto'; // pisa el height:100% para medir el alto real de contenido
  reviewViewport.appendChild(medidor);

  let maxAltura = 0;
  dataCarrusel.resenas.forEach(resena => {
    medidor.innerHTML = crearContenidoCard(resena);
    maxAltura = Math.max(maxAltura, medidor.offsetHeight); //Busca la altura de tarjeta maxima
  });

  reviewViewport.removeChild(medidor); //Se lo borra porque ya cumplio su funcion
  reviewViewport.style.minHeight = `${maxAltura}px`;
}

//Habilita/deshabilita los botones prev/next según la posición
//Se pasaron a una funcion para evitar repetición de codigo
function actualizarBotones(item) {
  const esPrimero = item === 0;
  const esUltimo = item === dataCarrusel.resenas.length - 1;

  buttonPrev.disabled = esPrimero;
  buttonPrev.classList.toggle('disabilitado', esPrimero);

  buttonNext.disabled = esUltimo;
  buttonNext.classList.toggle('disabilitado', esUltimo);
}

//Marca el dot activo
//Se pasaron a una funcion para evitar repetición de codigo
function actualizarDots(item) {
  document.querySelectorAll('.dot').forEach(dot => dot.classList.remove('active'));
  document.getElementById(`${item}dot`).classList.add('active');
}

// Pinta el estado inicial, sin animación
function renderInicial(item) {
  const card = reviewViewport.querySelector('.review-card');
  card.innerHTML = crearContenidoCard(dataCarrusel.resenas[item]);
  currentIndex = item;
  actualizarBotones(item);
  actualizarDots(item);
}

// Cambia de reseña con animación de deslizamiento horizontal
function updateCarrusel(dataCarrusel, item) {
  item = Number(item);

  // Bloquea si ya hay una animación en curso, si es la misma reseña, o si está fuera de rango
  if (isAnimating || item === currentIndex || item < 0 || item > dataCarrusel.resenas.length - 1) {
    return;
  }

  // next -> avanza, desliza hacia la izquierda | prev -> retrocede, desliza hacia la derecha
  const direction = item > currentIndex ? 'next' : 'prev';
  isAnimating = true;

  const slideActual = reviewViewport.querySelector('.review-slide');

  // Arma el slide entrante, ya con el contenido de destino, posicionado fuera de vista
  const slideNuevo = document.createElement('div');
  slideNuevo.classList.add('review-slide', direction === 'next' ? 'review-slide--enter-next' : 'review-slide--enter-prev');

  const cardNuevo = document.createElement('article');
  cardNuevo.className = 'review-card';
  cardNuevo.innerHTML = crearContenidoCard(dataCarrusel.resenas[item]);
  slideNuevo.appendChild(cardNuevo);

  reviewViewport.appendChild(slideNuevo);

  // Fuerza al navegador a registrar la posición inicial antes de animar.
  // El navegador de por si deja muchos valores para calcular luego, pero el offsetWidth
  // lo fuerza a que termine esas tareas ahora asi nos devuelve un valor real.

  // void no hace nada aca, solo sirve para indicar que no queremos un valor aca, si no que solamente se fuercen calculos
  void slideNuevo.offsetWidth;

  // Dispara la animación: la tarjeta actual sale, la nueva entra al centro
  slideActual.classList.add(direction === 'next' ? 'review-slide--exit-next' : 'review-slide--exit-prev');
  slideNuevo.classList.remove('review-slide--enter-next', 'review-slide--enter-prev');
  slideNuevo.classList.add('review-slide--center');

  currentIndex = item;
  actualizarBotones(item);
  actualizarDots(item);

  // Cuando termina la transición, saca del DOM la tarjeta anterior
  //Acabo de usar recursion????????????????
  const finalizarAnimacion = () => {
    slideActual.removeEventListener('transitionend', finalizarAnimacion);
    if (slideActual.parentNode === reviewViewport) {
      reviewViewport.removeChild(slideActual);
    }
    isAnimating = false;
  };

  slideActual.addEventListener('transitionend', finalizarAnimacion);

  // Salvavidas por si transitionend no llega a dispararse (ej. pestaña en 2do plano)
  setTimeout(() => {
    if (slideActual.parentNode === reviewViewport) {
      finalizarAnimacion();
    }
  }, ANIMATION_DURATION + 100);
}

// Inicialización
fillNavReviews(dataCarrusel, navReviews);
ajustarAlturaViewport();
renderInicial(0);

// Recalcula la altura si cambia el ancho del viewport (responsive)
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(ajustarAlturaViewport, 200);
});

//Event listeners para los botones prev y next
buttonPrev.addEventListener('click', () => {
  updateCarrusel(dataCarrusel, currentIndex - 1);
});
buttonNext.addEventListener('click', () => {
  updateCarrusel(dataCarrusel, currentIndex + 1);
});

//Actualizar las reseñas según botoncito apretado
navReviews.addEventListener('click', (event) => {
  if (event.target.classList.contains('dot')) {
    const indice = event.target.id.replace('dot', '');
    updateCarrusel(dataCarrusel, indice);
  }
});