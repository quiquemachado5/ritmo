import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const erroresDePagina = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errores: string[] = [];
  erroresDePagina.set(page, errores);
  page.on("pageerror", error => errores.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(erroresDePagina.get(page) ?? [], "No debe haber errores de JavaScript sin gestionar").toEqual([]);
});

async function iniciarSesion(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("alex@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await expect(page.getByLabel("Correo electrónico")).toHaveValue("alex@ritmo.test");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Buenas|Buenos/).first()).toBeVisible();
}

const secciones = { "/": "Hoy", "/ajustes": "Ajustes", "/nutricion": "Nutrición", "/progreso": "Progreso", "/habitos": "Hábitos" } as const;

async function irA(page: Page, ruta: keyof typeof secciones) {
  // Las pestañas se recorren como en la app, sin destruir el documento y
  // abortar peticiones de autenticación en vuelo. La recarga se prueba aparte.
  const documento = await page.evaluate(() => {
    const contexto = window as typeof window & { __ritmoDocumentId?: string };
    contexto.__ritmoDocumentId ??= crypto.randomUUID();
    return contexto.__ritmoDocumentId;
  });
  const sidebar = page.locator("[data-app-sidebar]");
  if (await sidebar.isVisible()) {
    await sidebar.getByRole("link", { name: secciones[ruta], exact: true }).click();
  } else if (ruta === "/ajustes") {
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.getByRole("menuitem", { name: "Ajustes", exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Navegación principal móvil" })
      .getByRole("link", { name: secciones[ruta], exact: true }).click();
  }
  await expect(page).toHaveURL(url => url.pathname === ruta);
  expect(await page.evaluate(() => (window as typeof window & { __ritmoDocumentId?: string }).__ritmoDocumentId), "La navegación entre pestañas debe conservar el documento").toBe(documento);
}

async function sinDesbordamiento(page: Page) {
  const resultado = await page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    return { exceso: document.documentElement.scrollWidth - ancho,
      elementos: [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > ancho + 1)
        .slice(0, 8).map(el => ({ tag: el.tagName, clase: el.className, texto: el.textContent?.slice(0, 100) })) };
  });
  expect(resultado.exceso, JSON.stringify(resultado.elementos)).toBeLessThanOrEqual(1);
}

test("el despliegue declara que código y datos están alineados", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "El contrato HTTP no depende del dispositivo");
  const respuesta = await request.get("/api/health");
  expect(respuesta.status()).toBe(200);
  expect(await respuesta.json()).toMatchObject({ status: "ok", service: "ritmo", database: "ready" });
});

test("accesibilidad automática en acceso y lectura principal", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "Una pasada semántica estable es suficiente; las geometrías móviles se cubren aparte");
  await request.post("http://127.0.0.1:3199/__reset");
  await page.goto("/login");
  let resultado = await new AxeBuilder({ page }).analyze();
  expect(resultado.violations.filter((item) => item.impact === "critical" || item.impact === "serious"), JSON.stringify(resultado.violations, null, 2)).toEqual([]);
  await iniciarSesion(page);
  resultado = await new AxeBuilder({ page }).analyze();
  expect(resultado.violations.filter((item) => item.impact === "critical" || item.impact === "serious"), JSON.stringify(resultado.violations, null, 2)).toEqual([]);
});

test("auditoría visual de despliegue cubre anchuras críticas", async ({ page, request }, info) => {
  test.skip(info.project.name !== "desktop", "Una matriz interna evita repetirla por motor");
  test.setTimeout(120000);
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  const superficies = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ];
  for (const viewport of superficies) {
    await page.setViewportSize(viewport);
    for (const ruta of Object.keys(secciones) as Array<keyof typeof secciones>) {
      await page.goto(ruta);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.getByText("Esta sección falló", { exact: true })).toHaveCount(0);
      await sinDesbordamiento(page);
      const idsDuplicados = await page.evaluate(() => {
        const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((elemento) => elemento.id).filter(Boolean);
        return [...new Set(ids.filter((id, indice) => ids.indexOf(id) !== indice))];
      });
      expect(idsDuplicados, `IDs duplicados en ${ruta} a ${viewport.width}px`).toEqual([]);
    }
    await page.goto("/");
    const resultado = await new AxeBuilder({ page }).analyze();
    expect(resultado.violations.filter((item) => item.impact === "critical" || item.impact === "serious"), `Accesibilidad a ${viewport.width}px`).toEqual([]);
  }
});

