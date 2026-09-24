
(function(){
const $=id=>document.getElementById(id);
const eur=n=>(n==null||isNaN(n))?'—':Math.round(n).toLocaleString('fr-FR')+' €';
const num=n=>Math.round(n).toLocaleString('fr-FR');
const PAYS={DE:'Allemagne',AT:'Autriche',BE:'Belgique',LU:'Luxembourg',NL:'Pays-Bas',IT:'Italie',ES:'Espagne',CH:'Suisse',JP:'Japon'};
const STATUTS=[['nouveau','Nouveau'],['a_contacter','À contacter'],['en_cours','Négociation'],['achete','Acheté'],['ecarte','Écarté']];
const CIBLE=5000;
let fx={CHF:1.0646,JPY:1/180.17,date:''};
let rows=[], journal=[], filt={pays:new Set(),marque:new Set(),seg:new Set(),prixmax:0,kmmax:0,pro:false,tva:false,go:true,fiable:false,hide:false,sort:'marge'};

function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,2200);}
function prixAff(o){return o.devise==='EUR'||!o.devise?eur(o.prix):num(o.prix)+(o.devise==='JPY'?' ¥':' CHF');}
function evalRow(o){const d={devise:'EUR',...DEFAUTS[o.pays]||DEFAUTS.DE,...o,fxCHF:fx.CHF,fxJPY:fx.JPY}; return calcul(d);}
function cls(m){return m>=CIBLE?'good':m>=0?'warn':'bad';}
function conf(o){if(o.verif==='manuelle')return['À vérifier','warn',0];const n=o.nb_comparables||0;return n>=6&&(o.dispersion==null||o.dispersion<=0.18)?['Estimation fiable · '+n+' comparables','good',2]:['Estimation moyenne · '+n+' comparables','neutral',1];}
function copy(t){try{navigator.clipboard.writeText(t).then(()=>toast('Copié : '+t),()=>toast(t));}catch(e){toast(t);}}

// ---------- Tabs ----------
document.querySelectorAll('nav.tabs button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
function openTools(t){const d=$('drawer');d.hidden=false;document.body.classList.add('noscroll');
  d.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  ['calc','rules'].forEach(p=>$('p-'+p).hidden=p!==t);d.querySelector('.drawer-in').scrollTop=0;try{localStorage.setItem('radar-tool',t)}catch(e){}}
function closeTools(){$('drawer').hidden=true;document.body.classList.remove('noscroll');}
function showTab(t){if(t==='opp'){closeTools();$('p-opp').hidden=false;return;}openTools(t);}
$('open-tools').addEventListener('click',()=>{let t='calc';try{t=localStorage.getItem('radar-tool')||'calc'}catch(e){}openTools(t);});
$('close-tools').addEventListener('click',closeTools);
$('drawer').addEventListener('click',e=>{if(e.target.id==='drawer')closeTools();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('drawer').hidden)closeTools();});

// ---------- Filters ----------
function closeDD(except){document.querySelectorAll('.ddp').forEach(p=>{if(p!==except){p.hidden=true;p.previousElementSibling.setAttribute('aria-expanded','false');}});}
document.querySelectorAll('.ddb').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const p=b.nextElementSibling;closeDD(p);p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden));const inp=p.querySelector('input[type=number]');if(!p.hidden&&inp)setTimeout(()=>inp.focus(),0);}));
document.addEventListener('click',e=>{if(!e.target.closest('.dd'))closeDD();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDD();});
function multi(key,elId,items,label){const p=$(elId);p.innerHTML='';
  items.forEach(([v,l])=>{const lb=document.createElement('label');lb.className='opt';const i=document.createElement('input');i.type='checkbox';i.value=v;i.checked=filt[key].has(v);
    i.addEventListener('change',()=>{i.checked?filt[key].add(v):filt[key].delete(v);updLabels();renderList();});lb.appendChild(i);lb.appendChild(document.createTextNode(' '+l));p.appendChild(lb);});
  const act=document.createElement('div');act.className='ddact';const c=document.createElement('button');c.type='button';c.className='btn ghost';c.textContent='Tout';
  c.addEventListener('click',()=>{filt[key].clear();p.querySelectorAll('input').forEach(i=>i.checked=false);updLabels();renderList();});act.appendChild(c);p.appendChild(act);}
