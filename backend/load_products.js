import {
    aplicarFiltros,
    construirFiltros,
} from "../backend/filter_products.js";

const formularioFiltros = document.getElementById("formularioFiltros");
const productGrid = document.getElementById("product-grid");

let PRECIO_MAX_DEFAULT, PRECIO_MIN_DEFAULT;
let productos = []; // fuente única de productos, se llena una sola vez

if (productGrid && formularioFiltros) {
    document.addEventListener("DOMContentLoaded", load_items);
    formularioFiltros.addEventListener("submit", retrieveFiltros);
}

export async function fetch_products(){
    try {
        const respuesta = await fetch("../backend/db/db.json");
        if (!respuesta.ok) throw new Error(`Error HTTP: ${respuesta.status}`);
        return respuesta.json();
    } catch (error) {
        console.error(`Hubo un error: ${error}`)
    }
}

let productosPromise = null;
/* Trae los productos desde una misma fuente: evita que se hagan multiples 
    fetch a la base de datos, si no que lo hace una vez al iniciar y lo obtiene
    desde acá para no repetir los fetch */
export function obtenerProductos(actualizar = false) {
    if (actualizar || !productosPromise) {
        productosPromise = fetch_products().then(data =>
            Object.entries(data.items).map(([id, producto]) => ({ id, ...producto }))
        );
    }
    return productosPromise;
}

async function load_items(){
    try {
        productos = await obtenerProductos();
        const bounds = calcMinMaxPrice(productos); // ahora función pura, sin fetch propio
        PRECIO_MIN_DEFAULT = bounds.min;
        PRECIO_MAX_DEFAULT = bounds.max;

        const filtros = leerFiltrosDesdeURL();
        sincronizarFormularioConFiltros(filtros);

        const productosFiltrados = aplicarFiltros(productos, filtros);
        create_cards(productosFiltrados);
        console.log("Hola los items fueron cargados: ", productosFiltrados)
    } catch (error) {
        console.error(`Hubo un error al ejecutar la peticion: ${error}`);
    }
}

export function calcMinMaxPrice(productos){
  let array_prices = []
  productos.forEach((producto) => {
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

function retrieveFiltros(e) {
    e.preventDefault();

    const filtros = construirFiltros(new FormData(formularioFiltros), PRECIO_MIN_DEFAULT, PRECIO_MAX_DEFAULT);

    actualizarURL(filtros);
    const productosFiltrados = aplicarFiltros(productos, filtros);
    create_cards(productosFiltrados);
}

function leerFiltrosDesdeURL() {
    return construirFiltros(new URLSearchParams(window.location.search), PRECIO_MIN_DEFAULT, PRECIO_MAX_DEFAULT);
}

function actualizarURL(filtros) {
    const params = new URLSearchParams();

    filtros.categoria.forEach(cat => params.append("categoria", cat));
    filtros.color.forEach(color => params.append("color", color));
    filtros.talle.forEach(talle => params.append("talle", talle));

    if (filtros.precioMin > PRECIO_MIN_DEFAULT) params.set("precioMin", filtros.precioMin);
    if (filtros.precioMax < PRECIO_MAX_DEFAULT) params.set("precioMax", filtros.precioMax);

    const queryString = params.toString();
    const nuevaURL = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

    history.pushState(filtros, "", nuevaURL);
}

function sincronizarFormularioConFiltros(filtros) {
    formularioFiltros.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked =
            filtros.categoria.includes(input.value) ||
            filtros.color.includes(input.value) ||
            filtros.talle.includes(input.value);
    });

    document.getElementById("price-min").value = filtros.precioMin;
    document.getElementById("price-max").value = filtros.precioMax;
    document.getElementById("price-min-input").value = filtros.precioMin;
    document.getElementById("price-max-input").value = filtros.precioMax;
}

export function create_cards(products) {
    const product_grid = document.getElementById("product-grid");
    product_grid.innerHTML = "";
    products.forEach((product) => {
        const product_card = document.createElement("article");
        product_card.className = "product-card";

        product_card.appendChild(create_media(product));
        product_card.appendChild(create_body(product));

        product_grid.appendChild(product_card)
    });
}

function create_media(product){
    const div_media = document.createElement("div")
    div_media.className = "product-card__media"

    if (product.is_new) {
        const badge_new = document.createElement("span");
        badge_new.className = "product-card__badge";
        badge_new.textContent = "Nuevo";
        div_media.appendChild(badge_new);
    }

    const img_base = document.createElement("img")
    img_base.className = "product-card__img--base"
    img_base.alt = `${product.name}`;
    img_base.src = `${product.imgSrc}`;

    const img_alt = document.createElement("img")
    img_alt.className = "product-card__img--alt"
    img_alt.alt = `${product.name}, vista alternativa`;
    img_alt.src = `${product.imgSrcHover}`

    div_media.appendChild(img_base);
    div_media.appendChild(img_alt);

    return div_media;  
}

function create_body(product){
    const div_body = document.createElement("div");
    div_body.className = "product-card__body";

    const title = document.createElement("h3");
    title.className = "product-card__name";
    title.textContent = `${product.name}`;
    div_body.appendChild(title)

    const categories = document.createElement("p");
    categories.className = "product-card__category";
    categories.textContent = product.categories.join(", ");
    div_body.appendChild(categories);

    const div_footer = document.createElement("div");
    div_body.appendChild(div_footer)

    const price = document.createElement("span");
    price.textContent = `$${product.price}`;
    div_footer.appendChild(price);

    const icon_cart = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z"></path><path d="M9 7a3 3 0 0 1 6 0"></path></svg>`
    const button_addCart = document.createElement("button")
    button_addCart.innerHTML = `${icon_cart}`
    button_addCart.type = "button"
    button_addCart.className = "product-card__cart"
    button_addCart.dataset.productId = product.id;
    button_addCart.ariaLabel = `Agregar ${product.name} al carrito`
    div_footer.appendChild(button_addCart)

    return div_body

}