# Verificación integral de Contabilidad UNIBE

Fecha: 1 de noviembre de 2026.

## Resultado

Las cuatro baterías finalizaron sin fallos en la versión integrada de la aplicación. Se usó Chrome sin ventana y contextos efímeros: las pruebas no escriben sobre el progreso del navegador del estudiante. La paleta actual es una propuesta de grafito neutro y azul discreto, pendiente de valoración visual del Jefe.

| Batería ejecutada | Evidencia |
| --- | --- |
| `node verify.cjs` | 57 preguntas, 22 flashcards, cinco unidades, compatibilidad v1, selección adaptativa, persistencia, pausas, vencimiento, omisiones e idempotencia. |
| `node verify-browser.cjs` | 80 combinaciones: diez módulos × dos temas × cuatro anchos (320, 390, 768 y 1440 px). Sin desbordamiento horizontal. Dieciséis pares principales de contraste cumplen al menos 4.5:1. |
| `node verify-materials.cjs` | 45 referencias, 11 videos, 12 secciones, filtros, búsqueda, consignas, estados de las fuentes y sesiones. Ambos temas a 320, 390 y 1440 px. |
| `node verify-full.cjs` | 26 escenarios de aceptación con eventos de mouse, táctiles y teclado enviados por Chrome DevTools Protocol. Los controles se comprueban visibles y libres de elementos superpuestos antes de pulsarlos. |

## Cobertura de aceptación

- Navegación por los diez módulos en escritorio y celular; apertura real de enlaces de Materiales en otra pestaña.
- Prácticas completas de 57 preguntas a 1440 px con mouse y a 390 px con eventos táctiles. En cada ronda: 38 aciertos, 19 errores, recarga antes y después de corregir, pausa y continuación.
- Recuperación de los 19 errores de cada ronda. Verificación independiente del número de intentos, aciertos acumulados, resultados por unidad y estado sin errores pendientes.
- Búsqueda con y sin resultados, filtros por unidad, recorrido de las 22 flashcards, revelado y navegación anterior/siguiente.
- Desarrollo: escritura, comparación, dominio autoevaluado, persistencia e invalidación de la revisión al editar. El texto escrito se representa como texto, incluso si contiene etiquetas HTML.
- Cancelar y confirmar abandono; cancelar y confirmar reinicio de progreso.
- Simulacros de 10, 20, 30 y 57 preguntas: duración, orden sin duplicados, aciertos, errores, omisiones, cancelación de finalización, resultados y persistencia sin duplicar registros.
- Vencimiento del simulacro al recargar, con todas las preguntas omitidas y una sola finalización.
- Almacenamiento bloqueado, datos ilegibles y respaldo imposible.
- Las 57 preguntas seleccionadas y corregidas, con sus explicaciones visibles, a 320 px en ambos temas. Sin desbordamiento horizontal.
- Simulacro táctil a 320 px: hoja de 57 respuestas, saltos, anterior/siguiente, pausa al ir a Materiales, recarga, continuación y abandono.
- Sesión HTTP ya abierta sin red. Apertura directa de `index.html` y recarga sin red, conservando el progreso en Chrome.

## Hallazgo corregido

La lectura fallida del progreso guardado descartaba el valor ilegible y lo sobrescribía con un objeto vacío. Ahora, antes de escribir, se conserva el valor original en una clave `repaso-unibe-recovery-<fecha>`. Si tampoco es posible guardar ese respaldo, se bloquea la sobrescritura del dato anterior y se avisa al estudiante. Los datos válidos mantienen la clave y la estructura actuales.

La prueba de datos ilegibles falló antes de la corrección y pasó después. También se comprobó que el dato original permanece intacto si no se puede respaldar.

## Material académico y fuentes

Se contrastaron las 45 referencias del catálogo con los enlaces y reproductores del curso de Moodle compartido: coincidieron las 45, incluidos los 11 identificadores de video. Esa comprobación confirma la correspondencia con el aula; no equivale a revisar completamente las lecturas o reproducir los videos de principio a fin. Se mantienen los estados de contenido pendiente y acceso restringido.

## Límites de esta verificación

- Los eventos táctiles son una emulación de Chrome; no se probó hardware móvil físico, Safari ni Firefox.
- No se verificó reproducción completa, disponibilidad futura ni contenido integral de los videos externos. Moodle y YouTube requieren conexión y pueden imponer sus propios permisos.
- La prueba sin red de una página HTTP se hizo con la página ya abierta. No se promete recargar un sitio alojado estando sin conexión. El HTML local sí se abrió y recargó sin red.
- El contraste comprobado y la navegación por teclado no constituyen una certificación completa de accesibilidad.
- No se realizó un despliegue ni una verificación en Netlify en producción. La valoración estética de la nueva paleta sigue abierta.

## Repetir las pruebas

Se necesitan Node 22 o posterior, Python para servir la carpeta y Chrome con CDP local en el puerto 9227. No hay paquetes que instalar.

1. Servir la carpeta con `python -m http.server 8765 --bind 127.0.0.1`.
2. Iniciar Chrome sin ventana con `--headless=new`, `--remote-debugging-port=9227` y un directorio temporal para `--user-data-dir`.
3. Ejecutar las cuatro órdenes de la tabla. [qa-browser.cjs](./qa-browser.cjs) crea y elimina un contexto de prueba por escenario; no usa el almacenamiento de otras pestañas.

Las pruebas de aceptación también se pueden limitar al almacenamiento con `node verify-full.cjs --storage`.
