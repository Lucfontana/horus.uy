const apiProductos = "/api/products";
const apiCategorias = "/api/categories";
const tallesDisponibles = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const productos = new Map();
const categorias = new Map();
const botonesVista = [...document.querySelectorAll("[data-view]")];
const paneles = [...document.querySelectorAll("[data-panel]")];
const tabla = document.getElementById("products-table");
const contador = document.getElementById("product-count");

function mostrarVista(vista) {
  botonesVista.forEach(boton => {
    if (boton.dataset.view === vista) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  paneles.forEach(panel => { panel.hidden = panel.dataset.panel !== vista; });
  if (vista === "products") cargarProductos();
}

function informar(elemento, texto, tipo = "") {
  elemento.textContent = texto;
  if (tipo) elemento.dataset.kind = tipo;
  else delete elemento.dataset.kind;
}

async function solicitar(url, opciones = {}) {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: { "Content-Type": "application/json", ...opciones.headers }
  });
  const resultado = respuesta.status === 204 ? null : await respuesta.json();
  if (!respuesta.ok) throw new Error(resultado?.error || `Error HTTP ${respuesta.status}.`);
  return resultado;
}

function opcionesMarcadas(contenedorId) {
  return new Set([...document.querySelectorAll(`#${contenedorId} input:checked`)]
    .map(control => control.value));
}

function renderizarOpciones(contenedorId, nombreCampo, opciones, seleccionadas = new Set()) {
  const contenedor = document.getElementById(contenedorId);
  contenedor.replaceChildren();
  if (!opciones.length) {
    const vacio = document.createElement("p");
    vacio.textContent = nombreCampo === "categoryIds"
      ? "No hay categorías disponibles. Podés agregarlas en «Gestionar categorías»."
      : "No hay opciones disponibles.";
    contenedor.append(vacio);
    return;
  }
  for (const opcion of opciones) {
    const etiqueta = document.createElement("label");
    etiqueta.className = "admin-option";
    const control = document.createElement("input");
    control.type = "checkbox";
    control.name = nombreCampo;
    control.value = opcion.value;
    control.checked = seleccionadas.has(opcion.value);
    etiqueta.append(control, document.createTextNode(opcion.label));
    contenedor.append(etiqueta);
  }
}

function actualizarOpcionesProducto() {
  const opcionesCategorias = [...categorias.values()].map(categoria => ({
    value: categoria.id,
    label: categoria.name
  }));
  for (const [contenedor, campo] of [
    ["add-category-options", "categoryIds"],
    ["edit-category-options", "categoryIds"],
    ["add-size-options", "size"],
    ["edit-size-options", "size"]
  ]) {
    const seleccionadas = opcionesMarcadas(contenedor);
    const opciones = campo === "categoryIds"
      ? opcionesCategorias
      : tallesDisponibles.map(talle => ({ value: talle, label: talle }));
    renderizarOpciones(contenedor, campo, opciones, seleccionadas);
  }
}

function crearCelda(fila, texto) {
  const celda = document.createElement("td");
  celda.textContent = texto;
  fila.append(celda);
}

function actualizarSelectores() {
  for (const idSelect of ["edit-id", "delete-id"]) {
    const selector = document.getElementById(idSelect);
    const idActual = selector.value;
    selector.replaceChildren();
    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Seleccioná un producto";
    selector.append(opcionInicial);
    for (const producto of productos.values()) {
      const opcion = document.createElement("option");
      opcion.value = producto.id;
      opcion.textContent = `${producto.id} · ${producto.name}`;
      selector.append(opcion);
    }
    if (productos.has(idActual)) selector.value = idActual;
  }
}

async function cargarCategorias() {
  const mensaje = document.getElementById("category-message");
  try {
    const resultado = await solicitar(apiCategorias);
    categorias.clear();
    for (const categoria of resultado) categorias.set(categoria.id, categoria);
    const tabla = document.getElementById("categories-table");
    tabla.replaceChildren();
    for (const categoria of categorias.values()) {
      const fila = document.createElement("tr");
      crearCelda(fila, categoria.name);
      const acciones = document.createElement("td");
      for (const [accion, etiqueta] of [["rename", "Editar"], ["delete", "Eliminar"]]) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = `admin-button ${accion === "delete" ? "admin-button--danger" : "admin-button--secondary"}`;
        boton.dataset.categoryAction = accion;
        boton.dataset.categoryId = categoria.id;
        boton.textContent = etiqueta;
        acciones.append(boton, document.createTextNode(" "));
      }
      fila.append(acciones);
      tabla.append(fila);
    }
    actualizarOpcionesProducto();
  } catch (error) {
    informar(mensaje, error.message, "error");
  }
}

