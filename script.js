// Lit classement.md, extrait le titre, le texte et le tableau, puis affiche le classement.
const FICHIER = "classement.md";
const MEDAILLES = ["🥇", "🥈", "🥉"];

function cellules(ligne) {
  return ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function lireMarkdown(texte) {
  const lignes = texte.split(/\r?\n/);
  let titre = null;
  const description = [];
  const tableau = [];
  let derniereLigneTableau = -1;

  lignes.forEach((ligne, i) => {
    const l = ligne.trim();
    if (!l) return;
    if (l.startsWith("|")) {
      tableau.push(l);
      derniereLigneTableau = i;
    } else if (l.startsWith("# ") && !titre) titre = l.slice(2).trim();
    else if (!tableau.length) description.push(l);
  });

  // Tout ce qui se trouve sous le tableau alimente la popup.
  const popup = lignes.slice(derniereLigneTableau + 1).join("\n").trim();

  if (tableau.length < 2) throw new Error("Aucun tableau trouvé dans " + FICHIER);

  const entetes = cellules(tableau[0]);
  // tableau[1] est la ligne de séparation |---|---|
  const lignesDonnees = tableau.slice(2).map(cellules).filter((c) => c.some(Boolean));

  // Colonne utilisée pour trier : "Points" (ou "Score"), sinon la 2e colonne.
  let iScore = entetes.findIndex((e) => /^(points?|score|force)/i.test(e));
  if (iScore === -1) iScore = 1;

  // Unité : texte entre parenthèses dans l'en-tête, par exemple "Force maximale (N)" donne "N".
  const unite = (entetes[iScore] || "").match(/\(([^)]+)\)/)?.[1] || "";

  const joueurs = lignesDonnees.map((c) => ({
    nom: c[0] || "",
    score: parseFloat((c[iScore] || "0").replace(",", ".")) || 0,
    scoreTexte: c[iScore] || "0",
    extras: entetes
      .map((e, i) => (i !== 0 && i !== iScore && c[i] ? `${e} : ${c[i]}` : null))
      .filter(Boolean),
  }));

  joueurs.sort((a, b) => b.score - a.score);

  // Rang avec gestion des égalités (ex. 1, 2, 2, 4).
  joueurs.forEach((j, i) => {
    j.rang = i > 0 && j.score === joueurs[i - 1].score ? joueurs[i - 1].rang : i + 1;
  });

  return {
    titre,
    description: description.join(" "),
    libelleScore: entetes[iScore] || "Points",
    libelleNom: entetes[0] || "Nom",
    unite,
    joueurs,
    popup,
  };
}

// Convertit le texte en éléments DOM : **gras**, [texte](lien http/https). Pas de HTML brut.
function inline(parent, texte) {
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let dernier = 0;
  let m;
  while ((m = re.exec(texte))) {
    if (m.index > dernier) parent.append(texte.slice(dernier, m.index));
    if (m[1] !== undefined) {
      parent.append(el("strong", null, m[1]));
    } else {
      const a = el("a", null, m[2]);
      a.href = m[3];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      parent.append(a);
    }
    dernier = re.lastIndex;
  }
  if (dernier < texte.length) parent.append(texte.slice(dernier));
}

