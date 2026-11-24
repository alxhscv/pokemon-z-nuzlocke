# Pokémon Z · Nuzlocke Tracker

Web para seguir un reto **Nuzlocke** (o Random / Monotype) del fan game **Pokémon Z**
de [LostieFan Games](https://lostiefangames.blogspot.com/p/pokemon-z.html) junto a tus amigos:
cada jugador registra los Pokémon que captura y **todos veis el progreso de los demás en tiempo real**.

> El juego: Pokémon Z es un fan game ambientado en la Kalos de hace siglos (la gran guerra y el Arma
> Definitiva). 12 gimnasios + postgame, todos los Pokémon de las 9 generaciones obtenibles, y modos
> Nuzlocke / Random / Monotype.

---

## Cómo funciona

1. Un jugador **crea una partida** → obtiene un **código** de 4 letras.
2. Los amigos **se unen** con ese código y crean su **entrenador** (nombre + color).
3. Cada uno **registra Pokémon**: Pokémon, mote, zona de captura, nivel, estado
   (⚔️ equipo / 📦 caja / ⚰️ muerto) y notas. También lleva sus **medallas** (0–12).
4. El **panel de la partida** muestra el equipo y las estadísticas de cada jugador,
   y se actualiza solo cuando alguien cambia algo (Supabase Realtime).

No hay login: se entra por código de partida. El dispositivo recuerda tu última partida y entrenador
(`localStorage`), así que al volver entras directo.

---

## Stack

- **Front:** HTML + CSS + JavaScript vanilla (ES modules). Sin framework ni build → se sirve tal cual.
- **Datos compartidos:** [Supabase](https://supabase.com) (Postgres + Realtime), plan gratuito.
- **Hosting:** GitHub Pages (estático).
- **Datos de Pokémon:** `data/pokemon.json` (1025 especies, Gen 1–9, nombres ES/EN) generado desde
  los CSV de [PokéAPI](https://github.com/PokeAPI/pokeapi). Sprites servidos desde el repo de sprites
  de PokéAPI por id. No hay dependencia de PokéAPI en tiempo de ejecución.

## Estructura

```
index.html            # una sola página (secciones: crear/unirse · elegir jugador · app)
css/styles.css        # estilos (tema oscuro)
js/config.js          # URL + anon key de Supabase, y lista de zonas sugeridas
js/app.js             # toda la lógica (Supabase, realtime, render, diálogo)
data/pokemon.json     # 1025 Pokémon {id, es, en}
supabase/schema.sql   # tablas + RLS + realtime (pegar una vez en Supabase)
scripts/build_pokemon_json.py  # regenera data/pokemon.json desde los CSV de PokéAPI
```

---

## Puesta en marcha

### 1. Base de datos (una sola vez)
En el panel de Supabase → **SQL Editor → New query**, pega el contenido de
[`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Crea las tablas `runs`, `players`,
`entries`, sus políticas y activa el realtime.

### 2. Credenciales
Están en [`js/config.js`](js/config.js):
- **Project URL:** `https://lrzpgufrsvwlkizrlmrt.supabase.co`
- **anon / publishable key** (pública, segura en el cliente).

Si regeneras la clave en Supabase, actualiza `js/config.js`.

### 3. Publicar (GitHub Pages)
Repo → **Settings → Pages → Branch: `main` / root → Save**. En ~1 min estará en
`https://<usuario>.github.io/<repo>/`. Comparte esa URL con tus amigos.

### Regenerar la lista de Pokémon (opcional)
```bash
curl -s -o scripts/species_names.csv https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv
curl -s -o scripts/species.csv       https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
python scripts/build_pokemon_json.py scripts/species_names.csv scripts/species.csv data/pokemon.json
```

---

## Decisiones y límites (contexto para el futuro)

- **Zonas de captura editables**, no una lista fija de rutas: el fan game no publica tablas de
  encuentros fiables, así que `config.js → LOCATIONS` solo sugiere sitios y cada uno escribe la zona
  real. Si algún día hay datos de rutas/encuentros, se pueden fijar aquí.
- **Seguridad deliberadamente abierta:** la app no tiene login. Las políticas RLS permiten a cualquiera
  con la URL + anon key leer/escribir (`using(true)`). Es un tracker entre amigos, no datos sensibles.
  Quien tenga el código de la partida puede editarla. Si quisieras cerrarlo, habría que añadir Supabase
  Auth y políticas por usuario.
- **Pokédex:** se incluyen las 9 generaciones completas (National Dex). No está filtrada a los Pokémon
  concretos de Pokémon Z porque esa lista exacta no está confirmada; registras el que captures.
- **Sin histórico/undo:** editar o borrar una entrada es inmediato y definitivo.
