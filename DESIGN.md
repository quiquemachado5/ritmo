---
name: "Composición"
description: "Hoja sanitaria luminosa para seguir hábitos, peso y composición corporal con claridad."
colors:
  canvas: "#f8fafc"
  surface: "#ffffff"
  surface-2: "#f5f7fa"
  surface-3: "#edf1f6"
  border: "#e1e7ef"
  border-strong: "#cbd5e1"
  ink: "#152238"
  ink-2: "#334155"
  ink-3: "#56657b"
  ink-4: "#5b6880"
  overlay: "rgba(15, 23, 42, .45)"
  weight: "#1f6fda"
  weight-hover: "#1765d1"
  weight-active: "#1356b3"
  weight-soft: "#9bc7ff"
  weight-wash: "#eef5ff"
  weight-border: "#c7dcff"
  weight-ink: "#1b63c9"
  habit: "#347b55"
  habit-soft: "#a9dbbb"
  habit-wash: "#effaf3"
  habit-border: "#c3e8d0"
  habit-ink: "#347b55"
  energy: "#bd4b3c"
  energy-soft: "#f7b7aa"
  energy-wash: "#fff1ed"
  energy-border: "#f8d0c8"
  energy-ink: "#a44235"
  body: "#7768ca"
  body-soft: "#c9c0f0"
  body-wash: "#f4f2ff"
  body-border: "#ded8fa"
  body-ink: "#6557ae"
  warning: "#bd7b12"
  warning-wash: "#fff7e7"
  warning-border: "#f1d59b"
  warning-ink: "#95600b"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.85rem, 3.4vw, 2.55rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.04rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.375rem, 4vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.022em"
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.012em"
  label:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.06em"
  input:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  metric:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.8rem, 3.8vw, 2.4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.06em"
  metric-hero:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.35rem, 6vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.075em"
rounded:
  sm: "9px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  pill: "999px"
spacing:
  gap-mobile: "12px"
  gap-desktop: "16px"
  card-mobile: "18px"
  card-desktop: "22px"
  page-inline: "clamp(16px, 3vw, 32px)"
  touch: "44px"
  header-mobile: "60px"
  header-desktop: "64px"
  tabbar-mobile: "60px"
components:
  button-primary:
    backgroundColor: "{colors.weight}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "42px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "{spacing.touch}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-desktop}"
  overview-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-desktop}"
  forecast-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  chip-estimate:
    backgroundColor: "{colors.body-wash}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  habit-toggle-on:
    backgroundColor: "{colors.habit-wash}"
    textColor: "{colors.habit-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 11px"
    height: "48px"
  navigation-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.weight}"
    rounded: "{rounded.pill}"
    padding: "0 17px"
    height: "{spacing.header-desktop}"
---

# Design System: Composición

## Overview

**Creative North Star: "La hoja sanitaria calibrada"**

Composición se presenta como una hoja de seguimiento personal, luminosa y rigurosa: fondo de papel frío, módulos blancos de borde fino y una tinta azul profunda que estructura la lectura. La referencia vinculante se traduce en espacio blanco generoso, iconografía de trazo ligero, reglas discretas y grandes áreas que conectan datos relacionados en vez de apilarlos como widgets aislados.

La interfaz prioriza la revisión cotidiana antes que la ornamentación. Cada bloque responde a una sola pregunta; el color aparece para indicar dominio, acción o certeza, y nunca sustituye texto, fecha, rango o patrón. El peso real, el presente y la previsión siguen un orden visual explícito.

**Key Characteristics:**

- Hoja clínica clara: superficie blanca, contornos tenues y jerarquía editorial de alto contraste.
- Azul profundo para peso y acción; verde para hábitos, coral para energía, violeta para cuerpo y estimación.
- Módulos continuos para estado, jornada, evolución y composición; divisores internos antes que tarjetas anidadas.
- Cifras tabulares y etiquetas visibles para distinguir medición, dato introducido y estimación.

## Colors

La paleta mantiene el papel en neutros fríos y reserva las familias cromáticas para hechos que la persona debe reconocer rápidamente.

### Primary

- **Azul de seguimiento:** identifica peso, acción principal, navegación activa, gráficos y el tramo de evidencia medida.
- **Escala azul:** hover, active, soft, wash, border e ink construyen respuesta, foco y contexto sin llenar las superficies de lectura.

