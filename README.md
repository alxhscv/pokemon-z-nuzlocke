# PayoLocke Z · Nuzlocke Tracker de Pokémon Z

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
4. La app está en **9 pestañas**:
   - **🗺️ Rutas** — matriz rutas × jugadores agrupada por zonas (plegables), con estado por casilla (**pendiente / sin encuentro / fallido / capturado**, clic en tu casilla para cambiarlo), progreso por jugador y del grupo, marca de tu siguiente ruta y filtros (pendientes, fallidas, solo mías).
   - **🎒 Seguimiento** — tus Pokémon en Equipo / Caja / Cementerio, con botones para moverlos.
   - **👥 Payos** — todas las cuentas (avatar, medallas visuales, equipo); clic en una abre su perfil.
   - **📋 Misiones** — las crea el admin; cada jugador marca las suyas y solo entonces se revela la recompensa (guardada en otra tabla con RLS: el servidor no la entrega antes).
   - **🟢 Conectados** — **fichaje manual** (botón Fichar entrada/salida, también en la barra superior): solo cuentas horas y sales online si has fichado. Arriba **tu fichaje** (en otro color, con «entrada a las HH:MM» y cronómetro en vivo; el botón pasa a «Fichar salida»); debajo los **conectados ahora** con su tiempo y las **últimas conexiones** de los demás (hace cuánto y cuánto duró). En Payos cada cuenta lleva un punto verde/gris.
   - **⚰️ Cementerio** — muro global con **todos** los caídos (de todos): apodo, de quién era, nivel de
     muerte y su «último suspiro» (nota). Los tuyos se editan desde su lápida.
   - **🏆 Ranking** — todos los usuarios con victorias, derrotas y % de victorias, y el registro de las **últimas batallas** (entre nosotros). **Solo el admin** registra o borra batallas: el ganador recibe +50 monedas y el perdedor +20.
   - **🎰 Casino** (antes Gacha) — tres vistas con **monedas ficticias locales** (1000 iniciales, en `localStorage`, botón Reiniciar y Recarga gratis con saldo 0; no tocan Supabase): **Gacha** (5 rarezas Común 60 % · Raro 25 % · Épico 10 % · Legendario 4 % · Mítico 1 %, x1 100 / x10 900 con Raro+ garantizado, pity de 50, colección con filtro y animaciones por rareza con sonido sintetizado y «Saltar»), **Blackjack** (6 barajas, 3:2, plantar en 17, doblar, dividir hasta 3 manos, seguro; atajos H/S/D/P) y **Gacha clásico** (el de antes: 100 monedas reales de Supabase, ranking de tiradas y tiradas gratis de prueba).
   - **🧑 Perfil** — eliges tu **banner** (46 temas: tipos, Kalos, Mega, Zygarde, shiny…; el admin puede cambiar el de cualquiera), escribes tu propia **frase** (máx. 40; se ve sobre tu banner en Payos), editas tu nombre y avatar y tus **medallas** (fichas con la imagen oficial; se activa cada una por separado, sin arrastrar las anteriores), todo en una **sola columna centrada**. El **color es fijo (rojo)** para todos. El **avatar** puede ser un Pokémon o una **URL de imagen** (Google, etc.).

   Todo se actualiza solo (Supabase Realtime). **Solo editas lo tuyo**.

La sesión se recuerda en el dispositivo (si caducó, se cierra sola y vuelve al login). En la tabla de
rutas, al pulsar una de **tus** celdas se abre el registro con esa ruta ya puesta. Lo registrado con el
botón «Registrar Pokémon» (sin ruta) aparece en una fila final **«Sin zona»**.

**Pantalla de carga (intro):** al abrir la web, en silencio, se ve un **telón** cerrado con un botón rojo señalado por flechas y dedos. Al pulsarlo (ese clic es lo que permite que suene el audio) el telón se abre y aparece `Inicio/splash.jpeg` botando a 90 bpm con `Inicio/splash.wav`, con rayos, anillos, destellos y estrellas. Dura 10 s o se salta con la tecla **K**; al acabar, la música baja con fundido y la intro se desvanece sobre la web. El **admin** la activa o desactiva para todos desde el menú de usuario (**Intro: Activada/Desactivada**); el ajuste vive en la tabla `app_settings` (`supabase/intro.sql`) y cada navegador lo recuerda en `localStorage`. El código está inline en `index.html`.

