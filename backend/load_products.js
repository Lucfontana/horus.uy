document.addEventListener("DOMContentLoaded", load_items)

export async function fetch_products(){
    try {
        const productos = await fetch("../backend/db/db.json");
        return productos.json()
    } catch (error) {
        console.error(`Hubo un error: ${error}`)
    }
}

async function load_items(){
    console.log("Se cargaron productos! (anda a saber donde)");
    try {
    const productos = await fetch_products();

    create_cards(Object.values(productos.items));
    return;
 
    } catch (error) {
        console.error(`Hubo un error al ejecutar la peticion: ${error}`);
    }
}

function create_cards(products){
    const product_grid = document.getElementById("product-grid");
    products.forEach((product) => {
        const product_card = document.createElement("article");
        product_card.className = "product-card";

        const media = create_media(product);
        product_card.appendChild(media)

        const body = create_body(product);
        product_card.appendChild(body);

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
    img_base.alt = `${product.name}`;
    img_base.src = `${product.imgSrc}`;

    const img_alt = document.createElement("img")
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
    categories.className = "product-card__category"
    let raw_categories = product.categories;
    categories.textContent = raw_categories.join(", ")
    div_body.appendChild(categories);

    const div_footer = document.createElement("div");
    div_body.appendChild(div_footer)

    const price = document.createElement("span");
    price.textContent = `${product.price}`;
    div_footer.appendChild(price);

    const icon_cart = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z"></path><path d="M9 7a3 3 0 0 1 6 0"></path></svg>`
    const button_addCart = document.createElement("button")
    button_addCart.innerHTML = `${icon_cart}`
    button_addCart.type = "button"
    button_addCart.className = "product-card__cart"
    button_addCart.ariaLabel = `Agregar ${product.name} al carrito`
    div_footer.appendChild(button_addCart)

    return div_body

}