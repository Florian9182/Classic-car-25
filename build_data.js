// node build_data.js scan.json sortie.json [manuel.json]
const fs=require('fs'); const e=require('./engine.js');
const scan=JSON.parse(fs.readFileSync(process.argv[2]));
const manuel=process.argv[4]&&fs.existsSync(process.argv[4])?JSON.parse(fs.readFileSync(process.argv[4])):[];
const taux={CHF:1/0.9393,JPY:1/180.17,date:'2026-09-22',source:'BCE'};
const ref=new Date(scan.date+'T12:00');
const out=[];
for(const a of scan.annonces){
  const o={id:'as24-'+a.as24_id,devise:'EUR',...a,date_scan:scan.date};
  const r=e.calcul({...e.DEFAUTS[o.pays]||e.DEFAUTS.DE,...o},ref);
  o._marge=Math.round(r.marge); out.push(o);
}
out.sort((x,y)=>y._marge-x._marge);
const keep=out.filter(o=>o._marge>=1000).slice(0,120).map(({_marge,...o})=>o);
const data={maj:scan.date,taux,journal:scan.journal,opportunites:[...keep,...manuel]};
fs.writeFileSync(process.argv[3],JSON.stringify(data).replace(/</g,'\\u003c'));
console.log('annonces analysées',out.length,'gardées',keep.length,'≥5k',out.filter(o=>o._marge>=5000).length);
out.slice(0,15).forEach(o=>console.log(o._marge,o.pays,o.marque,o.variante,o.immat,o.km,o.prix,o.tva,'FR',o.prixFR,o.nb_comparables));
