---
name: "Composición"
description: "Seguimiento corporal claro que separa el dato medido de la estimación."
colors:
  canvas: "#f6f8fa"
  surface: "#ffffff"
  surface-2: "#f1f4f8"
  surface-3: "#e9eef5"
  border: "#dfe6ee"
  border-strong: "#c7d2df"
  ink: "#1d2939"
  ink-2: "#344054"
  ink-3: "#667085"
  ink-4: "#98a2b3"
  overlay: "rgba(15, 23, 42, .45)"
  weight: "#2f6fdb"
  weight-hover: "#1f5fbe"
  weight-active: "#184fa9"
  weight-soft: "#9fc5ff"
  weight-wash: "#eff6ff"
  weight-border: "#bfdbfe"
  weight-ink: "#175cd3"
  habit: "#3d9b70"
  habit-soft: "#9bd5b8"
  habit-wash: "#effaf3"
  habit-border: "#bce8ce"
  habit-ink: "#287c55"
  energy: "#e16d57"
  energy-soft: "#f2ae9d"
  energy-wash: "#fff1ed"
  energy-border: "#f6c9be"
  energy-ink: "#b44f3d"
  body: "#7f56d9"
  body-soft: "#c4b5fd"
  body-wash: "#f4f1ff"
  body-border: "#ddd4fe"
  body-ink: "#6941c6"
  warning: "#bd7b12"
  warning-wash: "#fff7e7"
  warning-border: "#f1d59b"
  warning-ink: "#95600b"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4.5vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.375rem, 4vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.06em"
  input:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  metric:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.625rem, 6vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  metric-hero:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.125rem, 8vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.052em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  gap-mobile: "12px"
  gap-desktop: "16px"
  card-mobile: "16px"
  card-desktop: "20px"
  page-inline: "clamp(16px, 3vw, 32px)"
  section: "44px"
  section-history: "56px"
  touch: "44px"
  header-mobile: "56px"
  header-desktop: "64px"
  tabbar-mobile: "60px"
components:
  button-primary:
    backgroundColor: "{colors.weight}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "{spacing.touch}"
  button-primary-habit:
    backgroundColor: "{colors.habit}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "{spacing.touch}"
  button-primary-body:
    backgroundColor: "{colors.body}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "{spacing.touch}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "{spacing.touch}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-mobile}"
  overview-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-mobile}"
  forecast-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-mobile}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "{spacing.touch}"
  chip-estimate:
    backgroundColor: "{colors.body-wash}"
    textColor: "{colors.body-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  habit-toggle-on:
    backgroundColor: "{colors.habit-wash}"
    textColor: "{colors.habit-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "{spacing.touch}"
  navigation-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.weight}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "42px"
---

# Design System: Composición

## Overview

**Creative North Star: "La revisión de salud calibrada"**

Composición se siente como una revisión de salud personal de alta calidad: sobria, clara y preparada para el uso cotidiano. La composición aprobada prioriza el estado de peso, la próxima revisión, el trabajo de hoy y la evolución, con superficies blancas sobre un fondo gris frío y una cabecera que no compite con los datos.

El sistema no trata una predicción como una medición. El último pesaje queda anclado como evidencia; el momento presente marca el cambio de certeza; y la proyección aparece después como una estimación con rango. La claridad de esa transición importa más que la decoración de la tarjeta.

**Key Characteristics:**

- Jerarquía de seguimiento: estado, próxima revisión, hoy, composición e histórico.
- Color semántico contenido sobre superficies neutras; el azul no invade la pantalla.
- Datos numéricos estables, etiquetas explícitas y un cambio visible entre medido y estimado.

## Colors

La base es blanca y gris fría; las familias cromáticas identifican el dominio y el nivel de certeza sin sustituir el texto.

### Primary

- **Azul de peso:** acción principal, selección de Panel, marca, estado de peso y tramo medido del raíl de previsión.
- **Escala de azul de peso:** la variante de interacción oscurece la acción; las variantes suave, lavado, borde y tinta construyen foco, marca y contexto sin crear fondos dominantes.

### Secondary

- **Verde de hábitos:** Registro, hábitos confirmados, objetivos y estados favorables.
- **Coral de energía:** balance diario, ingesta y gasto; identifica el dominio, no un juicio de valor.

