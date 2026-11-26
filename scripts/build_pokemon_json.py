"""Generate data/pokemon.json (Gen 1-9) from PokeAPI CSVs: id, Spanish + English name, types `t` (slugs es, optional 4th arg = pokemon_types.csv)."""
import csv, json, sys

names_csv, species_csv, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
types_csv = sys.argv[4] if len(sys.argv) > 4 else None

# type_id de PokeAPI (1-18) -> slug usado en los tokens CSS --t-*
TYPE = ["normal", "lucha", "volador", "veneno", "tierra", "roca", "bicho", "fantasma", "acero", "fuego", "agua", "planta", "electrico", "psiquico", "hielo", "dragon", "siniestro", "hada"]
types = {}
if types_csv:
    with open(types_csv, encoding="utf-8") as f:
        for row in sorted(csv.DictReader(f), key=lambda r: (int(r["pokemon_id"]), int(r["slot"]))):
            types.setdefault(row["pokemon_id"], []).append(TYPE[int(row["type_id"]) - 1])

ES, EN = "7", "9"  # local_language_id
es, en = {}, {}
with open(names_csv, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        sid, lang = row["pokemon_species_id"], row["local_language_id"]
        if lang == ES:
            es[sid] = row["name"]
        elif lang == EN:
            en[sid] = row["name"]

out = []
with open(species_csv, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        sid = row["id"]
        if int(row["generation_id"]) <= 9:
            p = {"id": int(sid), "es": es.get(sid, en.get(sid, sid)), "en": en.get(sid, sid)}
            if sid in types: p["t"] = types[sid]
            out.append(p)

out.sort(key=lambda p: p["id"])
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"wrote {len(out)} pokemon -> {out_path}")
