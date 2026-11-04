# Rediseño de shell visual (navegación, header, Inicio, Tu Núcleo) — Spec de diseño

**Fecha:** 2026-11-03
**Contexto:** La clienta pidió hacer ALBA "tan fácil y operativa" como la app competidora **Niddo** (coparentalidad), tras compartir ~20 capturas de pantalla de referencia. Este spec cubre la primera pasada acordada: navegación, header global, botón de acciones rápidas, modales de ayuda, pantalla de Inicio, y la nueva pantalla "Tu Núcleo". Validado iterativamente con la clienta sobre un prototipo interactivo (Artifact), no solo descrito en texto.

**Fuera de alcance de este spec** (decisión explícita de la clienta, ver sección "Decisiones de alcance"):
- **Custodia** (calendario de custodia + intercambios + recordatorios): confirmado como "importantísimo", pero por su tamaño se brainstormea aparte, como spec propio, inmediatamente después de este. Aquí solo se agrega como tarjeta de navegación en "Más funciones".
- **Medicación** y **Listas**: no existen hoy en ALBA. Quedan como tarjetas "Próximamente" sin funcionalidad.
- **Los familiares** (abuelos, niñeras, etc. dentro de Tu Núcleo): requiere extender el modelo de datos más allá de los 2 progenitores actuales. Por ahora es una sección visual/informativa, sin invitar ni gestionar familiares de verdad.

---

## 1. Navegación principal

**Antes:** 7 íconos en el nav inferior (`Dashboard`, `Perfil`, `Chat`, `Calendario`, `Gastos`, `Acuerdos`, `Bóveda`), con etiquetas de 9px — apretado, especialmente en pantallas angostas.

**Ahora:** 4 ítems: **Inicio** (renombrado de "Dashboard"), **Chat**, **Calendario**, **Más**. `Perfil`, `Gastos`, `Acuerdos` y `Bóveda` se mueven dentro de "Más" (ver sección 7).

- El ícono de "Más" cambia de tres puntos (`•••`) a una cuadrícula 2×2 — se lee más claro como "más opciones", y además anticipa visualmente el grid que hay adentro.
- Mismo componente `AppNav`, misma paleta de marca para el estado activo (círculo `orange` detrás del ícono activo).

## 2. Botón flotante "+" (acciones rápidas)

- Posición: **esquina inferior derecha** (no centrado), flotando sobre el nav.
- Es **contextual**: las acciones que ofrece cambian según la pestaña activa. Al tocarlo, despliega 1-2 chips verticales (texto + círculo de ícono de color), apilados arriba del botón, alineados a la derecha. El botón "+" rota a "×" mientras está abierto.
- Acciones por sección:
  - **Inicio:** Nuevo evento, Nuevo gasto.
  - **Chat:** Nuevo mensaje.
  - **Calendario:** Nuevo evento, Nueva tarea.
- **No existe en "Más"** ni en "Tu Núcleo" (no hay nada que "crear" en una pantalla de navegación/overflow).
- Importante — lenguaje: el "+" de Calendario ofrece **"Nuevo evento"** y **"Nueva tarea"** únicamente. Nunca debe exponer el término técnico "crear slot" (slot de custodia recurrente) — ese concepto sigue existiendo en el convenio/backend, pero no se presenta como una acción rápida de creación aquí; se configura desde el flujo de convenio existente.

## 3. Header global

Nuevo, fijo (no se mueve con el scroll), visible en Inicio/Chat/Calendario/Más:

- **Izquierda:** foto de perfil del usuario, circular (~46px), con borde blanco y sombra sutil. El recorte de la imagen (`object-position`) prioriza la parte superior para no cortar el pelo.
- **Centro:** wordmark "alba." (punto final en color `orange`), ~28px.
- **Derecha:** campana de notificaciones con contador (badge rojo con número).

## 4. Fondo: de beige a blanco

