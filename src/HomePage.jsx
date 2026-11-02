import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

const reviews = [
    { title: "Envío rápido", content: "Pedí un conjunto y llegó en menos de 48 horas. Todo perfecto y bien embalado.", author: "Martín G." },
    { title: "Excelente calidad", content: "El producto es de excelente calidad y me ha servido muy bien.", author: "Valentina R." },
    { title: "Atención personalizada", content: "Tuve una duda con el talle y el asistente me ayudó al instante. Muy buena experiencia de compra.", author: "Camila F." },
    { title: "Excelente calidad", content: "El producto es de excelente calidad y me ha servido muy bien.", author: "Carlos P." }
];

function Reveal({ children, className = "" }) {
    const element = useRef(null);
    const [visible, setVisible] = useState(() => !("IntersectionObserver" in window));

    useEffect(() => {
        if (!element.current || !("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.2 });
        observer.observe(element.current);
        return () => observer.disconnect();
    }, []);

    return <div ref={element} className={`section__inner reveal${visible ? " is-visible" : ""} ${className}`}>{children}</div>;
}

export default function HomePage() {
    const [index, setIndex] = useState(0);
    const [message, setMessage] = useState("");
    return <main className="react-home">

        <section id="hero" className="section section--hero" aria-labelledby="hero-titulo">
            <div className="hero__scrim" aria-hidden="true"/>
            <Reveal className="hero__content">
                <p className="eyebrow">Paysandú · Uruguay</p>
                <h2 id="hero-titulo" className="glitch-title" data-text="Horus Uruguay">Horus Uruguay</h2>
                <p className="lead">Ropa pensada para quienes buscan estilo y comodidad en cada ocasión. Descubrí nuestras colecciones y encontrá tu próxima prenda favorita.</p>
                <Link className="btn btn--gold" to="/catalogo"><button>Ver catálogo</button></Link>
            </Reveal>
        </section>
        <section className="section section--foro" aria-labelledby="foro-titulo"><Reveal>
            <p className="eyebrow">Colecciones</p><h2 id="foro-titulo">Novedades</h2><p className="lead">Descubrí los últimos lanzamientos y encontrá tu próxima prenda favorita.</p><Link className="btn btn--outline" to="/catalogo">Ver productos</Link>
        </Reveal></section>
        <section className="section section--ubicacion" aria-labelledby="ubicacion-titulo"><Reveal>
            <h2 id="ubicacion-titulo">Ubicación</h2><div className="ubicacion__grid"><div className="ubicacion__text"><p className="eyebrow">Visitanos</p><p className="lead">Conocé nuestras colecciones en persona y recibí asesoramiento personalizado en Paysandú, Uruguay.</p></div>
                <div className="ubicacion__mapa"><iframe src="https://www.google.com/maps?q=Horus+Paysandu+Uruguay&output=embed" title="Ubicación de la tienda Horus Uruguay" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
            </div>
        </Reveal></section>
        <section className="section section--resenas" aria-labelledby="resenas-titulo"><Reveal>
            <p className="eyebrow">Testimonios</p>
            <h2 id="resenas-titulo">Reseñas de nuestros clientes</h2>
            <div className="reviews">
                <div className="review-viewport" id="review-viewport" aria-live="polite">
                    {reviews.map((review, position) => <article className="review-card" key={review.author} aria-hidden={position !== index}>
                        <h3 className="review-card__title">{review.title}</h3>
                        <p className="review-card__content">{review.content}</p>
                        <p className="review-card__author">{review.author}</p>
                    </article>)}
                </div>
                <div className="navResenas">
                    <button id="prev" className="review-nav-btn" type="button" title="Reseña anterior" aria-label="Reseña anterior" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft /></button>
                    <div className="react-review-dots">{reviews.map((item, position) => <button key={item.author} type="button" className={`dot${index === position ? " active" : ""}`} aria-label={`Ver reseña ${position + 1}`} aria-pressed={index === position} onClick={() => setIndex(position)} />)}</div>
                    <button id="next" className="review-nav-btn" type="button" title="Reseña siguiente" aria-label="Reseña siguiente" disabled={index === reviews.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight /></button>
                </div>
            </div>
        </Reveal></section>
        <section className="section section--contacto" aria-labelledby="contacto-titulo"><Reveal>
            <p className="eyebrow">Hablemos</p><h2 id="contacto-titulo">Contacto</h2>
            <form className="contact-form" onSubmit={event => { event.preventDefault(); setMessage("El envío de mensajes todavía no está disponible. Contactanos en Instagram: @horus.uy."); }}><fieldset><legend>Contacto</legend>
                <div className="field">
                    <label htmlFor="contact-name">Nombre</label>
                    <input id="contact-name" name="nombre" required autoComplete="name" /></div>
                <div className="field">
                    <label htmlFor="contact-email">Email</label>
                    <input id="contact-email" name="email" type="email" required autoComplete="email" /></div>
                <div className="field">
                    <label htmlFor="contact-message">Mensaje</label>
                    <textarea id="contact-message" name="mensaje" rows="5" required /></div>
                <div className="contact-form__actions">
                    <button className="btn-action btn-action--primary" type="submit">Enviar mensaje</button>
                    <p className="contact-form__or"> O </p>
                    <a className="btn-action btn-action--assistant" href="https://instagram.com/horus.uy" target="_blank" rel="noreferrer">Hablar con el asistente IA
                    </a>
                </div>
                <p role="status">{message}</p>
            </fieldset></form>
        </Reveal></section>
    </main>;
}