---
name: "Composición"
description: "Libreta de seguimiento cromática para hábitos, peso y composición corporal."
colors:
  canvas: "#f4f6fc"
  surface: "#ffffff"
  surface-2: "#eef1f7"
  surface-3: "#e1e7f0"
  border: "#dce3ef"
  border-strong: "#c5cfdf"
  ink: "#18213b"
  ink-2: "#3c4862"
  ink-3: "#526078"
  ink-4: "#5b6880"
  weight: "#4559d7"
  weight-hover: "#3548bf"
  weight-active: "#293a9c"
  weight-soft: "#aeb9ff"
  weight-wash: "#eef0ff"
  weight-border: "#c8d0ff"
  weight-ink: "#3346b7"
  habit: "#07866b"
  habit-soft: "#91d6bf"
  habit-wash: "#e9f8f2"
  habit-border: "#b9eadb"
  habit-ink: "#057158"
  energy: "#d85d42"
  energy-soft: "#f4ae9d"
  energy-wash: "#fff0ec"
  energy-border: "#f8cfc4"
  energy-ink: "#ad442f"
  body: "#754bc0"
  body-soft: "#c5afea"
  body-wash: "#f4effd"
  body-border: "#ddcef6"
  body-ink: "#6335ad"
  warning: "#bd7b12"
  warning-wash: "#fff7e7"
  warning-border: "#f1d59b"
  warning-ink: "#95600b"
typography:
  display:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 5.5vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  metric:
    fontFamily: "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 7vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.035em"
rounded:
  sm: "9px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  pill: "999px"
spacing:
  gap-mobile: "12px"
  gap-desktop: "16px"
  card-mobile: "16px"
  card-desktop: "20px"
  page-mobile: "18px"
  page-desktop: "24px"
  section: "48px"
  touch: "44px"
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
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "{spacing.touch}"
  chip-habit:
    backgroundColor: "{colors.habit-wash}"
    textColor: "{colors.habit-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
---

# Design System: Composición

## Overview

**Creative North Star: "Libreta de seguimiento cromática"**

Composición convierte el seguimiento personal en una libreta activa: peso, hábitos, energía y cuerpo se entienden como asuntos distintos y legibles, nunca como la misma cifra azul. El fondo azul grisáceo contiene tarjetas blancas, mientras los lavados de color organizan cada dominio sin perder sobriedad.

La lectura prioriza estado actual y próxima revisión; después permite registrar el día y estudiar la evolución. Las mediciones reales, estimaciones e imputaciones conservan etiquetas explícitas y no se presentan como equivalentes.

**Key Characteristics:**

- Jerarquía de datos clara, compacta y móvil primero.
- Cuatro familias cromáticas persistentes, aplicadas por significado.
- Superficies de papel, bordes suaves y profundidad contenida.

## Colors

La paleta usa color como categoría de información y conserva tinta neutra para el texto y los valores críticos.

### Primary

- **Índigo de peso:** identifica el estado de peso, los controles principales por defecto y el panel de resumen.

### Secondary

- **Verde azulado de hábitos:** identifica registro, cumplimiento, objetivos y estados favorables de hábitos.
- **Coral de energía:** identifica balance diario, consumo y gasto; no indica por sí solo que un resultado sea bueno o malo.

### Tertiary

- **Violeta de composición:** delimita mediciones y previsiones corporales.
- **Ocre de advertencia:** acompaña datos pendientes, inciertos o que requieren atención.

### Neutral

- **Papel azul grisáceo:** soporta el lienzo y las capas secundarias.
- **Blanco de tarjeta:** mantiene los formularios, tablas y contenido de consulta limpios.
- **Tinta azul noche:** sostiene títulos, cifras tabulares y la lectura cotidiana.

### Named Rules

**The Four Families Rule.** Índigo es peso, verde azulado es hábito, coral es energía y violeta es cuerpo. No se intercambian para decorar ni se reduce todo a un único acento.

**The Labelled Evidence Rule.** El color acompaña etiquetas como «medido», «estimado», «anotado» o «sin registrar»; nunca sustituye esa evidencia textual.

## Typography

**Display Font:** Onest con la pila de sistema como respaldo.

**Body Font:** Onest con la pila de sistema como respaldo.

**Character:** Una sans contemporánea y firme mantiene la libreta precisa, sin tono clínico. Las cifras usan tabulares y un espaciado apretado para que los cambios sean comparables de un vistazo.

### Hierarchy

- **Display:** abre cada vista con un título claro y de alto contraste.
- **Headline:** nombra secciones y sostiene la navegación de lectura.
- **Body:** explica contexto, rangos y ayuda sin competir con el dato.
- **Metric:** reserva el mayor peso visual para valor actual, objetivo y balance.
- **Label:** usa versalitas espaciadas para claves de métrica y microestados.

### Named Rules

**The Tabular Number Rule.** Pesos, calorías, porcentajes y deltas se componen con cifras tabulares; un dato que se actualiza no debe desplazar la lectura.

