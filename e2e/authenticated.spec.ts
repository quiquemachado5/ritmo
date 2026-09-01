import { expect, test, type Page } from "@playwright/test";

const accountA = { email: process.env.E2E_USER_A_EMAIL || "", password: process.env.E2E_USER_A_PASSWORD || "" };
const accountB = { email: process.env.E2E_USER_B_EMAIL || "", password: process.env.E2E_USER_B_PASSWORD || "" };
const hasAccounts = Boolean(accountA.email && accountA.password && accountB.email && accountB.password);

async function login(page: Page, account: typeof accountA) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/(onboarding)?$/);
}

test("registro móvil mantiene el formulario utilizable y valida la confirmación", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Caso específico de móvil");
  await page.goto("/registro");
  await page.getByLabel("Email").fill("e2e-mobile@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("RitmoE2E!2026");
  await page.getByLabel("Confirmar").fill("RitmoE2E!2027");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Las contraseñas no coinciden" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect((await page.getByRole("button", { name: "Crear cuenta" }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("cerrar sesión y cambiar de cuenta no conserva la identidad anterior", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "La identidad se cubre una vez en escritorio");
  test.skip(!hasAccounts, "Configura las dos cuentas E2E en el entorno");
  await login(page, accountA);
  await page.goto("/ajustes");
  await expect(page.getByText(accountA.email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, accountB);
  await page.goto("/ajustes");
  await expect(page.getByText(accountB.email, { exact: true })).toBeVisible();
  await expect(page.getByText(accountA.email, { exact: true })).toHaveCount(0);
});

test("un hábito registrado offline entra en cola y se sincroniza al reconectar", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "La sincronización se cubre una vez en escritorio");
  test.skip(!hasAccounts, "Configura una cuenta E2E con onboarding completo");
  await login(page, accountA);
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.getByRole("button", { name: "Hábitos", exact: true }).click();
  const habit = page.getByRole("button", { name: /Comida|Cena|Sin alcohol|Deporte|Beber agua|Dormir bien/ }).first();
  const initial = await habit.getAttribute("aria-pressed");

  await context.setOffline(true);
  await habit.click();
  await expect(page.getByText(/Sin conexión/)).toBeVisible();
  await expect(page.getByText(/1 cambio en cola/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión/)).toBeHidden({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await page.getByRole("button", { name: "Hábitos", exact: true }).click();
  const persisted = page.getByRole("button", { name: /Comida|Cena|Sin alcohol|Deporte|Beber agua|Dormir bien/ }).first();
  await expect(persisted).toHaveAttribute("aria-pressed", initial === "true" ? "false" : "true");
  await persisted.click();
});
