export type ErrorKind = "session" | "network" | "sync" | "nutrition" | "permission" | "data" | "unknown";

export type ErrorCopy = {
  kind: ErrorKind;
  title: string;
  detail: string;
  action: string;
};

function messageOf(error: unknown) {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLocaleLowerCase("es-ES");
  return String(error ?? "").toLocaleLowerCase("es-ES");
}

export function errorCopy(error: unknown): ErrorCopy {
  const message = messageOf(error);
  if (/auth session missing|jwt|refresh token|sesión|session/.test(message)) return {
    kind: "session",
    title: "Tu sesión necesita renovarse",
    detail: "Los datos guardados no se han borrado. Vuelve a iniciar sesión para reconectar esta cuenta.",
    action: "Iniciar sesión",
  };
  if (/failed to fetch|fetch failed|network|offline|timeout|load failed|conexión/.test(message)) return {
    kind: "network",
    title: "RITMO está sin conexión",
    detail: "Puedes seguir registrando. Conservaremos los cambios en este dispositivo y los sincronizaremos después.",
    action: "Probar de nuevo",
  };
  if (/revision|conflict|sincron|pending|cola/.test(message)) return {
    kind: "sync",
    title: "Hay un cambio por revisar",
    detail: "Otro dispositivo pudo editar el mismo registro. La versión local sigue guardada y no se sobrescribirá sola.",
    action: "Abrir sincronización",
  };
  if (/nutrition|nutric|ingrediente|kcal|gemini|alimento/.test(message)) return {
    kind: "nutrition",
    title: "No pudimos interpretar toda la comida",
    detail: "Revisa la cantidad o la preparación indicada. Lo que ya has escrito seguirá disponible para corregirlo.",
    action: "Revisar comida",
  };
  if (/forbidden|permission|row.level|rls|acceso|unauthorized/.test(message)) return {
    kind: "permission",
    title: "Esta cuenta no tiene acceso",
    detail: "La sesión es válida, pero este contenido no está habilitado para tu cuenta.",
    action: "Volver",
  };
  if (/parse|corrupt|invalid data|schema|migraci|formato/.test(message)) return {
    kind: "data",
    title: "Un dato necesita reparación",
    detail: "RITMO ha detenido la carga para no sustituir tu historial. Tu copia local y los datos de la nube siguen intactos.",
    action: "Recargar con seguridad",
  };
  return {
    kind: "unknown",
    title: "Esta sección no pudo terminar de cargar",
    detail: "El fallo quedó aislado en esta pantalla. Tus registros siguen a salvo y puedes reintentar o cambiar de sección.",
    action: "Reintentar",
  };
}
