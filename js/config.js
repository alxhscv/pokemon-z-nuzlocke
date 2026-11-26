// Credenciales públicas de Supabase (la anon/publishable key es segura en el cliente).
// Si regeneras la clave en Supabase, actualízala aquí.
export const SUPABASE_URL = "https://lrzpgufrsvwlkizrlmrt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_flXeoN0iYEbt2UduG9azTw_qiufj8Q2";

// Rutas/zonas del juego, en orden. Son las FILAS de la tabla de rutas y las sugerencias de
// "zona de captura". Es un borrador editable: ajusta/añade según avance vuestra partida.
// Si alguien registra una zona que no esté aquí, aparece igualmente al final de la tabla.
// Agrupadas por zonas (editable). ROUTES (lista plana, en orden) se deriva de aquí.
export const ROUTE_ZONES = [
  ["Inicio", ["Inicial / Regalo", "Ruta 1", "Ruta 2", "Bosque"]],
  ["Novarte", ["Ciudad Novarte", "Ruta 3", "Ruta 4"]],
  ["Acrílico", ["Pueblo Acrílico", "Ruta 5", "Cueva", "Ruta 6"]],
  ["Luminalia", ["Castillo de Luminalia", "Chateau Lanton", "Ruta 7", "Ruta 8"]],
  ["Profano", ["Pueblo Profano", "Ruta 9", "Árbol Eterno", "Ruta 10"]],
  ["Tramo final", ["Ruta 11", "Ruta 12", "Aserradero", "Ruta 13", "Ruta 14", "Ruta 15"]],
  ["Liga", ["Victory Road", "Liga Pokémon"]],
  ["Extras", ["Postgame", "Intercambio", "Huevo"]],
];
export const ROUTES = ROUTE_ZONES.flatMap((z) => z[1]);

// Medallas (12). `img` = nº de PokeAPI/sprites/badges (43–50 = las 8 reales de Kalos).
// Las 4 últimas usan otras medallas oficiales como marcador: cámbialas por las de los gimnasios de Z.
export const MEDALS = [
  { name: "Bicho",   img: 43 }, { name: "Muro",    img: 44 }, { name: "Lucha",   img: 45 },
  { name: "Planta",  img: 46 }, { name: "Voltaje", img: 47 }, { name: "Hada",    img: 48 },
  { name: "Psíquica",img: 49 }, { name: "Iceberg", img: 50 }, { name: "Núcleo",  img: 64 },
  { name: "Célula",  img: 65 }, { name: "Orden",   img: 62 }, { name: "Zygarde", img: 63 },
];

