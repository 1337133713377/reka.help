# reka.help

Site de présentation et d'aide de [REKA](https://github.com/1337133713377/reka), la console de mixage tout-en-un pour Windows.

Site statique, sans étape de build ni dépendance : du HTML, une feuille de style et un script.

```
index.html            présentation
help.html             centre d'aide (recherche, sommaire, dépannage)
404.html              page introuvable
assets/css/style.css  styles (palette du thème « Dark Studio Pro » de REKA)
assets/js/site.js     langue, thèmes, recherche, visionneuse
assets/img/           captures et logo, repris du dépôt reka
assets/fonts/         Inter (licence OFL, voir Inter-OFL.txt)
```

## Voir le site en local

```bash
python3 -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

## Publier avec GitHub Pages

Dans le dépôt : **Settings → Pages → Deploy from a branch**, branche par défaut, dossier `/ (root)`.
Pour un domaine personnalisé, renseigne-le dans le même écran (GitHub crée alors le fichier `CNAME`).

## Modifier le contenu

- **Deux langues dans la même page.** Chaque texte existe en double, marqué `lang="fr"` et `lang="en"` ;
  une seule version est affichée. Quand tu changes un texte, change les deux.
- **L'interface de REKA est en français** : la version anglaise cite les boutons tels qu'ils
  apparaissent à l'écran, suivis de leur traduction entre parenthèses.
- **Rubrique d'aide** : une `<section class="doc-section" id="…">` dans `help.html`, plus son lien
  dans le sommaire (`<aside class="toc">`). `data-keywords` ajoute des mots pour la recherche.
- **Question fréquente** : un `<details class="faq" id="faq-…">` dans la rubrique `#depannage`.
- **Captures** : remplace les fichiers de `assets/img/` en gardant les mêmes noms et dimensions.
- **Thèmes de la page d'accueil** : les pastilles sous la capture changent la capture
  (`assets/img/theme-<nom>.webp`) et les couleurs du site (`html[data-theme="<nom>"]` dans `style.css`).

Le contenu vient du `README.md`, de `reaper_mixer/README.md` et de `reaper_mixer/NOUVEAUTES.md` du dépôt
`reka` : à mettre à jour ici quand ils changent.
