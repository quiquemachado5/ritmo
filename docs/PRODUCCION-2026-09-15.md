# RITMO · revisión de lanzamiento

15 de septiembre de 2026. Revisión de código, datos, acceso, accesibilidad y experiencia móvil.

## Decisión de lanzamiento

**RITMO queda preparado para producción y la base de datos está alineada.** Se aplicaron en Supabase las migraciones pendientes hasta `202609150002` dentro de transacciones y se verificaron las funciones críticas. La publicación se promueve desde `main` después de superar CI y se comprueba de nuevo en `https://ritmo-nu-six.vercel.app/api/health`.

No se han activado servicios de pago. Las pruebas automáticas usan datos sintéticos; SMTP, enlaces recibidos y la autenticación completa con cuentas externas siguen necesitando cuentas dedicadas del operador.

## Mejoras implementadas

### Acceso, permisos y servidor

| ID | Mejora | Resultado para el usuario |
| --- | --- | --- |
| A01 | Validación del destino de acceso, incluidas barras inversas y caracteres de control | El retorno de login no puede sacar al usuario del dominio |
| A02 | Conservación de ruta y parámetros al solicitar acceso | Regresar al lugar que se intentaba abrir |
| A03 | Propagación de cookies renovadas y eliminadas en redirecciones | Menos pérdidas de sesión al cambiar de pantalla |
| A04 | Respuestas autenticadas privadas y sin caché | Impedir que se reutilicen respuestas de una sesión en otra |
| A05 | Callback con errores recuperables, sin referencias ni códigos en la URL de salida | Recuperarse de un enlace o proveedor fallido |
| A06 | Administración decidida por la base de datos, con tiempo de espera acotado | La revocación tiene efecto aunque la sesión conserve información antigua |
| A07 | Control defensivo de ráfagas y memoria del limitador acotada | Las rutas no acumulan indefinidamente contadores locales |
| A08 | Diagnóstico con validación estricta y errores de persistencia visibles | Un evento no figura como guardado cuando su escritura falla |
| A09 | Comprobación de estado que distingue migración pendiente, servicio inaccesible y nutrición desconocida | Evitar una señal de disponibilidad engañosa |
| A10 | API de nutrición detenida si no puede comprobar su control de pausa | Respetar el control operativo incluso ante fallos |
| A11 | CSP con nonce único por respuesta y scripts inline cerrados | Reducir la superficie de ejecución de código inyectado |
| A12 | HSTS limitado a HTTPS público | Mantener protección de transporte sin romper pruebas o desarrollo local |
| A13 | Límite de diagnósticos atómico y compartido entre instancias | Evitar que un cambio de servidor reinicie el límite |

### Historial, copias y sincronización

| ID | Mejora | Resultado para el usuario |
| --- | --- | --- |
| D01 | Importación limitada a los registros del archivo | No reescribir días ajenos a la copia importada |
| D02 | Comprobación de revisiones al importar | Detectar cambios de otro dispositivo antes de sobrescribirlos |
| D03 | Cancelación de operaciones al cambiar de cuenta | Evitar que una importación continúe con otra identidad |
| D04 | Exclusión de escrituras que interfieren con una importación | Mantener una secuencia de guardado coherente |
| D05 | Relectura de lo confirmado tras una importación parcial | La pantalla refleja lo que realmente llegó a guardarse |
| D06 | Validación de formatos y límites antes de importar | Rechazar archivos que la base de datos no podría aceptar |
| D07 | Detección de colas corruptas, fechas imposibles e identificadores duplicados | Detener la carga conservando la evidencia para recuperar datos |
| D08 | Un fallo en la fecha de sincronización no convierte un envío confirmado en conflicto | Evitar reintentos y avisos falsos |
| D09 | Comprobación de copias antes de recuperarlas y recuperación de la copia anterior | Resistir respaldos corruptos o mal serializados |
| D10 | Respaldo tolerante a falta de espacio para una segunda copia | Actualizar la copia principal cuando la rotación no es posible |
| D11 | Caché PWA limitada a su versión y a activos públicos válidos | No conservar páginas privadas, HTML inesperado ni respuestas privadas o redirigidas |
| D12 | Coordinación de la cola entre pestañas, confirmaciones por ID y conflictos independientes | No perder pendientes ni resucitar operaciones cuando dos pestañas guardan o reconectan |
| D13 | Importación completa en una transacción, con revisiones y progreso visible | O se confirma todo el archivo o no se escribe ninguna parte |
| D14 | Borrado paginado de todos los respaldos | Eliminar también cuentas con más de 1.000 copias históricas |
| D15 | Búsqueda de actualizaciones al recuperar foco, conexión o visibilidad | Detectar una versión nueva en sesiones largas sin recargar a mitad de un guardado |

