# Contabilidad UNIBE — Repaso

Aplicación estática, sin backend ni dependencias externas. Para Netlify, publicar la carpeta que contiene `index.html`, sin comando de compilación. También puede abrirse directamente el HTML; para conservar el mismo almacenamiento conviene usar siempre el mismo sitio y navegador.

## Modalidades

- Temario: cinco unidades, búsqueda, fuentes declaradas y explicaciones simplificadas.
- Práctica: las 57 preguntas originales, con explicación inmediata y selección adaptativa.
- Emergencia: 20 preguntas únicas, cuatro por unidad, y resumen de áreas para reforzar.
- Flashcards: las 22 tarjetas originales.
- Desarrollo: 22 consignas basadas en esas tarjetas, borradores, respuestas modelo, conceptos y dominio autoevaluado. La comparación por palabras no evalúa significado ni sustituye la revisión del estudiante.
- Simulacro: 10, 20, 30 o 57 preguntas, corrección final y omisiones registradas como incorrectas.
- Rendimiento: preguntas únicas respondidas, aciertos por intento, errores pendientes, conceptos autoevaluados y evolución de los simulacros.

## Persistencia y selección

Se conserva la clave `repaso-unibe-v1` de localStorage. La versión 2 amplía el objeto sin descartar el historial ni los simulacros anteriores. Los registros antiguos no reciben datos de omisiones o fechas inventados. Se guardan el orden de preguntas, la selección, las respuestas corregidas, el progreso y los borradores.

El reloj del simulacro usa una fecha de vencimiento absoluta, que sigue corriendo al recargar o cerrar la página. Pausar o cambiar de sección detiene explícitamente el reloj y conserva el tiempo restante. Continuar retoma esa sesión; abandonar exige confirmación y conserva las estadísticas ya registradas. Una sola ronda puede estar activa a la vez.

La selección usa Fisher–Yates para desempatar, con prioridad para preguntas nuevas, falladas y revisiones antiguas. Los aciertos de cada unidad ajustan esa prioridad. Se alternan unidades para equilibrar la cobertura y no se repiten preguntas dentro de la ronda. No es un predictor de aprobación del examen.

## Fuentes

Se conservaron las referencias originales, incluidas las páginas que ya mencionaban las preguntas. Los DOCX y PDF no están incluidos en el repositorio: esas páginas no se pudieron volver a verificar. Las referencias nuevas identifican el resumen o la flashcard utilizada y señalan esa limitación.

## Verificación

Ejecutar `node verify.cjs` (Node.js, sin instalar paquetes). Comprueba contenido, compatibilidad del historial, selección equilibrada, persistencia, pausas, vencimiento, omisiones, resultados e idempotencia de la finalización. Usa un DOM mínimo para comprobar la lógica; no reemplaza las pruebas de navegador.

También se verificaron en navegador las rondas de emergencia completas, la recuperación de errores, las flashcards, búsqueda, desarrollo, recarga y finalización de simulacros con omisiones. Se revisó navegación y ausencia de desbordamiento horizontal en vistas móviles y de escritorio.
