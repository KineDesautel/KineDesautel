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

  for (const ligne of lignes) {
    const l = ligne.trim();
    if (!l) continue;
    if (l.startsWith("|")) tableau.push(l);
    else if (l.startsWith("# ") && !titre) titre = l.slice(2).trim();
    else if (!tableau.length) description.push(l);
  }

  if (tableau.length < 2) throw new Error("Aucun tableau trouvé dans " + FICHIER);

  const entetes = cellules(tableau[0]);
  // tableau[1] est la ligne de séparation |---|---|
  const lignesDonnees = tableau.slice(2).map(cellules).filter((c) => c.some(Boolean));

  // Colonne utilisée pour trier : "Points" (ou "Score"), sinon la 2e colonne.
  let iScore = entetes.findIndex((e) => /^(points?|score)$/i.test(e));
  if (iScore === -1) iScore = 1;

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

  return { titre, description: description.join(" "), libelleScore: entetes[iScore] || "Points", joueurs };
}

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function afficher({ titre, description, libelleScore, joueurs }) {
  if (titre) {
    document.getElementById("titre").textContent = titre;
    document.title = titre;
  }
  document.getElementById("description").textContent = description;

  const unite = libelleScore.toLowerCase();

  const podium = document.getElementById("podium");
  joueurs.slice(0, 3).forEach((j, i) => {
    const m = el("div", `marche r${i + 1}`);
    m.append(
      el("div", "medaille", MEDAILLES[j.rang - 1] || `#${j.rang}`),
      el("div", "nom", j.nom),
      el("div", "points", `${j.scoreTexte} ${unite}`)
    );
    podium.append(m);
  });

  const liste = document.getElementById("liste");
  joueurs.forEach((j) => {
    const li = el("li");
    const nom = el("div", "ligne-nom", j.nom);
    if (j.extras.length) nom.append(el("small", null, j.extras.join(" · ")));
    li.append(el("span", "rang", j.rang), nom, el("span", "ligne-points", j.scoreTexte));
    liste.append(li);
  });
}

// "?v=" + date évite que le navigateur garde une ancienne version du fichier en cache.
fetch(`${FICHIER}?v=${Date.now()}`)
  .then((r) => {
    if (!r.ok) throw new Error(`Impossible de charger ${FICHIER} (${r.status})`);
    return r.text();
  })
  .then((texte) => afficher(lireMarkdown(texte)))
  .catch((err) => {
    const e = document.getElementById("erreur");
    e.textContent = err.message;
    e.hidden = false;
  });
