import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { construirFiltros } from "../backend/filter_products.js";
import { imagenProducto, obtenerPaginaProductos } from "./services/products.js";

const moneda = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });
const categorias = ["abrigos", "calzado", "camisas", "camisetas", "chalecos", "pantalones", "vestidos", "accesorios"];
const colores = [
    ["negro", "Negro", "#1a1a1a"], ["blanco", "Blanco", "#f5f5f0"],
    ["beige", "Beige", "#d8c9a8"], ["camel", "Camel", "#b98d54"],
    ["verde", "Verde", "#4a5c45"], ["azul", "Azul", "#33475b"],
    ["bordo", "Bordó", "#6b2737"], ["gris", "Gris", "#8a8a86"]
];
const talles = [["xs", "XS"], ["s", "S"], ["m", "M"], ["l", "L"], ["XL", "XL"], ["XXL", "XXL"]];

function FilterGroup({ id, title, children }) {
    const [expanded, setExpanded] = useState(false);
    return <div className="filter-group" data-filter-group>
        <button type="button" className="filter-group__toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
            <span>{title}</span>
            <svg className="filter-group__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <div className={`filter-group__panel${expanded ? "" : " is-collapsed"}`} id={id}>
            <div className="filter-group__panel-inner">{children}</div>
        </div>
    </div>;
}

function PriceRange({ minimum, maximum, initialMinimum, initialMaximum }) {
    const [values, setValues] = useState({ minimum: initialMinimum, maximum: initialMaximum });
    const span = maximum - minimum;
    const gap = Math.min(50, span);
    const fillLeft = span > 0 ? ((values.minimum - minimum) / span) * 100 : 0;
    const fillRight = span > 0 ? ((values.maximum - minimum) / span) * 100 : 100;
    const format = value => `$${Number(value).toLocaleString("es-UY")}`;

    function updateMinimum(value) {
        setValues(current => ({ ...current, minimum: Math.min(Number(value), current.maximum - gap) }));
    }

    function updateMaximum(value) {
        setValues(current => ({ ...current, maximum: Math.max(Number(value), current.minimum + gap) }));
    }

    return <div className="price-range" id="price-range">
        <div className="price-range__labels"><span id="price-min-label">{format(values.minimum)}</span><span id="price-max-label">{format(values.maximum)}</span></div>
        <div className="price-range__track">
            <div className="price-range__fill" />
            <div className="price-range__fill-active" id="price-fill-active" style={{ left: `${fillLeft}%`, width: `${fillRight - fillLeft}%` }} />
            <input type="range" id="price-min" name="precioMin" min={minimum} max={maximum - gap} step="1" value={values.minimum} aria-label="Precio mínimo" onChange={event => updateMinimum(event.target.value)} />
            <input type="range" id="price-max" name="precioMax" min={minimum + gap} max={maximum} step="1" value={values.maximum} aria-label="Precio máximo" onChange={event => updateMaximum(event.target.value)} />
        </div>
        <div className="price-range__inputs">
            <div className="field-mini"><label htmlFor="price-min-input">Min</label><input type="number" id="price-min-input" min={minimum} max={values.maximum - gap} value={values.minimum} onChange={event => updateMinimum(event.target.value)} /></div>
            <div className="field-mini"><label htmlFor="price-max-input">Max</label><input type="number" id="price-max-input" min={values.minimum + gap} max={maximum} value={values.maximum} onChange={event => updateMaximum(event.target.value)} /></div>
        </div>
    </div>;
}

function Producto({ producto }) {
    return <article className="product-card">
        <div className="product-card__media">
            {producto.is_new && <span className="product-card__badge">Nuevo</span>}
            <Link to={`/producto?id=${encodeURIComponent(producto.id)}`}>
                <img className="product-card__img--base" src={imagenProducto(producto.imgSrc)} alt={producto.name} loading="lazy" />
                <img className="product-card__img--alt" src={imagenProducto(producto.imgSrcHover || producto.imgSrc)} alt={`${producto.name}, vista alternativa`} loading="lazy" />
            </Link>
        </div>
        <div className="product-card__body">
            <h3 className="product-card__name">{producto.name}</h3>
            <p className="product-card__category">{producto.categories.join(", ")}</p>
            <div><span>{moneda.format(producto.price)}</span></div>
        </div>
    </article>;
}

