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
  { id: "clasico",   name: "Clásico",        title: "Entrenador novato",       c1: "#E3350D", c2: "#FF8A5C", item: "poke-ball" },
  { id: "fuego",     name: "Fuego",          title: "Maestro del Fuego",       c1: "#F5542B", c2: "#FFA23C", pk: 6 },
  { id: "agua",      name: "Agua",           title: "Maestro del Agua",        c1: "#2D7DD2", c2: "#4CC9F0", pk: 9 },
  { id: "planta",    name: "Planta",         title: "Maestro de la Planta",    c1: "#2E9B5E", c2: "#8BD450", pk: 3 },
  { id: "electrico", name: "Eléctrico",      title: "Maestro del Rayo",        c1: "#E0A800", c2: "#FFE45E", pk: 25 },
  { id: "hielo",     name: "Hielo",          title: "Maestro del Hielo",       c1: "#46B7D8", c2: "#C4F3FF", pk: 471 },
  { id: "lucha",     name: "Lucha",          title: "Puños de Acero",          c1: "#B3271F", c2: "#E8704F", pk: 68 },
  { id: "veneno",    name: "Veneno",         title: "Alquimista Tóxico",       c1: "#8E44AD", c2: "#C77DFF", pk: 169 },
  { id: "tierra",    name: "Tierra",         title: "Señor del Desierto",      c1: "#B8873B", c2: "#E2BF65", pk: 232 },
  { id: "volador",   name: "Volador",        title: "Rey de los Cielos",       c1: "#6F8FE0", c2: "#C3D4FF", pk: 18 },
  { id: "psiquico",  name: "Psíquico",       title: "Mente Brillante",         c1: "#F0457A", c2: "#FFB3CF", pk: 65 },
  { id: "bicho",     name: "Bicho",          title: "Entomólogo Experto",      c1: "#7AB80C", c2: "#D0E85A", pk: 212 },
  { id: "roca",      name: "Roca",           title: "Coloso de Piedra",        c1: "#A08A32", c2: "#D4C38A", pk: 248 },
  { id: "fantasma",  name: "Fantasma",       title: "Cazafantasmas",          c1: "#4B3F8C", c2: "#8E7CC3", pk: 94 },
  { id: "dragon",    name: "Dragón",         title: "Domador de Dragones",     c1: "#4F46E5", c2: "#9F8CFF", pk: 149 },
  { id: "siniestro", name: "Siniestro",      title: "Sombra Nocturna",         c1: "#2F2626", c2: "#6B5B5B", pk: 197 },
  { id: "acero",     name: "Acero",          title: "Muralla de Acero",        c1: "#6E7A87", c2: "#B8C2CC", pk: 376 },
  { id: "hada",      name: "Hada",           title: "Encanto Feérico",         c1: "#E27ADB", c2: "#FFC8F0", pk: 700 },
  { id: "normal",    name: "Normal",         title: "Corazón Humilde",         c1: "#9A9A82", c2: "#D9D9C2", pk: 143 },
  { id: "kalos",     name: "Kalos",          title: "Hijo de Kalos",           c1: "#2F9DB3", c2: "#FF6FB5", pk: 716 },
  { id: "zygarde",   name: "Zygarde",        title: "Guardián del Equilibrio", c1: "#17703A", c2: "#00D96B", pk: 718 },
  { id: "mega",      name: "Mega Evolución", title: "Vínculo Supremo",         c1: "#6A11CB", c2: "#FF5ACD", pk: 10034 },
  { id: "legendario",name: "Legendario",     title: "Ídolo de Leyenda",        c1: "#1E3C72", c2: "#3F6FD1", pk: 150 },
  { id: "shiny",     name: "Shiny",          title: "Cazador de Shinies",      c1: "#E69500", c2: "#FFE066", pk: 6, shiny: true },
  { id: "masterball",name: "Master Ball",    title: "Campeón Invicto",         c1: "#5B2A86", c2: "#C77DFF", item: "master-ball" },
  { id: "nuzlocke",  name: "Nuzlocke",       title: "Superviviente del Cementerio", c1: "#263238", c2: "#607D8B", pk: 92 },
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