// Rendu minimal : ## / ### / #### titres, * listes, paragraphes.
// Un paragraphe qui ne contient qu'un lien devient un bouton d'action.
function rendreMarkdown(texte, conteneur) {
  let liste = null;
  let paragraphe = [];

  const fermerParagraphe = () => {
    if (!paragraphe.length) return;
    const contenu = paragraphe.join(" ");
    const seulLien = /^\[[^\]]+\]\(https?:\/\/[^)\s]+\)$/.test(contenu);
    const p = el("p", seulLien ? "action" : null);
    inline(p, contenu);
    // Le bouton d'inscription de la popup affiche toujours "Inscris-toi", quel que soit le texte du lien dans le .md.
    if (seulLien) p.querySelector("a").textContent = "Inscris-toi";
    conteneur.append(p);
    paragraphe = [];
  };

  for (const brute of texte.split(/\r?\n/)) {
    const l = brute.trim();
    const titre = l.match(/^(#{2,4})\s+(.*)$/);
    const puce = l.match(/^[*-]\s+(.*)$/);

    if (puce) {
      fermerParagraphe();
      if (!liste) {
        liste = el("ul");
        conteneur.append(liste);
      }
      const li = el("li");
      inline(li, puce[1]);
      liste.append(li);
      continue;
    }
    liste = null;

    if (titre) {
      fermerParagraphe();
      const h = el("h" + titre[1].length);
      inline(h, titre[2]);
      conteneur.append(h);
    } else if (!l) fermerParagraphe();
    else paragraphe.push(l);
  }
  fermerParagraphe();
}

function initPopup(texte) {
  if (!texte) return;
  const dialogue = document.getElementById("popup");
  const contenu = document.getElementById("popup-contenu");
  if (contenu) rendreMarkdown(texte, contenu);

  const ouvrir = document.getElementById("ouvrir-popup");
  const fermer = document.getElementById("fermer-popup");
  if (!dialogue || !contenu || !ouvrir || !fermer) return;
  ouvrir.hidden = false;
  ouvrir.addEventListener("click", () => dialogue.showModal());
  fermer.addEventListener("click", () => dialogue.close());
  // Un clic sur le fond sombre (en dehors du contenu) ferme la popup.
  dialogue.addEventListener("click", (e) => {
    if (e.target === dialogue) dialogue.close();
  });
}

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function afficher({ titre, description, libelleScore, libelleNom, unite, joueurs }) {
  if (titre) {
    document.getElementById("titre").textContent = titre;
    document.title = titre;
  }
  document.getElementById("description").textContent = description;

  // Ligne d'en-tête : explique chaque colonne de la liste.
  const entete = document.getElementById("entete-liste");
  entete.append(el("span", null, "Rang"), el("span", null, libelleNom), el("span", null, libelleScore));

  const podium = document.getElementById("podium");
  joueurs.slice(0, 3).forEach((j, i) => {
    const m = el("div", `marche r${i + 1}`);
    m.append(
      el("div", "medaille", MEDAILLES[j.rang - 1] || `#${j.rang}`),
      el("div", "nom", j.nom),
      el("div", "points", unite ? `${j.scoreTexte} ${unite}` : j.scoreTexte),
      el("div", "socle", String(j.rang))
    );
    podium.append(m);
  });

  const liste = document.getElementById("liste");
  const max = Math.max(...joueurs.map((j) => j.score), 1);
  joueurs.forEach((j, i) => {
    const li = el("li");
    // Jauge sous la ligne : force relative au meilleur score.
    li.style.setProperty("--part", (j.score / max).toFixed(3));
    li.style.setProperty("--i", i);
    const nom = el("div", "ligne-nom", j.nom);
    if (j.extras.length) nom.append(el("small", null, j.extras.join(" · ")));
    const points = el("span", "ligne-points", j.scoreTexte);
    if (unite) points.append(el("small", null, unite));
    li.append(el("span", "rang", j.rang), nom, points);
    liste.append(li);
  });
}

// Dernière ligne du classement : une place libre qui ouvre la popup d'inscription.
function ajouterPlaceLibre() {
  const dialogue = document.getElementById("popup");
  const li = el("li", "libre");
  const bouton = el("button", "place-libre");
  bouton.type = "button";
  bouton.append(el("span", "rang", "?"), el("span", "ligne-nom", "Ta place ici ?"), el("span", "fleche", "→"));
  bouton.addEventListener("click", () => dialogue.showModal());
  li.append(bouton);
  document.getElementById("liste").append(li);
}

function initBandeau() {
  const bandeau = document.querySelector(".bandeau");
  const bouton = document.getElementById("pause-bandeau");
  if (!bandeau || !bouton) return;
  bouton.addEventListener("click", () => {
    const enPause = bandeau.classList.toggle("en-pause");
    bouton.setAttribute("aria-pressed", String(enPause));
    bouton.textContent = enPause ? "▶" : "❚❚";
    bouton.setAttribute("aria-label", enPause ? "Relancer le bandeau" : "Mettre le bandeau en pause");
  });
}

initBandeau();

// "?v=" + date évite que le navigateur garde une ancienne version du fichier en cache.
fetch(`${FICHIER}?v=${Date.now()}`)
  .then((r) => {
    if (!r.ok) throw new Error(`Impossible de charger ${FICHIER} (${r.status})`);
    return r.text();
  })
  .then((texte) => {
    const donnees = lireMarkdown(texte);
    afficher(donnees);
    initPopup(donnees.popup);
    if (donnees.popup) ajouterPlaceLibre();
  })
  .catch((err) => {
    const e = document.getElementById("erreur");
    e.textContent = err.message;
    e.hidden = false;
  });