### Formularios y experiencia diaria

| ID | Mejora | Resultado para el usuario |
| --- | --- | --- |
| U01 | Registro desbloqueado al volver desde la confirmación | Corregir el correo y volver a enviar el formulario |
| U02 | Eliminación de «Recuérdame», que no controlaba la sesión | Quitar una promesa que la app no cumplía |
| U03 | Correo normalizado y mensajes de acceso/recuperación accionables | Saber qué revisar cuando falla una solicitud |
| U04 | Requisitos de contraseña, errores asociados y controles táctiles accesibles | Crear y revisar una contraseña con menos fricción |
| U05 | Primer pesaje antes de dar por terminada la configuración inicial | No cerrar el alta si ese guardado falla |
| U06 | Validación de números completos, incluidos decimales españoles | No aceptar entradas parciales como `18abc` |
| U07 | Onboarding con Enter, foco por paso y errores junto al campo | Completar el alta con teclado y lector de pantalla |
| U08 | Reintento de guardado que conserva el formulario | Corregir un fallo sin volver a escribir los datos |
| U09 | Confirmación de importación con foco contenido, Escape y retorno al control inicial | Revisar una operación importante sin perder el contexto |
| U10 | Diferencia explícita entre JSON restaurable y CSV para consulta | Un CSV ya no oculta el recordatorio de hacer una copia recuperable |
| U11 | Viajes con etiquetas y validación de fecha local | Evitar fechas finales pasadas y errores por huso horario |
| U12 | Preferencias de apariencia y modo mínimo resistentes a almacenamiento bloqueado | Un ajuste local no impide abrir la cuenta |
| U13 | Enlace «Saltar al contenido» y sección activa anunciada también en móvil | Navegar sin recorrer todos los controles en cada pantalla |
| U14 | Búsqueda con selección anunciada y desplazamiento al resultado activo | Seguir los resultados al navegar con flechas |
| U15 | Atajos globales que respetan campos y diálogos | Evitar abrir otro panel mientras se trabaja en uno |
| U16 | Errores al leer el perfil no redirigen a una nueva configuración | Un fallo temporal no parece una cuenta sin configurar |
| U17 | Recuperación independiente si falla la estructura principal de la app | Tener acciones de reintento incluso ante un fallo general |
| U18 | Enlaces de error y 404 sin botones anidados; pantallas de recuperación con estructura accesible | Navegación de recuperación consistente |
| U19 | Etiquetas completas de hábitos y singular/plural coherentes en Hoy | Leer las acciones sin truncamientos innecesarios |
| U20 | Eventos de error de interfaz sin volcar el objeto completo a la consola | Reducir la exposición accidental de contexto de la aplicación |
| U21 | Índice de búsqueda calculado solo al abrir el buscador | Evitar recorrer todo el historial tras cada cambio cuando la búsqueda está cerrada |
| U22 | Consentimiento explícito y versionado antes del primer dato de salud | Conservar evidencia y permitir retirarla al borrar los datos |
| U23 | Información de privacidad ampliada con responsable, fines, bases, proveedores, retención y derechos | Explicar el tratamiento con lenguaje comprensible y controles accesibles |
| U24 | Catálogo nutricional ampliado con registros oficiales USDA | Mejorar estimaciones de plátano, huevo y pollo cocinado con referencias trazables |
| U25 | Métricas de experiencia real por ruta y dispositivo, sin textos, correo ni peso | Detectar problemas de velocidad respetando la minimización de datos |
| U26 | Comparación agregada de versiones del modelo con grupos mínimos de cinco personas | Evitar decisiones con muestras pequeñas y no exponer resultados individuales |

### Verificación de lanzamiento

| ID | Mejora | Resultado |
| --- | --- | --- |
| V01 | Pruebas directas de handlers, callbacks y guardas administrativas | Comprobar el comportamiento del código del servidor con regresiones |
| V02 | `test:e2e:production` | Recorrer una compilación de producción con backend sintético |
| V03 | CI de interfaz ejecuta esa modalidad de producción | Incluir las cabeceras y la PWA que no se activan en desarrollo |
| V04 | `check:release` agrupa las comprobaciones necesarias | Un único punto de entrada para repetir la revisión antes de publicar |
| V05 | Casos de alta fallida, importación cancelada, teclado, almacenamiento bloqueado y caché offline | Cubrir los fallos concretos de esta revisión |
| V06 | Cabeceras de transporte adaptadas a loopback HTTP | Probar producción en Safari local sin que solicite activos por un HTTPS inexistente; se conserva HTTPS obligatorio en dominios públicos |
| V07 | Vigilancia programada de producción cada 15 minutos | Convertir un fallo del estado, acceso o privacidad en una ejecución fallida visible en GitHub |