function updLabels(){
  const lp=[...filt.pays].map(p=>PAYS[p]||p);$('lb-pays').textContent=lp.length?(lp.length===1?(innerWidth<480?[...filt.pays][0]:lp[0]):'Pays ('+lp.length+')'):'Pays';
  $('lb-seg').textContent=filt.seg.size?(filt.seg.size===1?[...filt.seg][0].replace('Premium familial','Premium'):'Segment ('+filt.seg.size+')'):'Segment';
  const lm=[...filt.marque];$('lb-marque').textContent=lm.length?(lm.length===1?lm[0]:'Marque ('+lm.length+')'):'Marque';
  $('lb-km').textContent=filt.kmmax?'≤ '+num(filt.kmmax/1000)+' 000 km':'Km max';
  $('lb-vend').textContent=filt.tva?'TVA récup.':filt.pro?'Pros':'Vendeur';
  [['marque',filt.marque.size>0],['km',!!filt.kmmax],['vend',filt.pro||filt.tva]].forEach(([k,on])=>document.querySelector('[data-dd="'+k+'"]').classList.toggle('on',on));
  $('lb-prix').textContent=filt.prixmax?'≤ '+(filt.prixmax>=1000?num(filt.prixmax/1000)+' k€':num(filt.prixmax)+' €'):'Prix max';
  document.querySelector('[data-dd="pays"]').classList.toggle('on',filt.pays.size>0);
  document.querySelector('[data-dd="seg"]').classList.toggle('on',filt.seg.size>0);
  document.querySelector('[data-dd="prix"]').classList.toggle('on',!!filt.prixmax);}
function applyNum(k){const v=Number($('f-'+k).value);filt[k]=v>0?v:0;updLabels();closeDD();renderList();}
document.querySelectorAll('[data-ok]').forEach(b=>b.addEventListener('click',()=>applyNum(b.dataset.ok)));
document.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',()=>{$('f-'+b.dataset.clear).value='';applyNum(b.dataset.clear);}));
['prixmax','kmmax'].forEach(k=>$('f-'+k).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyNum(k);}}));
[['f-pro','pro'],['f-tva','tva']].forEach(([id,k])=>$(id).addEventListener('change',e=>{filt[k]=e.target.checked;updLabels();renderList();}));
document.querySelectorAll('input[name="f-sort"]').forEach(r=>r.addEventListener('change',()=>{filt.sort=r.value;renderList();}));
[['f-go','go'],['f-fiable','fiable'],['f-hide','hide']].forEach(([id,k])=>$(id).addEventListener('change',e=>{filt[k]=e.target.checked;renderList();}));

