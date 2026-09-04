import Link from "next/link";
import { RitmoLogo } from "@/components/ritmo-mark";
import { EXTERNAL_NUTRITION_ENABLED } from "@/lib/nutrition/policy";

export const metadata = { title: "Tus datos y privacidad" };
export default function PrivacidadPage() {
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
    <Link href="/" aria-label="Volver a RITMO"><RitmoLogo /></Link>
    <h1 className="mt-8 font-display text-3xl font-bold">Tus datos en RITMO</h1>
    <p className="mt-3 text-muted-foreground">Información sobre cómo funciona el tratamiento de datos en la aplicación.</p>
    <div className="mt-8 divide-y divide-border [&_section]:py-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground">
      <section><h2>Tu cuenta y tus registros</h2><p>Supabase gestiona el acceso y almacena tu perfil, hábitos, comidas y mediciones. Las políticas de acceso separan los registros de cada cuenta. Vercel sirve la aplicación y sus funciones de servidor.</p></section>
      <section><h2>Cuando analizas una comida</h2>{EXTERNAL_NUTRITION_ENABLED ? <><p>Al pulsar Analizar, se envían la descripción y las correcciones nutricionales seleccionadas al servidor. Cuando el análisis online está habilitado, puede utilizar Gemini (Google) o Edamam como alternativa. No se les envía tu correo ni tu histórico de pesajes. La pantalla identifica el origen del resultado; las cifras siguen siendo estimaciones.</p><p className="mt-2">La caché online es privada por cuenta y caduca a los diez minutos. Los registros caducados se purgan al procesar nuevas solicitudes. El tratamiento de los proveedores depende de su contrato y configuración.</p></> : <><p>El análisis se realiza en tu dispositivo con una tabla de alimentos y tus correcciones guardadas. No utiliza Gemini ni Edamam y no envía la descripción a estos servicios.</p><p className="mt-2">Es una estimación local, no una respuesta de IA. Revisa ingredientes y cantidades antes de guardar. Al registrar la comida, se sincroniza en tu cuenta como el resto de tus datos.</p></>}</section>
      <section><h2>En este dispositivo</h2><p>RITMO conserva preferencias, cambios pendientes, copias locales y borradores para recuperarlos ante interrupciones. Los borradores de comidas dejan de recuperarse a los siete días. Evita usar una cuenta personal en dispositivos compartidos sin limpiar después los datos locales.</p></section>
      <section><h2>Diagnóstico opcional</h2><p>En Ajustes puedes autorizar el envío de tipos de errores y versión de la aplicación. No se envían pesos, textos de comidas, notas ni grabaciones de pantalla. Los proveedores de alojamiento pueden conservar registros técnicos propios según su configuración.</p></section>
      <section><h2>Exportar, limpiar y borrar</h2><p>Exportar descarga una copia de tus datos. Limpiar este dispositivo elimina las copias y preferencias locales de esta cuenta; no borra la nube. Eliminar los datos de RITMO borra los registros de la aplicación y sus copias en Storage, pero no elimina tu identidad de acceso ni las copias operativas del proveedor sujetas a su política de conservación.</p></section>
      <section><h2>Una herramienta de seguimiento</h2><p>RITMO está dirigida a personas adultas. Las estimaciones nutricionales y de peso no son mediciones ni asesoramiento médico. No están destinadas a diagnosticar, tratar ni sustituir la atención de un profesional.</p></section>
    </div>
    <Link href="/ajustes" className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Abrir mis controles de privacidad</Link>
  </main>;
}
