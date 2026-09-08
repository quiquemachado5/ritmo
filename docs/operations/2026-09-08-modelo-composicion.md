# Modelo de composición y peso · 8 septiembre 2026

## Alcance

RITMO usa una aproximación dinámica de dos compartimentos inspirada en el trabajo de Kevin Hall: masa grasa (FM) y masa libre de grasa (FFM). No reproduce el Body Weight Planner del NIH ni promete precisión clínica. Su prioridad sigue siendo el pesaje real: cada medición vuelve a anclar el estado y el historial cerrado calibra la relación entre hábitos, energía y cambio de peso.

El modelo está destinado a personas adultas. El perfil ya limita la edad mínima a 18 años.

## Convención y cálculo

El balance interno conserva la convención existente de RITMO:

```text
balance = energía consumida − energía gastada
```

Por tanto, un déficit es negativo y reduce FM y FFM; un superávit es positivo y las aumenta. Esta convención evita el error de signo de sumar un déficit positivo al peso.

El TDEE parte de Mifflin–St Jeor y del nivel de actividad. El efecto térmico de los alimentos queda incluido en el gasto total estimado u observado; no se vuelve a sumar como una partida independiente para evitar contarlo dos veces. En déficits sostenidos se aplica gradualmente una adaptación metabólica de hasta el 8 %, sin permitir que la adaptación convierta por sí sola un déficit en superávit.

La energía diaria se reparte entre FM y FFM con una partición dependiente de la grasa disponible. Se usa la relación simplificada de Forbes `dFFM/dFM = 10,4/FM`, convertida a fracción energética y limitada de forma prudente entre 0,60 y 0,85. Las equivalencias usadas son 9.500 kcal/kg de grasa y 1.800 kcal/kg de masa libre de grasa.

Si hay un porcentaje de grasa registrado antes del último pesaje, manda esa medición. Si falta, se emplea una estimación antropométrica de respaldo basada en IMC, edad y sexo; la interfaz la identifica como estimación y nunca la mezcla con la sección de mediciones corporales reales.

## Báscula, tendencia e incertidumbre

Desde el último pesaje se simula cada día disponible. La señal energética se contrasta con una tendencia robusta y una tendencia ponderada de los siete últimos pesajes. El peso de la señal energética es dinámico: baja cuando existen pesajes frecuentes y consistentes, y sube cuando hay poca evidencia de báscula.

La corrección de tendencia se redistribuye entre FM y FFM conservando siempre `peso = FM + FFM`. Las proyecciones se ofrecen para hoy, mañana, 3, 7, 14 y 28 días, además del horizonte técnico de 30 días que conserva la auditoría histórica.

La báscula se modela como `FM + FFM + líquido transitorio`. En un día observado, no marcar «Sin alcohol» se interpreta como alcohol; un día totalmente vacío continúa siendo desconocido. El prior de producto —una heurística, no una constante fisiológica— añade 0,45 kg al día siguiente y lo hace decaer durante tres días. Si existen al menos dos tramos diarios con alcohol y tres sin alcohol, RITMO sustituye ese prior por la diferencia mediana personal, limitada entre 0,15 y 1,20 kg. Esta capa modifica la lectura esperada de báscula y su incertidumbre, pero nunca se transforma en grasa, masa libre de grasa o balance calórico.

Los rangos combinan el error histórico walk-forward con la incertidumbre diaria. Se amplían cuando faltan registros, hay días imputados o pasa más tiempo sin pesarse. La calibración y el backtest usan ahora la misma densidad energética efectiva de dos compartimentos; no mezclan esa predicción con la equivalencia antigua de 7.700 kcal/kg.

## Límites honestos

- Las oscilaciones de agua, glucógeno, sodio y contenido intestinal no se pueden predecir con precisión a partir de hábitos.
- La estimación antropométrica de grasa tiene error individual importante; una medición doméstica tampoco equivale a una referencia clínica.
- Un backtest retrospectivo mide el comportamiento sobre datos pasados, no garantiza el siguiente peso.
- El aprendizaje solo usa tramos de pesaje cerrados y, en cada evaluación walk-forward, excluye los datos futuros.

La auditoría separa el MAE de cada versión para no atribuir al modelo actual los errores de fórmulas anteriores. La versión asociada es `ritmo-2026-09-v3-liquidos`.

## Calidad operativa

- Hoy, Nutrición y Progreso indican cuál es el siguiente dato concreto que más mejora la lectura.
- El banco nutricional contiene doce platos complejos y mide MAE, MAPE, percentil 90 y sesgo en kcal y cada macro.
- El diagnóstico opcional solo comparte tipo, estado, versión, sección y familia de navegador; no envía ruta completa, user-agent, correo ni datos de salud. El servidor limita veinte eventos por minuto y por sesión autenticada.
- Producción bloquea framing, tipos MIME ambiguos, políticas cross-domain y fuerza HSTS.
- CI verifica RLS también sobre la auditoría del modelo y detiene el despliegue si el JavaScript supera 700 kB gzip totales o 130 kB en un único chunk.
