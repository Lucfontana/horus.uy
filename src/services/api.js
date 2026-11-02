export async function solicitar(url, opciones = {}) {
    const respuesta = await fetch(url, {
        ...opciones,
        headers: { "Content-Type": "application/json", ...opciones.headers }
    });
    const datos = respuesta.status === 204 ? null : await respuesta.json();
    if (!respuesta.ok) throw new Error(datos?.error || `Error HTTP ${respuesta.status}`);
    return datos;
}