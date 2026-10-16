const API_BASE_URL = "/api/products";
const MASTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const COLOR_SWATCHES = {
  negro: "#1a1a1a", blanco: "#f5f5f0", beige: "#d8c9a8", camel: "#b98d54",
  verde: "#4a5c45", azul: "#33475b", bordo: "#6b2737", gris: "#8a8a86"
};

// GET /api/products/:id returns a product, optionally wrapped in data or items[id].
export async function fetchProduct(id) {
  const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(id)}`);
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (!text.trim()) return null;
  const payload = JSON.parse(text);
  const product = payload?.items ? payload.items[id] : payload?.data ?? payload;
  if (!product || typeof product !== "object" || Array.isArray(product) || !product.name) return null;
  return product;
}

function initGallery(product) {
  const mainImage = document.getElementById("product-image");
  const thumbnails = document.getElementById("product-thumbnails");
  thumbnails.replaceChildren();
  [product.imgSrc, product.imgSrcHover].forEach((source, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-thumbnail";
    button.setAttribute("aria-label", `Ver imagen ${index + 1} de 2`);
    const image = document.createElement("img");
    image.src = source;
    image.alt = product.alt || product.name;
    button.append(image);
    function selectImage() {
      mainImage.src = source;
      mainImage.alt = image.alt;
      [...thumbnails.children].forEach(thumbnail => thumbnail.setAttribute("aria-pressed", String(thumbnail === button)));
    }
    button.addEventListener("click", selectImage);
    thumbnails.append(button);
    if (index === 0) selectImage();
    else button.setAttribute("aria-pressed", "false");
  });
}

function initRadioGroup(container, values, availableValues, createButton, onSelect) {
  container.replaceChildren();
  const buttons = values.map(value => {
    const button = createButton(value);
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", "false");
    button.tabIndex = -1;
    const available = availableValues.includes(value);
    if (!available) {
      button.setAttribute("aria-disabled", "true");
      button.title = "Sin stock";
      button.setAttribute("aria-label", `${value}: Sin stock`);
    }
    button.addEventListener("click", () => {
      if (available) select(button, value);
    });
    button.addEventListener("keydown", event => {
      const directions = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in directions) && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const enabled = buttons.filter(item => item.getAttribute("aria-disabled") !== "true");
      if (!enabled.length) return;
      const position = enabled.indexOf(button);
      const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1)
        : enabled[(position + directions[event.key] + enabled.length) % enabled.length];
      next.focus();
      next.click();
    });
    container.append(button);
    return button;
  });
  function select(button, value) {
    buttons.forEach(item => {
      item.setAttribute("aria-checked", String(item === button));
      item.tabIndex = item === button ? 0 : -1;
    });
    onSelect(value);
  }
  const firstAvailable = buttons.findIndex(button => button.getAttribute("aria-disabled") !== "true");
  if (firstAvailable >= 0) select(buttons[firstAvailable], values[firstAvailable]);
  else if (buttons.length) buttons[0].tabIndex = 0;
}

function initColors(product) {
  const colors = Array.isArray(product.colors) ? product.colors : [];
  document.getElementById("selected-color").textContent = colors.length ? "" : "No disponible";
  initRadioGroup(document.getElementById("product-colors"), colors, colors, color => {
    const key = color.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const button = document.createElement("button");
    button.className = `swatch${["blanco", "beige"].includes(key) ? " swatch--light" : ""}`;
    button.style.setProperty("--swatch-color", COLOR_SWATCHES[key] || "var(--text-muted)");
    button.setAttribute("data-swatch-toggle", "");
    button.setAttribute("aria-label", color);
    button.title = color;
    return button;
  }, color => { document.getElementById("selected-color").textContent = color; });
}

function initSizes(product) {
  const available = Array.isArray(product.size) ? product.size : [];
  const sizes = [...new Set([...MASTER_SIZES, ...available])];
  document.getElementById("selected-size").textContent = available.length ? "" : "Sin stock";
  initRadioGroup(document.getElementById("product-sizes"), sizes, available, size => {
    const button = document.createElement("button");
    button.className = "chip";
    button.textContent = size;
    return button;
  }, size => { document.getElementById("selected-size").textContent = size; });
  document.getElementById("product-stock").hidden = available.length > 0;
  document.getElementById("product-buy").setAttribute("aria-disabled", String(available.length === 0));
}

function initQuantity() {
  const input = document.getElementById("product-quantity");
  const minus = document.getElementById("quantity-minus");
  const plus = document.getElementById("quantity-plus");
  let quantity = 1;
  function update(value) {
    if (/^[+-]?\d+$/.test(String(value))) quantity = Math.max(1, Math.min(15, Number(value)));
    input.value = String(quantity);
    minus.setAttribute("aria-disabled", String(quantity === 1));
    plus.setAttribute("aria-disabled", String(quantity === 15));
  }
  minus.onclick = () => update(quantity - 1);
  plus.onclick = () => update(quantity + 1);
  input.oninput = input.onchange = input.onblur = () => update(input.value);
  update(1);
}

function renderProduct(product) {
  document.getElementById("product-name").textContent = product.name;
  document.getElementById("product-categories").textContent = (product.categories || []).join(" · ");
  document.getElementById("product-price").textContent = `$${product.price}`;
  document.getElementById("product-badge").hidden = product.is_new !== true;
  document.title = `${product.name} | Horus Uruguay`;
  initGallery(product);
  initColors(product);
  initSizes(product);
  initQuantity();
  // TODO: Implementar la compra cuando se defina el flujo.
}

function setPageState(state) {
  const loading = state === "loading";
  const ready = state === "ready";
  document.getElementById("product-status").hidden = ready;
  document.getElementById("product-detail").hidden = !ready;
  document.getElementById("product-detail").classList.toggle("is-visible", ready);
  document.getElementById("product-status").setAttribute("aria-busy", String(loading));
  const title = document.getElementById("status-title");
  title.hidden = ready;
  title.textContent = loading ? "Cargando producto…" : state === "missing" ? "Producto no encontrado"
    : "No pudimos cargar el producto. Intenta nuevamente.";
  document.getElementById("catalog-link").hidden = state !== "missing";
  document.getElementById("retry-product").hidden = state !== "error";
}

async function loadProduct() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return setPageState("missing");
  setPageState("loading");
  try {
    const product = await fetchProduct(id);
    if (!product) return setPageState("missing");
    renderProduct(product);
    setPageState("ready");
  } catch {
    setPageState("error");
  }
}

document.getElementById("retry-product").addEventListener("click", loadProduct);
loadProduct();