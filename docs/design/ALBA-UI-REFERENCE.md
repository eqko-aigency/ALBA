# ALBA — Referencia de UI/UX para desarrollo (Etapa 1: Beta)

> Documento de referencia para Claude Code. Complementa el wireframe visual (`alba-wireframes.html`). Define pantallas, flujos y notas funcionales por bloque. No define estética final — eso se resuelve en una segunda pasada de diseño visual.

## Paleta visual — "Alba"
Inspirada en el cielo del amanecer, no en la marca de EQKO (que se reserva para papelería/documentos de agencia). Uso semántico, no decorativo:

| Nombre | Hex | Rol |
|---|---|---|
| Noche | `#241B32` | Headers, navegación, texto principal |
| Coral | `#E2735A` | Acción principal (CTA primario) |
| Ámbar | `#EFA25F` | Acción secundaria, estados positivos ("al día", "+ agregar") |
| Cielo | `#9FB0C9` | Info secundaria, elementos seleccionados, estados neutros/pendientes |
| Bruma | `#FBF1E6` | Fondo general de la app |
| Tinta | `#2A2438` | Texto de cuerpo (nunca negro puro) |

Tipografía: un solo sans humanista y cálido en toda la interfaz (ej. Plus Jakarta Sans o General Sans) — evitar la combinación serif+crema genérica de IA. Reservar un peso más pesado únicamente para montos importantes (pensión, deuda, totales).

## Contexto técnico
- Stack: Next.js + Supabase + Anthropic API, desplegado en Vercel.
- Distribución Beta: PWA (Capacitor confirmado para empaquetar a iOS/Android sin reescribir código).
- 1 desarrollador + Claude Code, timeline 4-6 semanas.
- WhatsApp Business API **no** está en la Beta (es Etapa 2).
- Evidencia digital: hash + Merkle Tree, anclaje batch vía OpenTimestamps (no por mensaje individual) — aplica a Chat, Calendario y Documentos.
- Datos sensibles (legal/familiar): reforzar RLS (Row Level Security) en Supabase en todas las tablas de este documento.

---

## 1. Onboarding & Emparejamiento
**Flujo:** Splash → Registro/Login → Verificación → Invitar al otro padre/madre → Confirmación de vínculo

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Splash | Logo, CTA login/registro | — |
| Registro | Nombre, email, teléfono, contraseña, aviso de privacidad | Requiere consentimiento explícito de datos sensibles antes de continuar |
| Invitar al otro padre | Input email/teléfono, estado de invitación | **Core flow**: el vínculo requiere aceptación bidireccional — no crear registros de "familia" hasta que ambos confirmen |
| Confirmación de vínculo | Mensaje de éxito, opción de agregar hijos | Punto de entrada al dashboard principal |

---

## 2. Perfiles
**Flujo:** Perfil propio → Perfil de hijos → Configuración de cuenta

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Perfil propio | Foto, nombre, rol (mamá/papá), lista de hijos vinculados | — |
| Perfil de hijo | Nombre, fecha nac., escuela, datos médicos básicos, calendario asociado | Soporta **multi-hijo** — un usuario puede tener varios perfiles de hijos |
| Configuración | Notificaciones, privacidad/datos, gestión de vínculo, idioma, logout | — |

---

## 3. Chat + Calendario
**Flujo:** Lista de chats → Chat (con Tone Meter inline) → Calendario compartido → Detalle de evento/custodia

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Lista de chats | Hilos por tema (general, gastos, vacaciones) | Nav fija: Chat · Calendario · Gastos · Documentos |
| Chat | Burbujas de mensaje, indicador Tone Meter inline | Ver bloque 6 — el análisis de tono corre antes del envío |
| Calendario compartido | Grid mensual, días de custodia diferenciados por color, próximo evento | Fuente de verdad para custodia — debe sincronizar con perfil de hijo |
| Detalle de evento | Responsable, notas, confirmación de asistencia, hash de evidencia | Cada evento generado/editado entra al pool de evidencia (Merkle Tree batch) |

---

## 4. Gastos
**Flujo:** Lista de gastos → Agregar gasto → Detalle/aprobación → Balance resumen

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Lista de gastos | Balance general, gastos con estado (pendiente/aprobado) | — |
| Agregar gasto | Concepto, monto, categoría, comprobante (foto/PDF), % split | — |
| Aprobación | Comprobante, monto, split, aceptar/rechazar | Requiere notificación push al otro padre |
| Balance resumen | Gráfico por categoría, total del mes, pendientes | Debe poder exportarse (PDF/CSV) |

---

## 5. Documentos / Acuerdos
**Flujo:** Lista de documentos → Detalle (estado) → Subir documento

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Lista de documentos | Documentos con estado (firmado/pendiente) | — |
| Detalle documento | Vista previa PDF, estado de firma, hash de anclaje | Firma simple in-app (no es firma electrónica avanzada en la Beta) |
| Subir documento | Selector de archivo, nombre, tipo (acuerdo/constancia/otro) | Entra a revisión del otro padre antes de marcarse "firmado" |

---

## 6. Tone Meter + IA de reformulación
**Flujo:** Semáforo de tono inline en chat → Modal de sugerencia de reformulación → Historial de alertas

| Pantalla | Elementos clave | Notas funcionales |
|---|---|---|
| Alerta inline | Borde/color de alerta en el input mientras se escribe | Corre como análisis previo al envío (IA separada de la lógica determinística, ver arquitectura) |
| Modal de reformulación | Mensaje original vs. sugerido por IA | Usuario elige explícitamente cuál enviar — nunca se reemplaza sin confirmación |
| Historial de alertas | Registro cronológico de tono + acción tomada | Debe poder generarse como reporte exportable (relevante para el módulo legal en Etapa 2) |

---

## Consideraciones cross-bloque
- **RLS por familia**: cada tabla (mensajes, eventos, gastos, documentos) debe filtrar por el `family_id` compartido entre los dos padres vinculados, nunca por usuario individual.
- **Evidencia digital**: chat, calendario y documentos alimentan el mismo pipeline de hash/Merkle Tree — diseñar el schema pensando en esto desde el inicio, no como capa separada después.
- **Fuera de alcance en Beta**: WhatsApp Business API, firma electrónica avanzada, módulo legal completo (Etapa 2).