- El fondo base de la app cambia de `--alba-sand` (#e5dcd3) a **blanco** (#ffffff).
- **No se abandona la paleta de marca** — sand/dawn/orange/salmon/sky/sea/purple se siguen usando como acento (tarjetas de color, íconos, estado activo del nav, ilustraciones), igual que Niddo tampoco es monocromático, solo tiene lienzo blanco.
- Efecto en las tarjetas: sobre fondo blanco, las tarjetas pierden el contraste de color que las separaba del fondo beige. Se compensa con un **borde delgado** (1px, tono `sand`) en vez de depender solo de la sombra ambient.
- Este es un cambio de `globals.css` (`--background`) y de la clase `.card`/equivalente en los componentes — no es una preferencia por pantalla, es el nuevo valor por defecto de toda la app.

## 5. Modales "Así funciona" (ayuda contextual por sección)

Patrón reutilizable, uno por sección (Inicio, Chat, Calendario en esta pasada; Gastos/Perfil/Acuerdos/Bóveda/Tu Núcleo quedan con la misma plantilla para cuando se implementen, no es trabajo nuevo de diseño).

**Cuándo aparece:**
- **Automático** la primera vez que el usuario entra a esa sección.
- Después de la primera vez, **ya no aparece solo** — queda disponible manualmente tocando un ícono "i" (círculo, borde delgado) junto al título de la sección.
- Esto requiere persistir "ya vio el modal de X sección" por usuario — en base de datos (no `localStorage`; no es por dispositivo, debe sincronizar entre sesiones/dispositivos del mismo usuario, siguiendo la convención ya establecida en el proyecto de nunca guardar estado de aplicación solo en el cliente).

**Presentación (sheet, no pantalla completa):**
- Se abre como una hoja que sube desde abajo, **no** `inset:0` de borde a borde — dejando ver una franja de la pantalla de atrás arriba, con las esquinas superiores redondeadas (28px).
- **Altura ajustada al contenido** (no se estira hasta el borde inferior dejando espacio vacío).
- Fondo: tono oscuro neutro suave, **azul petróleo** (`#4a5a62`) — deliberadamente distinto del resto de la app (blanca) para que se sienta como "momento de explicación", pero sin ser agresivo (se descartaron tanto el café/ink de marca como un gris casi negro por verse muy duros).
- Se cierra con una "×" arriba a la izquierda o el botón "ENTENDIDO" abajo.

**Contenido de cada modal** (de arriba a abajo):
1. Ilustración "hero": una tarjeta decorativa con 1-2 elementos mockup relevantes a la sección (ej. dos burbujas de chat para Chat, una tarjeta de calendario para Calendario) + una insignia circular de color con un ícono + puntitos decorativos. **100% hecho en código** (formas simples, SVG, paleta de marca) — no requiere ilustración/mascota encargada.
2. Título en mayúsculas (ej. "CHAT").
3. Descripción corta (1-2 líneas).
4. Encabezado "Así funciona".
5. 3 puntos, cada uno con ícono + título corto + descripción de 1-2 líneas.
6. Botón "ENTENDIDO" (ancho completo, color `orange`).

**Contenido real por sección** (no genérico, basado en funciones que ALBA ya tiene):

- **Inicio:** Lo próximo primero / Balance siempre visible / Último mensaje a la mano.
- **Chat:** Tono cuidado (Tone Meter ya existente) / Queda con respaldo (hash + sellado Merkle ya existente) / Organiza por hilos (`chat_threads` ya existente).
- **Calendario:** Slots recurrentes / Confirma check-in y check-out / Lugares de encuentro.

## 6. Inicio (antes "Dashboard")

Pasa de ser una lista plana de 3 tarjetas a una pantalla más dinámica, de arriba a abajo:

1. Fila: "Hola, [nombre]" + ícono "i" (abre el modal de Inicio).
2. **Avatar grande del hijo/a** (circular, ~76px, borde `orange`), centrado, con su nombre debajo. Si hay más de un hijo, se evalúa en implementación mostrar al primero o un selector — no se definió en este spec, usar criterio (mostrar el primero por `createdAt` es razonable).
3. **Banner de recordatorio accionable** (fondo claro tono `dawn`, borde `orange`, ícono) — aparece solo cuando hay algo real pendiente de atención (ej. "El otro progenitor aún no confirmó el reparto de gastos"). Si no hay nada pendiente, el banner no se muestra (no inventar contenido).
4. **Tarjeta "Primeros pasos"**: barra de progreso + checklist (ítems completados se ven tachados con check verde; pendientes tienen círculo vacío + flecha `>` para ir a completarlos). Pensada sobre todo para usuarios nuevos — en implementación, evaluar ocultarla por completo una vez que el usuario completó todos los pasos (no solo mostrar 100%).
5. Encabezado "Resumen".
6. Las 3 tarjetas que ya existían: próxima visita, balance de gastos, último mensaje de chat — sin cambios de lógica, solo reubicadas debajo de lo nuevo.

## 7. Tu Núcleo (pantalla nueva, dentro de "Más")

Accesible desde una tarjeta en "Más funciones". Al entrar:

1. Botón "← Más" para volver.
2. Título "Tu Núcleo" + descripción corta.
3. **Banner ilustrado**: el "retrato familiar" completo (asset de la clienta, los 11 personajes juntos) como imagen de cabecera — se usa completo, sin recortar, porque recortar un personaje individual de una imagen compuesta a ojo se ve mal.
4. Tres secciones, cada una con filas de avatar + nombre:
   - **Los hijos** — datos reales (`children` existente). Botón "+ Añadir" visible pero puede reusar el flujo de alta ya existente en Perfil, no es una pantalla nueva de alta.
   - **Los progenitores** — datos reales (`family_members`/`profiles` existente): "Tú" y el otro progenitor.
   - **Los familiares** — **fuera de alcance funcional** (ver "Decisiones de alcance" arriba). En vez de datos falsos, mostrar un estado "Próximamente — vas a poder invitar a abuelos, niñeras y otras personas de confianza" en lugar de filas inventadas.
5. Avatares: la clienta proveyó 11 ilustraciones individuales por rol (Padre, Madre, Abuel@s, Madrastra, Padrastro, Hermano, Hermana, Hijo, Hija, Bebé hombre, Bebé mujer) en `Miniaturas familia alba/Avatares_Copaternidad/`. En implementación:
   - Copiar los 11 PNG a `apps/web/public/avatars/` (o equivalente ya establecido en el proyecto para assets estáticos).
   - Mapear por rol: progenitor → Padre/Madre según corresponda a su perfil; hijo/a → Hijo/Hija (o Bebé si aplica, no definido aún cómo se elige — usar criterio simple como edad, o dejar que el usuario elija su avatar al configurar el perfil del hijo).
   - **No** usar el PNG compuesto de los 11 juntos para avatares individuales — ese archivo es solo para el banner de cabecera.
   - `object-fit: cover` con `object-position: center 15%` para no cortar la parte superior (pelo) en el recorte circular.

## 8. Calendario (ajustes puntuales)

- Ícono "i" junto al título "Calendario" (ver sección 5).
- Nueva fila de filtros debajo de "Próximos eventos": **Este mes / Esta semana / Hoy** (pastillas, la activa en `ink` sólido, las demás en blanco/tono claro con borde).
- El "+" contextual solo ofrece "Nuevo evento"/"Nueva tarea" (ver sección 2 — nota de lenguaje).

## 9. Más funciones (antes lista vertical, ahora grid)

Cambia de una lista vertical de filas a un **grid de 2 columnas** de tarjetas (ícono circular de color + texto debajo, centrado), encabezado "Más funciones":

| Tarjeta | Estado | Ícono/color |
|---|---|---|
| Tu Núcleo | Funcional (sección 7) | Casa, `dawn` |
| Gastos | Funcional (ya existe) | Billete, `orange` |
| Perfil | Funcional (ya existe) | Persona, `sky` |
| Info y documentos | Funcional — **reemplaza a "Bóveda"** (ver nota) | Candado, `salmon` |
| Medicación | **Próximamente**, sin funcionalidad | Cruz médica, `success` (verde) |
| Custodia | **Próximamente** — se construye en spec dedicado aparte | Intercambio, `purple` |
| Acuerdos | Funcional (ya existe) | Documento+check, `sea` |
| Listas | **Próximamente**, sin funcionalidad | Checklist, `sky` |

**Decisión de la clienta (resuelta):** "Bóveda" deja de existir como tarjeta separada — su funcionalidad (documentos con hash SHA-256 + sellado Merkle) se absorbe dentro de **"Info y documentos"**. En implementación, "Info y documentos" apunta a la pantalla que hoy vive en `/boveda` (sin renombrar rutas ni perder el hash/Merkle existente), solo cambia la entrada de navegación: ya no hay una tarjeta "Bóveda" separada en el grid de "Más", ni en ningún otro nav. El grid queda en **8 tarjetas**, no 9.

Tarjetas marcadas "Próximamente": al tocarlas, no navegan a ningún lado funcional — mostrar un mensaje breve tipo "Esta función llega pronto" (toast o la misma tarjeta deshabilitada visualmente con opacidad reducida). No construir pantallas vacías para ellas.

---

## Self-review

**1. Cobertura:** cada decisión tomada en la sesión de mockup (nav, FAB, header, fondo blanco, modales, Inicio, Tu Núcleo, filtros de Calendario, grid de Más) tiene su sección arriba. Las piezas explícitamente diferidas (Familiares real, Medicación, Listas, Custodia) están marcadas como tales, no omitidas en silencio.

**2. Ambigüedad resuelta:** "Info y documentos" vs. Perfil/Bóveda se deja como nota abierta para la clienta en vez de que yo decida unilateralmente fusionar o eliminar una pantalla existente.

**3. Consistencia:** el patrón de modal "Así funciona" se define una sola vez (sección 5) y se referencia, no se repite, en Inicio/Chat/Calendario.

**4. Alcance:** ningún ítem de este spec requiere un modelo de datos nuevo grande, salvo la tabla de "visto el modal de ayuda" (pequeña, aditiva) — coherente con que esto sea la pasada de bajo riesgo antes de Custodia.
