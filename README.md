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
   ruta. Llevas tus **medallas** (12, marcadas una a una). En tu **perfil** eliges nombre y un **avatar**.
4. La app está en **5 pestañas**:
   - **🗺️ Rutas** — matriz rutas × jugadores (qué capturó cada uno en cada ruta).
   - **🎒 Seguimiento** — tus Pokémon en Equipo / Caja / Cementerio, con botones para moverlos.
   - **👥 Payos** — todas las cuentas (avatar, medallas visuales, equipo); clic en una abre su perfil.
   - **⚰️ Cementerio** — muro global con **todos** los caídos (de todos): apodo, de quién era, nivel de
     muerte y su «último suspiro» (nota). Los tuyos se editan desde su lápida.
   - **🧑 Perfil** — editas tu nombre y avatar (a la izquierda) y tus **medallas** (a la derecha: fichas con la imagen oficial; se activa cada una por separado, sin arrastrar las anteriores). El **color es fijo (rojo)** para todos. El **avatar** puede ser un Pokémon o una **URL de imagen** (Google, etc.).

   Todo se actualiza solo (Supabase Realtime). **Solo editas lo tuyo**.

La sesión se recuerda en el dispositivo (si caducó, se cierra sola y vuelve al login). En la tabla de
rutas, al pulsar una de **tus** celdas se abre el registro con esa ruta ya puesta. Lo registrado con el
botón «Registrar Pokémon» (sin ruta) aparece en una fila final **«Sin zona»**.

**Estilo:** menú de consola. Paneles planos con borde marino de 2px y esquinas poco redondeadas, sombra dura solo en botones, fichas de payo y modales, acento rojo Pokéball, pestañas de carpeta, y el Cementerio como un muro de **lápidas**. Tipografía Archivo (ancho expandido en títulos) y Silkscreen solo para niveles y nº de Pokédex.

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
index.html            # una página (login · app con 5 pestañas: rutas/seguimiento/payos/cementerio/perfil)
css/styles.css        # estilos (tema claro por defecto + oscuro, tokens CSS, estética Pokémon/Kalos)
js/config.js          # URL + anon key + ROUTES (filas de la tabla) + MEDALS (nombre + imagen de cada medalla)
js/app.js             # lógica (auth, run única, realtime, pestañas, rutas, payos, perfil, diálogos)
data/pokemon.json     # 1025 Pokémon {id, es, en}
supabase/schema.sql   # tablas + RLS + realtime + run única (se aplica una vez; BORRA y recrea las tablas)
supabase/admin.sql    # permisos de la cuenta admin + función para borrar usuarios (seguro de re-ejecutar)
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
| `color` | text | en desuso: todos usan el rojo de la marca |
| `avatar` | text | id del Pokémon-avatar **o** URL de imagen (opcional) |
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
| `badges` | int | **máscara de bits** de medallas (bit *i*-1 = medalla *i*; 0–4095). Antes era un contador: valores antiguos se verán como otras medallas, se corrigen marcándolas de nuevo |
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

### Cuenta admin
Usuario `admin` (email `admin@users.pokez`). **No aparece en ninguna lista** (no tiene fila en `players` ni
perfil) y tiene su propia vista: solo las pestañas Rutas, Payos y Cementerio. Puede:
- editar/mover/borrar **cualquier** Pokémon (desde la tabla de rutas, el cementerio o la ficha de un payo)
  y registrar Pokémon en la celda de cualquier jugador;
- en la ficha de un payo: marcar sus **medallas**, **renombrarlo** y **eliminar su cuenta** (con todos sus Pokémon).

Los permisos reales están en la base de datos: ejecuta **una vez** [`supabase/admin.sql`](supabase/admin.sql)
en Supabase → SQL Editor (después de crear la cuenta `admin`). Sin ese SQL, el admin entra pero no puede
editar lo de otros. La contraseña **no** está en el repo: se cambia desde Supabase → Authentication → Users.
Quien registre la cuenta `admin` primero es el admin, por eso hay que crearla antes de abrir la web al grupo.

### Editar las rutas
Las filas de la tabla de rutas están en `js/config.js → ROUTES` (lista ordenada y editable). Si alguien
registra una zona que no esté en la lista, aparece igualmente al final de la tabla.

### Editar las medallas
`js/config.js → MEDALS`: nombre e `img` (nº de [PokeAPI/sprites/badges](https://github.com/PokeAPI/sprites/tree/master/sprites/badges)).
Las 8 primeras son las reales de Kalos (43–50); las 4 últimas son imágenes oficiales de relleno hasta poner las de los gimnasios de Z.

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

---

## Registro de arreglos

- **Rediseño visual** (menos plantilla, más menú de juego): ver «Estilo». Nombre de ruta alineado a la izquierda y sin numeración de adorno; «Cayó a Nv.» ya no usa la fuente pixel (no tiene acentos).
- **Cuenta admin** (oculta, edita todo y borra usuarios): ver «Cuenta admin».
- El modal de un payo ahora se actualiza en vivo si cambian sus datos.
- **Medallas rediseñadas:** imágenes oficiales, editor en tarjeta a la derecha del perfil y selección independiente (máscara de bits en `players.badges`, sin cambios de esquema).
- **Botón «Cerrar» suelto** en todas las pestañas: el modal de payo (`#payoDialog`) tenía
  `display:flex` fijo, que anula el `display:none` de un `<dialog>` cerrado. Ahora solo aplica con `[open]`.
- **Avatar por URL sin escapar** al pintarlo en `src="…"` (podía inyectar HTML a los demás): ahora se escapa.
- El **color** de cada cuenta ya no depende de lo guardado en BD (siempre el rojo de la marca).
- Pokémon registrados **sin ruta** ya no desaparecen de la tabla (fila «Sin zona»).
- Modal de payo en móvil: ocupa todo el ancho como el resto de hojas inferiores.
- Aviso (toast) en móvil ya no queda tapado por la barra de pestañas.
- `Enter` en el campo usuario envía el login; el chip de usuario de Seguimiento lleva al Perfil.
- Cuadrícula de la Caja (nunca se veía) simplificada a fondo liso.
