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

currentIndex = 0;


let navReviews = document.getElementById('nav_reviews');

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

//Se rellena automaticamente al iniciar la página
fillNavReviews(dataCarrusel, navReviews); 
updateCarrusel(dataCarrusel, 0);

//Actualiza la información del carrusel
function updateCarrusel(dataCarrusel, item){

  //Se traen los elementos del index a modificar
  let buttonPrev = document.getElementById('prev');
  let buttonNext = document.getElementById('next');

  let container = document.querySelector('.review-card');
  container.id = item;

  let title = document.getElementById('title-review');
  let content = document.getElementById('content-review');
  let author = document.querySelector('.review-card__author');
  currentIndex = item;
  
  //Deshabilita/habilita los botones prev/next segun la posicion
  if (item === 0){
    buttonPrev.disabled = true;
    buttonPrev.classList.add("disabilitado");
  } else {
    buttonPrev.disabled = false;
    buttonPrev.classList.remove("disabilitado");
  }

  if (item === dataCarrusel.resenas.length - 1){
    buttonNext.disabled = true;
    buttonNext.classList.add("disabilitado");
  } else {
    buttonNext.disabled = false;
    buttonNext.classList.remove("disabilitado");
  }

  //Le saca la clase .active a todos los dot
  document.querySelectorAll('.dot').forEach(dot => dot.classList.remove('active'));

  //Trae el elemento actual (lo trae segun el item actual) y se le añade la clase active
  document.getElementById(`${item}dot`).classList.add('active');

  //Actualiza contenido
  title.textContent = dataCarrusel.resenas[item].title;
  content.textContent = dataCarrusel.resenas[item].content;
  author.textContent = dataCarrusel.resenas[item].author;

}

let buttonPrev = document.getElementById('prev');
let buttonNext = document.getElementById('next');

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
    updateCarrusel(dataCarrusel, event.target.id);
  }
});