### Tertiary

- **Violeta de composición:** mediciones de cuerpo y la previsión de peso; el violeta claro puntea el tramo estimado para diferenciarlo del pesaje real.
- **Ocre de advertencia:** datos sin registrar, incertidumbre y atención pendiente.

### Neutral

- **Lienzo gris frío:** sostiene la página sin transformar la app en un panel oscuro.
- **Superficies blancas y grises suaves:** delimitan tarjetas, navegación y controles en capas ligeras.
- **Tintas azul grisáceas:** organizan el orden de lectura desde cifra y título hasta metadato tenue.

### Named Rules

**The Evidence First Rule.** Azul continuo y etiqueta de medición representan evidencia de báscula; violeta discontinuo y etiqueta de estimación representan proyección. No intercambiar los dos lenguajes.

**The Contained Color Rule.** El color se concentra en acción, selección, categoría y estado. Las superficies de lectura permanecen neutrales salvo un contexto operativo breve.

## Typography

**Display Font:** Archivo, con una pila de sistema como respaldo.

**Body Font:** Archivo, con una pila de sistema como respaldo.

**Character:** Archivo da a la interfaz una precisión cordial, más cercana a un registro fiable que a una ficha clínica. El contraste entre títulos compactos, etiquetas pequeñas y cifras anchas ordena una revisión rápida.

### Hierarchy

- **Display:** abre cada vista, como «Tu progreso», y se equilibra para no romper la columna en móvil.
- **Headline:** nombra secciones temáticas sin competir con su cifra principal.
- **Title:** se reserva para títulos de panel o diálogo que requieren una escala intermedia.
- **Body:** explica modelo, rango, contexto y acción; los textos de apoyo no deben superar el peso visual de un dato.
- **Metric / Metric hero:** prioriza peso, balance, objetivo y las dos paradas del raíl.
- **Label:** introduce claves breves, microestados y metadatos; puede usar mayúsculas espaciadas cuando la implementación ya lo hace.

### Named Rules

**The Tabular Number Rule.** Pesos, calorías, porcentajes, fechas cuantificadas y deltas usan cifras tabulares; una actualización no debe mover el dato adyacente.

## Layout

La página es mobile-first y usa una sola columna hasta el escritorio. El contenedor central limita su anchura y conserva un margen lateral fluido. En móvil, la navegación de cuatro destinos queda fija en el borde inferior y el cuerpo deja su espacio seguro; desde escritorio pasa a la cabecera como navegación horizontal subrayada.

La rejilla se vuelve de doce columnas desde 768px. Las métricas ocupan dos columnas mientras caben, pasan a tres o cuatro desde 520px y vuelven a apilarse en el ancho más estrecho. Entre 768px y 1023px, los bloques de lectura compleja recuperan todo el ancho para no forzar tarjetas comprimidas. El relleno de tarjeta y la separación de rejilla crecen en escritorio.

El raíl de previsión es horizontal desde 680px: última báscula a la izquierda, tramo azul continuo, marcador «Hoy», tramo violeta discontinuo y próximo pesaje a la derecha. Por debajo de 680px, el mismo orden se vuelve vertical; se ocultan las líneas y el segundo hito empieza tras un divisor. Nunca se elimina la distinción textual «Medido» / «Estimado» ni el rango orientativo.

## Elevation & Depth

La profundidad es deliberadamente contenida. Las tarjetas normales se separan con borde fino, no con una pila de sombras; la tarjeta de estado actual usa elevación media como prioridad puntual. La cabecera es plana y blanca; un velo oscuro reservado a modales y la elevación fuerte de modales y toasts señalan la superposición al trabajo. Las transiciones son breves y respetan el modo de movimiento reducido.

### Shadow Vocabulary

- **Separación baja:** apoya controles o tarjetas cuando necesitan despegar mínimamente del lienzo.
- **Estado principal:** eleva la tarjeta de peso actual sin convertirla en un héroe visual pesado.
- **Capa flotante:** reserva la sombra fuerte a modales y avisos efímeros.
- **Foco:** un anillo contextual hace visible el campo activo; cambia a verde en Registro y a violeta en Cuerpo.

### Named Rules

**The Flat Reading Rule.** La lectura cotidiana se organiza con espacio, borde y jerarquía tipográfica. La sombra solo indica prioridad o superposición.

