# RITMO

**Constancia sobre perfección.** Seguimiento de nutrición, peso, hábitos, actividad y progreso personal, con una predicción de peso honesta que se calibra con tus datos reales.

RITMO es un rediseño integral construido **sobre** el modelo de la aplicación anterior (`legacy/composicion`): conserva su matemática —la parte más valiosa— y la lleva a una arquitectura moderna con su propia identidad.

- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Recharts · Gemini API opcional.
- **Diseño:** sistema propio de RITMO —verde pino sobre neutros de papel cálido, tipografía Bricolage Grotesque + Hanken Grotesk, claro/oscuro coherente.

---

## 1. Qué se reutilizó del proyecto anterior

La app anterior (vanilla JS, en `legacy/composicion/`) tenía un modelo de cálculo excelente. Se **portó íntegro a TypeScript**, con sus pruebas, sin reescribir la matemática:

| Origen (legacy) | Destino (RITMO) | Qué es |
|---|---|---|
| `core/metrics.js` | [`lib/model/metrics.ts`](lib/model/metrics.ts) | Balance, **Theil–Sen robusto**, intervalos de confianza, TDEE, composición, IMC/FFMI, rachas |
| `core/analytics.js` | [`lib/model/analytics.ts`](lib/model/analytics.ts) | Arrastre acumulado, TDEE observado, proyección calibrada, resumen |
| `core/dates.js` | [`lib/model/dates.ts`](lib/model/dates.ts) | Fechas ISO locales sin bugs de huso |
| `tests/run.js` (134 comprobaciones) | [`lib/model/__tests__/model.test.ts`](lib/model/__tests__/model.test.ts) | Verifican que el port es fiel — `npm test` |
| `seed.js` (263 días, 34 mediciones) | [`lib/model/seed.ts`](lib/model/seed.ts) | Histórico real, usado como datos de la demo |
| `supabase/schema.sql` | [`supabase/schema.sql`](supabase/schema.sql) | Esquema ampliado (comidas, agua, pasos, medidas, onboarding) |

**El modelo es la joya:** no predice con `peso + kcal/7700` ingenuo. Usa la pendiente mediana de **Theil–Sen** (robusta al ruido de báscula), calibra el gasto con tu **TDEE observado** real, y abre un **intervalo de confianza** que crece cuanto más tiempo llevas sin pesarte. Se personaliza por usuario y se recalibra con cada registro nuevo.

La predicción combina tres capas verificables:

1. **Prior biológico:** Mifflin–St Jeor usa peso, altura, edad, sexo y actividad; el objetivo y las kcal configuradas determinan el balance de un día plenamente adherente.
2. **Calibración personal:** cada tramo entre dos pesajes compara el cambio real con el esperado por los hábitos. Un ajuste ridge robusto aprende el sesgo y la respuesta individual, recortando saltos extremos de agua y glucógeno.
3. **Validación walk-forward:** cada siguiente pesaje se evalúa usando únicamente tramos anteriores. La app muestra el error medio histórico y la mejora frente al prior sin personalizar, en lugar de prometer una precisión imposible.

Los días con kcal completas prevalecen sobre cualquier estimación. Cero hábitos registrados sigue siendo un superávit conservador; los hábitos personalizados solo entran en el histórico desde su primera aparición.

---

## 2. Arranque rápido (modo demo)

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>. **Sin configurar nada**, RITMO arranca en modo demo con el histórico real de ejemplo: puedes explorar todas las pantallas, registrar comidas, pesos y hábitos (se guardan en el navegador).

Pruebas del modelo:

```bash
npm test
```

---

## 3. Activar cuentas y sincronización (Supabase)

1. **Crea un proyecto** en [supabase.com](https://supabase.com) (plan gratuito; región cercana).
2. **Crea el esquema:** en *SQL Editor*, pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql). Es idempotente.
3. **Habilita email + contraseña:** *Authentication → Providers → Email*. Para confirmación por correo, deja *Confirm email* activo; añade tu dominio en *URL Configuration → Redirect URLs* (incluye `/auth/callback`).
4. **Copia las credenciales** de *Project Settings → API* a un archivo `.env.local`:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Con esto, la app pide registro/login, ejecuta el **onboarding obligatorio** y sincroniza en PostgreSQL con RLS.

---

## 4. Contador de calorías inteligente (Gemini)

El registro de comidas en lenguaje natural (“2 huevos revueltos, tostada y café con leche” → kcal + macros) puede usar **Gemini** desde una ruta de servidor ([`app/api/nutricion/route.ts`](app/api/nutricion/route.ts)). La clave nunca se envía al navegador.

Añade en `.env.local` una clave creada en [Google AI Studio](https://aistudio.google.com/app/apikey):

```env
GEMINI_API_KEY=...
GEMINI_NUTRITION_MODEL=gemini-2.5-flash
```

Gemini tiene un nivel gratuito con límites de uso que pueden cambiar; revisa la cuota de tu proyecto antes de desplegar. Google indica que el contenido enviado en el nivel gratuito puede usarse para mejorar sus productos, así que no incluyas información personal o médica en la descripción de la comida. Sin clave —o si Gemini no responde— RITMO intenta Edamam si está configurado y finalmente mantiene el estimador local. Todas las respuestas se guardan como estimaciones editables: la etiqueta del producto y las cantidades pesadas prevalecen.

---

## 5. Despliegue

**Vercel (recomendado para Next.js):**
1. Importa el repositorio en [vercel.com](https://vercel.com).
2. Añade las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` si quieres análisis con IA).
3. Deploy. Añade la URL resultante a *Redirect URLs* en Supabase.

**Netlify:** funciona con el plugin oficial `@netlify/plugin-nextjs` (build `next build`). Configura las mismas variables de entorno.

---

## 6. Estructura

```
app/
  (app)/            Panel protegido: hoy, nutricion, habitos, progreso, calendario, ajustes
  (auth)/           login, registro
  onboarding/       Alta obligatoria por pasos
  api/nutricion/    Ruta de servidor con Gemini, Edamam y fallback local
  auth/callback/    Intercambio del enlace de correo por sesión
components/
  app/              Shell, navegación, registro rápido, gráficas, heatmap, primitivos
  ui/               Componentes shadcn/ui
lib/
  model/            EL MODELO portado (metrics, analytics, dates, seed) + tests
  store/            Estado en cliente: adaptadores local/nube, provider optimista
  supabase/         Clientes browser/server + proxy de sesión
  nutrition/        Tipos, estimador offline y cliente de la API
proxy.ts            Refresco de sesión y protección de rutas (Next 16)
legacy/             La app anterior, intacta
```

Regla que mantiene el orden: **`lib/model/` es puro** (sin React, sin DOM), por eso se testea en aislamiento.

---

## 7. Diseño

Todo el color, tipografía, radios y sombras viven como tokens en [`app/globals.css`](app/globals.css). El verde de RITMO identifica peso, acción y progreso; cada familia de datos tiene su tono joya (oro para hábitos, terracota para energía, ciruela para composición, azul para agua). El color nunca es el único indicador: acompaña siempre a una etiqueta.
