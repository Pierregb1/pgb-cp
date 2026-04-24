
# Course Site (Render + Node + LaTeX build)

## Étapes

1. Dézipper le projet
2. Mettre votre ZIP Overleaf dans `source_bundle/Overleaf Projects.zip`
3. Remplacer `scripts/build_from_nested_zips.py` par votre script complet
4. `npm install`
5. Tester local: `npm run build-pdfs` puis `npm start`
6. Créer une base Postgres sur Render et récupérer DATABASE_URL
7. Dans Render Web Service:
   - Build: `npm install && npm run build-pdfs`
   - Start: `npm start`
   - Env:
     - DATABASE_URL=...
     - SESSION_SECRET=...
     - NODE_ENV=production
8. Créer la table users:
   ```sql
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     email TEXT UNIQUE,
     password TEXT
   );
   ```
9. Créer des comptes:
   ```bash
   DATABASE_URL="..." node scripts/create-student.js eleve@mail.com motdepasse
   ```
10. Accéder:
   - `/login` pour se connecter
   - `/dashboard` pour voir les documents

## Données hebdomadaires
- 200 mathématiciens (fictifs pour démo)
- 300 mathématiciennes (fictives pour démo)
- 300 problèmes

Sélection déterministe chaque semaine via `/api/weekly`.