test("recorrido visual y guardado con datos sintéticos", async ({ page, request }, info) => {
  test.setTimeout(120000);
  const analisisRemotos: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/nutricion") || /generativelanguage|api\.edamam/.test(request.url())) analisisRemotos.push(request.url()); });
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await page.getByRole("button", { name: /Buscar/ }).click();
  await expect(page.getByRole("option", { name: /Registrar una comida/ })).toBeVisible();
  const comando = page.getByLabel("Buscar o ejecutar una acción", { exact: true });
  await comando.press("ArrowDown");
  await comando.press("Enter");
  await expect(page.getByRole("dialog").getByRole("tab", { name: "Peso", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `test-results/${info.project.name}-hoy.png`, fullPage: true });
  for (const route of ["ajustes", "nutricion", "progreso", "habitos"] as const) {
    await irA(page, `/${route}`);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(0);
    await expect(page.getByText("Esta sección falló", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/${info.project.name}-${route}.png`, fullPage: true });
    if (route === "progreso") {
      const confianza = page.locator("#confianza-modelo");
      await expect(confianza.locator("..")).not.toHaveAttribute("open");
      await confianza.click();
      await expect(confianza.locator("..")).toHaveAttribute("open");
      await sinDesbordamiento(page);
      await page.screenshot({ path: `test-results/${info.project.name}-progreso-abierto.png`, fullPage: true });
    } else if (route === "habitos") {
      const selectorFecha = page.getByLabel("Día que quieres editar", { exact: true });
      const fechaHoy = await selectorFecha.inputValue();
      await page.getByRole("button", { name: "Día anterior", exact: true }).click();
      const fechaAnterior = await selectorFecha.inputValue();
      expect(fechaAnterior).not.toBe(fechaHoy);
      const habito = page.getByRole("button", { name: "Beber agua", exact: true });
      const estadoAnterior = await habito.getAttribute("aria-pressed");
      const escritura = page.waitForResponse(response => response.url().includes("/rest/v1/dias") && ["PATCH", "POST", "DELETE"].includes(response.request().method()) && response.ok());
      await habito.click();
      await escritura;
      await expect(habito).toHaveAttribute("aria-pressed", estadoAnterior === "true" ? "false" : "true");
      await page.reload();
      await selectorFecha.fill(fechaAnterior);
      await expect(habito).toHaveAttribute("aria-pressed", estadoAnterior === "true" ? "false" : "true");
    }
  }
  await irA(page, "/nutricion");
  await page.getByRole("button", { name: /Añadir comida|Analizar otra comida/ }).click();
  const prompt = page.getByRole("textbox", { name: "Descripción de la comida" });
  await prompt.fill("Ensalada con pollo y aceite de oliva");
  await page.getByRole("button", { name: "Analizar ingredientes", exact: true }).click();
  await expect(page.getByText("¿Cuánto aceite has usado en total?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "10 g", exact: true }).click();
  await page.getByRole("button", { name: "Analizar ingredientes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toBeVisible();
  // Al cambiar la descripción se exige un nuevo análisis, sin registrar cifras antiguas.
  await prompt.fill("100 g de arroz cocido con 2 filetes de pollo y 30 g de tahini");
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver a analizar", exact: true }).click();
  await expect(page.getByText("Hay texto sin interpretar", { exact: true })).toBeVisible();
  await expect(page.getByText("tahini", { exact: true })).toBeVisible();
  await expect(page.getByText(/Revisa primero:/).first()).toBeVisible();
  await expect(page.getByText("Unidades · peso aprox.", { exact: true })).toBeVisible();
  await page.getByText("Fuentes y valores por 100 g", { exact: true }).click();
  await expect(page.getByText(/Catálogo RITMO · cocción calculada con absorción de agua/).first()).toBeVisible();
  await expect(page.getByText("Catálogo RITMO · referencia estándar por 100 g", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Corregir pollo/ }).click();
  await page.getByLabel("Peso en gramos · recalcula nutrientes").fill("100");
  await page.getByRole("button", { name: "Aplicar corrección", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/251\s*kcal/).first()).toBeVisible();
  await sinDesbordamiento(page);
  // Capturamos el diálogo en su viewport real: Chromium fullPage puede emitir
  // un resize transitorio de 1×1 y alternar artificialmente Dialog/Drawer.
  await page.screenshot({ path: `test-results/${info.project.name}-registro.png` });
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Añadir a comida", exact: true }).click();
  await expect(page.getByText(/Comida añadida/).first()).toBeVisible();
  await page.getByRole("button", { name: "Close toast", exact: true }).click();
  await expect(page.getByText("Plan de comidas", { exact: true })).toHaveCount(0);
  await irA(page, "/");
  await page.getByRole("button", { name: "Preparar informe mensual" }).click();
  await expect(page.getByRole("button", { name: "Póster editorial", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("switch", { name: "Evolución de peso" })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: "Número de comidas" })).not.toBeChecked();
  await expect(page.getByRole("img", { name: /Vista previa de/ })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-informe.png`, fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await irA(page, "/ajustes");
  await page.getByRole("navigation", { name: "Áreas de ajustes" }).getByRole("button", { name: /Datos y cuenta/ }).click();
  await page.getByRole("button", { name: "Informe profesional", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Informe para nutricionista", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Notas contextuales", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Texto de las comidas", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Imprimir / guardar PDF", exact: true })).toBeEnabled();
  await sinDesbordamiento(page);
  await page.screenshot({ path: `test-results/${info.project.name}-informe-profesional.png` });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Correo electrónico").fill("bea@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByText(/Buenas tardes, Bea|Buenos días, Bea|Buenas noches, Bea/)).toBeVisible();
  await irA(page, "/nutricion");
  await expect(page.getByText("100 g de arroz cocido con 2 filetes de pollo y 30 g de tahini", { exact: false })).toHaveCount(0);
  expect(analisisRemotos).toEqual([]);
});

test("la navegación normal no expone administración ni herramientas internas", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await expect(page.locator("[data-app-sidebar]").getByText("Modo mínimo", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-app-sidebar]").getByText("Laboratorio", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-app-sidebar]").getByText(/usuarios/i)).toHaveCount(0);
});

