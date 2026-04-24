const { exec } = require("child_process");

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(stdout + "\n" + stderr);
      resolve(stdout + "\n" + stderr);
    });
  });
}

async function compileLatex(folder) {
  let logs = "";

  try {
    // 1ère compilation
    logs += await run("pdflatex -interaction=nonstopmode main.tex", folder);

    // Bibtex (si présent)
    try {
      logs += await run("bibtex main", folder);
    } catch (e) {
      logs += "\n(no bibtex)\n";
    }

    // 2ème compilation
    logs += await run("pdflatex -interaction=nonstopmode main.tex", folder);

    // 3ème compilation (refs)
    logs += await run("pdflatex -interaction=nonstopmode main.tex", folder);

    return logs;

  } catch (err) {
    throw logs + "\n" + err;
  }
}

module.exports = { compileLatex };