### Secondary

- **Verde de hábito:** identifica Registro, consistencia, estados confirmados y resultados favorables.
- **Escala verde:** el lavado, borde y tono suave forman estados marcados que conservan texto y marca de verificación.

### Tertiary

- **Coral de energía:** delimita ingesta, gasto, balance y acciones de ajuste relacionadas.
- **Violeta de cuerpo:** delimita composición corporal y predicciones; su línea discontinua expresa un tramo estimado.
- **Ocre de atención:** acompaña incertidumbre o registros pendientes; debe conservar su etiqueta explicativa.

### Neutral

- **Papel frío:** canvas, surface-2 y surface-3 sostienen la página, las áreas tranquilas y los fondos de apoyo.
- **Superficie blanca:** el plano principal de módulos, campos, tablas y navegación.
- **Tinta azul grisácea:** ink establece la lectura principal; ink-2, ink-3 e ink-4 degradan a control, ayuda y metadato.
- **Reglas suaves:** border y border-strong ordenan zonas, controles y tablas sin crear una cuadrícula pesada.

### Named Rules

**The Evidence Line Rule.** El segmento azul sólido siempre representa un dato medido; el violeta discontinuo siempre representa una estimación. Ambos conservan una etiqueta que nombra su condición.

**The Quiet Surface Rule.** El color semántico vive en bordes, iconos, líneas, texto de estado y lavados breves. El área principal de lectura permanece blanca o gris muy clara.

## Typography

**Display Font:** Manrope, con pila de sistema como respaldo.

**Body Font:** Manrope, con pila de sistema como respaldo.

**Character:** Manrope aporta una precisión técnica amable: títulos compactos y pesados para orientar, texto de apoyo más sereno y cifras firmes que se leen como datos, no como decoración.

### Hierarchy

- **Display:** abre cada vista y fija la prioridad de la página.
- **Headline:** titula secciones de trabajo y lecturas agrupadas.
- **Title:** nombra paneles, diálogos y jerarquías intermedias.
- **Body:** explica rangos, modelo, fecha y contexto; mantiene líneas cómodas dentro de la columna.
- **Label:** introduce claves breves, columnas, microestados y navegación; puede usar mayúsculas espaciadas.
- **Input:** mantiene valores introducidos claramente legibles en controles táctiles.
- **Metric / Metric hero:** reservados a peso, balance, objetivo y cifras de estado.

### Named Rules

**The Stable Figure Rule.** Pesos, calorías, porcentajes, fechas cuantificadas y deltas usan cifras tabulares. Una actualización no puede desplazar la lectura de la cifra vecina.

## Layout

El contenedor central tiene un límite amplio y un margen lateral fluido; la página respira con una cabecera limpia y bloques separados por ritmo vertical, no por decoración. La rejilla es de una columna por defecto y pasa a doce columnas desde 768px. Entre 768px y 1023px, los grupos complejos recuperan todo el ancho o se separan en tarjetas individuales para mantener la lectura.

Por encima de 960px, la cabecera alberga las cuatro secciones en pestañas horizontales subrayadas. Por debajo, la misma navegación se fija abajo en una barra de cuatro destinos; el contenido reserva su espacio seguro. Las parejas de módulos se conectan visualmente en escritorio con borde compartido y esquinas exteriores, y se convierten en tarjetas completas con separación en móvil.

El raíl de previsión se lee de izquierda a derecha en escritorio: última báscula, línea medida, hito «Hoy», línea estimada y próximo pesaje. Bajo el umbral móvil se apila en el mismo orden; nunca desaparecen las etiquetas de condición ni el rango orientativo.

## Elevation & Depth

El sistema es esencialmente plano: borde, separación y fondo tonal organizan el trabajo cotidiano. La elevación aparece solo cuando una capa necesita prioridad real. La tarjeta normal no lleva sombra; modales y toasts usan una capa superior, y el estado de foco combina contorno visible con halo contextual. Las transiciones de control usan una curva breve y se anulan con la preferencia de movimiento reducido.

### Shadow Vocabulary

