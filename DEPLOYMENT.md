# Publicación segura de RITMO

## Revisión de lanzamiento · 15 de septiembre de 2026

El [listado de mejoras y comprobaciones](docs/PRODUCCION-2026-09-15.md) documenta los cambios de esta revisión. La base de datos de producción está alineada con `202609150002`; la publicación se valida en `https://ritmo-nu-six.vercel.app/api/health` después de cada promoción.

`npm run check:release` ejecuta la verificación local completa. La interfaz se prueba ahora también con una compilación de producción (`npm run test:e2e:production`), incluido el service worker, usando cuentas y transporte sintéticos. El comando completo termina recompilando con las variables habituales; no publicar el build intermedio de E2E.

Esta guía distingue código preparado de servicios realmente activados. La revisión no activa facturación ni proveedores nutricionales externos. En producción están aplicadas las migraciones del repositorio hasta `202609150002`.

## 1. Antes de desplegar

- Exportar una copia JSON y comprobar su restauración en un proyecto de pruebas.
- Ejecutar `npm ci`, `npm run check:versions`, `npm test`, `npm run test:db`, `npm run lint` y `npm run build`.
- Ejecutar `npm run test:e2e:production`: usa exclusivamente identidades sintéticas y un transporte local. No verifica Google OAuth, SMTP ni el servicio real de Supabase. `test:e2e:local` conserva la modalidad de desarrollo para iteraciones.
- Para verificar los proveedores reales, ejecutar opcionalmente las pruebas autenticadas con dos cuentas **exclusivas de staging**. Nunca usar las cuentas personales como fixtures; CI normal no necesita estas cuentas.
- Revisar secretos con un escáner que oculte sus valores; rotar cualquier credencial anteriormente compartida o expuesta. No pegar claves en incidencias ni logs.

## 2. Base de datos

El origen reproducible es `supabase/migrations/`, en orden de nombre. `supabase/schema.sql` queda como referencia histórica, no como procedimiento de instalación.

1. Aplicar primero todas las migraciones pendientes en un proyecto Supabase de pruebas, usando el historial de migraciones de Supabase.
2. Probar con datos representativos y revisar la copia antes de aplicar a producción.
3. Aplicar solo las pendientes en producción, una vez. No ejecutar a ciegas todo el directorio sobre una instalación ya migrada.

Las migraciones `202609100001_admin_console.sql` a `202609150002_health_import.sql` crean el control administrativo, la parada segura del motor nutricional, la comprobación pública de versión, la importación atómica, el consentimiento versionado, los límites distribuidos, las métricas de rendimiento, la comparación agregada del modelo y el almacenamiento de sueño y entrenamiento importados. `/api/health` devuelve `503` mientras código y base de datos no estén alineados.

La nueva línea base crea el esquema desde cero y conserva tablas existentes. La migración de perfil admite proteína decimal y alinea límites con el formulario. Sus restricciones nuevas son `NOT VALID`: los datos históricos no se borran ni se corrigen automáticamente; las nuevas escrituras sí se validan.

`npm run test:db` aplica el esquema a PostgreSQL embebido y prueba aislamiento de dos cuentas, Storage y cuota de IA. CI repite las comprobaciones con PostgreSQL 17. Esto no sustituye verificar configuración real de RLS, Storage, Realtime y proveedores en staging.

## 3. Nutrición sin servicios externos

**Configuración elegida: sin Gemini, Edamam ni facturación nueva.** `config/nutrition.json` bloquea los proveedores externos incluso si quedan claves antiguas o `NUTRITION_AI_ENABLED=true` en Vercel. El navegador calcula con la tabla local y reutiliza correcciones confirmadas para el mismo ingrediente y cantidad. No llama al servidor de nutrición. Registrar la comida sí la sincroniza con Supabase.

No se necesitan claves nuevas, `SUPABASE_SERVICE_ROLE_KEY` ni activar la cuota SQL para el análisis local. No es IA generativa ni sustituye etiquetas y cantidades pesadas. `npm run test:nutrition:local` evalúa doce platos complejos y 72 variantes de lenguaje sin API, y comprueba que no hay llamadas externas. El flujo manual «Evaluación nutricional local (sin API)» tampoco necesita secretos. El benchmark de Gemini queda bloqueado mientras esta política esté desactivada.

### Solo si en el futuro se autoriza explícitamente otra modalidad

Los pasos siguientes **no son activaciones pendientes** y no forman parte de esta configuración. Antes de habilitar proveedores habría que cambiar también `externalProvidersEnabled`, revisar condiciones y autorizar por separado cualquier coste.