// ---------- List ----------
function renderList(){
  const list=$('list');
  const ev=rows.map(o=>{const r=evalRow(o);return {o,r,roi:r.marge/r.coutRevient};});
  const good=ev.filter(x=>x.r.marge>=CIBLE).sort((a,b)=>b.r.marge-a.r.marge);
  const sorters={marge:(a,b)=>b.r.marge-a.r.marge,roi:(a,b)=>b.roi-a.roi,prix:(a,b)=>a.r.prixEUR-b.r.prixEUR,conf:(a,b)=>(conf(b.o)[2]-conf(a.o)[2])||(b.r.marge-a.r.marge)};
  const shown=ev.filter(x=>(!filt.pays.size||filt.pays.has(x.o.pays))&&(!filt.seg.size||filt.seg.has(x.o.segment))&&(!filt.prixmax||x.r.prixEUR<=filt.prixmax)&&(!filt.marque.size||filt.marque.has(x.o.marque))&&(!filt.kmmax||(x.o.km||0)<=filt.kmmax)&&(!filt.pro||x.o.vendeur_type!=='particulier')&&(!filt.tva||x.o.tva==='deductible')&&(!filt.go||x.r.marge>=CIBLE)&&(!filt.fiable||conf(x.o)[2]===2)&&(!filt.hide||x.o.statut!=='ecarte')).sort(sorters[filt.sort]);
  if(!rows.length){list.innerHTML='<div class="empty">Aucune opportunité pour l\'instant. La veille hebdomadaire les ajoutera ici.</div>';return;}
  if(!shown.length){list.innerHTML='<div class="empty">Aucune annonce ne correspond à ces filtres.</div>';return;}
  list.innerHTML='';
  shown.forEach(({o,r,roi})=>{
    const k=cls(r.marge); const [cl0,ck]=conf(o);const cl=cl0.replace('Estimation ','').replace(/ · (\d+) comparables/,' · $1 comp.'); const el=document.createElement('article'); el.className='opp '+k;
    el.innerHTML=`<div class="stripe"></div>${o.photo?'<a class="ph" target="_blank" rel="noopener"><img loading="lazy" decoding="async" alt="" referrerpolicy="no-referrer"></a>':''}<div class="in">
      <div><h3></h3><div class="tagrow"><span class="cc">${o.pays}</span><span class="pill ${ck}">${cl}</span><span class="t-sub"></span></div></div>
      <div class="margin"><small>Marge nette</small><b class="${k}-t">${eur(r.marge)}</b><small>${(roi*100).toFixed(0)} %</small></div>
      <div class="figs">
        <div>Prix<b>${prixAff(o)}</b></div>
        <div>TVA<b>${o.tva==='deductible'?'Récupérable':o.tva==='import'?'Import':'Marge'}</b></div>
        <div>Malus<b>${eur(r.malus.total)}</b></div>
        <div>Coût HT<b>${eur(r.coutRevient)}</b></div>
        <div>Revente FR<b>${eur(o.prixFR)}</b></div>
        <div>Achat max<b>${o.devise&&o.devise!=='EUR'?num(r.achatMaxAnnonce)+(o.devise==='JPY'?' ¥':' CHF'):eur(r.achatMaxAnnonce)}</b></div>
      </div>
      <div class="seller"></div>
      <details><summary>Comparables France</summary><div class="d-comp"></div><p class="d-notes"></p></details>
      <div class="actions"><a class="btn" target="_blank" rel="noopener">Voir l'annonce</a>
        <button class="btn ghost" type="button" data-a="calc">Recalculer</button>
        <label style="flex-direction:row;align-items:center;gap:6px">Mon statut <select data-a="statut" aria-label="Mon statut"></select></label></div>
    </div>`;
    const vv=o.variante||'';const mg=o.modele_groupe||'';el.querySelector('h3').textContent=`${o.marque} ${vv&&mg&&!vv.includes(mg)?mg+' '+vv:(vv||o.titre||o.modele||'')}`.trim();
    const sub=[o.variante&&o.titre?'« '+o.titre.slice(0,48)+' »':'',(o.immat||'').split('-').reverse().join('/'),num(o.km)+' km',o.ps?o.ps+' ch':'',o.ville?o.ville+' ('+(PAYS[o.pays]||o.pays)+')':PAYS[o.pays]].filter(Boolean);
    el.querySelector('.t-sub').textContent=sub.join(' · ');
    const sl=el.querySelector('.seller');
    const sv=document.createElement('span');sv.innerHTML='<b></b>';sv.querySelector('b').textContent=(o.vendeur||'—')+(o.vendeur_type==='particulier'?' (particulier)':'');sl.appendChild(sv);
    if(o.tel){const t=document.createElement('button');t.type='button';t.className='btn ghost';t.textContent=o.tel;t.title='Copier le numéro';t.addEventListener('click',()=>copy(o.tel));sl.appendChild(t);}
    
    const dc=el.querySelector('.d-comp');
    if(o.comparables_fr&&o.comparables_fr.length){const t=document.createElement('table');t.className='comps';
      o.comparables_fr.forEach(c=>{const tr=document.createElement('tr');const td0=document.createElement('td');const a=document.createElement('a');a.href=c.lien;a.target='_blank';a.rel='noopener';a.textContent=(c.titre||'Annonce')+(c.ville?' — '+c.ville:'');td0.appendChild(a);tr.appendChild(td0);
        [(c.immat||'').split('-').reverse().join('/'),num(c.km)+' km',eur(c.prix)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});t.appendChild(tr);});
      dc.appendChild(t);
      
    } else { dc.textContent='Comparables : '+(o.comparables||'—'); }
    el.querySelector('.d-notes').textContent=o.notes||'';
    if(o.risques&&o.risques.length){const w=document.createElement('div');w.className='risk';o.risques.forEach(x=>{const d=document.createElement('div');d.textContent='⚠ '+x;w.appendChild(d);});el.querySelector('.seller').after(w);}
    const ph=el.querySelector('.ph');if(ph){ph.href=o.lien||'#';const im=ph.querySelector('img');im.src=o.photo.replace(/\/\d+x\d+\.webp$/,'/720x540.webp');im.alt=(o.marque||'')+' '+(o.variante||'');im.onerror=()=>{ph.remove();el.classList.add('nophoto');};}
    const a=el.querySelector('a.btn'); if(o.lien) a.href=o.lien; else a.hidden=true;
    const s=el.querySelector('select'); STATUTS.forEach(([v,l])=>{const op=document.createElement('option');op.value=v;op.textContent=l;if((o.statut||'nouveau')===v)op.selected=true;s.appendChild(op);});
    s.addEventListener('change',()=>{o.statut=s.value;saveStatut(o.id,s.value);toast('Statut enregistré sur cet appareil');if(filt.hide)renderList();});
    el.querySelector('[data-a="calc"]').addEventListener('click',()=>{loadForm(o);openTools('calc');});
    list.appendChild(el);
  });
}
// ---------- Calculator ----------
const F=['pays','modele','prix','devise','tva','immat','km','co2','masse','energie','malusManuel','transport','agent','transit','douane','homologation','prep','admin','prixFR','cible','fxCHF','fxJPY'];
const NUMS=new Set(['prix','km','co2','masse','transport','agent','transit','douane','homologation','prep','admin','prixFR','cible','fxCHF','fxJPY']);
function readForm(){const o={};F.forEach(k=>{const v=$('c-'+k).value;o[k]=NUMS.has(k)?Number(v||0):v;});if(o.malusManuel==='')o.malusManuel=null;else o.malusManuel=Number(o.malusManuel);return o;}
function loadForm(o){const d={...DEFAUTS[o.pays],...o};F.forEach(k=>{if(k==='fxCHF'||k==='fxJPY'||k==='cible')return;const el=$('c-'+k);if(!el)return;
  if(k==='modele') el.value=`${o.marque||''} ${o.titre||o.modele||''}`.trim(); else el.value=d[k]==null?'':d[k];});
  if(o.tva==='import') $('c-tva').value='import'; calc();}
