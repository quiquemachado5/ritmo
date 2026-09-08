export interface NutrientReference {
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

export interface ReferenceMeal {
  id: string;
  texto: string;
  referencia: NutrientReference;
  /** Margen asumido por variación real de marcas, cortes y cocción. */
  toleranciaPct: number;
}

/**
 * Banco de platos complejos para evaluar el analizador de forma estable. Las
 * referencias se calculan ingrediente a ingrediente con valores medios de
 * composición; no representan consejo médico ni una marca comercial concreta.
 */
export const REFERENCE_MEALS: ReferenceMeal[] = [
  {
    id: "pavo-pecorino-ensalada",
    texto: "220 g de pechuga de pavo a la plancha con 1 diente de ajo y 10 ml de AOVE, 20 g de queso pecorino y 80 g de canónigos con 15 ml de AOVE, 5 ml de vinagre de Jerez y sal",
    referencia: { kcal: 595, proteinas: 71, carbohidratos: 5, grasas: 32 },
    toleranciaPct: 16,
  },
  {
    id: "salmon-patata-alioli",
    texto: "180 g de lomo de salmón al horno con 10 g de mantequilla y eneldo, 150 g de patata cocida con piel, 100 g de espárragos con 5 ml de AOVE y 30 g de alioli casero",
    referencia: { kcal: 845, proteinas: 45, carbohidratos: 35, grasas: 58 },
    toleranciaPct: 18,
  },
  {
    id: "bowl-arroz-pollo",
    texto: "Bowl con 150 g de arroz basmati cocido, 150 g de contramuslo de pollo, 10 ml de aceite de sésamo, 15 ml de salsa de soja, 80 g de brócoli, 50 g de aguacate y 5 g de sésamo",
    referencia: { kcal: 725, proteinas: 48, carbohidratos: 54, grasas: 35 },
    toleranciaPct: 16,
  },
  {
    id: "cerdo-boniato-nueces",
    texto: "200 g de solomillo de cerdo ibérico con 10 ml de AOVE, 120 g de boniato asado, 80 g de champiñones con 5 ml de AOVE y ajo, más 15 g de nueces",
    referencia: { kcal: 640, proteinas: 53, carbohidratos: 29, grasas: 34 },
    toleranciaPct: 18,
  },
  {
    id: "ensalada-garbanzos-pollo",
    texto: "Ensalada templada con 100 g de garbanzos cocidos, 120 g de pechuga de pollo, 60 g de espinacas, 40 g de queso de cabra, 50 g de tomate cherry y 15 ml de AOVE con 8 g de mostaza antigua",
    referencia: { kcal: 625, proteinas: 53, carbohidratos: 29, grasas: 32 },
    toleranciaPct: 16,
  },
  {
    id: "ternera-pure-pimientos",
    texto: "180 g de filete de ternera a la plancha con 10 ml de AOVE, 150 g de puré hecho con 130 g de patata, 15 ml de leche entera y 5 g de mantequilla, más 100 g de pimientos del padrón con 5 ml de AOVE",
    referencia: { kcal: 665, proteinas: 54, carbohidratos: 32, grasas: 35 },
    toleranciaPct: 18,
  },
  {
    id: "pasta-gambas-tomate",
    texto: "150 g de pasta penne en crudo con 120 g de gambas, 10 ml de AOVE, 2 dientes de ajo, guindilla, 50 g de tomates secos en aceite escurridos y 15 g de parmesano",
    referencia: { kcal: 900, proteinas: 49, carbohidratos: 120, grasas: 22 },
    toleranciaPct: 15,
  },
  {
    id: "tortilla-mozzarella-pavo",
    texto: "Tortilla de 3 huevos L con 8 ml de AOVE, 50 g de mozzarella rallada y 40 g de jamón de pavo, con 100 g de tomate y 5 ml de AOVE",
    referencia: { kcal: 515, proteinas: 40, carbohidratos: 8, grasas: 34 },
    toleranciaPct: 16,
  },
  {
    id: "desayuno-avena-yogur",
    texto: "Bol con 60 g de copos de avena, 200 g de yogur griego natural 2%, 100 g de plátano, 15 g de crema de cacahuete y 10 g de miel",
    referencia: { kcal: 590, proteinas: 30, carbohidratos: 82, grasas: 18 },
    toleranciaPct: 16,
  },
  {
    id: "lentejas-arroz-huevo",
    texto: "Plato con 250 g de lentejas guisadas, 100 g de arroz blanco cocido, 1 huevo L, 50 g de espinacas y 10 ml de AOVE",
    referencia: { kcal: 660, proteinas: 31, carbohidratos: 88, grasas: 21 },
    toleranciaPct: 18,
  },
  {
    id: "bocadillo-pollo-aguacate",
    texto: "Bocadillo con 120 g de pan, 140 g de pechuga de pollo a la plancha, 60 g de aguacate, 40 g de tomate y 15 g de mayonesa",
    referencia: { kcal: 760, proteinas: 57, carbohidratos: 73, grasas: 27 },
    toleranciaPct: 18,
  },
  {
    id: "tofu-quinoa-verduras",
    texto: "Bowl con 180 g de tofu firme, 150 g de quinoa cocida, 120 g de verduras salteadas, 10 ml de aceite de sésamo, 15 ml de salsa de soja y 10 g de anacardos",
    referencia: { kcal: 610, proteinas: 35, carbohidratos: 55, grasas: 30 },
    toleranciaPct: 18,
  },
];
