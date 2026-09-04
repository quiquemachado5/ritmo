# Catálogo, auditoría y sincronización · 4 septiembre 2026

## Alcance

Se retira el plan de comidas de Nutrición y su componente. No se borran comidas registradas, plantillas ni planes de respaldos antiguos: el campo legado sigue admitiéndose al importar/exportar.

Se aplican las propuestas 6, 7, 8, 9, 12, 14 y 15. Se conserva la línea visual de RITMO con Impeccable: información de fuentes plegable, errores junto al campo y una sola barra de guardado, sin añadir otra pantalla de estadísticas.

## Nutrición verificable, no precisión garantizada

Cinco entradas contrastadas de USDA FoodData Central: arroz crudo/cocido, pasta cruda/cocida y aceite de oliva. Se conserva su identificador, versión, fecha de revisión y valores por 100 g. El resto del catálogo se identifica como referencia local pendiente de verificar. Detalle y procedencia en `lib/nutrition/SOURCES.md`.

Gramos indicados, volumen/unidades con masa aproximada y porciones supuestas tienen etiquetas diferentes. Una corrección manual de nutrientes no transforma una porción supuesta en peso medido. Editar gramos recalcula con la referencia; los cambios personales no se presentan como valores de USDA. Los fragmentos no interpretados permanecen visibles para corregir el texto.

El benchmark local de ocho platos arroja MAE **185,5 kcal**, MAPE **26,9 %** y **12,5 %** dentro de las tolerancias de referencia. Las referencias son aproximadas y la muestra pequeña: esto NO demuestra una estimación fiable de cualquier plato ni una mejora global de precisión. Hace falta ampliar el catálogo y evaluar más comidas. Los tests de parser son regresiones de comportamiento, no una certificación nutricional.

Se mantiene `externalProvidersEnabled: false`: sin llamadas ni facturación de Gemini u otros servicios externos.

## Predicciones emitidas antes del pesaje

`historial_modelo` y `predicciones_modelo` son privadas por `auth.uid()`. El servidor sella fecha/hora y solo admite hoy como día de emisión. Se conservan los primeros pronósticos de 1, 3, 7 y 30 días, sin sobrescribirlos. No se emiten para una fecha con pesaje ya registrado. La configuración usada debe seguir siendo la última de la cuenta al emitir. Las tablas no permiten inserción, edición ni borrado directo al cliente; los RPC verifican la identidad.

La predicción aún se calcula en el cliente: el sello acredita cuándo se guardó, no certifica que un cliente manipulado haya ejecutado un algoritmo concreto. La evaluación se hace contra pesajes de la fecha exacta, separada por horizonte; no interpola ni convierte ajustes retrospectivos en aciertos futuros.

El historial de perfil/hábitos empieza ahora. Antes de la primera versión, se conserva un supuesto inicial congelado y se indica que la configuración anterior no está documentada. Los cambios posteriores usan su fecha de vigencia; no reescriben ese supuesto inicial. Varias configuraciones en un día usan la última para el balance diario.

Sin conexión no se inventan emisiones antiguas. Progreso muestra un aviso si no puede verificar la copia en la nube. Las importaciones de auditoría se guardan como documentación por cuenta y se reexportan, pero nunca se convierten en emisiones verificadas ni alteran la configuración histórica activa. El borrado de datos espera las operaciones de auditoría en curso y luego elimina exclusivamente la auditoría de esa cuenta.

## Ajustes y sincronización

Perfil, objetivos, reglas del modelo y hábitos comparten Guardar/Descartar; apariencia y privacidad siguen siendo inmediatas. Validación inline, decimales con coma, guardas de doble envío/cambio de cuenta y aviso al seguir enlaces internos o recargar con cambios. El aviso no intercepta el botón Atrás del navegador en navegación SPA; no se promete esa cobertura.

La primera carga descarga el historial completo. Las siguientes descargan un manifiesto paginado de fechas/revisiones y solo el contenido cambiado. El coste sigue siendo O(N) metadatos + O(cambios) contenido, no un delta puro. El manifiesto permite detectar borrados aunque no haya Realtime. Reconciliación al recuperar foco/conexión y cada minuto mientras la página está visible y conectada.

No hay una transacción única entre las consultas de lectura: una edición remota durante una carga se reconcilia en el siguiente ciclo. La cola conserva la revisión original de cada edición offline; descargar una revisión nueva no autoriza a sobrescribirla. Los conflictos requieren revisión explícita. Las operaciones consecutivas propias encadenan la revisión confirmada.

## Versiones y comprobaciones

Respaldo v3, caché v5, esquema `202609040004`. La CI valida versiones, migraciones, pruebas unitarias y UI sintética en Chromium y WebKit. La nueva migración es autocontenida y no necesita las tablas de presupuesto/caché nutricional.

Verificación final local: **136 pruebas unitarias correctas**, evaluación externa de Gemini omitida por diseño, migraciones y aislamiento de cuentas correctos, lint sin errores y compilación de producción con TypeScript y prerender correctos.

Las pruebas móviles cubren orientación horizontal, texto al 200 %, guardado único y reducción simulada de `visualViewport` por teclado. No equivalen a ejecutar el teclado físico de un iPhone ni un OAuth real. No se usan cuentas de producción en los E2E.

La revisión encontró y corrigió controles de Ajustes que desbordaban con texto ampliado: ahora se reorganizan y crecen sin ocultar contenido ni reducir la letra. La barra de guardado deja de ser fija si supera el 28 % de la altura disponible, y las etiquetas de navegación pueden envolver su texto. El login espera a que el formulario esté hidratado para permitir escribir, evitando que WebKit borre texto introducido sobre el HTML previo a React. En E2E se desactiva únicamente el indicador flotante de desarrollo de Next, que tapaba «Hoy»; los errores de ejecución siguen visibles y hacen fallar el recorrido.

La confirmación E2E completa pasa **8 casos**, con **1 omitido** porque prueba móvil no corresponde a escritorio. Incluye Chrome escritorio/móvil y WebKit móvil, cambio de cuenta, reanálisis y corrección de gramos, guardado/descartado de Ajustes, navegación con cambios pendientes, paisaje, texto ampliado y viewport reducido. No se filtran errores JavaScript: se corrigió el CORS del servidor sintético con origen y encabezados explícitos. Esas cabeceras no cambian la configuración de producción.

## Aplicación en Supabase

Se verificó que las tres tablas nuevas no existían. Se aplicó exclusivamente `202609040004_model_audit.sql` en el proyecto **dieta**, dentro de una transacción, con `lock_timeout=3s` y `statement_timeout=20s`. El editor confirmó éxito. La consulta posterior confirmó versión `202609040004`, RLS activo, ausencia de lectura anónima y de inserción directa; las lecturas autenticadas quedan limitadas a `user_id = auth.uid()`. El registro de versión no tiene acceso anónimo ni autenticado.

No se ejecutó ningún borrado de registros ni se modificaron las políticas de las tablas anteriores. La función de limpieza queda disponible para la acción explícita «Eliminar mis datos» de cada cuenta. No se activó facturación ni se crearon tablas de cuotas de IA. El número de esquema indica la última ampliación aplicada, no acredita que se hayan ejecutado todas las migraciones anteriores de la instalación antigua.

Las operaciones de borrado del cliente fijan el token de la identidad validada y se detienen entre fases si se cierra el adaptador. Las regresiones cubren específicamente cambiar de cuenta entre dos peticiones, para no borrar datos de la nueva cuenta por accidente.