Para una aplicación disponible en España/EEE, Google exige el uso de sus servicios de pago: la API debe pertenecer a un proyecto con facturación activa. También restringe las aplicaciones dirigidas a menores o probablemente accesibles por ellos. La interfaz indica uso adulto y la cuota verifica la edad del perfil, pero el operador debe comprobar la elegibilidad del producto. [Condiciones de Gemini](https://ai.google.dev/gemini-api/terms).

Variables de **servidor**, nunca con prefijo `NEXT_PUBLIC_`:

- `GEMINI_API_KEY`: credencial nueva y restringida al servicio necesario.
- `SUPABASE_SERVICE_ROLE_KEY`: solo en el entorno servidor. No compartirla con el navegador.
- `NUTRITION_AI_ENABLED=true`: habilitar solo tras configurar la base y revisar condiciones/cuotas.
- `GEMINI_NUTRITION_MODEL`: opcional; ver los modelos probados en el código.
- `EDAMAM_APP_ID` y `EDAMAM_APP_KEY`: respaldo opcional sujeto a las condiciones del proveedor.

Además, el operador debe activar `nutrition_policy.enabled` en Supabase. Los valores iniciales son 30 análisis por usuario/día y 300 globales/día (UTC), configurables. Un análisis puede intentar hasta dos modelos Gemini y un respaldo Edamam: **no equivale a una sola llamada facturable**. Configurar también alertas de presupuesto y cuotas del proveedor; los contadores de RITMO no garantizan un importe monetario máximo.

La caché compartida aísla por usuario y huella de la petición. Evita análisis duplicados en varias instancias de Vercel. La respuesta deja de ser reutilizable a los 10 minutos; la purga física se realiza con posteriores peticiones, no mediante una tarea programada. No hay garantía de eliminación física en ese mismo minuto.

Antes de una futura activación, ejecutar `npm run test:nutrition:eval` con una clave de pruebas autorizada y la política revisada. La prueba genera consumo externo y no se ejecuta dentro de `npm test` ni del flujo local. Exige respuesta para los platos de referencia y controla error en kcal y los tres macros. Las referencias actuales son valores medios de evaluación, no mediciones de laboratorio; conviene ampliarlas con etiquetas y pesos documentados.

## 4. Autenticación y correo

Configurar SMTP propio para confirmaciones y recuperación. El SMTP predeterminado de Supabase está limitado y no se recomienda para producción. Verificar entrega, dominio, remitente y enlaces con una cuenta externa. [Guía oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Verificar manualmente:

- Dominio público real en `NEXT_PUBLIC_APP_URL` y URL de sitio de Supabase.
- Redirects exactos de producción y staging para `/auth/callback`.
- Google OAuth: publicación, audiencia y usuarios de prueba según el estado del proyecto Google; invitar a alguien a usar RITMO no requiere hacerlo administrador de Supabase.
- Recuperación de contraseña, enlace expirado, sesión caducada y cambio de cuenta.
- La nueva política de adultos no valida documentos de identidad.

CI normal ejecuta pruebas sintéticas de dos cuentas, sin secretos nuevos. Solo la ejecución manual con `e2e_real` activado exige `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL` y `E2E_USER_B_PASSWORD`. Sin ellos ese trabajo falla de forma visible; las pruebas locales nunca se presentan como validación de Google, SMTP o Supabase reales.

Configurar protección de `main` y bloquear/promover despliegues según los checks. **Añadir un workflow no hace que Vercel espere automáticamente a GitHub Actions.** Esa integración o promoción debe configurarse en el proyecto.

## 5. Privacidad y observabilidad

- `/privacidad` identifica al responsable público y explica fines, bases, proveedores, retención, consentimiento y derechos. Completar los datos formales de contacto que correspondan tras una revisión jurídica.
- Los eventos remotos del cliente son opt-in y solo incluyen categoría, gravedad y versión; nunca descripción de comida, peso, correo o identificador de cuenta en el evento.
- La autenticación y la infraestructura pueden producir sus propios logs: revisar accesos y retención en Supabase/Vercel.
- GitHub comprueba el estado público cada 15 minutos. El panel privado agrega fallos de nutrición, sincronización y acceso; falta elegir un canal externo si se desean avisos inmediatos de esas señales.
- Los diagnósticos aplican un límite distribuido en PostgreSQL. La cuota SQL protege análisis externos; un WAF adicional puede ajustarse más adelante al tráfico real.

## 6. Qué verificar tras la publicación

1. Guardado rápido, dos toques consecutivos, pérdida de red, reconexión y conflicto entre dispositivos.
2. Recuperación de borrador al cerrar el registro; registro consumido frente a comida solo planificada.
3. Importación con vista previa, duplicados y archivo corrupto; exportación con biblioteca y plan.
4. Informe mensual: peso y número de comidas ocultos inicialmente, vista previa antes de compartir.
5. Instalación PWA en Safari iOS y Chrome Android. El navegador real sigue siendo necesario para teclado e instalación.
6. Actualización de la PWA con cambios pendientes: no debe recargar mientras haya una escritura pendiente.
7. App abierta sin red: conserva escrituras en cola. Una recarga sin red muestra una pantalla pública offline; no se cachea HTML privado de otra cuenta.

## Límites pendientes de una siguiente fase

- Las escrituras de registros detectan conflictos por versión; la biblioteca/preferencias todavía usa un documento con resolución por fecha, no una fusión por campo.
- La paginación elimina el corte a 1.000 filas y las notificaciones agrupan recargas. Aún no es sincronización incremental completa por fila.
- La validación del modelo es condicional a los hábitos observados del tramo y al perfil actual: no demuestra precisión futura absoluta. Muestra comparación contra último peso y cobertura empírica; no asegura un intervalo clínico.
- Las referencias nutricionales trazables ya cubren alimentos base adicionales. La cohorte del modelo requiere cinco participantes reales antes de mostrar resultados.
- Los tests locales no reemplazan los E2E de cuentas reales de staging, SMTP, OAuth, redes móviles ni revisión legal.