**Estilo:** «Pokédex + PC de Bill + menú de juego» (detalle en la sección [Estilo](#estilo)).

La interfaz usa **tema oscuro por defecto** (y tema claro con el botón, que recuerda tu elección; hay un
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
  [PokéAPI](https://github.com/PokeAPI/pokeapi). Los nombres van en el JSON; los sprites, medallas e iconos de objeto se cargan en vivo desde `raw.githubusercontent.com` (PokeAPI/sprites) y `supabase-js` desde jsDelivr (sin SRI).

## Estructura de archivos

```
Inicio/               # splash.jpeg + splash.wav de la intro
index.html            # una página (incluye la intro/telón inline) (login · app con 9 pestañas: rutas/seguimiento/payos/conectados/misiones/cementerio/ranking/gacha/perfil)
css/styles.css        # estilos (tokens CSS, tema oscuro por defecto + claro, estética Pokédex)
css/casino*.css       # estilos del Casino (armazón, gacha, blackjack)
css/themes.css        # 5 skins además del Clásico (`html[data-skin]`: colores y carcasa; Kanto también radios y tipografía)
js/config.js          # URL + anon key + ROUTE_ZONES/ROUTES (zonas y filas de Rutas) + MEDALS + BANNERS (temas de banner)
js/app.js             # arranque: carga datos y conecta eventos
js/core.js            # estado compartido (S), cliente Supabase, helpers (esc, toast, avatares, banners, medallas)
js/shell.js           # pestañas, tema claro/oscuro, menú, skeletons
js/auth.js            # login/registro, entrada a la run
js/data.js            # reload(), realtime (recarga única con antirrebote de 300 ms) y render()
js/casino.js · casino-wallet.js · casino-audio.js · casino-gacha.js · casino-bj.js · casino-bj-rules.js   # Casino: armazón, saldo local, sonido, gacha, blackjack y sus reglas puras (`selfTest()`)
js/rutas.js · mons.js · payos.js · perfil.js · misiones.js · presence.js · dialog.js · ranking.js · gacha.js   # una pestaña/diálogo cada uno
data/pokemon.json     # 1025 Pokémon {id, es, en}
.claude/agents/       # subagentes: pz-interfaz, pz-logica, pz-contenido (escriben) y pz-revisor (solo lectura, informe corto)
supabase/schema.sql   # tablas + RLS + realtime + run única (seguro de re-ejecutar: no borra datos; incluye checks e índices)
supabase/gacha_ranking.sql # frase de perfil, monedas, gacha y batallas (tablas + RPC; seguro de re-ejecutar)
supabase/intro.sql    # tabla app_settings: interruptor de la intro (lectura pública, escribe el admin)
supabase/banners.sql  # columna profiles.banner (temas de banner de perfil; seguro de re-ejecutar)
supabase/routes.sql   # estados de ruta (sin encuentro / fallido) por jugador (seguro de re-ejecutar)
supabase/missions.sql # misiones: 3 tablas + RLS (la recompensa solo es legible al completar; seguro de re-ejecutar)
supabase/presence.sql # fichaje: tabla `sessions` + funciones clock_ping/clock_out/presence_summary (seguro de re-ejecutar)
supabase/admin.sql    # permisos de la cuenta admin + función para borrar usuarios (seguro de re-ejecutar)
scripts/test-ranking.mjs · test-bj-rules.mjs  # tests sin dependencias: `node scripts/<archivo>.mjs` (imprimen `ok`)
scripts/build_pokemon_json.py  # regenera data/pokemon.json (nombres + tipos `t`) desde los CSV de PokéAPI
```

---

## Estilo

Dirección: **Pokédex + PC de Bill + menú de juego**. Todo sale de tokens en `:root` de `css/styles.css`.

- **Colores:** carcasa roja (`--shell`), lente azul (`--lens`), LED (`--led-r/y/g`), crema (`--case`) y los **18 tipos oficiales** como `--t-fuego`, `--t-agua`… (chips de tipo y bordes). Las rarezas del gacha son `--rar-*`. Un solo acento por pantalla.
- **Formas:** bordes de 2–3 px (`--bw`), esquinas de 2/4/6 px y **sombras duras sin blur**; nada de glassmorphism.
- **Tipografía:** Silkscreen en títulos (`h1`, `h2`, marca), Pixelify Sans en números (Nº, Nv., posiciones) y Nunito en el cuerpo y los textos pequeños (las fuentes pixel confundían la «C» con la «O» a tamaño pequeño).
- **Cabecera:** carcasa de Pokédex con lente y tres LED; el LED amarillo (`#liveDot`) parpadea con cada evento en vivo. Pestañas de menú de juego con cursor ▶ en la activa; en móvil, barra inferior roja.
- **Cuadros de texto de juego** (`.dlgbox`): login, toasts y estados vacíos, con borde doble, efecto máquina de escribir corto y ▼ parpadeante. Se desactivan con `prefers-reduced-motion`. Las confirmaciones siguen siendo el `confirm()` del navegador (no se puede estilar) pero con texto de juego.
- **Pokémon:** ficha de entrada de Pokédex (sprite en recuadro, Nº, chips de tipo desde `data/pokemon.json → t`, barra de PS decorativa que refleja el nivel), Caja como cuadrícula de PC y Equipo con 6 huecos de Pokéball.
- **Rutas:** zonas como carteles, casillas con Pokéball (vacía / tachada / rota / llena) y progreso con barras de PS. **Medallas:** estuche de 12 huecos grabados con destello. **Payos:** carnet de Entrenador. **Ranking:** podio y tabla tipo Torre de combate.
- **Iconos:** sprites de objeto de PokéAPI para objetos y secciones, y SVG propios para controles (cerrar, más, tema). No hay emojis en la interfaz salvo el telón de la intro.
- **Textos:** frases cortas con tono de juego («¡Has capturado a X!», «¿Seguro que quieres…?»).

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

**Perfil**: `profiles.banner` (id del tema, `null` = clásico; la lista de temas vive en `config.js → BANNERS`).

**Rutas**: `route_status(user_id, route, status none|failed)`; «capturado» se deduce de `entries` y «pendiente» es no tener nada.

**Misiones**: `missions`, `mission_rewards` (recompensa, solo legible al completar o siendo admin) y `mission_completions` (una fila por jugador y misión).

**Fichaje** (`supabase/presence.sql`): tabla `sessions(user_id, started_at, last_seen, ended_at)`, una sesión abierta por usuario. Solo se escribe con `clock_in()` (fichar entrada), `clock_ping()` (latido cada 30 s mientras estás fichado) y `clock_out()` (salida); `presence_summary()` devuelve horas totales, si está conectado y desde cuándo. Lectura para autenticados, sin escritura directa.

### Seguridad (RLS)
Solo usuarios **autenticados**; el rol `anon` no tiene acceso.
- **Lees** perfiles y la run; **lees** `players`/`entries` solo de la run de la que eres miembro
  (función `is_member()`).
- **Escribes** solo lo tuyo: tu perfil (incluido el banner), tu fila de `players`, tus `entries`, tus casillas de `route_status` y tus `mission_completions`. La run es fija (solo lectura).
- **Misiones:** solo el admin las crea; la recompensa (`mission_rewards`) solo se lee al completar la misión.
- **Fichaje:** `sessions` es de solo lectura para usuarios; se escribe únicamente con las funciones `clock_*`.

---

## Puesta en marcha

1. **Auth:** Supabase → *Authentication → Providers → Email*: activa *Email* y **desactiva "Confirm email"**.
2. **Base de datos:** Supabase → *SQL Editor* → pega cada archivo y **Run**, en este orden (todos son seguros de re-ejecutar):
   1. [`supabase/schema.sql`](supabase/schema.sql) — tablas, RLS, realtime y la run única.
   2. [`supabase/admin.sql`](supabase/admin.sql) — permisos del admin (tras crear la cuenta `admin`).
   3. [`supabase/routes.sql`](supabase/routes.sql) — estados de ruta.
   4. [`supabase/banners.sql`](supabase/banners.sql) — banners de perfil.
   5. [`supabase/gacha_ranking.sql`](supabase/gacha_ranking.sql) — frase, monedas, Ranking y Gacha clásico.
   6. [`supabase/presence.sql`](supabase/presence.sql) — fichaje.
   7. [`supabase/missions.sql`](supabase/missions.sql) — misiones.
   8. [`supabase/intro.sql`](supabase/intro.sql) — interruptor de la intro (tabla `app_settings`).

   La web **asume que todos están aplicados**: ya no avisa si falta alguno (fallaría con el error de Supabase).
3. **Credenciales:** en [`js/config.js`](js/config.js) (Project URL + anon key, públicas).
4. **Publicar:** repo → *Settings → Pages → Branch `main` / root*. URL: `https://<usuario>.github.io/<repo>/`.

### Cuenta admin
Usuario `admin` (email `admin@users.pokez`). **No aparece en ninguna lista** (no tiene fila en `players` ni
perfil) y tiene su propia vista: sin Seguimiento ni Perfil, y sin fichar. Puede:
- editar/mover/borrar **cualquier** Pokémon (desde la tabla de rutas, el cementerio o la ficha de un payo)
  y registrar Pokémon en la celda de cualquier jugador;
- en la ficha de un payo: marcar sus **medallas**, **renombrarlo**, cambiarle el **banner** y **eliminar su cuenta** (con todos sus Pokémon);
- crear, editar y borrar **misiones** (ve siempre las recompensas) y marcar casillas de Rutas por cualquiera.

Los permisos reales están en la base de datos: ejecuta **una vez** [`supabase/admin.sql`](supabase/admin.sql)
en Supabase → SQL Editor (después de crear la cuenta `admin`). Sin ese SQL, el admin entra pero no puede
editar lo de otros. La contraseña **no** está en el repo: se cambia desde Supabase → Authentication → Users.
Quien registre la cuenta `admin` primero es el admin, por eso hay que crearla antes de abrir la web al grupo.

### Editar las rutas
Las zonas y rutas están en `js/config.js → ROUTE_ZONES` (lista ordenada y editable; `ROUTES` se deriva de ella). Si alguien
registra una zona que no esté en la lista, aparece igualmente al final de la tabla.

### Editar los banners
`js/config.js → BANNERS`: id, nombre, título, dos colores del degradado y el Pokémon (`pk`, con `shiny`) u objeto (`item`) de decoración. El primero es el de por defecto.

### Editar las medallas
`js/config.js → MEDALS`: nombre e `img` (nº de [PokeAPI/sprites/badges](https://github.com/PokeAPI/sprites/tree/master/sprites/badges)).
Las 8 primeras son las reales de Kalos (43–50); las 4 últimas son imágenes oficiales de relleno hasta poner las de los gimnasios de Z.

### Regenerar la lista de Pokémon (opcional)
```bash
curl -s -o scripts/species_names.csv https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv
curl -s -o scripts/species.csv       https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv
curl -s -o scripts/pokemon_types.csv   https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_types.csv
python scripts/build_pokemon_json.py scripts/species_names.csv scripts/species.csv data/pokemon.json scripts/pokemon_types.csv
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
- **Fichaje manual:** `clock_in` abre sesión y hay latido cada 30 s solo mientras estás fichado. 90 s sin latido = desconectado, así que la precisión es de ±30 s y cerrar la pestaña tarda hasta 90 s en notarse (cerrar sesión ficha la salida al instante). Las horas no cuentan con la pestaña cerrada. El admin no ficha. El tiempo en vivo usa el reloj del navegador.
- **Sin histórico/undo:** editar o borrar es inmediato y definitivo.

---

## Registro de arreglos

- **Temas de la web:** en «Tu perfil» hay un selector con 6 diseños: **Clásico Pokéball** (por defecto, alterna claro/oscuro con el botón), **Kanto retro** (verde Game Boy), **Johto dorado**, **Hoenn océano**, **Alola atardecer** y **Galar competitivo**. Se guarda en este navegador (`localStorage`); cada skin fija su modo. La lista vive en `js/config.js → SKINS` y los colores en `css/themes.css`. Se quitaron Sinnoh, Teselia, Kalos, Paldea, Neón, Manga, Bosque, Lava, Hielo, Ghost y Pastel por no estar al nivel del diseño nuevo; quien los tuviera guardados vuelve al Clásico.
- **Perfil compacto** (tarjeta estrecha; medallas y banners a la derecha), **frase personalizable** en lugar del título fijo del banner, **Ranking** de batallas y **Gacha** con monedas (`supabase/gacha_ranking.sql`, hay que aplicarlo a mano en Supabase). Las escrituras de monedas/batallas/tiradas solo van por RPC (no hay inserts directos).- **Perfil centrado:** formulario, medallas y banner apilados en una sola columna centrada (680 px máx.).
- **Banners de perfil** con 46 temas y título visible en Payos (`supabase/banners.sql`; sin él la web funciona con el banner clásico).
- **Subagentes del proyecto** (`.claude/agents/`) y primera revisión de seguridad. Pendiente de arreglar: `with check` en `players_update`/`entries_update`, restringir `profiles.avatar` a `https` y límites de longitud en SQL; `reload()` ignora errores de `entries`/`players` y puede pisarse con eventos realtime seguidos; solo `app.js` lleva `?v=` (los demás módulos se cachean sin versión).
- **Código en módulos:** `js/app.js` (960 líneas) se parte en módulos ES (`core`, `shell`, `auth`, `data`, `rutas`, `mons`, `payos`, `perfil`, `misiones`, `presence`, `dialog`); el estado compartido vive en `S` (`core.js`). Sin cambios de comportamiento.
- **Fase 1 de rediseño:** cabecera móvil en una fila con menú de usuario (Salir dentro), tema con estado e icono, contenido centrado, errores de promesas con aviso amable y Rutas con estados/zonas/progreso/filtros (`supabase/routes.sql`).
- **Fichaje manual y Misiones** (`supabase/missions.sql` y `supabase/presence.sql`).
- **BD endurecida:** `schema.sql` ya no borra tablas; checks de `status`/`level`/`badges`, índices de claves foráneas y políticas con `(select auth.uid())`. 
- **Iconos Pokémon** en las pestañas (sprites de objetos de PokéAPI; se probaron iconos SVG propios y se descartaron) y **cambio de tema** con una sola transición de página (View Transitions; instantáneo si no hay soporte o `prefers-reduced-motion`).
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

- **Recarga en vivo:** los eventos de Supabase se agrupan (300 ms) en un solo `reload()`; las acciones ya no recargan a mano salvo borrar Pokémon o usuario (los DELETE con filtro no llegan en vivo). «Mi colección» del Gacha clásico trae todas tus tiradas; «Últimas tiradas» solo 15. `pendiente.sql` eliminado y avisos de «falta aplicar SQL» quitados. Tests nuevos: `scripts/test-bj-rules.mjs` (el gacha del Casino no se puede probar en node: `core.js` importa Supabase por URL).

- **Rediseño Pokédex (5 fases):** tokens, tipografía, cabecera y pestañas; login de arranque y cuadros de texto; fichas de Pokémon, Caja, Rutas y Medallas; Payos, Ranking, Casino y Perfil; y por último skins (de 17 a 6), textos y pulido. `data/pokemon.json` ahora trae los tipos (`t`).

- **Pulido de temas y banners:** los cuadros de texto (estados vacíos, toasts, login) siguen ahora el tema (en oscuro ya no son blancos) con tokens `--box-*`; las tres columnas de Seguimiento (Equipo, Caja, Cementerio) comparten formato; cada skin define su carcasa (`--shell`) y su resalte (`--hl`); y los banners usan el **arte oficial** de PokéAPI (si falta, el sprite) con patrón de rayas y borde duro, y las bolas clásica y Master Ball son SVG propios.

- **Banners con fondo propio:** 46 banners (20 nuevos: Eevee, Gyarados, Arcanine, Lucario, Mimikyu, Greninja, Garchomp, Mew, Rayquaza, Dialga, Palkia, Giratina, Lugia, Ho-Oh, Magikarp, Psyduck, Ditto, Lapras, Snorlax y Charizard X). Cada uno lleva su patrón (`pat` en `config.js → BANNERS`, estilos `.bg-*`), y el ángulo del degradado y el desfase salen del id. Los iconos vuelven a ser sprites pixel art. En Payos, equipo y medallas ocupan una sola fila de 6.
