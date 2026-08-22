# Composición

Registro de hábitos alimenticios, control de peso y análisis de composición corporal.

Aplicación de página única en módulos ES nativos, sin *framework* y **sin paso de
compilación**: lo que hay en el repositorio es exactamente lo que se sirve. La
persistencia funciona con dos adaptadores intercambiables —`localStorage` y
PostgreSQL sobre Supabase— tras una única fachada, así que la interfaz no sabe ni
le importa dónde acaban los datos.

---

## Arranque rápido

Los módulos ES exigen servirse por HTTP; abrir `index.html` con doble clic no
funciona (el navegador bloquea los `import` bajo el protocolo `file://`).

```bash
npm run dev
```

Y abre <http://localhost:5173>. La aplicación arranca en modo local y se siembra
con el histórico incluido en `assets/js/seed.js`.

Para ejecutar las pruebas de la capa de cálculo:

```bash
npm test
```

---

## Estructura

```
.
├── index.html                  Esqueleto: cabecera, contenedores de vista, nada más
├── netlify.toml                Publicación estática y cabeceras de seguridad
├── package.json                Solo scripts; sin dependencias de ejecución
│
├── assets/
│   ├── css/
│   │   ├── tokens.css          Variables: color, tipografía, espaciado, movimiento
│   │   ├── base.css            Reset, tipografía y rejilla (mobile-first)
│   │   └── components.css      Tarjetas, botones, campos, calendario, gráficos
│   │
│   └── js/
│       ├── main.js             Arranque, enrutado por hash, ciclo de render
│       ├── config.js           Credenciales de Supabase, hábitos, perfil por defecto
│       ├── seed.js             Histórico migrado (263 días, 34 mediciones)
│       │
│       ├── core/               Lógica pura, sin DOM — es lo que se testea
│       │   ├── metrics.js      Balance, predicción, composición, IMC, TDEE, rachas
│       │   ├── analytics.js    Derivaciones sobre el estado completo
│       │   ├── dates.js        Fechas ISO locales sin sorpresas de huso horario
│       │   ├── format.js       Presentación en español
│       │   └── store.js        Estado reactivo con escritura optimista
│       │
│       ├── data/               Persistencia intercambiable
│       │   ├── repository.js   Fachada: elige adaptador y siembra si hace falta
│       │   ├── local-adapter.js      localStorage + sincronía entre pestañas
│       │   └── supabase-adapter.js   PostgreSQL + Auth + Realtime
│       │
│       └── ui/                 Vistas: reciben estado, devuelven HTML
│           ├── dashboard.js  registro.js  composicion.js  ajustes.js
│           ├── charts.js       Gráficos SVG escritos a mano, sin librerías
│           └── toast.js
│
├── supabase/schema.sql         Tablas, restricciones, índices, RLS y vistas
├── tests/run.js                134 comprobaciones sobre los cálculos
└── legacy/                     La versión anterior, intacta, por si acaso
```

La regla que mantiene esto ordenado: **`core/` no puede importar nada de `ui/` ni
tocar el DOM**. Por eso `tests/run.js` puede ejecutarse en Node sin navegador.

---

## Las matemáticas

Todo sale de `assets/js/core/metrics.js`, y cada fórmula tiene su comprobación en
`tests/run.js`.

| Magnitud | Fórmula |
|---|---|
| Balance calórico neto | `consumidas − quemadas` (negativo = déficit) |
| Estimación de peso hoy | `último peso + Σ(balance diario) / 7700` |
| Proyección a N días | `estimación hoy + (balance medio × N) / 7700` |
| Masa grasa | `peso × grasa% / 100` |
| Masa magra | `peso − masa grasa` |
| IMC | `peso / (altura_m)²` |
| FFMI | `masa magra / (altura_m)²` |
| Metabolismo basal | Mifflin-St Jeor |
| TDEE teórico | `basal × factor de actividad` |
| TDEE observado | `media consumida − (Δpeso × 7700) / días` |
| Tendencia robusta | Pendiente mediana de Theil–Sen × 7 |
| Arrastre acumulado | `Σ balance(último pesaje → hoy) / 7700` |
| Rango de predicción | Variación de báscula + incertidumbre acumulada de cada día |

Las 7700 kcal/kg son la regla de Wishnofsky. Es una aproximación lineal: describe
bien periodos de semanas y se queda corta en pérdidas muy grandes o muy rápidas,
donde el gasto se adapta a la baja. Por eso la aplicación **prefiere siempre el
TDEE observado a partir de tu historial real** cuando hay datos suficientes
(≥ 21 días de separación entre pesajes y ≥ 60 % de los días anotados), y solo
recurre a la fórmula teórica mientras no los haya.

