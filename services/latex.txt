const { exec } = require("child_process");

function compileLatex(folder) {
  return new Promise((resolve, reject) => {
    exec(
      "pdflatex -interaction=nonstopmode main.tex",
      { cwd: folder },
      (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      }
    );
  });
}

module.exports = { compileLatex };