## Layout

La base es una sola columna compacta. El contenedor llega hasta 1240px y gana una rejilla de 12 columnas a partir de 768px; las métricas breves permanecen en dos columnas desde móvil y pasan a tres o cuatro cuando el ancho lo permite. La barra de navegación queda fija al alcance del pulgar en móvil y se convierte en un control segmentado dentro de la cabecera en escritorio.

La página usa márgenes laterales y relleno de tarjeta propios de cada tamaño, con un ritmo corto dentro de tarjetas y una separación mayor entre secciones temáticas. A 900px puede aparecer el descriptor de marca; las reglas intermedias de la rejilla evitan columnas demasiado estrechas entre 768px y 1023px.

## Elevation & Depth

La profundidad es híbrida: las tarjetas base se separan con borde fino y sombra ambiental baja; las tarjetas de contexto semántico suelen usar lavado y borde de su familia sin sombra. La tarjeta de peso actual, los modales y los avisos efímeros reciben la elevación fuerte. Las definiciones exactas de sombra están en el sidecar.

### Named Rules

**The Tonal Card Rule.** Cuando una tarjeta pertenece a hábitos, energía o composición, la familia se expresa primero con lavado y borde; la sombra no compite con ese significado.

## Shapes

Las formas son amables y funcionales: controles y días de calendario usan esquinas pequeñas, campos y botones el radio medio, y tarjetas el radio amplio. Las píldoras se reservan para chips, sincronización, progreso y estados compactos. Los bordes son finos y azul grisáceos; las barras se recortan como píldoras para que el avance se lea como continuidad, no como bloques decorativos.

## Components

### Buttons

- **Character:** controles táctiles, firmes y contenidos.
- **Primary:** en la vista general y ajustes usa la familia de peso; en Registro se convierte en hábito y en Cuerpo en composición. Conserva la misma silueta, altura y tipografía.
- **Secondary / Ghost:** superficie blanca con borde para tareas secundarias; el fantasma quita el borde hasta la interacción. La variante de peligro sigue siendo discreta hasta hover.
- **Hover / Focus:** el relleno avanza a la tinta de su familia; el foco mantiene un anillo visible contextual.

### Chips

- **Style:** píldoras compactas con lavado, borde y tinta de la familia correspondiente.
- **State:** neutro para contexto, violeta para previsión, verde para resultado anotado o favorable, coral para energía y ocre para advertencia. La etiqueta siempre expone el estado.

### Cards / Containers

- **Character:** una tarjeta responde a una pregunta, y las zonas internas se separan con línea antes que con nuevas cajas.
- **Variants:** la tarjeta de peso actual es índigo sólido y elevada; objetivo es verde azulado; previsión y composición son violetas; el día energético es coral; la tarjeta normal queda blanca.
- **Padding:** la escala cambia de móvil a escritorio sin perder la retícula interior.

### Inputs / Fields

- **Style:** campo blanco de altura táctil, borde perceptible y número tabular.
- **Focus:** el anillo toma la familia de la vista: peso por defecto, hábito en Registro y cuerpo en Composición.
- **Error / Disabled:** no hay una variante de error específica implementada; deshabilitado reduce opacidad y deja de aceptar interacción.

### Navigation

- **Mobile:** cuatro destinos con icono y etiqueta en una barra inferior fija; el destino activo adopta su color semántico.
- **Desktop:** el mismo conjunto se presenta como un control segmentado de superficie gris suave con una píldora blanca móvil para la opción activa.

### Habit Controls

- **Style:** botones de selección de tamaño táctil con casilla cuadrada y comprobación SVG.
- **State:** dentro de Registro, un hábito marcado pasa a lavado, borde, texto y casilla verde azulado; la confirmación no depende solo del color.

### Calendar

- **Style:** celdas cuadradas suaves con cuatro intensidades de cumplimiento, selección por borde y punto para un pesaje.
- **Missing data:** un día imputado usa rayado, evitando que se confunda con un registro real.

## Do's and Don'ts

### Do:

- **Do** usar la familia del dominio en su vista, tarjeta, chip, control principal y foco.
- **Do** preservar las etiquetas de medición, estimación, imputación y registro junto al color.
- **Do** usar lavados y bordes semánticos para información secundaria; reservar la elevación fuerte para estado actual, modales y toasts.
- **Do** mantener los números tabulares y el orden estado actual → próxima revisión → registro → evolución.

### Don't:

- **Don't** presentar una estimación o un dato imputado con la misma certeza visual que una medición de báscula.
- **Don't** reutilizar índigo, verde azulado, coral o violeta como adorno intercambiable.
- **Don't** volver a una pantalla de tarjetas azules homogéneas ni usar color sin una etiqueta, signo o patrón legible.
- **Don't** añadir densidad mediante tarjetas anidadas cuando una zona y una línea divisoria bastan.
