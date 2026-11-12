# Money Time

Jeu de coaching de basket en solo, dans une ligue fictive : vous prenez un banc à 2 min 00 de la fin et devez gagner le match.

## Lancer le jeu

Double-cliquez sur `index.html`, ou servez le dossier en local :

```bash
python3 -m http.server 8123
```

puis ouvrez <http://localhost:8123>. Le jeu est un site statique sans dépendance ni étape de build : pour le mettre en ligne, il suffit de déposer le dossier chez un hébergeur de fichiers statiques.

## Organisation

| Fichier | Rôle |
|---|---|
| `js/data.js` | Attributs et libellés des consignes |
| `js/teams.js` | Base de données de la ligue : 18 équipes, 162 joueurs fictifs (âge, pays, gabarit, 16 aptitudes) |
| `tools/generate_teams.py` | Générateur de `js/teams.js` (le relancer écrase les retouches manuelles) |
| `js/engine.js` | État du match, règles, résolution d'une séquence (sans DOM) |
| `js/ai.js` | Coach adverse simulé |
| `js/scenarios.js` | Familles de défis et tirage des paramètres |
| `js/events.js` | Douze événements aléatoires, chacun avec ses choix et leurs effets |
| `js/ui.js`, `css/style.css` | Les trois écrans : lancement, match, résultat |
| `a-propos.html`, `versions.html`, `mentions-legales.html`, `css/pages.css` | Pages d'information ; le numéro de version est à tenir à jour dans `versions.html` et dans `js/data.js` |
| `tests/sim.html` | Simulations de contrôle (6 000 matchs entre les 18 équipes) à ouvrir dans le navigateur |

## Arbitrages retenus pour ce prototype

- **Égalité** : prolongation éclair de deux minutes, fautes d'équipe remises à zéro, un temps mort rendu (deux au plus).
- **Effectifs** : 18 équipes fictives de 9 joueurs, chacune avec un style propre. Seattle et Pittsburgh sont écrits à la main, les 16 autres sont générés par archétypes puis figés dans `js/teams.js`.
- **Règles** : deux temps morts au plus par équipe ; pénalité dès la deuxième faute d'équipe des deux dernières minutes ; exclusion à six fautes ; remplacements aux arrêts de jeu sur coup de sifflet ou temps mort, pas après un panier ; ballon en jeu, seul le porteur du ballon peut demander un temps mort.
- **Statistiques** : la feuille de match des 46 premières minutes est tirée au lancement du défi (les points retombent sur le score), puis tenue par le moteur. Chaque joueur a une forme du soir (de -1 à +1) qui pèse au plus trois points de réussite au tir et évolue avec ses tirs.
- **Événements aléatoires** : au plus trois par match (quatre avec prolongation), jamais deux séquences de suite ni deux fois le même, environ deux par partie en moyenne. La probabilité (22 % par décision) est dans `EV.roll`.
- **Calibrage** : tous les coefficients sont dans `js/engine.js` et restent à éprouver en jeu.

## Licence et crédits

© 2026 Hiramb23, avec l'aide de Claude (Anthropic).

Le jeu — code, textes, base de joueurs et logo — est diffusé sous licence [Creative Commons Attribution - Pas d'utilisation commerciale - Partage dans les mêmes conditions 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr) (CC BY-NC-SA 4.0). Le texte complet figure dans le fichier `LICENSE`.

Vous pouvez le partager et l'adapter, à condition de citer l'auteur, de ne pas en faire un usage commercial et de diffuser vos adaptations sous la même licence.

La ligue, ses équipes et ses joueurs sont fictifs. Toute ressemblance avec des ligues, des clubs ou des personnes réels serait fortuite. Ce jeu n'est affilié à aucune ligue ni à aucun club.

Le jeu ne collecte aucune donnée : pas de cookie, pas de compte, aucun appel à un service externe.
