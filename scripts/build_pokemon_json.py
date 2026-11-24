"""Generate data/pokemon.json (Gen 1-9) from PokeAPI CSVs: id, Spanish + English name."""
import csv, json, sys

names_csv, species_csv, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

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
            out.append({"id": int(sid), "es": es.get(sid, en.get(sid, sid)), "en": en.get(sid, sid)})

out.sort(key=lambda p: p["id"])
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"wrote {len(out)} pokemon -> {out_path}")