async function cargarProductos() {
  informar(document.getElementById("list-message"), "");
  contador.textContent = "Cargando productos…";
  try {
    const respuesta = await solicitar(apiProductos);
    const items = respuesta.items || {};
    productos.clear();
    for (const [id, datos] of Object.entries(items)) productos.set(String(id), { id: String(id), ...datos });

    tabla.replaceChildren();
    for (const producto of productos.values()) {
      const fila = document.createElement("tr");
      crearCelda(fila, producto.id);
      crearCelda(fila, producto.name);
      crearCelda(fila, new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(producto.price));
      crearCelda(fila, (producto.categories || []).join(", ") || "—");
      crearCelda(fila, `${(producto.colors || []).join(", ") || "—"} / ${(producto.size || []).join(", ") || "—"}`);
      tabla.append(fila);
    }
    contador.textContent = `${productos.size} ${productos.size === 1 ? "producto" : "productos"}`;
    actualizarSelectores();
  } catch (error) {
    contador.textContent = "No se pudo cargar el catálogo.";
    informar(document.getElementById("list-message"), error.message, "error");
  }
}

function leerCampos(formulario) {
  const campos = new FormData(formulario);
  const lista = nombre => String(campos.get(nombre) || "")
    .split(",").map(valor => valor.trim()).filter(Boolean);
  return {
    name: String(campos.get("name")).trim(),
    price: Number(campos.get("price")),
    imgSrc: String(campos.get("imgSrc")).trim(),
    imgSrcHover: String(campos.get("imgSrcHover")).trim(),
    alt: String(campos.get("alt")).trim(),
    categoryIds: [...formulario.querySelectorAll('input[name="categoryIds"]:checked')]
      .map(control => control.value),
    colors: lista("colors"),
    size: [...formulario.querySelectorAll('input[name="size"]:checked')]
      .map(control => control.value),
    is_new: campos.has("is_new")
  };
}

function prepararEnvio(formulario, boton, mensaje) {
  boton.disabled = true;
  boton.textContent = "Guardando…";
  informar(mensaje, "Procesando solicitud…");
}

function finalizarEnvio(boton, etiqueta) {
  boton.disabled = false;
  boton.textContent = etiqueta;
}

botonesVista.forEach(boton => boton.addEventListener("click", () => mostrarVista(boton.dataset.view)));

document.getElementById("add-form").addEventListener("submit", async evento => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const boton = formulario.querySelector('button[type="submit"]');
  const mensaje = document.getElementById("add-message");
  prepararEnvio(formulario, boton, mensaje);
  try {
    const creado = await solicitar(apiProductos, { method: "POST", body: JSON.stringify(leerCampos(formulario)) });
    informar(mensaje, `Producto ${creado.id} agregado correctamente.`, "success");
    formulario.reset();
    await cargarProductos();
  } catch (error) {
    informar(mensaje, error.message, "error");
  } finally {
    finalizarEnvio(boton, "Guardar producto");
  }
});

const formularioEdicion = document.getElementById("edit-form");
document.getElementById("load-product").addEventListener("click", async () => {
  const id = document.getElementById("edit-id").value;
  const mensaje = document.getElementById("edit-message");
  if (!id) return informar(mensaje, "Seleccioná un producto.", "error");
  informar(mensaje, "Cargando producto…");
  try {
    const producto = await solicitar(`${apiProductos}/${encodeURIComponent(id)}`);
    for (const [campo, valor] of Object.entries(producto)) {
      if (["categories", "categoryIds", "size"].includes(campo)) continue;
      const control = formularioEdicion.elements.namedItem(campo);
      if (!control) continue;
      if (campo === "id") continue;
      if (control.type === "checkbox") control.checked = Boolean(valor);
      else control.value = Array.isArray(valor) ? valor.join(", ") : valor;
    }
    renderizarOpciones("edit-category-options", "categoryIds",
      [...categorias.values()].map(categoria => ({ value: categoria.id, label: categoria.name })),
      new Set(producto.categoryIds || []));
    renderizarOpciones("edit-size-options", "size",
      tallesDisponibles.map(talle => ({ value: talle, label: talle })),
      new Set(producto.size || []));
    informar(mensaje, `Producto ${id} cargado.`, "success");
  } catch (error) {
    informar(mensaje, error.message, "error");
  }
});