- **Separación baja** (\`0 1px 2px rgba(15, 23, 42, 0.025)\`): detalle leve para elementos que necesitan apenas despegarse.
- **Elevación media** (\`0 10px 28px rgba(15, 23, 42, 0.055)\`): capas flotantes discretas, como un toast.
- **Capa alta** (\`0 20px 44px -28px rgba(16, 24, 40, 0.26), 0 8px 16px -14px rgba(16, 24, 40, 0.08)\`): panel de modal sobre el velo.
- **Foco** (\`0 0 0 4px rgba(47, 111, 219, 0.14)\`): halo de peso y ajustes; Registro y Cuerpo cambian a la familia correspondiente.

### Named Rules

**The Flat Reading Rule.** Las sombras no sustituyen la jerarquía. Usar superficie, línea y espacio primero; elevar solo una prioridad o una capa superpuesta.

## Shapes

La geometría es técnica y amable. Botones, iconos y campos usan la esquina pequeña; las tarjetas y grupos conectados usan la esquina amplia; las píldoras quedan reservadas para chips, barras y el pequeño indicador activo de la navegación móvil. Los bordes son de un píxel y las uniones entre módulos eliminan el radio interior para que se perciban como una hoja de trabajo continua.

## Components

### Buttons

- **Character:** acciones compactas, firmes y táctiles.
- **Primary:** azul de peso sobre blanco; en Cuerpo adopta violeta. El hover oscurece el mismo dominio y el active profundiza otro paso.
- **Secondary / Ghost:** blanco con borde para edición; el fantasma retira el borde y el fondo hasta la interacción.
- **Focus:** anillo visible y separado de la silueta; no se comunica solo con el cambio de relleno.

### Chips

- **Style:** píldora corta, borde semántico y lavado tenue.
- **State:** violeta para previsión, verde para confirmado, coral para energía y ocre para atención. La etiqueta verbal permanece siempre.

### Cards / Containers

- **Character:** un módulo responde a una pregunta; los detalles relacionados se separan con una regla interior.
- **Groups:** en escritorio, resumen, jornada, registro, cuerpo e histórico conectan tarjetas adyacentes con una sola figura exterior.
- **Responsive:** en móvil cada módulo recupera su borde y radio completos para que el contenido respire.
- **Forecast:** superficie blanca con borde azul y la evidencia como eje; los horizontes y detalles se organizan por reglas, no por contenedores anidados.

### Inputs / Fields

- **Style:** superficie blanca, borde perceptible y altura táctil.
- **Focus:** azul por defecto y violeta en Cuerpo; el foco conserva un halo además del cambio de borde.
- **Numbers:** peso, porcentaje y energía usan cifras tabulares.

### Navigation

- **Desktop:** cabecera blanca de línea fina; el destino activo se expresa con color semántico y subrayado, nunca con una píldora segmentada.
- **Mobile:** barra fija inferior de cuatro columnas con icono, etiqueta y un indicador superior del color activo.
- **Iconography:** SVG de trazo ligero, siempre acompañados por texto en la navegación.

### Habit Controls

- **Style:** filas táctiles blancas con una casilla cuadrada.
- **State:** el marcado combina borde verde, lavado, texto verde y check SVG. Ningún estado depende solo del color.

### Forecast Rail

- **Structure:** última báscula medida → Hoy → próximo pesaje estimado.
- **Evidence:** línea azul sólida para la medición, punto «Hoy» con anillo y línea violeta discontinua para estimación.
- **Responsive:** conserva las dos paradas y sus etiquetas al apilarse; no comprimir la trayectoria hasta borrar su significado.

## Do's and Don'ts

### Do:

- **Do** usar superficie blanca, reglas tenues y espacio amplio como estructura principal de cada vista.
- **Do** conectar datos relacionados en módulos continuos de escritorio y separarlos con bordes completos en móvil.
- **Do** mantener azul para peso/acción, verde para hábitos, coral para energía, violeta para cuerpo/estimación y ocre para atención.
- **Do** acompañar cada condición semántica con texto, fecha, signo, rango o patrón legible.
- **Do** preservar números tabulares, foco visible y controles táctiles.

### Don't:

- **Don't** tratar una predicción, un dato imputado y una medición de báscula como la misma clase de evidencia.
- **Don't** bañar la interfaz en azul u otra familia semántica; el color es un acento de lectura.
- **Don't** volver a fragmentar grupos de trabajo con tarjetas dentro de tarjetas.
- **Don't** sustituir las pestañas subrayadas por navegación de escritorio segmentada.
- **Don't** ocultar etiquetas o rangos al adaptar el raíl de previsión a móvil.