## Comprobaciones externas que siguen abiertas

| Acción | Motivo |
| --- | --- |
| Probar confirmación de correo, recuperación, enlace caducado y OAuth de extremo a extremo | Requiere recibir mensajes e iniciar sesión con cuentas externas dedicadas; las redirecciones y errores sí están cubiertos con datos sintéticos |
| Añadir un canal externo para fallos repetidos de acceso o sincronización | El panel privado ya agrupa señales y GitHub vigila el servicio; falta elegir el destino de la notificación |
| Revisar la información legal con los datos formales del operador | La página identifica al responsable público y explica el tratamiento, pero una revisión jurídica debe completar los datos de contacto que correspondan |
| Reunir una cohorte real de cinco o más participantes | La comparación ya está implementada y oculta grupos pequeños; no se inventan resultados antes de disponer de observaciones |

## Cómo repetir la comprobación

```bash
npm ci
npm run check:release
```

El comando comprueba estilo y tipos al compilar, pruebas de código, migraciones y aislamiento local, recorridos en Chrome/Safari móvil y presupuesto de JavaScript. Las pruebas de interfaz usan exclusivamente identidades sintéticas en loopback. Después vuelve a compilar con las variables habituales del proyecto: no se debe publicar la compilación de pruebas, que apunta al backend sintético.

La coordinación de guardado entre pestañas requiere Web Locks (`navigator.locks`), disponible en los navegadores actuales probados y en contextos seguros. Cuando no está disponible, se permite leer pero el guardado falla explícitamente y conserva los pendientes existentes. La excepción HTTP de las cabeceras se limita a direcciones de loopback; no habilita HTTP para el dominio público.

Para la aplicación publicada, una vez alineada la base de datos:

```bash
RITMO_DEPLOYMENT_URL=https://ritmo-nu-six.vercel.app node scripts/smoke-deployment.mjs
```

Consulta [DEPLOYMENT.md](../DEPLOYMENT.md) para migraciones, staging, correo y promoción. Mantener la nutrición local elegida por el proyecto: ninguna mejora de esta revisión requiere Gemini, Edamam o facturación nueva.

## Resultados de la validación

| Comprobación | Resultado |
| --- | --- |
| Pruebas de código | **300 aprobadas**, 1 omitida por evaluación externa no activada; 45 archivos aprobados |
| Revisión de código y tipos | ESLint y TypeScript correctos; revisión independiente de autenticación, importación y sincronización completada |
| Base de datos local | **12 migraciones** aplicadas en PostgreSQL embebido; aislamiento, importación atómica, consentimiento y límites distribuidos aprobados |
| Recorridos de interfaz en producción | **46 aprobados** y 14 omitidos por dispositivo en la suma de escritorio, móvil Chromium y móvil WebKit |
| Regresión posterior de la cola | Registro completo, cambio de cuenta, alta con fallo y PWA comprobados de nuevo en las superficies pertinentes |
| Dos pestañas reales | **2 casos aprobados**, Chromium y WebKit: cambios offline en días distintos, reconexión, cola vacía y conservación de los demás hábitos |
| Compilación final | `npm run build` aprobado con las variables habituales del proyecto, después de terminar el servidor sintético |
| Presupuesto de JavaScript | **701,5 kB gzip** entre todos los fragmentos; el mayor ocupa **110,1 kB**. Límites del proyecto: 710/130 kB; el lector ZIP se carga solo al elegir una exportación |
| Accesibilidad y presentación | Sin incidencias graves/críticas detectadas por axe en las superficies evaluadas; matriz de 320, 390, 768 y 1440 px, oscuro, 2560 px, paisaje y texto al 200 % |
| Inspección visual | Escritorio y registro móvil revisados; detector de los archivos UI modificados sin hallazgos |
| Dependencias | `npm audit`: **0 vulnerabilidades reportadas**; `fflate` se usa de forma diferida para leer ZIP de Apple Health en el dispositivo |
| Base de datos publicada | **202609150002**, con las columnas de salud y la importación atómica verificadas en el proyecto de producción |

Las pruebas con Safari usan WebKit con geometría móvil. El teclado virtual se simula: quedan fuera la instalación y el teclado físico de un teléfono real, el correo/OAuth reales y las condiciones de red del usuario. Una auditoría de dependencias sin avisos no certifica la ausencia de vulnerabilidades en toda la aplicación.

Los fallos detectados durante las primeras pasadas se corrigieron. Los tests de registro usan confirmaciones simuladas: no se enviaron correos a personas reales.
