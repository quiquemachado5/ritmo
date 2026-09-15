# Catálogo nutricional de RITMO

Versión `2026-09-15.1`. Revisión realizada el 15 de septiembre de 2026.

El análisis usa primero el catálogo local y determinista. Los proveedores externos
solo pueden intervenir cuando la política de despliegue los habilita y queda algún
ingrediente sin reconocer; sus filas se recalculan con el catálogo cuando existe
una coincidencia. Actualmente esa política está desactivada.
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
| [Pechuga de pollo sin piel, cocinada a la parrilla · 171534](https://fdc.nal.usda.gov/food-details/171534/nutrients) | 151 | 30,54 | 0 | 3,17 |
| [Huevo entero cocido · 173424](https://fdc.nal.usda.gov/food-details/173424/nutrients) | 155 | 12,58 | 1,12 | 10,61 |
| [Plátano crudo · 173944](https://fdc.nal.usda.gov/food-details/173944/nutrients) | 89 | 1,09 | 22,84 | 0,33 |

## Catálogo estándar de RITMO

El resto incorpora la tabla de referencia facilitada para RITMO y se identifica
como **referencia local**. No se le asigna un enlace USDA, BEDCA u Open Food Facts,
una fecha de verificación ni una validación inexistentes. Su identificador
`ritmo-local:…` se deriva del nombre canónico, no de la posición en el catálogo.
El nombre canónico debe mantenerse estable; nuevas formulaciones requieren otro
ID. `CATALOGO_NUTRICIONAL` expone todas las entradas, sus nutrientes y su estado.

## Cantidades y correcciones

- Gramos/kilos: peso indicado por la persona; no podemos comprobar que se pesó.
- Unidades (filetes, lonchas, cucharadas): número indicado, masa aproximada.
- Rangos de unidades (por ejemplo, «5-6 rodajas»): se usa el punto medio y se
  conserva la etiqueta de cantidad aproximada.
- Volumen: ml indicados, masa aproximada. La conversión actual 1 ml ≈ 1 g no es
  una densidad validada para cada líquido: para mayor precisión se piden gramos.
- Sin cantidad: porción supuesta y señalada como tal.
- Los nombres compuestos se cuentan una sola vez: por ejemplo, «hamburguesa de
  pollo» no suma además una hamburguesa genérica y otra ración de pollo. Cremas,
  gazpacho, salmorejo y productos rebozados usan una receta media cuando no se
  aporta etiqueta o desglose; por eso siempre aparecen como aproximados.
- Salvo indicación expresa de «peso cocinado», los gramos se interpretan en crudo,
  fresco y limpio. Arroz, pasta, quinoa y legumbres secas aplican su factor de
  absorción de agua cuando el peso sí se declara cocinado; carnes y pescados aplican
  su merma de agua. Una unidad servida como «guisada» sí se interpreta como pieza
  cocinada, porque su peso unitario corresponde al alimento ya preparado.
- Aceite: cucharada/cda = 10 g = 90 kcal; cucharadita/cdta = 5 g = 45 kcal;
  chorrito o pulverización = 3 g = 27 kcal.
- Cambiar gramos recalcula los nutrientes desde la referencia por 100 g.
- Cambiar nutrientes crea una corrección personal; no se atribuye a USDA.
- El texto no interpretado se muestra y no añade calorías silenciosamente.

Las pruebas son de regresión de cálculo y transparencia, no una certificación
de precisión clínica o nutricional. Las doce comidas de referencia existentes
siguen siendo aproximaciones y no etiquetas de laboratorio.

## Fuentes públicas previstas para ampliaciones

- USDA FoodData Central, para ingredientes genéricos y fichas públicas trazables.
- BEDCA, para alimentos y preparaciones habituales en España.
- Open Food Facts, para productos envasados identificados por marca o código.

RITMO no muestra una fuente como consultada hasta que la entrada concreta conserva
su identificador o URL verificable. La fórmula 4/4/9 se enseña como comprobación de
coherencia, no como sustituto automático de la energía declarada (fibra y redondeos
pueden producir diferencias pequeñas).