## Shapes

La geometría es suavemente técnica: esquinas pequeñas para navegación, botones y campos; tarjetas con la esquina amplia; y píldoras solo para chips, barras y estados compactos. Los bordes son claros y discretos. Los tramos del raíl se mantienen lineales y el punto de «Hoy» es circular para que el cambio de evidencia se lea como un hito, no como una decoración.

## Components

### Buttons

- **Character:** controles táctiles, contenidos y directos.
- **Primary:** azul de peso por defecto; cambia a verde en Registro y a violeta en Cuerpo sin cambiar la silueta ni la jerarquía.
- **Secondary / Ghost:** blanco con borde de control para edición; el fantasma solo gana superficie en interacción. Peligro no usa un rojo dominante en reposo.
- **Hover / Focus:** oscurecer la familia correspondiente en hover; mostrar foco contextual visible y no depender del cambio de relleno.

### Chips

- **Style:** píldoras compactas con borde y lavado semántico.
- **State:** violeta para previsión, verde para anotado o favorable, coral para energía y ocre para advertencia. El texto sigue nombrando «Estimado», «Anotado» o «Sin registrar».

### Cards / Containers

- **Character:** una tarjeta responde a una pregunta; las subsecciones relacionadas se dividen con una línea, no con tarjetas anidadas.
- **Overview:** superficie blanca, borde azul de peso y elevación media. Es la referencia de estado, no un bloque de marca oscuro.
- **Forecast:** superficie blanca y borde violeta; contiene el raíl medido → Hoy → estimado, horizontes y detalle del modelo.
- **Today / Body / Habit:** conservan superficie blanca con borde coral, violeta o verde según el dominio; el color no cubre la tarjeta completa.

### Inputs / Fields

- **Style:** campo blanco de altura táctil, borde perceptible y datos numéricos tabulares.
- **Focus:** azul por defecto; verde en Registro y violeta en Cuerpo. El contraste de foco se mantiene además del cambio de color.
- **Disabled:** reduce la opacidad y deja de aceptar interacción. No existe una variante de error específica implementada.

### Navigation

- **Mobile:** cuatro destinos con icono y etiqueta en una barra inferior fija; el activo toma el color semántico de su vista.
- **Desktop:** los mismos destinos pasan a la cabecera como acciones horizontales con una línea inferior en el color activo; no usar la antigua píldora segmentada.

### Habit Controls

- **Style:** botón táctil con casilla cuadrada y comprobación SVG.
- **State:** en Registro, el marcado combina lavado, borde, texto y marca verde; la confirmación no depende solo del color.

### Forecast Rail

- **Structure:** última báscula medida → hoy → próximo pesaje estimado; los horizontes de 7 y 30 días quedan después del raíl.
- **Evidence:** el segmento medido es azul continuo; tras «Hoy», el estimado es violeta claro discontinuo. Cada parada conserva cifra, fecha o horizonte, estado y rango.
- **Responsive:** la transición se muestra como punto con anillo en horizontal y como secuencia dividida en móvil. No convertir el tramo estimado en una continuidad azul.

## Do's and Don'ts

### Do:

- **Do** mantener la secuencia estado actual → próxima revisión → hoy → composición → histórico en el Panel.
- **Do** unir cada color semántico a su dominio y acompañarlo con etiqueta, signo, fecha, rango o patrón legible.
- **Do** preservar en el raíl el hito de «Hoy», el tramo azul continuo medido y el violeta discontinuo estimado.
- **Do** conservar controles de al menos altura táctil y el foco contextual visible.
- **Do** dejar que el borde, el espacio y el texto hagan la mayor parte de la jerarquía.

### Don't:

- **Don't** presentar un valor estimado o imputado con la misma evidencia visual que un pesaje real.
- **Don't** usar el azul, verde, coral o violeta como adornos intercambiables ni bañar toda la interfaz en una familia.
- **Don't** volver a una navegación de escritorio en píldora segmentada cuando la implementación vigente usa pestañas subrayadas.
- **Don't** comprimir el raíl horizontal en móvil: debe apilarse sin perder sus etiquetas ni el rango.
- **Don't** crear densidad mediante tarjetas dentro de tarjetas cuando un divisor de zona es suficiente.
