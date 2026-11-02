import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, List, Tags, Save } from "lucide-react";
import { solicitar } from "./services/api.js";

const sizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

async function loadData(signal) {
    const [products, categories] = await Promise.all([
        solicitar("/api/products", { signal }), solicitar("/api/categories", { signal })
    ]);
    return { products: Object.entries(products.items).map(([id, product]) => ({ ...product, id })), categories };
}

function ProductForm({ product, categories, busy, onSave }) {
    function submit(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
            name: data.get("name").trim(), price: Number(data.get("price")),
            imgSrc: data.get("imgSrc").trim(), imgSrcHover: data.get("imgSrcHover").trim(),
            alt: data.get("alt").trim(), categoryIds: data.getAll("categoryIds"),
            colors: data.get("colors").split(",").map(value => value.trim()).filter(Boolean),
            size: data.getAll("size"), is_new: data.has("is_new")
        });
    }
    return <form className="admin-form" onSubmit={submit}>
        {[["name", "Nombre", "text", 160], ["price", "Precio", "number"], ["imgSrc", "Imagen principal", "text"], ["imgSrcHover", "Imagen alternativa", "text"], ["alt", "Descripción de imagen", "text", 240]].map(([name, label, type, maxLength]) => <label className="admin-field" key={name}>{label}<input name={name} type={type} required maxLength={maxLength} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} defaultValue={product?.[name] ?? ""} /></label>)}
        <fieldset className="admin-fieldset"><legend>Categorías</legend><div className="admin-option-list">{categories.map(category => <label className="admin-option" key={category.id}><input type="checkbox" name="categoryIds" value={category.id} defaultChecked={product?.categoryIds?.includes(category.id) || false} />{category.name}</label>)}{!categories.length && <p>No hay categorías disponibles.</p>}</div></fieldset>
        <label className="admin-field">Colores<input name="colors" placeholder="Negro, Azul" defaultValue={product?.colors?.join(", ") || ""} /></label>
        <fieldset className="admin-fieldset"><legend>Talles</legend><div className="admin-option-list">{sizes.map(size => <label className="admin-option" key={size}><input type="checkbox" name="size" value={size} defaultChecked={product?.size?.includes(size) || false} />{size}</label>)}</div></fieldset>
        <label className="admin-checkbox"><input type="checkbox" name="is_new" defaultChecked={product?.is_new || false} />Producto nuevo</label>
        <div className="admin-form-actions"><button className="admin-button" disabled={busy}><Save size={16} aria-hidden="true" />{busy ? "Guardando..." : "Guardar producto"}</button></div>
    </form>;
}

export default function AdminPage() {
    const [data, setData] = useState({ products: [], categories: [] });
    const [status, setStatus] = useState("loading");
    const [view, setView] = useState("products");
    const [selected, setSelected] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        loadData(controller.signal).then(result => { setData(result); setStatus("ready"); }).catch(error => {
            if (error.name !== "AbortError") { setStatus("error"); setMessage(error.message); }
        });
        return () => controller.abort();
    }, []);

    async function mutate(url, method, body) {
        if (busy) return;
        setBusy(true);
        setMessage("");
        try {
            await solicitar(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
            const result = await loadData();
            setData(result);
            setRevision(value => value + 1);
            setMessage("Cambios guardados correctamente.");
            return true;
        } catch (error) {
            setMessage(error.message);
            return false;
        } finally {
            setBusy(false);
        }
    }

    const product = data.products.find(item => item.id === selected);
    const views = [["products", "Ver productos", <List size={18} aria-hidden="true" />], ["add", "Agregar producto", <Plus size={18} aria-hidden="true" />], ["edit", "Editar producto", <Pencil size={18} aria-hidden="true" />], ["delete", "Eliminar producto", <Trash2 size={18} aria-hidden="true" />], ["categories", "Gestionar categorías", <Tags size={18} aria-hidden="true" />]];
    return <div className="admin-layout react-admin">
        <aside className="admin-sidebar"><p className="eyebrow">Horus Uruguay</p><nav className="admin-nav" aria-label="Administración">{views.map(([name, label, icon]) => <button type="button" key={name} aria-current={view === name ? "page" : undefined} disabled={busy} onClick={() => { setView(name); setMessage(""); }}>{icon}{label}</button>)}</nav></aside>
        <main className="admin-main"><div className="admin-content"><header className="admin-heading"><h1>Administrar productos</h1><p>{data.products.length} productos</p></header><p role={status === "error" ? "alert" : "status"} className="admin-message">{status === "loading" ? "Cargando..." : message}</p>
            {status === "error" && <button type="button" className="admin-button" onClick={() => window.location.reload()}>Reintentar</button>}
            {status === "ready" && <section className="admin-panel"><h2>{views.find(([name]) => name === view)[1]}</h2>
                {view === "products" && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Categorías</th><th>Variantes</th></tr></thead><tbody>{data.products.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{currency.format(item.price)}</td><td>{item.categories.join(", ")}</td><td>{item.colors.join(", ")} / {item.size.join(", ")}</td></tr>)}</tbody></table>{!data.products.length && <p>No hay productos.</p>}</div>}
                {(view === "edit" || view === "delete") && <label className="admin-field">Producto<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}><option value="">Seleccioná un producto</option>{data.products.map(item => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label>}
                {view === "add" && <ProductForm key={`new:${revision}`} categories={data.categories} busy={busy} onSave={fields => mutate("/api/products", "POST", fields)} />}
                {view === "edit" && product && <ProductForm key={`${product.id}:${revision}`} product={product} categories={data.categories} busy={busy} onSave={fields => mutate(`/api/products/${encodeURIComponent(product.id)}`, "PATCH", fields)} />}
                {view === "delete" && product && <button className="admin-button admin-button--danger" type="button" disabled={busy} onClick={async () => { if (window.confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`) && await mutate(`/api/products/${encodeURIComponent(product.id)}`, "DELETE")) setSelected(""); }}><Trash2 size={16} aria-hidden="true" />Eliminar producto</button>}
                {view === "categories" && <>
                    <form key={revision} className="admin-form" onSubmit={event => { event.preventDefault(); mutate("/api/categories", "POST", { name: new FormData(event.currentTarget).get("name").trim() }); }}><label className="admin-field">Nombre de categoría<input name="name" required maxLength="80" /></label><div className="admin-form-actions"><button className="admin-button" disabled={busy}><Plus size={16} aria-hidden="true" />Agregar categoría</button></div></form>
                    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nombre</th><th>Acciones</th></tr></thead><tbody>{data.categories.map(category => <tr key={category.id}><td>{category.name}</td><td><div className="react-admin-actions">
                        <button type="button" className="admin-button" title="Editar categoría" aria-label={`Editar ${category.name}`} disabled={busy} onClick={() => { const name = window.prompt("Nuevo nombre de categoría:", category.name); if (name?.trim()) mutate(`/api/categories/${encodeURIComponent(category.id)}`, "PATCH", { name: name.trim() }); }}><Pencil size={16} /></button>
                        <button type="button" className="admin-button admin-button--danger" title="Eliminar categoría" aria-label={`Eliminar ${category.name}`} disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar la categoría "${category.name}"?`)) mutate(`/api/categories/${encodeURIComponent(category.id)}`, "DELETE"); }}><Trash2 size={16} /></button>
                    </div></td></tr>)}</tbody></table>{!data.categories.length && <p>No hay categorías.</p>}</div>
                </>}
            </section>}
        </div></main>
    </div>;
}