// Banners de perfil (se eligen en Perfil y se ven en Payos junto a su título).
// art: pk = nº Pokémon (PokeAPI sprites), shiny = versión shiny, item = sprite de objeto.
// El primero es el de por defecto (profiles.banner = null).
export const BANNERS = [
  { id: "clasico",   name: "Clásico",        title: "Entrenador novato",       c1: "#E3350D", c2: "#FF8A5C", item: "poke-ball", pat: "stripes" },
  { id: "fuego",     name: "Fuego",          title: "Maestro del Fuego",       c1: "#F5542B", c2: "#FFA23C", pk: 6, pat: "flames" },
  { id: "agua",      name: "Agua",           title: "Maestro del Agua",        c1: "#2D7DD2", c2: "#4CC9F0", pk: 9, pat: "waves" },
  { id: "planta",    name: "Planta",         title: "Maestro de la Planta",    c1: "#2E9B5E", c2: "#8BD450", pk: 3, pat: "leaves" },
  { id: "electrico", name: "Eléctrico",      title: "Maestro del Rayo",        c1: "#E0A800", c2: "#FFE45E", pk: 25, pat: "bolts" },
  { id: "hielo",     name: "Hielo",          title: "Maestro del Hielo",       c1: "#46B7D8", c2: "#C4F3FF", pk: 471, pat: "plus" },
  { id: "lucha",     name: "Lucha",          title: "Puños de Acero",          c1: "#B3271F", c2: "#E8704F", pk: 68, pat: "rays" },
  { id: "veneno",    name: "Veneno",         title: "Alquimista Tóxico",       c1: "#8E44AD", c2: "#C77DFF", pk: 169, pat: "bubbles" },
  { id: "tierra",    name: "Tierra",         title: "Señor del Desierto",      c1: "#B8873B", c2: "#E2BF65", pk: 232, pat: "bricks" },
  { id: "volador",   name: "Volador",        title: "Rey de los Cielos",       c1: "#6F8FE0", c2: "#C3D4FF", pk: 18, pat: "clouds" },
  { id: "psiquico",  name: "Psíquico",       title: "Mente Brillante",         c1: "#F0457A", c2: "#FFB3CF", pk: 65, pat: "diamonds" },
  { id: "bicho",     name: "Bicho",          title: "Entomólogo Experto",      c1: "#7AB80C", c2: "#D0E85A", pk: 212, pat: "hex" },
  { id: "roca",      name: "Roca",           title: "Coloso de Piedra",        c1: "#A08A32", c2: "#D4C38A", pk: 248, pat: "triangles" },
  { id: "fantasma",  name: "Fantasma",       title: "Cazafantasmas",          c1: "#4B3F8C", c2: "#8E7CC3", pk: 94, pat: "zigzag" },
  { id: "dragon",    name: "Dragón",         title: "Domador de Dragones",     c1: "#4F46E5", c2: "#9F8CFF", pk: 149, pat: "scales" },
  { id: "siniestro", name: "Siniestro",      title: "Sombra Nocturna",         c1: "#2F2626", c2: "#6B5B5B", pk: 197, pat: "rain" },
  { id: "acero",     name: "Acero",          title: "Muralla de Acero",        c1: "#6E7A87", c2: "#B8C2CC", pk: 376, pat: "grid" },
  { id: "hada",      name: "Hada",           title: "Encanto Feérico",         c1: "#E27ADB", c2: "#FFC8F0", pk: 700, pat: "stars" },
  { id: "normal",    name: "Normal",         title: "Corazón Humilde",         c1: "#9A9A82", c2: "#D9D9C2", pk: 143, pat: "dots" },
  { id: "kalos",     name: "Kalos",          title: "Hijo de Kalos",           c1: "#2F9DB3", c2: "#FF6FB5", pk: 716, pat: "checker" },
  { id: "zygarde",   name: "Zygarde",        title: "Guardián del Equilibrio", c1: "#17703A", c2: "#00D96B", pk: 718, pat: "hex" },
  { id: "mega",      name: "Mega Evolución", title: "Vínculo Supremo",         c1: "#6A11CB", c2: "#FF5ACD", pk: 10034, pat: "stars" },
  { id: "legendario",name: "Legendario",     title: "Ídolo de Leyenda",        c1: "#1E3C72", c2: "#3F6FD1", pk: 150, pat: "diamonds" },
  { id: "shiny",     name: "Shiny",          title: "Cazador de Shinies",      c1: "#E69500", c2: "#FFE066", pk: 6, shiny: true, pat: "plus" },
  { id: "masterball",name: "Master Ball",    title: "Campeón Invicto",         c1: "#5B2A86", c2: "#C77DFF", item: "master-ball", pat: "hex" },
  { id: "nuzlocke",  name: "Nuzlocke",       title: "Superviviente del Cementerio", c1: "#263238", c2: "#607D8B", pk: 92, pat: "zigzag" },
  { id: "eevee", name: "Eevee", title: "Evolución Pendiente", c1: "#8B5A2B", c2: "#E8C07D", pk: 133, pat: "dots" },
  { id: "gyarados", name: "Gyarados", title: "Furia del Mar", c1: "#0B4F8A", c2: "#2FB7E6", pk: 130, pat: "waves" },
  { id: "arcanine", name: "Arcanine", title: "Fiel y Veloz", c1: "#C93F0B", c2: "#FFB347", pk: 59, pat: "flames" },
  { id: "lucario", name: "Lucario", title: "Aura Pura", c1: "#1F4E9E", c2: "#7FB2FF", pk: 448, pat: "rays" },
  { id: "mimikyu", name: "Mimikyu", title: "Disfraz de Pikachu", c1: "#B8932A", c2: "#F3E08A", pk: 778, pat: "triangles" },
  { id: "greninja", name: "Greninja", title: "Ninja de las Sombras", c1: "#14507A", c2: "#3AA0C8", pk: 658, pat: "rain" },
  { id: "garchomp", name: "Garchomp", title: "Tiburón del Cielo", c1: "#1B2F6B", c2: "#5472C9", pk: 445, pat: "scales" },
  { id: "mew", name: "Mew", title: "Mito Rosa", c1: "#E85AA0", c2: "#FFD1E8", pk: 151, pat: "bubbles" },
  { id: "rayquaza", name: "Rayquaza", title: "Señor del Cielo", c1: "#0E6B47", c2: "#52E0A0", pk: 384, pat: "clouds" },
  { id: "dialga", name: "Dialga", title: "Dominio del Tiempo", c1: "#2B3F8F", c2: "#8AA0F0", pk: 483, pat: "grid" },
  { id: "palkia", name: "Palkia", title: "Dominio del Espacio", c1: "#A03C8F", c2: "#F0A0E0", pk: 484, pat: "stars" },
  { id: "giratina", name: "Giratina", title: "Sombra del Mundo Distorsión", c1: "#2A1A3E", c2: "#7A3A5A", pk: 487, pat: "diamonds" },
  { id: "lugia", name: "Lugia", title: "Guardián de los Mares", c1: "#3A5F9A", c2: "#C0D8F0", pk: 249, pat: "plus" },
  { id: "hooh", name: "Ho-Oh", title: "Luz del Arcoíris", c1: "#D43B12", c2: "#FFD23F", pk: 250, pat: "rays" },
  { id: "magikarp", name: "Magikarp", title: "Salpicadura Épica", c1: "#D9501A", c2: "#FFC070", pk: 129, pat: "waves" },
  { id: "psyduck", name: "Psyduck", title: "Dolor de Cabeza", c1: "#D9B000", c2: "#FFF08A", pk: 54, pat: "dots" },
  { id: "ditto", name: "Ditto", title: "Transformación", c1: "#9D7FD0", c2: "#E8D8FF", pk: 132, pat: "zigzag" },
  { id: "lapras", name: "Lapras", title: "Viajero de Hielo", c1: "#3A8FC0", c2: "#C8F0FF", pk: 131, pat: "plus" },
  { id: "snorlax", name: "Snorlax", title: "Siesta Legendaria", c1: "#2F6F6F", c2: "#9CD0C8", pk: 143, pat: "checker" },
  { id: "charizardx", name: "Charizard X", title: "Llama Azul", c1: "#102A5C", c2: "#2E7BFF", pk: 10034, pat: "flames" },
];

export const GACHA_COST = 100;   // monedas por tirada (el servidor aplica el mismo precio)

// Temas de la web (Perfil). El CSS de cada uno vive en css/themes.css (html[data-skin]); "clasico" = sin skin y con botón claro/oscuro.
// mode = modo fijo del skin; bg/surface/accent solo alimentan la mini-previsualización.
export const SKINS = [
  { id: "clasico", name: "Clásico Pokéball", mode: "auto", bg: "#0B1226", surface: "#141E3A", accent: "#C2371F" },
  { id: "kanto", name: "Kanto retro", mode: "light", bg: "#9BBC0F", surface: "#B0CE22", accent: "#0F380F" },
  { id: "johto", name: "Johto dorado", mode: "light", bg: "#F4EBD0", surface: "#FFFBEF", accent: "#8A5A00" },
  { id: "hoenn", name: "Hoenn océano", mode: "dark", bg: "#06283D", surface: "#0B3B57", accent: "#0A6E9E" },
  { id: "alola", name: "Alola atardecer", mode: "dark", bg: "#3A1630", surface: "#52203F", accent: "#C2410C" },
  { id: "galar", name: "Galar competitivo", mode: "light", bg: "#EDEFF2", surface: "#FFFFFF", accent: "#C4162A" },
];
