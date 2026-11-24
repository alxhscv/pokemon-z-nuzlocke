# Pokémon Z · Nuzlocke Tracker

Web para seguir **un Nuzlocke compartido** del fan game **Pokémon Z**
de [LostieFan Games](https://lostiefangames.blogspot.com/p/pokemon-z.html): todo el grupo juega **la
misma partida**, cada uno inicia sesión con su cuenta y registra sus capturas. El apartado central es
una **tabla de rutas × jugadores** que muestra **qué capturó cada uno en cada ruta**, en tiempo real.

> El juego: Pokémon Z es un fan game ambientado en la Kalos de hace siglos. 12 gimnasios + postgame,
> todos los Pokémon de las 9 generaciones obtenibles, y modos Nuzlocke / Random / Monotype.

---

## Cómo funciona

1. **Creas tu cuenta** (usuario + contraseña, sin verificación de email) o inicias sesión.
2. Entras directo a la **partida compartida** (no hay que crear ni unirse: es una sola para todos).
3. **Registras Pokémon** (Pokémon, mote, nivel y notas). El Pokémon entra en la **Caja** por defecto;
   luego lo mueves entre ⚔️ Equipo / 📦 Caja / ⚰️ Cementerio con los botones de su tarjeta (está en un
   único estado). La **zona de captura** no se escribe: se pone sola al registrar desde una celda de
   ruta. Llevas tus **medallas** (0–12). En tu **perfil** eliges nombre, color y un **avatar**.
4. La app está en **5 pestañas**:
   - **🗺️ Rutas** — matriz rutas × jugadores (qué capturó cada uno en cada ruta).
   - **🎒 Seguimiento** — tus Pokémon en Equipo / Caja / Cementerio, con botones para moverlos.
   - **👥 Payos** — todas las cuentas (avatar, medallas visuales, equipo); clic en una abre su perfil.
   - **⚰️ Cementerio** — muro global con **todos** los caídos (de todos): apodo, de quién era, nivel de
     muerte y su «último suspiro» (nota). Los tuyos se editan desde su lápida.
   - **🧑 Perfil** — editas tu nombre, avatar y medallas (iconos 0–12). El **color es fijo (verde
     Zygarde)** para todos. El **avatar** puede ser un Pokémon o una **URL de imagen** (Google, etc.).

   Todo se actualiza solo (Supabase Realtime). **Solo editas lo tuyo**.

La sesión se recuerda en el dispositivo (si caducó, se cierra sola y vuelve al login). En la tabla de
rutas, al pulsar una de **tus** celdas se abre el registro con esa ruta ya puesta.

La interfaz usa **tema claro por defecto** y **tema oscuro** (respeta `prefers-color-scheme`; hay un
botón en la barra superior para alternar, y la preferencia se guarda en el dispositivo). En móvil las
pestañas pasan a una **barra inferior fija** y los modales a **hoja inferior** a pantalla completa.

> **Avatar por URL:** el campo `profiles.avatar` pasó de número a texto (admite id de Pokémon o una URL
> de imagen). En una base de datos ya creada, ejecuta una vez en Supabase → SQL Editor:
> `alter table public.profiles alter column avatar type text using avatar::text;`

---

## Stack

- **Front:** HTML + CSS + JavaScript vanilla (ES modules). Sin framework ni build.
- **Cuentas + datos:** [Supabase](https://supabase.com) (Auth + Postgres + Realtime + RLS), plan gratuito.
- **Hosting:** GitHub Pages (estático).
- **Datos de Pokémon:** `data/pokemon.json` (1025 especies, Gen 1–9, nombres ES/EN) desde
  [PokéAPI](https://github.com/PokeAPI/pokeapi). Sprites por id. Sin dependencia de PokéAPI en runtime.

## Estructura de archivos

```
index.html            # una página (login · app con 4 pestañas: rutas/seguimiento/payos/perfil)
css/styles.css        # estilos (tema claro por defecto + oscuro, tokens CSS, estética Pokémon/Kalos)
js/config.js          # URL + anon key + ROUTES (filas de la tabla de rutas)
js/app.js             # lógica (auth, run única, realtime, pestañas, rutas, payos, perfil, diálogos)
data/pokemon.json     # 1025 Pokémon {id, es, en}
supabase/schema.sql   # tablas + RLS + realtime + run única (se aplica una vez)
scripts/build_pokemon_json.py  # regenera data/pokemon.json desde los CSV de PokéAPI
```

---

## Base de datos — tablas y columnas

Autenticación gestionada por Supabase Auth (`auth.users`). Esquema propio en `public`:

### `profiles` — identidad de cada cuenta
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | = `auth.users.id` (cascade) |
| `display_name` | text | nombre visible |
| `color` | text | color del jugador (hex) |
| `avatar` | int | id nacional del Pokémon-avatar (opcional) |
| `created_at` | timestamptz | |

### `runs` — la partida (única y compartida)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `code` | text **unique** | `MAIN` |
| `name` | text | nombre de la partida |
| `mode` | text | `nuzlocke` · `random` · `monotype` |
| `owner_id` | uuid null | sin dueño; los usuarios no crean/borran runs |
| `created_at` | timestamptz | **Hay una sola fila**, sembrada por el `schema.sql` |

### `players` — pertenencia (qué usuario está en la partida)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `run_id` | uuid **FK→runs** | cascade |
| `user_id` | uuid **FK→profiles** | cascade |
| `badges` | int | medallas (0–12) |
| `created_at` | timestamptz | **unique(`run_id`,`user_id`)** |

### `entries` — Pokémon registrados
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `run_id` | uuid **FK→runs** | cascade |
| `player_id` | uuid **FK→players** | cascade |
| `user_id` | uuid **FK→profiles** | dueño (permisos) |
| `pokemon_id` | int | id nacional (`data/pokemon.json`) |
| `nickname` | text | mote (opcional) |
| `location` | text | **zona de captura** (agrupa la tabla de rutas; se pone desde la celda de ruta, no hay campo) |
| `level` | int | nivel |
| `status` | text | `team` · `box` · `dead` |
| `notes` | text | notas (opcional) |
| `created_at` / `updated_at` | timestamptz | |

**Relaciones:** `profiles 1—N players N—1 runs`; cada `entry` pertenece a la run, a un `player` y a un
`user`. Borrar una cuenta arrastra en cascada sus `players` y `entries` (la run permanece).

### Seguridad (RLS)
Solo usuarios **autenticados**; el rol `anon` no tiene acceso.
- **Lees** perfiles y la run; **lees** `players`/`entries` solo de la run de la que eres miembro
  (función `is_member()`).
- **Escribes** solo lo tuyo: tu perfil, tu fila de `players`, tus `entries`. La run es fija (solo lectura).

---

## Puesta en marcha

1. **Auth:** Supabase → *Authentication → Providers → Email*: activa *Email* y **desactiva "Confirm email"**.
2. **Base de datos:** Supabase → *SQL Editor* → pega [`supabase/schema.sql`](supabase/schema.sql) → **Run**
   (crea tablas, RLS, realtime y la run única).
3. **Credenciales:** en [`js/config.js`](js/config.js) (Project URL + anon key, públicas).
4. **Publicar:** repo → *Settings → Pages → Branch `main` / root*. URL: `https://<usuario>.github.io/<repo>/`.

### Editar las rutas
Las filas de la tabla de rutas están en `js/config.js → ROUTES` (lista ordenada y editable). Si alguien
registra una zona que no esté en la lista, aparece igualmente al final de la tabla.

### Regenerar la lista de Pokémon (opcional)
```bash
curl -s -o scripts/species_names.csv https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv
curl -s -o scripts/species.csv       https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
python scripts/build_pokemon_json.py scripts/species_names.csv scripts/species.csv data/pokemon.json
```

---

## Decisiones y límites (contexto para el futuro)

- **Una sola run compartida:** no hay crear/unirse; al loguearte te añades como miembro de la run única
  (sembrada en `schema.sql`). Para empezar de cero, se vacían `players`/`entries` desde Supabase.
- **Usuario/contraseña sin verificación:** el "usuario" se mapea a un email sintético
  `usuario@users.pokez` y, con la confirmación desactivada, el registro es inmediato. No hay recuperación
  de contraseña (no hay email real): se resetea desde el panel de Supabase.
- **Rutas = borrador editable** (`config.js → ROUTES`): el fan game no publica tablas de encuentros
  fiables. Las zonas nuevas se añaden solas, así que no bloquea.
- **Pokédex:** 9 generaciones completas (National Dex), no filtrada a los Pokémon concretos del juego.
- **Sin histórico/undo:** editar o borrar es inmediato y definitivo.
