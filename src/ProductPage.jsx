import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Minus, ShoppingBag } from "lucide-react";
import { imagenProducto } from "./services/products.js";
import { solicitar } from "./services/api.js";

const swatches = { negro: "#1a1a1a", blanco: "#f5f5f0", beige: "#d8c9a8", camel: "#b98d54", verde: "#4a5c45", azul: "#33475b", bordo: "#6b2737", gris: "#8a8a86" };
const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

function ProductDetail({ product, add }) {
    const [image, setImage] = useState(product.imgSrc);
    const [color, setColor] = useState("");
    const [size, setSize] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const sizes = [...new Set(["XS", "S", "M", "L", "XL", "XXL", ...product.size])];

    async function addToCart() {
        setBusy(true);
        setMessage("");
        try {
            await solicitar(`/api/products/${encodeURIComponent(product.id)}/variants`, {
                method: "POST", body: JSON.stringify({ color, size })
            });
            await add({ productId: String(product.id), name: product.name, imgSrc: product.imgSrc, price: Number(product.price), color, size, quantity });
            setMessage("Producto agregado al carrito.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    return <article className="product-detail" aria-labelledby="product-name">
        <div className="product-gallery">
            <div className="product-thumbnails" aria-label="Imágenes del producto">
                {[product.imgSrc, product.imgSrcHover || product.imgSrc].map((source, index) => <button key={index} type="button" className="product-thumbnail" aria-label={`Ver imagen ${index + 1}`} aria-pressed={image === source} onClick={() => setImage(source)}><img src={imagenProducto(source)} alt={product.alt || product.name} /></button>)}
            </div>
            <div className="product-image-frame"><img src={imagenProducto(image)} alt={product.alt || product.name} /></div>
        </div>
        <div className="product-info">
            {product.is_new && <span className="product-card__badge">Nuevo</span>}
            <p className="product-card__category">{product.categories.join(" · ")}</p>
            <h1 id="product-name">{product.name}</h1>
            <p className="product-card__price">{currency.format(product.price)}</p>
            <fieldset className="product-option react-options"><legend>Color: {color}</legend><div className="swatches">
                {product.colors.map(value => <label key={value} title={value} className="react-swatch" style={{ "--swatch-color": swatches[value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || "var(--text-muted)" }}><input aria-label={value} type="radio" name="color" value={value} checked={color === value} onChange={() => setColor(value)} /><span /></label>)}
            </div>{!product.colors.length && <p>No disponible</p>}</fieldset>
            <fieldset className="product-option react-options"><legend>Talle: {size}</legend><div className="size-chips">
                {sizes.map(value => <label key={value} className="react-size"><input type="radio" name="size" value={value} checked={size === value} disabled={!product.size.includes(value)} onChange={() => setSize(value)} /><span>{value}</span></label>)}
            </div>{!product.size.length && <p role="status">Sin stock</p>}</fieldset>
            <div className="product-option"><label htmlFor="product-quantity">Cantidad</label><div className="product-quantity">
                <button type="button" title="Reducir cantidad" aria-label="Reducir cantidad" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus size={16} /></button>
                <input id="product-quantity" type="number" min="1" max="15" value={quantity} onChange={event => setQuantity(Math.max(1, Math.min(15, Number(event.target.value) || 1)))} />
                <button type="button" title="Aumentar cantidad" aria-label="Aumentar cantidad" disabled={quantity >= 15} onClick={() => setQuantity(quantity + 1)}><Plus size={16} /></button>
            </div></div>
            <button className="btn-action btn-action--primary product-buy" type="button" disabled={busy || !color || !size} onClick={addToCart}><ShoppingBag size={18} aria-hidden="true" />{busy ? "Agregando..." : "Agregar al carrito"}</button>
            <p role="status" aria-live="polite">{message}</p>
        </div>
    </article>;
}

export default function ProductPage({ add }) {
    const [params] = useSearchParams();
    const id = params.get("id");
    const [result, setResult] = useState({ id: null, status: "loading" });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        if (!id) return () => controller.abort();
        solicitar(`/api/products/${encodeURIComponent(id)}`, { signal: controller.signal }).then(product => {
            setResult({ id, status: "ready", product });
        }).catch(error => {
            if (error.name !== "AbortError") setResult({ id, status: "error", message: error.message });
        });
        return () => controller.abort();
    }, [id, attempt]);
    const status = !id ? "missing" : result.id !== id ? "loading" : result.status;
    return <main className="product-main"><div className="product-shell">
        <nav className="product-breadcrumb" aria-label="Ruta de navegación"><Link to="/catalogo">Catálogo</Link></nav>
        {status === "ready" ? <ProductDetail key={id} product={result.product} add={add} /> : <div className="product-status" role="status">
            <h1>{status === "missing" ? "Producto no encontrado" : status === "loading" ? "Cargando producto..." : result.message}</h1>
            {status === "error" && <button type="button" className="btn btn--outline" onClick={() => { setResult({ id, status: "loading" }); setAttempt(attempt + 1); }}>Reintentar</button>}
            <Link to="/catalogo">Volver al catálogo</Link>
        </div>}
    </div></main>;
}