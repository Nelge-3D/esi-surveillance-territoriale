# ESI — Earth Surface Intelligence

Prototype conceptuel indépendant de DEUS TECH MACHINA pour NASA Space Apps Challenge 2026. Le scénario de Mandji–Yombi illustre la comparaison forestière, les périmètres d’une plantation fictive, le contexte historique des éléphants et la préparation d’un signalement.

## Lancer

```powershell
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:3000. Le fond de carte OpenStreetMap utilise Internet. Les interactions et les couches de scénario sont embarquées. La plantation fictive reste en mémoire pendant la visite. Le signalement est simulé.

## Vérifier

```powershell
npm run typecheck
npm run build
```

Le polygone de perturbation, les secteurs de veille et l’incident sont fictifs. La fiche utilise des règles de démonstration. L’indice anthropique n’est pas calibré. Le point de référence du changement sert au calcul de proximité. Les références officielles et scientifiques sont accessibles dans l’interface.

## Visuel

`public/foret-concept.png` a été généré avec ImageGen. Prompt utilisé :

> Create one wide 3:2 realistic overhead satellite-inspired raster texture for the ESI dark scientific dashboard, fictional Gabon tropical rainforest. Dense deep forest green textured equatorial canopy, an organic meandering dark teal river predominantly in the left third, continuous forest across the right half, subtle varied dark olive and blue green tones. Perfect straight-down orthographic framing, no sky, no perspective, no clouds, no labels, no text, no overlays, no buildings, no clear-cut. This is entirely fictional landscape art. Visual texture of a high-resolution aerial view. A procedural localized clearing overlay will be added in the app.

Le comparateur applique une clairière illustrative à cette même image.