# Configuración sin nuevos servicios de pago · 4 septiembre 2026

Registro del primer pase, publicado después en `13cec36`. Para el estado posterior del catálogo, auditoría y esquema, ver `2026-09-04-catalog-audit-sync.md`: ese segundo pase sí crea el registro de versión y las tablas del modelo, sin aplicar a ciegas migraciones anteriores.

## Proyecto verificado

Supabase: **dieta**, referencia `twslzgzmvgoaqusrmukt`, organización en plan Free. Coincide con el host configurado en RITMO. No se activó facturación, SMTP de terceros, proveedores de IA ni planes superiores.

## Comprobación de producción y cambio aplicado

La inspección del catálogo confirmó cuatro tablas públicas: `perfiles`, `dias`, `composicion` y `user_prefs`, todas con RLS activo y políticas `authenticated` que exigen `auth.uid() = user_id` tanto en lectura como en escritura.

`perfiles.proteina_objetivo` era `integer`. Se aplicó dentro de una transacción, con espera de bloqueo máxima de 3 segundos y tiempo máximo de consulta de 20 segundos, **solo el bloque de cambios de perfil** de `202609040002_profile_limits.sql`, sin su actualización del registro de versiones:

- Tipo `numeric(6,2)` para admitir proteína decimal.
- Límites de nuevas escrituras: proteína 0,5–4; edad 18–120; altura 100–250; peso objetivo 30–300; kcal 800–6000; nombre hasta 80 caracteres.
- Restricciones `NOT VALID`: no se borraron ni normalizaron datos históricos.
- No se modificaron políticas RLS, grants, usuarios, contraseñas ni permisos de Storage.

La consulta posterior confirmó el tipo `numeric`, precisión 6 y escala 2. No se descargaron datos personales ni secretos.

Antes del cambio, los límites eran: edad 14–100, altura 120–230, peso objetivo 35–250 y kcal 900–4000; no había restricciones de proteína ni longitud de nombre. Las demás restricciones de perfil permanecen intactas.

## Qué NO se ha aplicado

No se ejecutó la línea base completa, no se crearon tablas de cuotas/caché de IA y no se marcó el esquema como totalmente migrado. No existe un nuevo historial completo de migraciones en producción. Al adoptar posteriormente el directorio de migraciones, revisar las pendientes: la migración de perfil admite que estas restricciones ya existan.

El código permite eliminar los datos de una instalación anterior sin exigir el RPC del caché nutricional, únicamente cuando Supabase confirma que no existe (`PGRST202`). Otros errores no se ocultan.

## Configuración local preparada

`config/nutrition.json` bloquea servicios externos incluso ante claves antiguas. La estimación se ejecuta en el navegador, usa la tabla local y reutiliza correcciones para el mismo ingrediente y cantidad. No es IA generativa y debe revisarse. Las pruebas normales y el benchmark local no necesitan cuentas nuevas ni claves externas. Los E2E contra proveedores reales son manuales y opcionales.

Este registro no certifica OAuth/SMTP de extremo a extremo ni implica que el código local se haya publicado en Vercel.

## Acceso: dirección de Vercel configurada

El panel de Auth conservaba `https://lustrous-croissant-daab24.netlify.app/` como Site URL. El usuario confirmó expresamente el dominio de Vercel y autorizó corregirlo. Se guardó y verificó `https://ritmo-nu-six.vercel.app` como Site URL y se añadieron dos retornos concretos: `/auth/callback` y `/recuperar-contrasena`.

Se conservaron los retornos anteriores de Netlify (`/**`) y `http://localhost:5173/**`, sin ampliar dominios con comodines nuevos ni desactivar accesos existentes. Quedan cuatro retornos en total. Esta verificación de configuración no equivale a haber completado un login de Google ni un correo de recuperación real.

La pantalla de proveedores confirma Email habilitado, acceso anónimo desactivado, confirmación de email desactivada y Google desactivado. El formulario de Google muestra vacíos Client IDs y Client Secret. No se cambiaron estos ajustes. Habilitar Google requiere configurar primero OAuth en un proyecto Google autorizado; no equivale a activar Gemini ni se ha realizado. No se ha activado confirmación por correo sin verificar antes la entrega SMTP.

## Comprobaciones de código

81 pruebas unitarias correctas (benchmark externo omitido por diseño); pruebas de esquema/RLS en PostgreSQL embebido correctas; flujos sintéticos de escritorio y móvil correctos; lint, TypeScript y compilación de producción correctos. No se ha realizado commit, push ni despliegue de estos cambios locales.