test("el modo mínimo sustituye la app por una única acción y recupera la pestaña", async ({ page, request }, info) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await irA(page, "/nutricion");
  await page.getByRole("button", { name: "Activar modo mínimo", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-vista-minima", "true");
  await expect(page).toHaveURL(url => url.pathname === "/nutricion");
  await expect(page.getByRole("heading", { name: /Hoy, a lo esencial/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Navegación principal móvil" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Secciones de RITMO" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/${info.project.name}-modo-minimo.png`, fullPage: true });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-vista-minima", "true");
  await page.getByRole("button", { name: "Salir del modo mínimo", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-vista-minima", "false");
  await expect(page).toHaveURL(url => url.pathname === "/nutricion");
  await expect(page.getByText("Registra, revisa y ajusta cada estimación.", { exact: true })).toBeVisible();
});

test("administración separa usuarios, lanzamientos y modelos sin datos de salud", async ({ page, request }, info) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("bea@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const sidebar = page.locator("[data-app-sidebar]");
  if (await sidebar.isVisible()) {
    await sidebar.getByRole("link", { name: "Administración", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.getByRole("menuitem", { name: "Administración", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Administración", exact: true })).toBeVisible();
  await expect(page.getByText("Datos de salud aislados", { exact: true })).toBeVisible();
  await expect(page.getByText("Señales técnicas · 24 h", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Usuarios", exact: true }).click();
  await expect(page.getByText("q••••••••@gmail.com", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Funciones", exact: true }).click();
  await expect(page.getByText("Publicación progresiva", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Modelos", exact: true }).click();
  await expect(page.getByText("Canal de predicción de peso", { exact: true })).toBeVisible();
  await sinDesbordamiento(page);
  await page.screenshot({ path: `test-results/${info.project.name}-admin.png`, fullPage: true });
});

test("ajustes con un solo guardado, validación, descarte y aviso al salir", async ({ page, request }) => {
  test.setTimeout(90000);
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await irA(page, "/ajustes");
  const barra = page.getByRole("region", { name: "Guardar ajustes", exact: true });
  const guardar = page.getByRole("button", { name: "Guardar cambios", exact: true });
  await expect(barra).toHaveCount(1);
  await expect(guardar).toHaveCount(1);
  await expect(guardar).toBeDisabled();
  await page.getByLabel("Nombre", { exact: true }).fill("Alex prueba");
  await expect(barra.getByText("Cambios pendientes", { exact: true })).toBeVisible();
  await page.getByLabel("Edad", { exact: true }).fill("17");
  await guardar.click();
  await expect(page.getByLabel("Edad", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Edad", { exact: true }).fill("30");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: "Hoy", exact: true }).click();
  await expect(page).toHaveURL(/\/ajustes$/);
  await barra.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Alex");
  await expect(guardar).toBeDisabled();
  await page.getByLabel("Nombre", { exact: true }).fill("Alex guardado");
  await guardar.click();
  await expect(guardar).toBeDisabled();
  await expect(barra.getByText("Todo al día", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Alex guardado");
  await sinDesbordamiento(page);
});

test("ajustes organiza cada área sin apilar toda la cuenta", async ({ page, request }, info) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await irA(page, "/ajustes");
  const areas = page.getByRole("navigation", { name: "Áreas de ajustes" });
  await expect(areas.getByRole("button")).toHaveCount(4);
  await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
  await expect(page.getByText("Modo viaje / vacaciones", { exact: true })).toBeHidden();

  await areas.getByRole("button", { name: /Rutina y modelo/ }).click();
  await expect(page.getByText("Modo viaje / vacaciones", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nombre", { exact: true })).toBeHidden();

  await areas.getByRole("button", { name: /Experiencia/ }).click();
  await expect(page.getByText("Densidad visual", { exact: true })).toBeVisible();

  await areas.getByRole("button", { name: /Datos y cuenta/ }).click();
  await expect(page.getByText("Tu historial, siempre contigo", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Guardar ajustes", exact: true })).toBeHidden();
  await sinDesbordamiento(page);
  await page.screenshot({ path: `test-results/${info.project.name}-ajustes-redisenados.png`, fullPage: true });
});

test("modo rescate reduce Hoy a una misión y devuelve el panel al completarla", async ({ page, request }, info) => {
  test.skip(info.project.name !== "mobile", "La composición de rescate se verifica una vez en móvil");
  await request.post("http://127.0.0.1:3199/__reset");
  const userId = "00000000-0000-4000-8000-000000000001";
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString("base64url");
  const headers = { authorization: `Bearer local.${payload}.signature`, apikey: "local-test-public-key", "content-type": "application/json" };
  await request.get("http://127.0.0.1:3199/rest/v1/dias", { headers });
  for (let i = 1; i <= 3; i++) {
    const fecha = new Date(); fecha.setDate(fecha.getDate() - i);
    const iso = fecha.toLocaleDateString("en-CA");
    await request.patch(`http://127.0.0.1:3199/rest/v1/dias?fecha=eq.${iso}`, { headers, data: { habitos: { comida: true }, comidas: [] } });
  }
  await iniciarSesion(page);
  await expect(page.getByRole("heading", { name: "Hoy no toca remontarlo todo.", exact: true })).toBeVisible();
  await expect(page.getByText("La misión de hoy", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-rescate.png", fullPage: true });
  await page.getByRole("button", { name: "Marcar como hecho", exact: true }).click();
  await expect(page.getByText("Energía de hoy", { exact: true })).toBeVisible();
});

test("móvil: paisaje, texto ampliado y registro con viewport de teclado", async ({ page, request }, info) => {
  test.skip(!info.project.name.includes("mobile"), "Solo superficies móviles");
  test.setTimeout(120000);
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  const vertical = page.viewportSize()!;
  await page.setViewportSize({ width: vertical.height, height: vertical.width });
  for (const ruta of ["/ajustes", "/nutricion"] as const) {
    await irA(page, ruta);
    await expect(page.locator("main h1").first()).toBeVisible();
    await sinDesbordamiento(page);
  }
  await page.screenshot({ path: `test-results/${info.project.name}-paisaje.png`, fullPage: true });
  await page.setViewportSize(vertical);
  await irA(page, "/ajustes");
  // Aumento de texto al 200 %, no un zoom de captura que oculte desbordamientos.
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
  await sinDesbordamiento(page);
  const barra = page.getByRole("region", { name: "Guardar ajustes", exact: true });
  await expect.poll(() => barra.evaluate(el => {
    const alturaVisible = window.visualViewport?.height || innerHeight;
    return el.getBoundingClientRect().height <= alturaVisible * 0.28 || getComputedStyle(el).position !== "sticky";
  }), { message: "Una barra muy alta debe volver al flujo y no tapar el formulario" }).toBe(true);
  const nombre = page.getByLabel("Nombre", { exact: true });
  await nombre.scrollIntoViewIfNeeded();
  expect(await nombre.evaluate(el => {
    const r = el.getBoundingClientRect();
    const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return encima === el || el.contains(encima);
  }), "El campo de nombre debe quedar visible y pulsable, no bajo una barra").toBe(true);
  const etiquetasCaben = await page.getByRole("navigation", { name: "Navegación principal móvil" }).getByRole("link").evaluateAll(enlaces => enlaces.every(enlace => {
    const label = enlace.querySelector("span");
    if (!label) return false;
    const limite = enlace.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(label);
    return [...range.getClientRects()].every(r => r.left >= limite.left - 1 && r.right <= limite.right + 1);
  }));
  expect(etiquetasCaben, "Las etiquetas ampliadas de navegación deben envolver sin pisarse").toBe(true);
  await page.screenshot({ path: `test-results/${info.project.name}-texto-ampliado.png` });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await irA(page, "/nutricion");
  await page.getByRole("button", { name: "Analizar otra comida" }).click();
  const prompt = page.getByRole("textbox", { name: "Descripción de la comida" });
  await prompt.fill("100 g de pan");
  await prompt.focus();
  expect(await prompt.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  // Simulación explícita de visualViewport. Playwright no abre el teclado físico
  // de iOS: comprobamos la respuesta del layout al espacio disponible real.
  await page.evaluate(() => {
    if (!window.visualViewport) throw new Error("Se requiere visualViewport para este caso");
    Object.defineProperty(window.visualViewport, "height", { configurable: true, get: () => 380 });
    window.visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect(page.getByRole("heading", { name: "Registrar comida", exact: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Tipo de registro", exact: true })).toBeHidden();
  const principal = page.getByRole("button", { name: "Analizar ingredientes", exact: true });
  await expect(principal).toBeVisible();
  await expect.poll(async () => {
    const caja = await principal.boundingBox();
    return caja ? caja.y + caja.height : Infinity;
  }).toBeLessThanOrEqual(381);
  expect((await principal.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sinDesbordamiento(page);
  await page.screenshot({ path: `test-results/${info.project.name}-teclado-simulado.png`, fullPage: true });
  await principal.click();
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Añadir a comida", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("tema oscuro y anchuras extremas mantienen la interfaz utilizable", async ({ page, request }, info) => {
  test.setTimeout(120000);
  await request.post("http://127.0.0.1:3199/__reset");
  const movil = info.project.name.includes("mobile");
  await page.setViewportSize(movil ? { width: 320, height: 568 } : { width: 2560, height: 1200 });
  await iniciarSesion(page);
  await irA(page, "/ajustes");
  await page.getByRole("navigation", { name: "Áreas de ajustes" }).getByRole("button", { name: /Experiencia/ }).click();
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const ruta of ["/", "/nutricion", "/progreso", "/habitos", "/ajustes"] as const) {
    await irA(page, ruta);
    await expect(page.locator("main h1").first()).toBeVisible();
    await sinDesbordamiento(page);
  }
  await page.screenshot({ path: `test-results/${info.project.name}-${movil ? "320" : "2560"}-oscuro.png`, fullPage: true });
});

test("registro permite corregir el correo tras solicitar confirmación", async ({ page }) => {
  await page.route("**/auth/v1/signup**", route => route.fulfill({ json: {
    user: { id: "00000000-0000-4000-8000-000000000003", email: "alta@ritmo.test", aud: "authenticated", created_at: new Date().toISOString() },
    session: null,
  }, headers: { "access-control-allow-origin": "http://127.0.0.1:3101", "access-control-allow-credentials": "true" } }));
  await page.goto("/registro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("alta@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
  await page.getByRole("button", { name: "Cambiar correo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Crear cuenta", exact: true })).toBeEnabled();
  await page.getByLabel("Correo electrónico", { exact: true }).fill("corregido@ritmo.test");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByText("corregido@ritmo.test", { exact: true })).toBeVisible();
});

test("onboarding valida cifras completas y conserva el alta si falla el primer pesaje", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await request.patch("http://127.0.0.1:3199/rest/v1/perfiles", { data: { onboarding_completo: false } });
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("alex@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/onboarding/);
  const continuar = page.getByRole("button", { name: "Continuar", exact: true });
  await page.getByLabel("Edad", { exact: true }).fill("18abc");
  await continuar.click();
  await expect(page.getByLabel("Edad", { exact: true })).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "Introduce una edad" })).toBeVisible();
  await page.getByLabel("Edad", { exact: true }).fill("30");
  await continuar.click();
  await page.getByLabel("Altura (cm)", { exact: true }).fill("175");
  await page.getByLabel("Peso de hoy (kg, opcional)", { exact: true }).fill("80,5");
  await continuar.click();
  await page.getByLabel(/Consiento expresamente que RITMO trate los datos de salud/i).check();
  await page.route("**/rest/v1/dias*", route => ["PATCH", "POST"].includes(route.request().method())
    ? route.fulfill({ status: 403, json: { message: "permission denied" } }) : route.continue());
  await page.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /peso|pesaje/i })).toBeVisible();
  await expect(page).toHaveURL(/onboarding/);
  await expect(page.getByRole("button", { name: "Reintentar", exact: true })).toBeEnabled();
  const perfiles = await (await request.get("http://127.0.0.1:3199/rest/v1/perfiles")).json();
  expect(perfiles[0].onboarding_completo).toBe(false);
});

test("búsqueda y navegación exponen el foco y respetan los diálogos", async ({ page, request }, info) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  const salto = page.getByRole("link", { name: "Saltar al contenido", exact: true });
  await salto.focus();
  await salto.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  if (info.project.name.includes("mobile")) {
    await expect(page.getByRole("navigation", { name: "Navegación principal móvil" }).getByRole("link", { name: "Hoy", exact: true })).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("button", { name: /Buscar/ }).click();
  const buscador = page.getByRole("combobox", { name: "Buscar o ejecutar una acción" });
  await expect(buscador).toHaveAttribute("aria-expanded", "true");
  await buscador.press("ArrowUp");
  const opcion = page.getByRole("option", { selected: true });
  await expect(opcion).toBeInViewport();
  await expect(buscador).toHaveAttribute("aria-activedescendant", await opcion.getAttribute("id") as string);
  await buscador.fill("Registrar peso");
  await buscador.press("Enter");
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Buscar o ejecutar una acción" })).toHaveCount(0);
});

test("una preferencia bloqueada no impide abrir la cuenta", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("ritmo:vista-minima:")) throw new DOMException("Storage blocked", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("ritmo:vista-minima:")) throw new DOMException("Storage blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  await iniciarSesion(page);
  await page.getByRole("button", { name: "Activar modo mínimo", exact: true }).click();
  await expect(page.getByText("No pudimos guardar esta preferencia", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
});

test("la importación mantiene el foco y permite cancelar sin escribir datos", async ({ page, request }) => {
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await irA(page, "/ajustes");
  await page.getByRole("navigation", { name: "Áreas de ajustes" }).getByRole("button", { name: /Datos y cuenta/ }).click();
  const importar = page.getByRole("button", { name: "Importar", exact: true });
  const selectorArchivo = page.waitForEvent("filechooser");
  await importar.click();
  await (await selectorArchivo).setFiles({ name: "copia-sintetica.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ app: "ritmo", version: 5, dias: { "2025-01-01": { fecha: "2025-01-01", habitos: {}, peso: 79 } } })) });
  const dialogo = page.getByRole("dialog", { name: "Confirmar importación" });
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(await dialogo.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(importar).toBeFocused();
  const dias = await (await request.get("http://127.0.0.1:3199/rest/v1/dias?fecha=eq.2025-01-01")).json();
  expect(dias).toEqual([]);
});

test("la PWA recupera sin conexión y no guarda páginas privadas", async ({ page, request, context }, info) => {
  test.skip(process.env.RITMO_E2E_PRODUCTION !== "1" || info.project.name !== "desktop", "El service worker se activa en producción; basta un contrato de caché");
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto("/nutricion");
  await expect(page.locator("main h1")).toBeVisible();
  const rutasCache = await page.evaluate(async () => {
    const cacheNames = (await caches.keys()).filter(name => name.startsWith("ritmo-"));
    return (await Promise.all(cacheNames.map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat();
  });
  expect(rutasCache).toContain("/offline");
  expect(rutasCache.every(path => path === "/offline" || path === "/manifest.json" || path === "/icon" || path.startsWith("/_next/static/") || path.startsWith("/brand/"))).toBe(true);
  await context.setOffline(true);
  await page.goto("/nutricion");
  await expect(page.getByRole("heading", { name: "Sin conexión", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a intentar" })).toBeVisible();
});

test("dos pestañas conservan sus cambios sin conexión y los sincronizan al volver", async ({ page, request, context }, info) => {
  test.skip(info.project.name === "mobile", "La coordinación se verifica en Chromium y WebKit");
  await request.post("http://127.0.0.1:3199/__reset");
  await iniciarSesion(page);
  const otra = await context.newPage();
  const erroresOtra: string[] = [];
  otra.on("pageerror", error => erroresOtra.push(error.message));
  try {
    await otra.goto("/habitos");
    await otra.getByRole("button", { name: "Día anterior", exact: true }).click();
    const fechaAnterior = await otra.getByLabel("Día que quieres editar", { exact: true }).inputValue();
    const aguaHoy = page.getByRole("main").getByRole("button", { name: /Beber agua$/ });
    const aguaAyer = otra.getByRole("button", { name: "Beber agua", exact: true });
    await expect(aguaHoy).toHaveAttribute("aria-pressed", "true");
    await expect(aguaAyer).toHaveAttribute("aria-pressed", "true");
    await context.setOffline(true);
    await Promise.all([aguaHoy.click(), aguaAyer.click()]);
    await expect(aguaHoy).toHaveAttribute("aria-pressed", "false");
    await expect(aguaAyer).toHaveAttribute("aria-pressed", "false");
    const pendientes = () => page.evaluate(() => {
      const key = Object.keys(localStorage).find(key => /^ritmo:writequeue:[^:]+$/.test(key));
      return key ? JSON.parse(localStorage.getItem(key) || "[]") as Array<{ payload: { fecha: string }; bloqueada?: boolean }> : [];
    });
    await expect.poll(async () => (await pendientes()).length).toBe(2);
    const fechas = (await pendientes()).map(op => op.payload.fecha);
    expect(fechas).toContain(fechaAnterior);
    expect(new Set(fechas).size).toBe(2);
    await context.setOffline(false);
    await expect.poll(async () => (await pendientes()).length).toBe(0);
    for (const fecha of fechas) {
      const filas = await (await request.get(`http://127.0.0.1:3199/rest/v1/dias?fecha=eq.${fecha}`)).json();
      expect(filas[0].habitos).not.toHaveProperty("beberAgua");
      expect(filas[0].habitos).toMatchObject({ comida: true, noAlcohol: true });
    }
    expect(erroresOtra).toEqual([]);
  } finally {
    await context.setOffline(false);
    await otra.close();
  }
});
