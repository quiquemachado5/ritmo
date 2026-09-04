# Catálogo nutricional de RITMO

Versión `2026-09-04.1`. Revisión realizada el 4 de septiembre de 2026.

El análisis sigue siendo local y aproximado; no contacta con proveedores externos.
La trazabilidad de una referencia **no** valida el reconocimiento del plato, la
porción, el método de preparación ni la composición de una marca concreta.

## Referencias contrastadas

Se contrastaron los campos originales de las fichas completas de **USDA FoodData
Central, SR Legacy**, publicadas el 1 de abril de 2019. Las cantidades se expresan
por 100 g. Identificadores de nutrientes: energía 1008, proteína 1003,
carbohidratos por diferencia 1005 y grasas totales 1004. Los valores del buscador
pueden aparecer redondeados; `catalog.ts` conserva los de la ficha completa.

| Referencia | kcal | Proteínas (g) | Carbohidratos (g) | Grasas (g) |
| --- | ---: | ---: | ---: | ---: |
| [Arroz blanco largo, cocido sin sal · 169757](https://fdc.nal.usda.gov/food-details/169757/nutrients) | 130 | 2,69 | 28,17 | 0,28 |
| [Arroz blanco largo, crudo · 169756](https://fdc.nal.usda.gov/food-details/169756/nutrients) | 365 | 7,13 | 79,95 | 0,66 |
| [Pasta cocida sin sal, sin enriquecer · 168928](https://fdc.nal.usda.gov/food-details/168928/nutrients) | 158 | 5,8 | 30,86 | 0,93 |
| [Pasta seca, sin enriquecer · 168927](https://fdc.nal.usda.gov/food-details/168927/nutrients) | 371 | 13,04 | 74,67 | 1,51 |
| [Aceite de oliva para ensalada/cocina · 171413](https://fdc.nal.usda.gov/food-details/171413/nutrients) | 884 | 0 | 0 | 100 |

## Datos anteriores

El resto conserva los valores preexistentes de RITMO y se identifica como
**Referencia local pendiente de verificar**. No se les asigna un enlace USDA,
una fecha de verificación ni una validación inexistentes. Su identificador
`ritmo-local:…` se deriva del nombre canónico, no de la posición en el catálogo.
El nombre canónico debe mantenerse estable; nuevas formulaciones requieren otro
ID. `CATALOGO_NUTRICIONAL` expone todas las entradas, sus nutrientes y su estado.

## Cantidades y correcciones

- Gramos/kilos: peso indicado por la persona; no podemos comprobar que se pesó.
- Unidades (filetes, lonchas, cucharadas): número indicado, masa aproximada.
- Volumen: ml indicados, masa aproximada. La conversión actual 1 ml ≈ 1 g no es
  una densidad validada para cada líquido: para mayor precisión se piden gramos.
- Sin cantidad: porción supuesta y señalada como tal.
- Cambiar gramos recalcula los nutrientes desde la referencia por 100 g.
- Cambiar nutrientes crea una corrección personal; no se atribuye a USDA.
- El texto no interpretado se muestra y no añade calorías silenciosamente.

Las pruebas son de regresión de cálculo y transparencia, no una certificación
de precisión clínica o nutricional. Las ocho comidas de referencia existentes
siguen siendo aproximaciones y no etiquetas de laboratorio.