formularioEdicion.addEventListener("submit", async evento => {
  evento.preventDefault();
  const id = document.getElementById("edit-id").value;
  const boton = formularioEdicion.querySelector('button[type="submit"]');
  const mensaje = document.getElementById("edit-message");
  prepararEnvio(formularioEdicion, boton, mensaje);
  try {
    await solicitar(`${apiProductos}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(leerCampos(formularioEdicion))
    });
    informar(mensaje, `Producto ${id} actualizado correctamente.`, "success");
    await cargarProductos();
  } catch (error) {
    informar(mensaje, error.message, "error");
  } finally {
    finalizarEnvio(boton, "Guardar cambios");
  }
});

document.getElementById("delete-form").addEventListener("submit", async evento => {
  evento.preventDefault();
  const id = document.getElementById("delete-id").value;
  const mensaje = document.getElementById("delete-message");
  if (!id) return informar(mensaje, "Seleccioná un producto.", "error");
  const producto = productos.get(id);
  if (!window.confirm(`¿Eliminar "${producto?.name || id}" (ID ${id})? Esta acción no se puede deshacer.`)) return;

  const boton = evento.currentTarget.querySelector('button[type="submit"]');
  prepararEnvio(evento.currentTarget, boton, mensaje);
  try {
    await solicitar(`${apiProductos}/${encodeURIComponent(id)}`, { method: "DELETE" });
    informar(mensaje, `Producto ${id} eliminado correctamente.`, "success");
    await cargarProductos();
  } catch (error) {
    informar(mensaje, error.message, "error");
  } finally {
    finalizarEnvio(boton, "Eliminar producto");
  }
});

document.getElementById("category-form").addEventListener("submit", async evento => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const boton = formulario.querySelector('button[type="submit"]');
  const mensaje = document.getElementById("category-message");
  const name = String(new FormData(formulario).get("name") || "").trim();
  boton.disabled = true;
  informar(mensaje, "Guardando categoría…");
  try {
    const creada = await solicitar(apiCategorias, {
      method: "POST",
      body: JSON.stringify({ name })
    });
    informar(mensaje, `Categoría "${creada.name}" agregada.`, "success");
    formulario.reset();
    await cargarCategorias();
  } catch (error) {
    informar(mensaje, error.message, "error");
  } finally {
    boton.disabled = false;
  }
});

document.getElementById("categories-table").addEventListener("click", async evento => {
  const boton = evento.target.closest("button[data-category-action]");
  if (!boton) return;
  const categoria = categorias.get(boton.dataset.categoryId);
  if (!categoria) return;
  const mensaje = document.getElementById("category-message");
  const id = encodeURIComponent(categoria.id);
  boton.disabled = true;
  try {
    if (boton.dataset.categoryAction === "rename") {
      const name = window.prompt("Nuevo nombre de categoría:", categoria.name);
      if (name === null) return;
      const nueva = name.trim();
      if (!nueva) return informar(mensaje, "El nombre no puede quedar vacío.", "error");
      const actualizada = await solicitar(`${apiCategorias}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nueva })
      });
      informar(mensaje, `Categoría "${actualizada.name}" actualizada.`, "success");
    } else {
      if (!window.confirm(`¿Eliminar la categoría "${categoria.name}"?`)) return;
      await solicitar(`${apiCategorias}/${id}`, { method: "DELETE" });
      informar(mensaje, `Categoría "${categoria.name}" eliminada.`, "success");
    }
    await cargarCategorias();
    await cargarProductos();
  } catch (error) {
    informar(mensaje, error.message, "error");
  } finally {
    boton.disabled = false;
  }
});

actualizarOpcionesProducto();
Promise.all([cargarCategorias(), cargarProductos()]);