La predicción no presenta el resultado como una medición. Cada día explícito,
estimado o imputado aporta una incertidumbre distinta; el rango mostrado es
orientativo y se abre conforme pasan los días sin pesarte. Un pesaje nuevo
recalibra el TDEE observado y vuelve a anclar la estimación. Con un pesaje cada dos
semanas, el modelo podrá corregir el desvío acumulado en cada ciclo.

### Tres decisiones que afectan a los números

**Los días sin anotar pueden contarse como días malos.** A partir de la fecha
configurada en Ajustes (por defecto el 1 de julio de 2026), un día que no aparece
en el historial puede recibir un superávit fijo (500 kcal ≈ 0,065 kg). Es una
regla configurable, no una certeza: por eso estos días ensanchan más el rango de
la predicción que un día anotado.

La regla se puede desactivar o reajustar entera desde *Ajustes → Días sin
registro*, y en pantalla los días imputados van siempre marcados: rayados en el
calendario y en el gráfico de balance, y etiquetados en las tarjetas.

**Los huecos anteriores a esa fecha siguen siendo desconocidos** y se excluyen de
las medias. Aplicar la regla a todo el histórico falsearía los datos antiguos,
donde un hueco podía ser simplemente que la aplicación aún no se usaba.

**El peso estimado se diferencia del último pesaje.** Entre la última vez que te
pesaste y hoy hay días cuyo balance ya ha ocurrido. El modelo suma ese arrastre al
último peso medido y comunica el rango resultante; la báscula, su fecha y la
calidad de la estimación permanecen siempre visibles. La composición corporal no
se extrapola: solo se muestra a partir de mediciones reales.

**Las calorías estimadas se señalan como tales.** Los días históricos anteriores
al registro numérico no tienen calorías anotadas, así que se estiman a partir de
los hábitos marcados. En la interfaz aparecen con asterisco o con la etiqueta
*estimadas*: un número inferido nunca se presenta como si lo hubieras medido.

---

## Publicar en Netlify

Sitio estático sin compilación. Arrastra la carpeta a Netlify, o conecta el
repositorio y deja lo que ya trae `netlify.toml`:

- **Build command:** vacío
- **Publish directory:** `.`

Con eso ya funciona, guardando en el navegador de cada dispositivo. Para
sincronizar entre ellos, sigue el paso siguiente.

---

## Activar la nube (Supabase)

Sin este paso los datos viven solo en el navegador. Si lo borras o cambias de
dispositivo, los pierdes. Son cinco minutos.

**1. Crea el proyecto.** En <https://supabase.com>, plan gratuito. Elige la región
más cercana (Frankfurt o París desde España).

**2. Crea el esquema.** En el *SQL Editor*, pega el contenido íntegro de
`supabase/schema.sql` y ejecútalo. Crea las tablas `perfiles`, `dias` y
`composicion`, sus restricciones e índices, las políticas RLS y la vista
`resumen_mensual`. Es idempotente: puedes volver a lanzarlo sin romper nada.

**3. Habilita el acceso por enlace mágico.** En *Authentication → Providers*,
activa **Email** y marca *Confirm email*. No hace falta nada más: la aplicación no
usa contraseñas.

**4. Añade la URL de tu sitio.** En *Authentication → URL Configuration*, pon tu
dominio de Netlify en *Site URL* y en *Redirect URLs*. Sin esto, el enlace del
correo no sabrá a dónde volver.

**5. Pega las credenciales.** En *Project Settings → API*, copia la *Project URL*
y la clave *anon public* en `assets/js/config.js`:

