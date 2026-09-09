import {fetch_products} from "../backend/load_products.js";

document.addEventListener('DOMContentLoaded', async function () {

  /* ============================================================
     Acordeón de filtros
     ============================================================ */
  let groups = document.querySelectorAll('[data-filter-group]');

  /* Formatea los grupos de categorias: 
     Si no tiene botón de toggle o panel de categoría, lo saltea */
  groups.forEach(function (group) {
    const toggle = group.querySelector('.filter-group__toggle');
    const panel = group.querySelector('.filter-group__panel');
    if (!toggle || !panel) return;

    /*Establece "expanded" como false al cargar el DOM para que los
      filtros estén cerrados y no abiertos. Luego según se le hace click,
      se cambia tanto su atributo de si está expandido (boolean) y se le
      hace toggle a su clase de is-collapsed (indica si está colapsado o no)*/
    toggle.addEventListener('click', function () {
      let expanded = toggle.getAttribute('aria-expanded') === 'false';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel.classList.toggle('is-collapsed', expanded);
    });
  });

  let bounds = await calcMinMaxPrice()
  setBoundsValues(bounds)

  /* ============================================================
     Rango de precio (doble slider + inputs numéricos)
     ============================================================ */
async function calcMinMaxPrice(){
  let productos = await fetch_products()

  if (!productos) return;
  
  let productos_formateados = Object.values(productos.items)

  let array_prices = []
  productos_formateados.forEach((producto) => {
    let precio_unitario = producto.price;
    array_prices.push(precio_unitario)
  })
  console.log(`Precios individuales: ${array_prices}`)

  //Busca el numero más pequeño, comparando valor por valor
  //acc mantiene el número más pequeño, val va iterando por los otros
  let minPrice = array_prices.reduce((acc, val) => Math.min(acc, val));
  let maxPrice = array_prices.reduce((acc, val) => Math.max(acc, val));

  //TODO: DENTRO DE ESTA FUNCION, ACTUALIZAR LOS VALUE DE PRECIO
  console.log(`Min: ${minPrice}, max: ${maxPrice}`)
  return {min: minPrice, max: maxPrice}
}

function setBoundsValues(bounds){
  const minSlider = document.getElementById('price-min');
  const maxSlider = document.getElementById('price-max');

  const minInput = document.getElementById('price-min-input');
  const maxInput = document.getElementById('price-max-input');

  const minLabel = document.getElementById('price-min-label');
  const maxLabel = document.getElementById('price-max-label');
  
  minSlider.min = bounds.min;
  minSlider.max = bounds.max;
  minSlider.value = bounds.min;

  maxSlider.min = bounds.min + 50;
  maxSlider.max = bounds.max;
  maxSlider.value = bounds.max;

  minInput.value = bounds.min;
  minInput.min = bounds.min;
  minInput.max = bounds.max;

  maxInput.value = bounds.max;
  maxInput.min = bounds.min;
  maxInput.max = bounds.max;

  minLabel.textContent = `$${bounds.min}`
  maxLabel.textContent = `$${bounds.max}`;
  
}

async function initPriceRange() {
  const priceRange = document.getElementById('price-range');
  if (!priceRange) return;

  const minSlider = document.getElementById('price-min');
  const maxSlider = document.getElementById('price-max');
  const minInput = document.getElementById('price-min-input');
  const maxInput = document.getElementById('price-max-input');
  const minLabel = document.getElementById('price-min-label');
  const maxLabel = document.getElementById('price-max-label');
  const fillActive = document.getElementById('price-fill-active');

  const bounds = await calcMinMaxPrice();
  if (!bounds) return;

  console.log("Estos son los bounds lel", bounds);

  setBoundsValues()

  const minGap = 50;
  let minVal = Number(minSlider.value);
  let maxVal = Number(maxSlider.value);

  function formatPrice(value) {
    return '$' + Number(value).toLocaleString('es-UY');
  }

  function getSliderValues() {
    return { minVal: Number(minSlider.value), maxVal: Number(maxSlider.value) };
  }

  function getInputValues() {
    return { minVal: Number(minInput.value), maxVal: Number(maxInput.value) };
  }

  function updateFill() {
    let range = bounds.max - bounds.min;
    let leftPct = ((minVal - bounds.min) / range) * 100;
    let rightPct = ((maxVal - bounds.min) / range) * 100;
    fillActive.style.left = leftPct + '%';
    fillActive.style.width = (rightPct - leftPct) + '%';
  }

  function syncFromSliders() {
    ({ minVal, maxVal } = getSliderValues());

    if (minVal > maxVal - minGap) {
      minVal = maxVal - minGap;
      minSlider.value = minVal;
    }

    minLabel.textContent = formatPrice(minVal);
    maxLabel.textContent = formatPrice(maxVal);
    minInput.value = minVal;
    maxInput.value = maxVal;
    updateFill();
  }

  function syncFromInputs(source) {
    ({ minVal, maxVal } = getInputValues());

    if (minVal < bounds.min) minVal = bounds.min;
    if (maxVal > bounds.max) maxVal = bounds.max; 

    if (minVal > maxVal - minGap) {
      if (source === 'min') {
        minVal = maxVal - minGap;
      } else {
        maxVal = minVal + minGap;
      }
    }

    minSlider.value = minVal;
    maxSlider.value = maxVal;
    minInput.value = minVal;
    maxInput.value = maxVal;
    minLabel.textContent = formatPrice(minVal);
    maxLabel.textContent = formatPrice(maxVal);
    updateFill();
  }

  minSlider.addEventListener('input', syncFromSliders);
  maxSlider.addEventListener('input', syncFromSliders);
  minInput.addEventListener('input', () => syncFromInputs('min'));
  maxInput.addEventListener('input', () => syncFromInputs('max'));

  updateFill();
}

initPriceRange();
    /* ============================================================
     Cargar más productos (Por ahora codigo en desuso)
     ============================================================ */
  var loadMoreBtn = document.getElementById('btn-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      var hiddenCards = document.querySelectorAll('[data-extra-card].is-hidden');
      hiddenCards.forEach(function (card) {
        card.classList.remove('is-hidden');
      });
      loadMoreBtn.setAttribute('hidden', '');
    });
  }

});