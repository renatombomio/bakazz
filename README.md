# BAKAZZ — Anime Community

BAKAZZ es una comunidad de anime para descubrir series y películas, compartir gustos, participar en debates y conectar con otros fans.

- Sitio oficial: https://www.bakazz.com
- Repositorio: https://github.com/renatombomio/bakazz
- Rama de trabajo autorizada: `feature/renanime-2.0-workspace`

> **Estado operativo (24-11-2026):** Preview está disponible para desarrollo y pruebas. Producción permanece intencionadamente en mantenimiento mientras se completa la validación y se obtiene aprobación explícita para el cambio. No desactives el mantenimiento ni despliegues a producción sin autorización.

## Antes de trabajar en el proyecto

Lee primero [AGENTS.md](./AGENTS.md) y, obligatoriamente, [AI_HANDOFF_AND_WORKFLOW.md](./docs/development/AI_HANDOFF_AND_WORKFLOW.md). Ese documento contiene las reglas de trabajo, arquitectura de rutas/autenticación, entornos, historial de incidencias, commits relevantes, pruebas y procedimiento para investigar errores. Las nuevas conversaciones deben consultar el repositorio antes de pedir al propietario que repita contexto.

## Funcionalidades del producto

- Descubrimiento de anime: recomendaciones, tendencias, temporada, próximos estrenos y títulos mejor valorados.
- Colección personal y lista de anime pendiente.
- Favoritos, géneros, fichas de anime y franquicias.
- Comunidad, perfiles públicos y debates.
- Interfaz en español e inglés.
- Diseño mobile-first.

Consulta `docs/product/` y `docs/MASTER_ROADMAP_RENANIME_WORLD_2.md` para las decisiones de producto existentes. El roadmap conserva contexto histórico de la etapa Renanime; la marca actual es BAKAZZ.

## Stack tecnológico

- Astro 7 con SSR y adaptador de Vercel.
- React 19, TypeScript y Tailwind CSS v4.
- Supabase Auth, PostgreSQL y `@supabase/ssr`.
- AniList y Jikan como fuentes de datos de anime.
- pnpm y Vitest.

Requisito de Node.js: `>=22.12.0`. Consulta `package.json` para los scripts disponibles.

## Desarrollo local

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Astro suele servir el proyecto en `http://localhost:4321`.

Variables de entorno:
- Usa únicamente el entorno autorizado para la tarea.
- Preview debe apuntar a Supabase Development.
- No compartas, imprimas ni subas secretos.
- No leas ni modifiques `.env.local` salvo autorización explícita.
- Consulta [supabase-environments.md](./docs/development/supabase-environments.md).

## Comandos

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Servidor local |
| `pnpm build` | Compilación SSR |
| `pnpm preview` | Previsualización de build |
| `pnpm test` | Pruebas Vitest |

Antes de cerrar una tarea que cambie código, ejecuta cuando sea posible:

```bash
pnpm test
pnpm build
```

Indica siempre qué comandos se ejecutaron realmente. No declares una compilación o prueba como correcta sin evidencia.

## Seguridad y entornos

- Supabase Development: proyecto `pakkdnfifrshqyqedpni`.
- Supabase Production: entorno exclusivamente productivo; prohibido usarlo para pruebas.
- No ejecutar operaciones destructivas ni alterar datos existentes sin autorización.
- La colección personal del propietario es intocable.
- No modificar claves, OAuth, variables de Vercel, DNS ni configuración de producción sin autorización.
- Producción permanece en mantenimiento mediante `MAINTENANCE_MODE = true` en `src/middleware.ts`.

Detalles y reglas completas: [AI_HANDOFF_AND_WORKFLOW.md](./docs/development/AI_HANDOFF_AND_WORKFLOW.md) y documentación de `docs/security/`.

## Enlaces técnicos

- [Astro](https://docs.astro.build/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side)
- [Vercel](https://vercel.com/docs)
