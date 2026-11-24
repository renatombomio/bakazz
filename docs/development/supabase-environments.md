# Supabase environments

BAKAZZ mantiene proyectos Supabase independientes. Preview/Development se usa para desarrollo y pruebas; Production se reserva para el servicio real.

| Environment | Project ref | Purpose |
|---|---|---|
| Production | `zgjetpoamiewygqlhheo` | Entorno productivo. Nunca usar para pruebas ni tareas de desarrollo. |
| Development / Preview | `pakkdnfifrshqyqedpni` | Desarrollo, registros de prueba, perfiles, colecciones y comunidad. |

## Reglas obligatorias

- Las pruebas y el trabajo de desarrollo deben usar exclusivamente el proyecto Development.
- Vercel Preview debe apuntar al proyecto Development.
- Vercel Production debe conservar su configuración productiva; no modificarla durante tareas de desarrollo.
- No usar variables compartidas entre Preview y Production si eso puede mezclar proyectos.
- No ejecutar SQL destructivo, resetear proyectos ni borrar usuarios/datos.
- La colección personal del propietario (“Colección de Ren”) no se modifica.
- No leer, mostrar ni editar `.env.local` salvo autorización explícita.
- Nunca guardar valores secretos reales en el repositorio.

## Variables utilizadas por la aplicación

El cliente SSR utiliza:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (o fallback compatible `PUBLIC_SUPABASE_ANON_KEY`)

Funciones confiables de servidor pueden requerir:
- `SUPABASE_SECRET_KEY` — solo servidor; nunca exponer en navegador ni en variables `PUBLIC_`.

El caché privado de búsqueda de anime puede utilizar:
- `ANIME_SEARCH_CACHE_TOKEN` — solo servidor; no enviar al navegador.

Configura las variables únicamente en el scope de entorno autorizado. Para Preview, la URL debe ser `https://pakkdnfifrshqyqedpni.supabase.co` y la publishable key debe obtenerse desde el panel del proyecto Development. No documentes aquí el valor de ninguna clave.

## Base de datos

Antes de cambiar el esquema:
1. Inspecciona el esquema real del proyecto Development.
2. Lee las migraciones existentes en `supabase/migrations`.
3. Revisa el SQL y el impacto de cada migración.
4. Confirma que no elimina ni altera datos existentes protegidos.
5. No apliques cambios a Production.

No asumas que una migración está aplicada por el mero hecho de existir en el repositorio.

## Caché de búsqueda de anime

La implementación documentada utiliza funciones/tablas privadas y validación del token en servidor. Los tiempos de expiración definidos en código/documentación deben comprobarse antes de modificarse; no se deben recrear tablas ni borrar caché manualmente como primera medida.

Para las reglas completas de trabajo, consulta [AI_HANDOFF_AND_WORKFLOW.md](./AI_HANDOFF_AND_WORKFLOW.md).