```js
export const SUPABASE = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

**6. Sube tus datos.** Abre la aplicación, entra con tu correo y, en
*Ajustes → Sincronización*, pulsa **Subir datos de este navegador**. A partir de
ahí todo se guarda en PostgreSQL y aparece al instante en tus otros dispositivos.

### Sobre la clave `anon`

Es pública por diseño y va en el HTML: no es un secreto que se te haya escapado.
Lo que protege tus datos es la política RLS, que compara `auth.uid()` con la
columna `user_id` de cada fila y se aplica dentro del motor de PostgreSQL. Con
esa clave y sin tu sesión no se puede leer ni escribir ninguna fila tuya, ni
siquiera saltándose por completo el código de la aplicación.

> **Nota sobre la versión anterior.** El `firebaseConfig` de `legacy/index.html`
> apuntaba a un documento fijo **sin autenticación**: cualquiera que abriese el
> código fuente podía leer y modificar el historial. Conviene borrar ese proyecto
> de Firebase, o al menos cerrar sus reglas de Firestore, una vez migrado.

---

## Copias de seguridad

*Ajustes → Exportar JSON* descarga absolutamente todo en un archivo legible que no
depende de esta aplicación. *Importar* fusiona: los días que coincidan se
sobrescriben con los del archivo y el resto se conserva, así que nunca borra algo
que el archivo no contenga.

---

## Añadir un hábito

Un solo sitio. En `assets/js/config.js`:

```js
export const HABITOS = [
  // …
  { clave: 'meditar', etiqueta: 'Meditar', codigo: 'MED' },
];
```

El formulario, el calendario, las rachas, la adherencia y el desglose por hábito
se ajustan solos. En Supabase no hay que tocar nada: los hábitos viven en una
columna `jsonb`, que es justo el tipo de dato que sí conviene tener sin esquema
rígido.

---

## Diseño

Monocromo: **una escala de grises y un único tono de acento**. Nada más.

```
Neutros   #f8f9fa  canvas      #ffffff  tarjeta
          #f1f5f9  hundido     #e2e8f0  borde      #cbd5e1  borde fuerte
          #0f172a  cifras      #334155  texto      #64748b  etiquetas   #94a3b8  ejes
Acento    #2563eb  pleno       #93c5fd  suave      #dbeafe  tenue       #eff6ff  fondo
```

Tres reglas sostienen la coherencia:

**1. El texto nunca lleva color.** Todas las cifras y etiquetas usan la escala de
grises. La dirección de un dato la comunican el signo (`+`/`−`) y la flecha
(`↑`/`↓`), que ya viajan dentro del propio número: no hace falta además pintarlo
de verde o rojo. Se verifica recorriendo el DOM y comprobando que ningún color de
texto se sale de los cuatro grises.

**2. El acento se reserva a dos usos.** Los controles con los que se interactúa
(botón principal, foco) y los datos representados gráficamente (barras, curvas,
calendario), donde la forma manda y el color solo acompaña. Las dos series de
composición corporal son el mismo tono a dos intensidades — grasa en pleno,
masa magra en suave — con leyenda, no dos colores distintos.

**3. Un solo patrón por concepto.** `.section` (bloque temático), `.zone`
(división interna por hairline), `.stats` (rejilla de cifra + micro-etiqueta),
`.facts` (datos en línea). Se repiten idénticos en las cuatro vistas.

### Arquitectura de la información

Cada vista se organiza en secciones con título, y cada sección es una tarjeta con
zonas separadas por una línea fina. No hay tarjetas sueltas flotando: si dos datos
se explican mutuamente, viven en la misma tarjeta.

| Vista | Secciones |
|---|---|
| Panel | Estado actual · Hoy · Proyección · Histórico |
| Registro | Día · Constancia · Últimos días |
| Cuerpo | Actual · Progreso · Medición · Histórico |
| Ajustes | Perfil · Días sin registro · Datos |

El panel pasó de 13 tarjetas dispersas a **4 secciones y 6 tarjetas**.

**Show, don't tell.** Las cifras van con una micro-etiqueta en versalitas y sin
frase explicativa: `MASA MAGRA / 74,2 kg`, no "tu masa magra estimada es de…".
El texto corrido se reserva para decisiones de configuración, donde el usuario
necesita saber qué está eligiendo.

### Responsive

Mobile-first de verdad: los estilos por defecto son los del móvil y las media
queries solo añaden desde 768 px.

- Navegación en **barra inferior fija** al alcance del pulgar; control segmentado
  en la cabecera a partir de 768 px.
- Objetivos táctiles de **44 px** mínimo (`--touch`), y campos a 16 px para que
  iOS no haga zoom al enfocarlos.
- Los gráficos son SVG con `viewBox`: escalan con el contenedor sin recalcular
  nada. Las tablas anchas scrollean **dentro de su tarjeta** (`.table-wrap`), de
  modo que la página nunca desplaza en horizontal.

Cambiar la identidad visual entera se hace en `tokens.css`: el resto del CSS solo
consume variables.

> **Nota técnica.** `.topbar` usa fondo sólido y no `backdrop-filter` a propósito:
> ese filtro convierte al elemento en bloque contenedor de sus descendientes
> `position: fixed`, y la barra de pestañas inferior quedaba anclada dentro de la
> cabecera en lugar de al borde de la ventana.
