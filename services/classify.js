function classify(name) {
  const n = name.toLowerCase();

  let matiere = n.includes("phys") ? "physique" : "maths";

  let niveau = "superieur";
  if (n.includes("term")) niveau = "terminale";
  if (n.includes("prem")) niveau = "premiere";
  if (n.includes("3")) niveau = "troisieme";

  let type = "cours";
  if (n.includes("exo")) type = "exo";
  if (n.includes("ds")) type = "ds";
  if (n.includes("corr")) type = "corrige";

  return { matiere, niveau, type };
}

module.exports = { classify };