// Credenciales públicas de Supabase (la anon/publishable key es segura en el cliente).
// Si regeneras la clave en Supabase, actualízala aquí.
export const SUPABASE_URL = "https://lrzpgufrsvwlkizrlmrt.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_flXeoN0iYEbt2UduG9azTw_qiufj8Q2";

// Rutas/zonas del juego, en orden. Son las FILAS de la tabla de rutas y las sugerencias de
// "zona de captura". Es un borrador editable: ajusta/añade según avance vuestra partida.
// Si alguien registra una zona que no esté aquí, aparece igualmente al final de la tabla.
export const ROUTES = [
  "Inicial / Regalo",
  "Ruta 1",
  "Ruta 2",
  "Bosque",
  "Ciudad Novarte",
  "Ruta 3",
  "Ruta 4",
  "Pueblo Acrílico",
  "Ruta 5",
  "Cueva",
  "Ruta 6",
  "Castillo de Luminalia",
  "Chateau Lanton",
  "Ruta 7",
  "Ruta 8",
  "Pueblo Profano",
  "Ruta 9",
  "Árbol Eterno",
  "Ruta 10",
  "Ruta 11",
  "Ruta 12",
  "Aserradero",
  "Ruta 13",
  "Ruta 14",
  "Ruta 15",
  "Victory Road",
  "Liga Pokémon",
  "Postgame",
  "Intercambio",
  "Huevo",
];

// Medallas (12). `img` = nº de PokeAPI/sprites/badges (43–50 = las 8 reales de Kalos).
// Las 4 últimas usan otras medallas oficiales como marcador: cámbialas por las de los gimnasios de Z.
export const MEDALS = [
  { name: "Bicho",   img: 43 }, { name: "Muro",    img: 44 }, { name: "Lucha",   img: 45 },
  { name: "Planta",  img: 46 }, { name: "Voltaje", img: 47 }, { name: "Hada",    img: 48 },
  { name: "Psíquica",img: 49 }, { name: "Iceberg", img: 50 }, { name: "Núcleo",  img: 64 },
  { name: "Célula",  img: 65 }, { name: "Orden",   img: 62 }, { name: "Zygarde", img: 63 },
];
