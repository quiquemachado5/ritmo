# RITMO — producto y criterios de interfaz

## Producto

RITMO es una aplicación web pública de seguimiento personal de hábitos saludables, nutrición, peso y composición corporal. Ayuda a registrar el día a día, entender la evolución real y distinguir con claridad los datos medidos de las estimaciones del modelo.

## Usuarios

- Personas que registran hábitos, comidas, pesajes y contexto diario.
- Un administrador propietario de la plataforma, responsable de usuarios, lanzamientos, experimentos, salud operativa y gobierno de los modelos.

## Objetivos confirmados

- Registro diario rápido y fiable, especialmente desde móvil.
- Privacidad estricta: cada persona accede solo a sus datos de salud.
- Predicciones explicables, calibradas con pesajes reales y presentadas como estimaciones con incertidumbre.
- Cálculo nutricional trazable, editable y resistente a descripciones complejas.
- Administración separada del producto cotidiano, con controles efectivos y auditables.
- Funcionamiento público en Vercel sin activar facturación de servicios externos.

## Arquitectura de experiencia

- Navegación de usuario: Hoy, Nutrición, Hábitos, Progreso y Ajustes.
- Administración: área protegida y exclusiva para el propietario. Incluye visión operativa, gestión de acceso, publicación de funciones, laboratorio, configuración segura de modelos y registro de cambios.
- “Modo mínimo” deja de formar parte del producto navegable.
- El número total de usuarios no se muestra a usuarios finales.

## Lenguaje visual establecido

- Marca verde pino sobre superficies cálidas de papel; oscuro en carbón con contraste equivalente.
- Tipografía, radios, controles y estados consistentes con el sistema existente.
- Densidad contenida, jerarquía clara y color semántico; sin decoración gratuita.
- Escritorio con panel lateral; móvil con cabecera y barra inferior.

## Seguridad y privacidad

- Supabase Auth y RLS son la frontera de datos personales.
- El rol administrador se valida en servidor y en PostgreSQL; ocultar controles en el cliente nunca concede permisos.
- Administración de usuarios muestra solo metadatos de cuenta necesarios. No expone comidas, peso, hábitos ni composición corporal.
- Las operaciones administrativas sensibles requieren una intención explícita, límites seguros y un registro de auditoría.

## Restricciones actuales

- Despliegue público en Vercel.
- No se presupone un servicio de pago activo.
- Las migraciones de Supabase se versionan en el repositorio y se verifican en CI.

## Fuera de alcance salvo petición explícita

- Acceder al contenido de salud de otras personas desde administración.
- Mostrar o recuperar contraseñas.
- Activar facturación o servicios de pago.
- Prometer precisión absoluta del modelo.
