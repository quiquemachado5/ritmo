# RITMO — sistema de diseño y composición

Este documento traduce [PRODUCT.md](./PRODUCT.md) a decisiones reutilizables. La interfaz debe sentirse serena, directa y fiable: registra primero, interpreta después y nunca disfraza una estimación de medición.

## Principios

1. **Una historia por pantalla.** Cada página se organiza como un flujo integrado: contexto, acción principal y detalle secundario. Las tarjetas no son una colección de widgets independientes.
2. **La báscula y el usuario mandan.** Todo dato muestra su origen cuando pueda confundirse: medido, calculado, estimado o sin datos.
3. **Menos antes que más.** La lectura principal cabe en el primer viewport móvil. El detalle avanzado vive en desplegables, carruseles o vistas secundarias.
4. **Color con significado.** Verde pino identifica progreso confirmado; arcilla, energía; ciruela, modelo corporal; turquesa, líquidos; rojo–ámbar–verde, constancia de hábitos.
5. **Móvil real.** Controles táctiles de al menos 44 px, texto de formulario de 16 px, carruseles con la siguiente tarjeta visible y acciones que sobreviven al teclado.

## Tokens y geometría

- Los colores, radios, sombras, tipografías y densidades viven en `app/globals.css`. No se crean paletas locales.
- Tarjeta de contenido: `Card`, borde cálido, radio `rounded-2xl`, sombra mínima y `p-4 sm:p-5` como base.
- Control: radio aproximado de 10 px y altura mínima de 44 px. Botones primarios por tarea; secundarios para alternativas; `ghost` para utilidades.
- Ancho de contenido: el lienzo puede crecer hasta 88 rem, pero el texto explicativo se mantiene entre 45 y 70 caracteres.
- Espaciado de página: 24 px móvil y 32–40 px escritorio entre capítulos. Dentro de una tarjeta se usan 8, 12, 16 y 20 px.

## Componentes canónicos

| Necesidad | Componente | Regla |
| --- | --- | --- |
| Cabecera de página | `PageHeader` | Un título, una explicación breve y como máximo una acción |
| Flujo de una sección | `IntegratedFlow` + `FlowChapter` | Une módulos que responden a la misma historia |
| Valor principal | `Metric`, `Ring`, `MacroBar` | Números tabulares y unidad visualmente subordinada |
| Origen del dato | `DataSourceBadge` | Obligatorio si lo medido y lo modelado conviven |
| Calidad del día | `RecordQuality` | Misma escala en Hoy, Nutrición y Progreso |
| Color de hábitos | `HabitScaleLegend` | Escala persistente 0 → todos; nunca una leyenda nueva |
| Contenido horizontal | `SnapRail` | Teclado, indicadores, snap y “peek” móvil incluidos |
| Fecha de trabajo | `ActiveDayNav` | La fecha se comparte entre Nutrición, Hábitos y Calendario |
| Sincronización | `SyncCenter` | Explica guardado local, pendientes y conflictos sin datos privados |
| Estado vacío | `EmptyState` | Dice qué acción desbloquea cada análisis |

## Estados obligatorios

Todo módulo que cargue o modifique datos contempla: carga con estructura estable, vacío accionable, éxito, error por causa, offline, permiso insuficiente y datos parciales. Un error no debe borrar el texto que el usuario estaba editando.

## Accesibilidad y movimiento

- Contraste AA como mínimo, foco siempre visible, iconos con etiqueta accesible y controles alcanzables por teclado.
- El significado nunca depende solo del color.
- Con movimiento reducido se eliminan entradas, deriva ambiental y rebotes; se mantienen transiciones breves de color y los indicadores funcionales.
- La interfaz se valida a 320 px, en paisaje, en oscuro y con texto al 200 %.

## Antes de añadir un componente

1. Comprobar si existe una primitiva canónica en `components/ui` o `components/app/primitives.tsx`.
2. Explicar qué decisión o tarea mejora; si solo decora, no se añade.
3. Verificar vacío, carga, error, oscuro, teclado, texto largo y móvil.
4. Añadir una prueba si cambia navegación, cálculo, permisos, persistencia o una frontera responsive.
