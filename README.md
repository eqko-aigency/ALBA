# ALBA — monorepo

App de coparentalidad. Estructura basada en la auditoría de framework de Etapa 2
(React Native), pensada para que la lógica de negocio nazca compartible entre
`apps/web` (Next.js, Beta/Etapa 1) y `apps/mobile` (React Native, Etapa 2).

```
alba/
├── apps/
│   ├── web/         # Next.js — Beta y plataforma comercial
│   └── mobile/       # React Native — se agrega en Etapa 2
└── packages/
    ├── core/         # TypeScript puro: entidades, validación, motor de cumplimiento
    └── api-client/   # Cliente Supabase tipado, compartido web + mobile
```

## Por qué existe `packages/core`

Ahí vive el **motor determinístico de incumplimientos** y las validaciones del
convenio y de gastos — la pieza legal-crítica del proyecto. Es TypeScript sin
ninguna dependencia de React ni de React Native, para que tanto la web como la
futura app móvil lo consuman literalmente, sin reescribirlo. Nunca usa IA: la
IA solo interviene, en otro flujo, para ayudar a estructurar el convenio con
confirmación humana de ambos progenitores.

## Reglas de arquitectura no negociables

- **WhatsApp Business API / BSP** — solo se llama desde el servidor (API
  routes / Edge Functions de `apps/web`). Ningún cliente habla directo con
  Meta o el BSP.
- **Hash evidenciario (SHA-256 + Merkle Tree)** — se calcula en el servidor,
  con timestamp del servidor, en el momento del evento. El cliente solo
  muestra el estado de verificación (pendiente / anclado).
- **Anthropic API** — nunca se llama desde un cliente (web o móvil); la API
  key no puede vivir en un binario.

## Setup

```bash
npm install
npm run dev --workspace=apps/web
```

Variables de entorno de Supabase van en `apps/web/.env.local` (ver
`apps/web/.env.local.example` una vez creado el proyecto en Supabase).
