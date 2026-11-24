# Pokémon Z · Nuzlocke Tracker

Web para seguir un reto **Nuzlocke** (o Random / Monotype) del fan game **Pokémon Z**
de [LostieFan Games](https://lostiefangames.blogspot.com/p/pokemon-z.html) junto a tus amigos:
cada jugador **inicia sesión con su cuenta**, registra los Pokémon que captura y **todos veis el
progreso de los demás en tiempo real**.

> El juego: Pokémon Z es un fan game ambientado en la Kalos de hace siglos (la gran guerra y el Arma
> Definitiva). 12 gimnasios + postgame, todos los Pokémon de las 9 generaciones obtenibles, y modos
> Nuzlocke / Random / Monotype.

---

## Cómo funciona

1. **Creas tu cuenta** (usuario + contraseña, sin verificación de email) o inicias sesión.
2. **Creas una partida** → obtienes un **código** de 4 letras, o **te unes** con el código de un amigo.
3. **Registras Pokémon**: Pokémon, mote, zona de captura, nivel, estado (⚔️ equipo / 📦 caja /
   ⚰️ muerto) y notas. Llevas tus **medallas** (0–12).
4. El **panel de la partida** muestra el equipo y las estadísticas de cada jugador, y se actualiza solo
   (Supabase Realtime). **Solo puedes editar lo tuyo**; el equipo de los demás es de solo lectura.

La sesión se recuerda en el dispositivo; al volver entras directo a tu última partida.

---

## Stack

- **Front:** HTML + CSS + JavaScript vanilla (ES modules). Sin framework ni build → se sirve tal cual.
- **Cuentas + datos:** [Supabase](https://supabase.com) (Auth + Postgres + Realtime + RLS), plan gratuito.
- **Hosting:** GitHub Pages (estático).
- **Datos de Pokémon:** `data/pokemon.json` (1025 especies, Gen 1–9, nombres ES/EN) generado desde
  los CSV de [PokéAPI](https://github.com/PokeAPI/pokeapi). Sprites desde el repo de sprites de PokéAPI
  por id. Sin dependencia de PokéAPI en tiempo de ejecución.

## Estructura de archivos

```
index.html            # una sola página (secciones: login · crear/unirse · app)
css/styles.css        # estilos (tema oscuro)
js/config.js          # URL + anon key de Supabase y zonas sugeridas
js/app.js             # toda la lógica (auth, Supabase, realtime, render, diálogo)
data/pokemon.json     # 1025 Pokémon {id, es, en}
supabase/schema.sql   # tablas + RLS + realtime (se aplica una vez)
scripts/build_pokemon_json.py  # regenera data/pokemon.json desde los CSV de PokéAPI
```

---

## Base de datos — tablas y columnas

Autenticación gestionada por Supabase Auth (`auth.users`). El esquema propio vive en `public`:

### `profiles` — identidad de cada cuenta
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | = `auth.users.id` (on delete cascade) |
| `display_name` | text | nombre visible (el usuario que eliges) |
| `color` | text | color del jugador (hex) |
| `created_at` | timestamptz | |

### `runs` — partidas
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `code` | text **unique** | código de 4 letras para unirse |
| `name` | text | nombre de la partida |
| `mode` | text | `nuzlocke` · `random` · `monotype` |
| `owner_id` | uuid **FK→auth.users** | creador (único que puede borrar la partida) |
| `created_at` | timestamptz | |

### `players` — pertenencia (qué usuario está en qué partida)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `run_id` | uuid **FK→runs** | cascade |
| `user_id` | uuid **FK→profiles** | cascade |
| `badges` | int | medallas en esa partida (0–12) |
| `created_at` | timestamptz | **unique(`run_id`,`user_id`)** |

### `entries` — Pokémon registrados
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `run_id` | uuid **FK→runs** | cascade |
| `player_id` | uuid **FK→players** | cascade |
| `user_id` | uuid **FK→profiles** | dueño (para permisos) |
| `pokemon_id` | int | id nacional (ver `data/pokemon.json`) |
| `nickname` | text | mote (opcional) |
| `location` | text | zona de captura |
| `level` | int | nivel |
| `status` | text | `team` · `box` · `dead` |
| `notes` | text | notas (opcional) |
| `created_at` / `updated_at` | timestamptz | |

**Relaciones:** `profiles 1—N players N—1 runs`; `entries` pertenece a una `run`, a un `player` y a un
`user`. Borrar una partida o una cuenta arrastra en cascada sus `players` y `entries`.

### Seguridad (RLS)
Solo usuarios **autenticados**; el rol `anon` no tiene acceso.
- **Lees** los perfiles (para ver nombres/colores) y las partidas (para buscar por código).
- **Lees** los `players`/`entries` solo de las partidas de las que **eres miembro**
  (función `is_member()`).
- **Escribes** solo lo tuyo: tu perfil, tu fila de `players`, y tus `entries`. Nadie puede editar el
  equipo de otro.

---

## Puesta en marcha

### 1. Auth (una vez)
En Supabase → **Authentication → Providers → Email**: activa *Email*, y **desactiva "Confirm email"**
(auto-confirmación), para que el registro sea inmediato sin enviar correos.

### 2. Base de datos (una vez)
Supabase → **SQL Editor → New query** → pega [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

### 3. Credenciales
En [`js/config.js`](js/config.js): **Project URL** y **anon/publishable key** (públicas, seguras en el
cliente). Si regeneras la clave, actualiza ese archivo.

### 4. Publicar (GitHub Pages)
Repo → **Settings → Pages → Branch `main` / root**. La web queda en
`https://<usuario>.github.io/<repo>/`. Comparte esa URL con tus amigos.

### Regenerar la lista de Pokémon (opcional)
```bash
curl -s -o scripts/species_names.csv https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv
curl -s -o scripts/species.csv       https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
python scripts/build_pokemon_json.py scripts/species_names.csv scripts/species.csv data/pokemon.json
```

---

## Decisiones y límites (contexto para el futuro)

- **Usuario/contraseña sin verificación:** el "usuario" se mapea internamente a un email sintético
  `usuario@users.pokez`; con la confirmación de email desactivada, el registro es inmediato. No hay
  recuperación de contraseña (no hay email real): si alguien la olvida, se crea otra cuenta o se
  resetea desde el panel de Supabase.
- **Zonas de captura editables**, no una lista fija de rutas: el fan game no publica tablas de
  encuentros fiables (`config.js → LOCATIONS` solo sugiere; escribes la zona real).
- **Pokédex:** 9 generaciones completas (National Dex), no filtrada a los Pokémon concretos de
  Pokémon Z porque esa lista exacta no está confirmada.
- **Sin histórico/undo:** editar o borrar una entrada es inmediato y definitivo.