function setDefaults(){const p=$('c-pays').value,d=DEFAUTS[p];['transport','agent','transit','homologation','prep','admin','douane'].forEach(k=>$('c-'+k).value=d[k]);
  $('c-devise').value=p==='CH'?'CHF':p==='JP'?'JPY':'EUR'; if(p==='JP')$('c-tva').value='import'; else if($('c-tva').value==='import')$('c-tva').value='deductible'; calc();}
$('c-defaults').addEventListener('click',setDefaults);
$('c-pays').addEventListener('change',setDefaults);
$('form').addEventListener('input',calc);
$('form').addEventListener('submit',e=>e.preventDefault());
function calc(){
  const o=readForm(); if(!o.immat){return;} const r=calcul(o);
  const k=cls(r.marge,o.cible);
  $('r-marge').textContent=eur(r.marge); $('r-marge').className=k+'-t';
  $('r-verdict').textContent=k==='good'?`Au-dessus de la cible de ${eur(o.cible)}`:k==='warn'?`Sous la cible : il manque ${eur(o.cible-r.marge)}`:'Opération à perte';
  const m=r.malus;
  const rowsT=[
    ['Prix affiché converti',eur(r.prixEUR)],
    ['Prix d\'achat HT retenu',eur(r.achat)],
    ['Droits de douane',eur(r.douane)],
    ['Frais d\'import',eur(r.frais)],
    ['Malus'+(m.manuel?' (saisi)':` (décote ${m.decote} %, ${m.mois} mois)`),eur(m.total)],
    ...(!m.manuel&&m.brutPoids?[['sub','dont malus au poids',eur(m.poids)]]:[]),
    ['tot','Coût de revient HT',eur(r.coutRevient)],
    ['Revente TTC',eur(r.pv)],
    [r.regimeRevente==='MARGE'?'TVA sur la marge':'TVA 20 % sur la revente','− '+eur(r.tvaRevente)],
    ['tot','Marge nette',eur(r.marge)],
    ['Prix d\'achat max pour la cible',o.devise==='EUR'?eur(r.achatMaxAnnonce):num(r.achatMaxAnnonce)+(o.devise==='JPY'?' ¥':' CHF')],
    ['Prix de revente min pour la cible',eur(r.pvMin)]
  ];
  const t=$('r-table'); t.innerHTML='';
  rowsT.forEach(x=>{const tr=document.createElement('tr');let a=x;if(x[0]==='tot'||x[0]==='sub'){tr.className=x[0];a=x.slice(1);}
    a.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td);});t.appendChild(tr);});
  const al=[r.tvaNote,...(m.alerts||[])]; $('r-alerts').innerHTML=''; al.forEach(a=>{const d=document.createElement('div');d.textContent=a;$('r-alerts').appendChild(d);});
}
calc();

