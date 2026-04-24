console.log("JS LOADED");
const listEl = document.getElementById('document-list');
const viewer = document.getElementById('pdf-viewer');
const selM = document.getElementById('matiere');
const selN = document.getElementById('niveau');
const selT = document.getElementById('type');

function unique(arr){ return [...new Set(arr)]; }

function fillSelect(sel, values){
  sel.innerHTML = '<option value="">Tous</option>' + values.map(v=>`<option value="${v}">${v}</option>`).join('');
}

function render(){
  const m = selM.value, n = selN.value, t = selT.value;
  const filtered = docs.filter(d => (!m || d.matiere===m) && (!n || d.niveau===n) && (!t || d.type===t));
  listEl.innerHTML = filtered.map((d,i)=>`<li data-i="${i}" class="item">${d.titre}</li>`).join('');
  document.querySelectorAll('.item').forEach(li=>{
    li.onclick = ()=>{
      const d = filtered[li.dataset.i];
      viewer.src = encodeURI('/'+d.fichier);
    };
  });
}

function init(){
  fillSelect(selM, unique(docs.map(d=>d.matiere)));
  fillSelect(selN, unique(docs.map(d=>d.niveau)));
  fillSelect(selT, unique(docs.map(d=>d.type)));
  selM.onchange = selN.onchange = selT.onchange = render;
  render();
}

init();
