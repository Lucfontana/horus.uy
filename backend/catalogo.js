document.addEventListener('DOMContentLoaded', function () {

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

    toggle.addEventListener('click', function () {
      let expanded = toggle.getAttribute('aria-expanded') === 'false';
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel.classList.toggle('is-collapsed', expanded);
    });
  });

  /* ============================================================
     Swatches de color (multi-selección)
     ============================================================ */
  document.querySelectorAll('[data-swatch-toggle]').forEach(function (swatch) {
    swatch.addEventListener('click', function () {
      swatch.classList.toggle('is-selected');
    });
  });

  /* ============================================================
     Chips de talle (multi-selección)
     ============================================================ */
  document.querySelectorAll('[data-chip-toggle]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      chip.classList.toggle('is-selected');
    });
  });

  /* ============================================================
     Rango de precio (doble slider + inputs numéricos)
     ============================================================ */
  var priceRange = document.getElementById('price-range');
  if (priceRange) {
    var minSlider = document.getElementById('price-min');
    var maxSlider = document.getElementById('price-max');
    var minInput = document.getElementById('price-min-input');
    var maxInput = document.getElementById('price-max-input');
    var minLabel = document.getElementById('price-min-label');
    var maxLabel = document.getElementById('price-max-label');
    var fillActive = document.getElementById('price-fill-active');

    var bounds = { min: Number(minSlider.min), max: Number(minSlider.max) };
    var minGap = 50;

    function formatPrice(value) {
      return '$' + Number(value).toLocaleString('es-UY');
    }

    function updateFill() {
      var minVal = Number(minSlider.value);
      var maxVal = Number(maxSlider.value);
      var range = bounds.max - bounds.min;
      var leftPct = ((minVal - bounds.min) / range) * 100;
      var rightPct = ((maxVal - bounds.min) / range) * 100;
      fillActive.style.left = leftPct + '%';
      fillActive.style.width = (rightPct - leftPct) + '%';
    }

    function syncFromSliders() {
      var minVal = Number(minSlider.value);
      var maxVal = Number(maxSlider.value);

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
      var minVal = Math.min(Math.max(Number(minInput.value) || bounds.min, bounds.min), bounds.max);
      var maxVal = Math.min(Math.max(Number(maxInput.value) || bounds.max, bounds.min), bounds.max);

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
    minInput.addEventListener('change', function () { syncFromInputs('min'); });
    maxInput.addEventListener('change', function () { syncFromInputs('max'); });

    updateFill();
  }

  /* ============================================================
     Cargar más productos
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