# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Una persona que usa la aplicación para seguir sus hábitos alimenticios, el peso y la composición corporal. La consulta de rutina es rápida y personal: comprobar cómo va el día, registrar lo necesario y entender la siguiente revisión del peso.

## Product Purpose

Composición convierte registros de hábitos, calorías, actividad y pesajes en un seguimiento claro de progreso corporal. Su éxito es que el usuario sepa qué ha ocurrido, qué puede esperar y qué dato conviene registrar después sin confundir una estimación con una medición.

## Positioning

En lugar de presentar una cifra de peso como si fuese segura, la app ancla cada predicción al último pesaje y muestra un rango cuya confianza depende de la calidad del historial y del tiempo transcurrido.

## Operating Context

Uso individual desde móvil o escritorio. El usuario registra días, consulta tendencias y, a partir de septiembre, incorporará un pesaje cada dos semanas para recalibrar las proyecciones.

## Capabilities and Constraints

- Página única estática con módulos ES nativos; no hay proceso de compilación.
- Los datos se guardan localmente o se sincronizan con Supabase, según la configuración elegida.
- Incluye hábitos, ingesta, actividad, peso, composición corporal, rachas, exportación e importación.
- Los cálculos y el modelo de predicción existentes deben conservarse.
- Las mediciones reales y los datos estimados o imputados deben seguir diferenciándose de forma explícita.

## Brand Commitments

La interfaz debe sentirse profesional, sencilla y entendible. El usuario ha pedido un rediseño integral con una paleta más rica que el azul dominante, datos más claros y una organización visual de mayor calidad.

Dirección permanente elegida por el usuario (agosto 2026): el **estándar de categoría** de un panel de salud, ejecutado de forma impecable —nada de gestos irónicos ni mundos temáticos—, con el **nivel de acabado de Apple Health / Fitness** como vara de calidad. El registro visual es **cálido y sofisticado**: neutro tipo hueso/papel cálido con familias de datos en tonos joya (verde pino para peso y acción, oro/ocre para hábitos, terracota para energía, ciruela para composición/estimación), en lugar del azul dominante anterior. Móvil y escritorio se cuidan por igual.

## Evidence on Hand

- Histórico personal incluido en `assets/js/seed.js`.
- 34 mediciones de peso y 263 días de histórico descritos en `README.md`.
- No se deben inventar mediciones, composición corporal ni afirmaciones de salud.

## Product Principles

1. Lo importante se entiende de un vistazo y el detalle aparece donde hace falta.
2. Los colores explican categorías de datos, no sustituyen sus etiquetas ni signos.
3. Una predicción orienta; una medición confirma.
4. Registrar y revisar deben requerir poco esfuerzo.

## Accessibility & Inclusion

El color nunca será el único indicador de significado. Los estados y estimaciones conservarán etiquetas, signos o patrones legibles, con contraste suficiente para la lectura cotidiana.
