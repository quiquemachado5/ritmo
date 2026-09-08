import { test, expect, type Page } from "@playwright/test";

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
  await page.getByLabel("Email").fill("alex@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await expect(page.getByLabel("Email")).toHaveValue("alex@ritmo.test");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Buenas|Buenos/).first()).toBeVisible();
}

const secciones = { "/": "Hoy", "/ajustes": "Ajustes", "/laboratorio": "Laboratorio", "/nutricion": "Nutrición", "/progreso": "Progreso", "/habitos": "Hábitos" } as const;

async function irA(page: Page, ruta: keyof typeof secciones) {
  // Las pestañas se recorren como en la app, sin destruir el documento y
  // abortar peticiones de autenticación en vuelo. La recarga se prueba aparte.
  const documento = await page.evaluate(() => performance.timeOrigin);
  const sidebar = page.locator("aside nav");
  if (await sidebar.isVisible()) {
    await sidebar.getByRole("link", { name: secciones[ruta], exact: true }).click();
  } else if (ruta === "/laboratorio" && new URL(page.url()).pathname === "/ajustes") {
    await page.getByRole("link", { name: "Abrir laboratorio", exact: true }).click();
  } else if (ruta === "/ajustes" || ruta === "/laboratorio") {
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.getByRole("menuitem", { name: "Ajustes", exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Navegación principal móvil" })
      .getByRole("link", { name: secciones[ruta], exact: true }).click();
  }
  await expect(page).toHaveURL(url => url.pathname === ruta);
  expect(await page.evaluate(() => performance.timeOrigin), "La navegación entre pestañas debe conservar el documento").toBe(documento);
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
  for (const route of ["ajustes", "laboratorio", "nutricion", "progreso", "habitos"] as const) {
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
    } else if (route === "laboratorio") {
      const interfazViva = page.getByRole("switch", { name: "Interfaz viva", exact: true });
      await expect(interfazViva).toBeChecked();
      await interfazViva.click();
      await expect(interfazViva).not.toBeChecked();
      await interfazViva.click();
      await expect(interfazViva).toBeChecked();
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
  await page.getByRole("button", { name: "Analizar otra comida" }).click();
  const prompt = page.getByRole("textbox", { name: "Descripción de la comida" });
  await prompt.fill("Ensalada con pollo y aceite de oliva");
  await page.getByRole("button", { name: "Analizar ingredientes", exact: true }).click();
  await expect(page.getByText("¿Cuánto aceite has usado en total?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "10 ml", exact: true }).click();
  await page.getByRole("button", { name: "Analizar ingredientes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toBeVisible();
  // Al cambiar la descripción se exige un nuevo análisis, sin registrar cifras antiguas.
  await prompt.fill("100 g de arroz cocido con 2 filetes de pollo y 30 g de tahini");
  await expect(page.getByRole("button", { name: "Añadir a comida", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Volver a analizar", exact: true }).click();
  await expect(page.getByText("Hay texto sin interpretar", { exact: true })).toBeVisible();
  await expect(page.getByText("tahini", { exact: true })).toBeVisible();
  await expect(page.getByText("Unidades · peso aprox.", { exact: true })).toBeVisible();
  await page.getByText("Fuentes y valores por 100 g", { exact: true }).click();
  await expect(page.locator('a[href="https://fdc.nal.usda.gov/food-details/169757/nutrients"]')).toBeVisible();
  await expect(page.getByText("Referencia local pendiente de verificar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Corregir pollo/ }).click();
  await page.getByLabel("Peso en gramos · recalcula nutrientes").fill("100");
  await page.getByRole("button", { name: "Aplicar corrección", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/295\s*kcal/).first()).toBeVisible();
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
  await page.getByLabel("Email").fill("bea@ritmo.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoTest123");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByText(/Buenas tardes, Bea|Buenos días, Bea|Buenas noches, Bea/)).toBeVisible();
  await irA(page, "/nutricion");
  await expect(page.getByText("100 g de arroz cocido con 2 filetes de pollo y 30 g de tahini", { exact: false })).toHaveCount(0);
  expect(analisisRemotos).toEqual([]);
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
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const ruta of ["/", "/nutricion", "/progreso", "/habitos", "/ajustes"] as const) {
    await irA(page, ruta);
    await expect(page.locator("main h1").first()).toBeVisible();
    await sinDesbordamiento(page);
  }
  await page.screenshot({ path: `test-results/${info.project.name}-${movil ? "320" : "2560"}-oscuro.png`, fullPage: true });
});
