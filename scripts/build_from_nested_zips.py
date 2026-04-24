
# NOTE: Replace this placeholder with your full LaTeX build & classification script.
# It should generate:
# - ./pdfs/... (PDF files)
# - ./catalog.json (array of {matiere, niveau, type, titre, fichier})

import json, os
os.makedirs("pdfs", exist_ok=True)
# Minimal stub catalog so the app works even before you paste your full script
catalog = [
  {"matiere":"maths","niveau":"superieure","type":"cours","titre":"Exemple Algèbre","fichier":"pdfs/example.pdf"}
]
with open("catalog.json","w",encoding="utf-8") as f:
  json.dump(catalog,f,ensure_ascii=False,indent=2)
print("Stub build done. Replace with your real script.")