export default function App() {
    const [catalogo, setCatalogo] = useState({
        consulta: null, productos: [], pagina: 1, total: 0,
        hayMas: false, minimo: 0, maximo: 0, estado: "loading", errorMas: ""
    });
    const [intento, setIntento] = useState(0);
    const [cargandoMas, setCargandoMas] = useState(false);
    const masController = useRef(null);
    const [parametros, setParametros] = useSearchParams();
    const consulta = parametros.toString();

    useEffect(() => {
        const controller = new AbortController();
        masController.current?.abort();
        obtenerPaginaProductos(new URLSearchParams(consulta), 1, controller.signal).then(datos => {
            setCatalogo({
                consulta,
                productos: datos.products,
                pagina: datos.page,
                total: datos.total,
                hayMas: datos.hasMore,
                minimo: datos.minPrice,
                maximo: datos.maxPrice,
                estado: "ready",
                errorMas: ""
            });
            setCargandoMas(false);
        }).catch(error => {
            if (error.name !== "AbortError") {
                setCatalogo(previous => ({
                    ...previous, consulta, productos: [], total: 0, hayMas: false, estado: "error"
                }));
            }
        });
        return () => {
            controller.abort();
            masController.current?.abort();
        };
    }, [consulta, intento]);

    const datosActuales = catalogo.consulta === consulta;
    const productos = datosActuales ? catalogo.productos : [];
    const estado = datosActuales ? catalogo.estado : "loading";
    const minimo = datosActuales ? catalogo.minimo : 0;
    const maximo = datosActuales ? catalogo.maximo : 0;
    const filtros = construirFiltros(parametros, minimo, maximo);
    const orden = parametros.get("sort") || "newest";

    async function cargarMas() {
        if (cargandoMas || !catalogo.hayMas || catalogo.consulta !== consulta) return;
        const controller = new AbortController();
        masController.current = controller;
        setCargandoMas(true);
        setCatalogo(previous => previous.consulta === consulta ? { ...previous, errorMas: "" } : previous);
        try {
            const datos = await obtenerPaginaProductos(new URLSearchParams(consulta), catalogo.pagina + 1, controller.signal);
            if (!controller.signal.aborted) {
                setCatalogo(previous => previous.consulta === consulta ? {
                    ...previous,
                    productos: [...previous.productos, ...datos.products],
                    pagina: datos.page,
                    total: datos.total,
                    hayMas: datos.hasMore
                } : previous);
            }
        } catch (error) {
            if (error.name !== "AbortError") {
                setCatalogo(previous => previous.consulta === consulta
                    ? { ...previous, errorMas: error.message } : previous);
            }
        } finally {
            setCargandoMas(false);
        }
    }

    function filtrar(evento) {
        evento.preventDefault();
        const nuevos = new URLSearchParams(new FormData(evento.currentTarget));
        if (orden !== "newest") nuevos.set("sort", orden);
        setParametros(nuevos);
    }

    function ordenar(evento) {
        const nuevos = new URLSearchParams(parametros);
        if (evento.target.value === "newest") nuevos.delete("sort");
        else nuevos.set("sort", evento.target.value);
        setParametros(nuevos);
    }

    return <main className="catalog-main">
        <nav className="catalog-categories" aria-label="Categorías destacadas">
            <ul>
                <li><a href="#" className="is-active">Mujer</a></li>
                <li><a href="#">Hombre</a></li>
                <li><a href="#">Ofertas</a></li>
                <li><a href="#">Niños</a></li>
                <li><a href="#">Accesorios</a></li>
            </ul>
        </nav>
        <div className="catalog-layout">
            <aside className="filters" id="filters">
                <div className="filters__sticky">
                    <p className="eyebrow">Filtros</p>
                    <h2 className="filters__title">Refinar búsqueda</h2>
                    <p className="filters__subtitle">Encontrá tu prenda ideal.</p>
                    <form action="" id="formularioFiltros" key={`${consulta}:${estado}:${minimo}:${maximo}`} onSubmit={filtrar}>
                        <FilterGroup id="panel-categoria" title="Categoría">
                            <ul className="filter-checklist">
                                {categorias.map(categoria => <li key={categoria}><label><input type="checkbox" name="categoria" value={categoria} defaultChecked={parametros.getAll("categoria").includes(categoria)} />{categoria.charAt(0).toUpperCase() + categoria.slice(1)}</label></li>)}
                            </ul>
                        </FilterGroup>
                        <FilterGroup id="panel-color" title="Color">
                            <ul className="filter-checklist swatches">
                                {colores.map(([value, label, color]) => <li key={value}><label><input type="checkbox" name="color" value={value} defaultChecked={parametros.getAll("color").includes(value)} />{label}<p className={`swatch${["blanco", "beige"].includes(value) ? " swatch--light" : ""}`} data-swatch-toggle style={{ "--swatch-color": color }} aria-label={label} /></label></li>)}
                            </ul>
                        </FilterGroup>
                        <FilterGroup id="panel-precio" title="Precio">
                            <PriceRange key={`${consulta}:${estado}:${minimo}:${maximo}`} minimum={minimo} maximum={maximo} initialMinimum={filtros.precioMin} initialMaximum={filtros.precioMax} />
                        </FilterGroup>
                        <FilterGroup id="panel-talle" title="Talle">
                            <div className="size-chips">
                                {talles.map(([id, talle]) => <span className="chip-option" key={talle}>
                                    <input type="checkbox" id={`talle-${id}`} name="talle" value={talle} className="chip-input" defaultChecked={parametros.getAll("talle").includes(talle)} />
                                    <label htmlFor={`talle-${id}`} className="chip">{talle}</label>
                                </span>)}
                            </div>
                        </FilterGroup>
                        <button type="submit" className="btn btn--outline filters__apply" id="filtrarButton" disabled={estado !== "ready"}>Aplicar filtros</button>
                    </form>
                </div>
            </aside>
            <section className="catalog-results" aria-labelledby="catalog-title">
                <div className="catalog-toolbar">
                    <div><h1 id="catalog-title">Catálogo</h1><p className="catalog-subtitle">Descubrí nuestra exclusiva colección.</p></div>
                    <div className="sort-control"><label htmlFor="sort">Ordenar por</label>
                        <select id="sort" value={orden} onChange={ordenar}>
                            <option value="newest">Lo más nuevo</option>
                            <option value="price-asc">Precio: menor a mayor</option>
                            <option value="price-desc">Precio: mayor a menor</option>
                        </select>
                    </div>
                </div>
                <div className="product-grid" id="product-grid" aria-busy={estado === "loading"}>
                    {estado === "loading" && <p role="status">Cargando productos...</p>}
                    {estado === "error" && <div role="alert"><p>No se pudieron cargar los productos.</p><button type="button" className="btn btn--outline" onClick={() => { setCatalogo(previous => ({ ...previous, estado: "loading" })); setIntento(value => value + 1); }}>Reintentar</button></div>}
                    {estado === "ready" && productos.map(producto => <Producto key={producto.id} producto={producto} />)}
                    {estado === "ready" && productos.length === 0 && <p>No se encontraron productos.</p>}
                </div>
                {estado === "ready" && catalogo.hayMas && <button type="button" className="btn btn--outline catalog-load-more" onClick={cargarMas} disabled={cargandoMas}>{cargandoMas ? "Cargando..." : "Cargar más"}</button>}
                {estado === "ready" && catalogo.errorMas && <p role="alert" className="catalog-load-more-error">{catalogo.errorMas}</p>}
                {estado === "ready" && productos.length > 0 && <p className="catalog-results-count">Mostrando {productos.length} de {catalogo.total} productos</p>}
            </section>
        </div>
    </main>;
}