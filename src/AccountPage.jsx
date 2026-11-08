import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Save, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { solicitar } from "./services/api.js";
import OrderItems from "./OrderItems.jsx";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

function PasswordField({ label, name, autoComplete, minLength }) {
    const [visible, setVisible] = useState(false);
    return <label className="account-field">{label}<span className="account-password">
        <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} maxLength="128" required />
        <button type="button" className="icon-btn" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    </span></label>;
}

export default function AccountPage({ auth, onAuthenticated, initialMode = "login" }) {
    const location = useLocation();
    const [mode, setMode] = useState(initialMode);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [ordersState, setOrdersState] = useState({ userId: "", orders: [], status: "loading", message: "" });
    const [discardingOrder, setDiscardingOrder] = useState("");
    const userId = auth.user?.id;
    const orders = ordersState.userId === userId ? ordersState.orders : [];
    const ordersStatus = ordersState.userId === userId ? ordersState.status : "loading";
    const ordersMessage = ordersState.userId === userId ? ordersState.message : "";
    const pageClassName = `account-page${auth.user ? "" : " account-page--standalone"}`;
    const backLink = <Link to="/" className="account-back"><ArrowLeft size={18} aria-hidden="true" />Volver</Link>;

    useEffect(() => {
        if (!userId) return undefined;
        const controller = new AbortController();
        solicitar("/api/orders", { signal: controller.signal }).then(result => {
            setOrdersState({ userId, orders: result, status: "ready", message: "" });
        }).catch(error => {
            if (error.name !== "AbortError") {
                setOrdersState({ userId, orders: [], status: "error", message: error.message });
            }
        });
        return () => controller.abort();
    }, [userId]);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        setBusy(true);
        setMessage("");
        try {
            const user = await solicitar(mode === "register" ? "/api/register" : "/api/login", {
                method: "POST",
                body: JSON.stringify(values)
            });
            onAuthenticated(user, location.state?.checkout);
            setMessage(mode === "register" ? "Tu cuenta se creó correctamente." : "Iniciaste sesión correctamente.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function changePassword(event) {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        setBusy(true);
        setMessage("");
        try {
            const result = await solicitar("/api/change-password", {
                method: "PATCH",
                body: JSON.stringify(Object.fromEntries(new FormData(form)))
            });
            form.reset();
            setMessage(result.message);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }

    async function discardOrder(order) {
        const confirmed = window.confirm(
            "¿Estás seguro de marcar tu orden como descartada? Esto detiene su preparación y envío. Si ya coordinaste por WhatsApp, avisa también al negocio."
        );
        if (!confirmed || discardingOrder) return;
        setDiscardingOrder(order.id);
        setOrdersState(previous => previous.userId === userId
            ? { ...previous, message: "" } : previous);
        try {
            const updated = await solicitar(`/api/orders/${encodeURIComponent(order.id)}/discard`, { method: "POST" });
            setOrdersState(previous => previous.userId === userId ? {
                ...previous,
                orders: previous.orders.map(item => item.id === updated.id ? updated : item),
                message: "La orden se marcó como descartada."
            } : previous);
        } catch (error) {
            setOrdersState(previous => previous.userId === userId
                ? { ...previous, message: error.message } : previous);
        } finally {
            setDiscardingOrder("");
        }
    }

    if (auth.status === "loading") {
        return <main className={pageClassName}><section className="account-card">{backLink}<p role="status">Cargando tu cuenta...</p></section></main>;
    }
    if (auth.status === "error") {
        return <main className={pageClassName}><section className="account-card">{backLink}<p role="alert">No se pudo verificar tu sesión. Recargá la página para volver a intentar.</p></section></main>;
    }

    return <main className={pageClassName}>
        <section className="account-card">
            {!auth.user && backLink}
            {auth.user ? <>
                <header className="account-heading"><UserRound size={28} aria-hidden="true" /><div><p className="eyebrow">Tu cuenta</p><h1>Mi perfil</h1></div></header>
                <dl className="account-details">
                    <div><dt>Nombre</dt><dd>{auth.user.nombre} {auth.user.apellido}</dd></div>
                    <div><dt>Email</dt><dd>{auth.user.email}</dd></div>
                    <div><dt>Rol</dt><dd>{auth.user.role === "admin" ? "Administrador" : "Usuario"}</dd></div>
                    {auth.user.direccion && <div><dt>Dirección</dt><dd>{auth.user.direccion}</dd></div>}
                </dl>
                <section className="account-orders">
                    <h2>Mis órdenes</h2>
                    <p role={ordersStatus === "error" || /no se pudo|error/i.test(ordersMessage) ? "alert" : "status"}>{ordersStatus === "loading" ? "Cargando tus órdenes..." : ordersMessage}</p>
                    {ordersStatus === "error" && <button type="button" className="admin-button" onClick={() => window.location.reload()}>Reintentar</button>}
                    {ordersStatus === "ready" && !orders.length && <p>Todavía no realizaste órdenes.</p>}
                    {orders.map(order => <article className="account-order" key={order.id}>
                        <header><div><h3>Orden {order.id}</h3><p>{new Date(order.createdAt).toLocaleDateString("es-UY")}</p></div><strong>{order.status}</strong></header>
                        <div className="checkout-products"><OrderItems entries={order.items} /></div>
                        <dl className="account-order__totals">
                            <div><dt>Subtotal</dt><dd>{currency.format(order.subtotal)}</dd></div>
                            {order.discountPercent > 0 && <div><dt>Cupón {order.couponCode} ({order.discountPercent}%)</dt><dd>−{currency.format(order.discountAmount)}</dd></div>}
                            <div><dt>Total</dt><dd>{currency.format(order.total)}</dd></div>
                        </dl>
                        {["Orden recibida", "Procesando"].includes(order.status) && <button type="button" className="admin-button admin-button--danger" disabled={discardingOrder === order.id} onClick={() => discardOrder(order)}>{discardingOrder === order.id ? "Descartando..." : "Descartar orden"}</button>}
                    </article>)}
                </section>
                <h2>Cambiar contraseña</h2>
                <form className="account-form" onSubmit={changePassword}>
                    <PasswordField label="Contraseña actual" name="currentPassword" autoComplete="current-password" />
                    <PasswordField label="Nueva contraseña (mínimo 8 caracteres)" name="newPassword" autoComplete="new-password" minLength="8" />
                    <button className="admin-button" disabled={busy}><Save size={16} aria-hidden="true" />{busy ? "Guardando..." : "Actualizar contraseña"}</button>
                </form>
            </> : <>
                <header className="account-heading"><UserRound size={28} aria-hidden="true" /><div><p className="eyebrow">Horus Uruguay</p><h1>{mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</h1></div></header>
                <form className="account-form" onSubmit={submit}>
                    {mode === "register" && <>
                        <label className="account-field">Nombre<input name="nombre" type="text" autoComplete="given-name" maxLength="80" required /></label>
                        <label className="account-field">Apellido<input name="apellido" type="text" autoComplete="family-name" maxLength="80" required /></label>
                    </>}
                    <label className="account-field">Email<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
                    <PasswordField label={mode === "register" ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"} name="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? "8" : undefined} />
                    <button className="admin-button" disabled={busy}>{busy ? "Enviando..." : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</button>
                </form>
                <p className="account-switch">{mode === "register" ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
                    <button type="button" className="account-link" onClick={() => { setMode(mode === "register" ? "login" : "register"); setMessage(""); }}>
                        {mode === "register" ? "Iniciar sesión" : "Registrarme"}
                    </button>
                </p>
            </>}
            <p className="account-message" role={message && /no se pudo|incorrect|válid|existe/i.test(message) ? "alert" : "status"}>{message}</p>
        </section>
    </main>;
}
