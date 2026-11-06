import { useEffect, useRef, useState } from "react";
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { LogOut, Menu, Moon, ShoppingBag, Sun, UserRound, X } from "lucide-react";
import Catalog from "./App.jsx";
import HomePage from "./HomePage.jsx";
import ProductPage from "./ProductPage.jsx";
import CheckoutPage from "./CheckoutPage.jsx";
import AdminPage from "./AdminPage.jsx";
import AccountPage from "./AccountPage.jsx";
import Cart from "./Cart.jsx";
import AssistantChat from "./AssistantChat.jsx";
import { useCart } from "./useCart.js";
import { obtenerProductos } from "./services/products.js";
import { solicitar } from "./services/api.js";

const currency = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" });

function Site() {
    const location = useLocation();
    const [cartOpen, setCartOpen] = useState(false);
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [auth, setAuth] = useState({ status: "loading", user: null });
    const cart = useCart(auth);
    const [accountMessage, setAccountMessage] = useState("");
    const [catalog, setCatalog] = useState({ key: null, products: [], error: false });
    const [theme, setTheme] = useState(() => {
        try { return localStorage.getItem("horus-theme") === "light" ? "light" : "dark"; }
        catch { return "dark"; }
    });
    const dialog = useRef(null);
    const hideSiteChrome = !auth.user && ["/cuenta", "/login", "/registro"].includes(location.pathname);

    useEffect(() => {
        if (accountMessage !== "Cerraste sesión.") return;
        const timeout = window.setTimeout(() => setAccountMessage(""), 5000);
        return () => window.clearTimeout(timeout);
    }, [accountMessage]);

    useEffect(() => {
        let active = true;
        let revision = 0;
        function refreshSession() {
            const current = ++revision;
            solicitar("/api/session").then(user => {
                if (active && current === revision) setAuth({ status: "ready", user });
            }).catch(error => {
                if (!active || current !== revision) return;
                setAuth(error.status === 401
                    ? { status: "ready", user: null }
                    : { status: "error", user: null });
            });
        }
        function onStorage(event) {
            if (event.key === "horus-auth-changed" || event.key === null) refreshSession();
        }
        refreshSession();
        window.addEventListener("horus-session-changed", refreshSession);
        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", refreshSession);
        return () => {
            active = false;
            window.removeEventListener("horus-session-changed", refreshSession);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", refreshSession);
        };
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem("horus-theme", theme); } catch { return undefined; }
    }, [theme]);

    useEffect(() => {
        const drawer = dialog.current;
        let frame;
        let timeout;

        function finishClosing(event) {
            if (event && (event.target !== drawer || event.propertyName !== "transform")) return;
            drawer.removeEventListener("transitionend", finishClosing);
            window.clearTimeout(timeout);
            if (drawer.open) drawer.close();
        }

        if (cartOpen) {
            if (!drawer.open) drawer.showModal();
            frame = window.requestAnimationFrame(() => drawer.classList.add("is-open"));
        } else if (drawer.open) {
            drawer.classList.remove("is-open");
            drawer.addEventListener("transitionend", finishClosing);
            timeout = window.setTimeout(() => finishClosing(), 450);
        }

        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timeout);
            drawer.removeEventListener("transitionend", finishClosing);
        };
    }, [cartOpen]);

    useEffect(() => {
        const controller = new AbortController();
        obtenerProductos(controller.signal).then(products => {
            setCatalog({ key: location.key, products, error: false });
        }).catch(error => {
            if (error.name !== "AbortError") setCatalog({ key: location.key, products: [], error: true });
        });
        window.scrollTo(0, 0);
        return () => controller.abort();
    }, [location.key]);

    const status = cart.status !== "ready" ? cart.status
        : catalog.key !== location.key ? "loading" : catalog.error ? "error" : "ready";
    const productsById = new Map(catalog.products.map(product => [String(product.id), product]));
    const entries = status === "ready" ? cart.entries.flatMap(entry => {
        const product = productsById.get(entry.productId);
        return product?.colors.includes(entry.color) && product?.size.includes(entry.size)
            ? [{ ...entry, name: product.name, imgSrc: product.imgSrc, price: Number(product.price) }] : [];
    }) : cart.entries;
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const total = entries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0);

    async function update(entry, quantity) {
        try { await cart.update(entry, quantity); setMessage(""); }
        catch (error) { setMessage(error.message); }
    }

    function notifySessionChanged() {
        window.dispatchEvent(new Event("horus-session-changed"));
        try { localStorage.setItem("horus-auth-changed", crypto.randomUUID()); }
        catch (error) { console.error("No se pudo notificar el cambio de sesión a otras pestañas:", error); }
    }

    function authenticated(user) {
        setAuth({ status: "ready", user });
        setAccountMessage("");
        closeNavigation();
        notifySessionChanged();
    }

    function closeNavigation() {
        setMenuOpen(false);
        setCartOpen(false);
    }

    async function logout() {
        try {
            if (!cart.canLogout()) throw new Error("Esperá a que termine de guardarse el carrito antes de cerrar sesión.");
            await solicitar("/api/logout", { method: "POST" });
            setAuth({ status: "ready", user: null });
            closeNavigation();
            setAccountMessage("Cerraste sesión.");
            notifySessionChanged();
        } catch (error) {
            setAccountMessage(error.message);
        }
    }

    return <>
        {!hideSiteChrome && <header className="react-header">
            <div className="react-header__inner">
                <Link to="/" className="brand" onClick={closeNavigation}><img src="/frontend/src/logo.png" alt="Horus Uruguay - Inicio" /></Link>
                <nav className={`react-nav${menuOpen ? " is-open" : ""}`} id="react-navigation" aria-label="Navegación principal">
                    {[ ["/", "Inicio"], ["/catalogo", "Catálogo"], ["/checkout", "Tu compra"] ].map(([path, label]) => <NavLink key={path} to={path} end onClick={closeNavigation}>{label}</NavLink>)}
                </nav>
                <div className="site-header__actions">
                    <button type="button" className="icon-btn" title="Ver carrito" aria-label={`Ver carrito (${count} productos)`} aria-haspopup="dialog" onClick={() => { setMessage(""); setCartOpen(true); }}><ShoppingBag size={20} /><span className="react-cart-count">{count}</span></button>
                    <button type="button" className="icon-btn" title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"} aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"} aria-pressed={theme === "light"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? <Moon size={20} /> : <Sun size={20} />}</button>
                    <div className="account-menu">
                        <Link to="/cuenta" className="icon-btn account-menu__trigger" title="Tu cuenta" aria-label="Tu cuenta" aria-haspopup="true" onClick={closeNavigation}><UserRound size={20} /></Link>
                        <nav className="account-menu__dropdown" aria-label="Menú de cuenta">
                            <Link to="/cuenta" onClick={closeNavigation}>Mi Perfil</Link>
                            {auth.user?.role === "admin" && <Link to="/administracion" onClick={closeNavigation}>Panel Administrador</Link>}
                            {!auth.user && <Link to="/cuenta" onClick={closeNavigation}>Iniciar sesión / Registrarme</Link>}
                            {auth.user && <button type="button" onClick={logout}><LogOut size={16} aria-hidden="true" />Cerrar sesión</button>}
                        </nav>
                    </div>
                    <button type="button" className="icon-btn react-menu-toggle" title="Menú" aria-label="Menú de navegación" aria-controls="react-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
                </div>
            </div>
        </header>}
        <p role="status" className="account-toast">{accountMessage}</p>
        {cart.message && <div className="migration-main" role="alert"><p>{cart.message}</p><button type="button" className="admin-button" onClick={cart.synchronize}>Reintentar sincronización del carrito</button></div>}
        <Routes>
            <Route path="/" element={<HomePage onOpenAssistant={() => setAssistantOpen(true)} />} />
            <Route path="/inicio" element={<HomePage onOpenAssistant={() => setAssistantOpen(true)} />} />
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/producto" element={<ProductPage add={cart.add} />} />
            <Route path="/carrito" element={<CheckoutPage entries={entries} update={update} status={status} />} />
            <Route path="/checkout" element={<CheckoutPage entries={entries} update={update} status={status} />} />
            <Route path="/cuenta" element={<AccountPage auth={auth} onAuthenticated={authenticated} />} />
            <Route path="/login" element={<AccountPage auth={auth} onAuthenticated={authenticated} initialMode="login" />} />
            <Route path="/registro" element={<AccountPage auth={auth} onAuthenticated={authenticated} initialMode="register" />} />
            <Route path="/administracion" element={auth.status === "loading"
                ? <main className="account-page"><p role="status">Verificando permisos...</p></main>
                : auth.status === "error"
                    ? <main className="account-page"><p role="alert">No se pudo verificar tu sesión. Recargá la página para volver a intentar.</p></main>
                    : auth.user?.role === "admin" ? <AdminPage /> : <Navigate to="/cuenta" replace />} />
            <Route path="*" element={<main className="migration-main"><h1>Página no encontrada</h1><Link to="/">Volver al inicio</Link></main>} />
        </Routes>
        <p role="status" className="react-storage-message">{message}</p>
        {!hideSiteChrome && <footer className="site-footer"><p>© 2026 horus.uy. Todos los derechos reservados.</p><nav aria-label="Redes sociales"><a href="https://instagram.com/horus.uy" target="_blank" rel="noreferrer">Instagram</a></nav></footer>}
        <dialog ref={dialog} className="react-cart-drawer" aria-labelledby="cart-title" onCancel={event => { event.preventDefault(); setCartOpen(false); }} onClose={() => setCartOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setCartOpen(false); } }}>
            <div className="react-cart-heading"><h2 id="cart-title">Tu carrito</h2><button type="button" className="icon-btn" title="Cerrar carrito" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}><X /></button></div>
            <div className="react-cart-content">{status === "ready" ? <Cart entries={entries} update={update} /> : <p role="status">{status === "error" ? "No se pudieron actualizar los productos. Recargá para reintentar." : "Cargando carrito..."}</p>}</div>
            <p role="status">{message}</p><div className="react-cart-footer"><p>Subtotal <strong>{status === "ready" ? currency.format(total) : "..."}</strong></p><Link className="btn-action btn-action--primary" to="/checkout" onClick={closeNavigation}>Finalizar compra</Link></div>
        </dialog>
        <AssistantChat open={assistantOpen} visible={["/", "/inicio"].includes(location.pathname)} onClose={() => setAssistantOpen(false)} />
    </>;
}

export default function Router() {
    return <HashRouter><Site /></HashRouter>;
}