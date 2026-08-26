# UI Lego de RITMO

RITMO incorpora inspiración externa como patrones adaptados, no como estilos copiados. Cada módulo debe conservar los tokens cálidos, la semántica de color, la accesibilidad y `prefers-reduced-motion` del producto.

## Fuentes compatibles

- [shadcn/ui](https://ui.shadcn.com): primitives accesibles y extensibles. Ya sustenta los tabs, dialogs, drawers y controles de RITMO.
- [beUI](https://beui.dev): microinteracciones de tabs, acciones y números. Usar solo cuando comuniquen un cambio real.
- [Transitions.dev](https://transitions.dev): panel reveal, icon swap y estados de carga. Preferir `transform`, `opacity` y `grid-template-rows` para animaciones ligeras.
- [Rare UI](https://rareui.com): ideas de interacción puntual. Evitar efectos 3D, orb o decoración que no aporten a una app de seguimiento.
- [Beautiful UI](https://beautifului.dev): referencia de composición y módulos, siempre reinterpretados con la identidad RITMO.

## Módulos propios derivados

- `RitmoDisclosure`: reveal progresivo para contenido histórico o secundario; se usa en el resumen semanal.
- `Tabs`, `Dialog`, `Drawer`, `Tooltip`: primitives existentes para navegación y registro rápido.
- `Card`, `Metric`, `Chip`, `MacroBar`: piezas semánticas de RITMO, no sustituibles por componentes genéricos.

## Criterio de integración

1. El módulo debe resolver una acción o lectura concreta.
2. Debe funcionar con teclado, móvil y reducción de movimiento.
3. No se añaden dependencias si el patrón puede vivir con los primitives actuales.
4. Se adapta a los tokens de RITMO; no se importa una estética externa.