// ---------- Données intégrées (mises à jour chaque semaine) ----------
function loadStatuts(){try{return JSON.parse(localStorage.getItem('radar-statuts')||'{}')}catch(e){return {}}}
function saveStatut(id,v){const s=loadStatuts();s[id]=v;try{localStorage.setItem('radar-statuts',JSON.stringify(s))}catch(e){}}
function init(D){
try{
  if(D.taux&&D.taux.CHF&&D.taux.JPY){fx={CHF:D.taux.CHF,JPY:D.taux.JPY,date:D.taux.date};
    $('m-fx').textContent=`1 CHF = ${D.taux.CHF.toLocaleString('fr-FR',{maximumFractionDigits:4})} € · 1 € = ${(1/D.taux.JPY).toLocaleString('fr-FR',{maximumFractionDigits:2})} ¥`;
    $('c-fxCHF').value=D.taux.CHF; $('c-fxJPY').value=D.taux.JPY.toFixed(6);}
  if(D.maj) $('m-scan').textContent='Scan du '+new Date(D.maj+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  journal=D.journal||[];
  const st=loadStatuts();
  rows=(D.opportunites||[]).map(o=>({...o,statut:st[o.id]||o.statut||'nouveau'}));
  const cov=$('cov'); if(cov&&journal.length){cov.innerHTML='<tr><th style="text-align:left">Recherche</th><th>Annonces UE</th><th>Lues</th><th>Annonces FR</th><th>Lues</th></tr>';
    journal.forEach(j=>{const tr=document.createElement('tr');[j.recherche,j.annonces_ue??'—',j.lues_ue,j.annonces_fr??'—',j.lues_fr].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(!i)td.style.textAlign='left';tr.appendChild(td);});cov.appendChild(tr);});}
}catch(e){rows=[];}
const paysPresents=[...new Set(rows.map(o=>o.pays))];
multi('pays','dd-pays',paysPresents.map(p=>[p,PAYS[p]||p]));
const marques=[...new Set(rows.map(o=>o.marque).filter(Boolean))].sort();multi('marque','dd-marque',marques.map(m=>[m,m]));
const segs=[...new Set(rows.map(o=>o.segment).filter(Boolean))];
multi('seg','dd-seg',segs.map(s=>[s,s]));updLabels();
renderList(); calc();
}
const inline=document.getElementById('radar-data');
if(inline){init(JSON.parse(inline.textContent));}
else{fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}).then(init).catch(()=>{$('list').innerHTML='<div class="empty">Données indisponibles pour le moment. Vérifiez la connexion puis rechargez la page.</div>';calc();});}
if('serviceWorker' in navigator&&location.protocol==='https:'&&!inline){navigator.serviceWorker.register('sw.js').catch(()=>{});}
})();

// ---------- Relance de la recherche ----------
(function(){
const $=id=>document.getElementById(id);
const btn=$('btn-scan'), st=$('scan-state'); if(!btn) return;
const RUN=['queued','in_progress','waiting','requested','pending'];
const since=d=>{const m=Math.round((Date.now()-new Date(d))/60000);return m<1?"à l'instant":m<60?'il y a '+m+' min':'il y a '+Math.round(m/60)+' h';};
let timer=null, lastSeen=null;
function busy(on,msg){btn.disabled=on;btn.classList.toggle('spin',on);btn.querySelector('span').textContent=on?'Recherche en cours…':'Relancer la recherche';if(msg!=null)st.textContent=msg;}
async function status(){
  try{const r=await fetch('api/scan',{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw 0;const d=await r.json();
    if(!d.configured){st.textContent='';return null;}
    if(d.run&&RUN.includes(d.run.status)){busy(true,'Lancée '+since(d.run.started)+' · environ 20 minutes · tu peux fermer la page');poll();}
    else{busy(false,d.run&&d.run.conclusion==='success'?'Dernière recherche terminée '+since(d.run.updated):d.run&&d.run.conclusion?'La dernière recherche a échoué. Relance-la.':'');
      if(lastSeen&&d.run&&d.run.conclusion==='success'&&lastSeen!==d.run.id){st.textContent='Nouvelles affaires disponibles : la page se recharge…';setTimeout(()=>location.reload(),1500);}}
    if(d.run)lastSeen=lastSeen||d.run.id;
    return d;}catch(e){return null;}
}
function poll(){clearTimeout(timer);timer=setTimeout(status,30000);}
btn.addEventListener('click',async()=>{
  busy(true,'Démarrage…');
  try{const r=await fetch('api/scan',{method:'POST',credentials:'same-origin'});const d=await r.json().catch(()=>({}));
    if(d.configured===false){busy(false,'La relance à la demande sera active dès que le moteur de recherche en ligne sera branché.');return;}
    if(!r.ok||!d.ok){busy(false,"Impossible de lancer la recherche pour l'instant. Réessaie dans quelques minutes.");return;}
    lastSeen=d.previous||lastSeen;
    busy(true,d.already?'Une recherche est déjà en cours · environ 20 minutes':'C’est parti · environ 20 minutes · tu peux fermer la page');poll();
  }catch(e){busy(false,'Pas de connexion. Réessaie quand tu as du réseau.');}
});
status();
})();
