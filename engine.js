// ===== Moteur de calcul Radar Import CC25 =====
const S=[50,75,100,125,150,170,190,210,230,240,260,280,310,330,360,400,450,540,650,740,818,898,983,1074,1172,1276,1386,1504,1629,1761,1901,2049,2205,2370,2544,2726,2918,3119,3331,3552,3784,4026,4279,4543,4818,5105,5404,5715,6039,6375,6724,7086,7462,7851,8254,8671,9103,9550,10011,10488,10980,11488,12012,12552,13109,13682,14273,14881,15506,16149,16810,17490,18188,18905,19641,20396,21171,21966,22781,23616,24472,25349,26247,27166,28107,29070,30056,31063,32094,33147,34224,35324,36447,37595,38767,39964,41185,42431,43703,45000,46323,47672,49047,50000];
const T=(()=>{const t=S.slice(0,48);let v=5715,inc=411;while(t.length<86){v+=inc;t.push(v);if(inc<3111)inc+=100;}return t;})();
const B2019=[35,40,45,50,55,60,65,70,75,80,85,90,113,140,173,210,253,300,353,410,473,540,613,690,773,860,953,1050,1101,1153,1260,1373,1490,1613,1740,1873,2010,2153,2300,2453,2610,2773,2940,3113,3290,3473,3660,3756,3853,4050,4253,4460,4673,4890,5113,5340,5573,5810,6053,6300,6553,6810,7073,7340,7613,7890,8173,8460,8753,9050,9353,9660,9973,10290];
const B2018=[50,53,60,73,90,113,140,173,210,253,300,353,410,473,540,613,690,773,860,953,1050,1153,1260,1373,1490,1613,1740,1873,2010,2153,2300,2453,2610,2773,2940,3113,3290,3473,3660,3853,4050,4253,4460,4673,4890,5113,5340,5573,5810,6053,6300,6553,6810,7073,7340,7613,7890,8173,8460,8753,9050,9353,9660,9973,10290];
// barèmes : start = 1er g taxé, seq, cap, capFrom (g à partir duquel plafond), norme
const BAREMES={
 2026:{start:108,seq:T,cap:80000,capFrom:192,norme:'WLTP'},
 2025:{start:113,seq:T,cap:70000,capFrom:193,norme:'WLTP'},
 2024:{start:118,seq:T,cap:60000,capFrom:194,norme:'WLTP'},
 2023:{start:123,seq:S,cap:50000,capFrom:226,norme:'WLTP'},
 2022:{start:128,seq:S,cap:40000,capFrom:224,norme:'WLTP'},
 2021:{start:133,seq:S,cap:30000,capFrom:219,norme:'WLTP'},
 2020:{start:138,seq:S,cap:20000,capFrom:213,norme:'WLTP'},
 2019:{start:117,seq:B2019,cap:10500,capFrom:191,norme:'NEDC'},
 2018:{start:120,seq:B2018,cap:10500,capFrom:185,norme:'NEDC'},
 2017:{start:127,seq:B2018,cap:10000,capFrom:191,norme:'NEDC',approx:true},
 2016:{start:131,seq:B2018,cap:8000,capFrom:201,norme:'NEDC',approx:true},
 2015:{start:131,seq:B2018,cap:8000,capFrom:201,norme:'NEDC',approx:true}
};
const DECOTE=[[3,3],[6,6],[9,9],[12,12],[18,16],[24,20],[36,28],[48,33],[60,38],[72,43],[84,48],[96,53],[108,58],[120,64],[132,70],[144,76],[156,82],[168,88],[180,94]];
function moisEcoules(immat,ref){ // immat "YYYY-MM"
  const [y,m]=immat.split('-').map(Number); const r=ref||new Date();
  let n=(r.getFullYear()-y)*12+(r.getMonth()+1-m); return Math.max(0,n);
}
function decotePct(mois){ if(mois>=181) return 100; if(mois<1) return 0; for(const [max,p] of DECOTE){ if(mois<=max) return p; } return 100; }
function maluscCO2Brut(annee,g){
  const b=BAREMES[annee]; if(!b) return {montant:0,note:annee<2015?'Avant 2015 : pas de malus':'Barème inconnu'};
  if(g<b.start) return {montant:0,b};
  if(g>=b.capFrom) return {montant:b.cap,b};
  const v=b.seq[g-b.start]; return {montant:Math.min(v==null?b.cap:v,b.cap),b};
}
function malusPoidsBrut(annee,masse,energie){
  if(annee<2022||energie==='EV') return 0;
  if(annee<=2023){ if(energie==='PHEV') return 0; return Math.max(0,masse-1800)*10; }
  let m=masse-(energie==='PHEV'?200:energie==='HEV'?100:0);
  const seuil=annee>=2026?1500:1600;
  const tr=annee>=2026?[[1500,10],[1700,15],[1800,20],[1900,25],[2000,30]]:[[1600,10],[1800,15],[1900,20],[2000,25],[2100,30]];
  if(m<=seuil) return 0; let tot=0;
  for(let i=0;i<tr.length;i++){const lo=tr[i][0],hi=i+1<tr.length?tr[i+1][0]:1e9; if(m>lo) tot+=(Math.min(m,hi)-lo)*tr[i][1];}
  return tot;
}
function calculMalus(o,ref){
  const annee=Number(o.immat.split('-')[0]); const mois=moisEcoules(o.immat,ref); const d=decotePct(mois);
  const alerts=[];
  if(o.energie==='EV') return {total:0,co2:0,poids:0,mois,decote:d,annee,alerts:['Électrique : exonéré']};
  if(annee<2015||mois>=181) return {total:0,co2:0,poids:0,mois,decote:100,annee,alerts:['Plus de 15 ans ou avant 2015 : pas de malus']};
  const c=maluscCO2Brut(annee,Math.round(o.co2||0)); const b=c.b||BAREMES[annee];
  if(b&&b.approx) alerts.push('Barème '+annee+' estimé (plafond '+b.cap.toLocaleString('fr-FR')+' €) : faire confirmer');
  if(annee===2020&&Number(o.immat.split('-')[1])<3) alerts.push('Immat. janv.–févr. 2020 : barème NEDC, faire confirmer');
  if(b) alerts.push('Barème '+annee+' ('+b.norme+')');
  const p=malusPoidsBrut(annee,o.masse||0,o.energie);
  const brut=Math.min(c.montant+p,b?b.cap:80000);
  const total=Math.round(brut*(100-d)/100);
  return {total,co2:Math.round(c.montant*(100-d)/100),poids:Math.round(p*(100-d)/100),brutCO2:c.montant,brutPoids:p,mois,decote:d,annee,alerts};
}
const TVA_UE={DE:19,AT:20,BE:21,IT:22,ES:21,LU:17,NL:21,PT:23,PL:23,CZ:21,SE:25,DK:25};
const UE=Object.keys(TVA_UE);
const DEFAUTS={
 DE:{transport:900,agent:0,transit:0,homologation:150,prep:800,admin:300,douane:0},
 AT:{transport:1100,agent:0,transit:0,homologation:150,prep:800,admin:300,douane:0},
 BE:{transport:900,agent:0,transit:0,homologation:150,prep:800,admin:300,douane:0},
 LU:{transport:700,agent:0,transit:0,homologation:150,prep:800,admin:300,douane:0},
 NL:{transport:1000,agent:0,transit:0,homologation:150,prep:800,admin:300,douane:0},
 IT:{transport:1300,agent:0,transit:0,homologation:200,prep:800,admin:300,douane:0},
 ES:{transport:1600,agent:0,transit:0,homologation:200,prep:800,admin:300,douane:0},
 CH:{transport:400,agent:0,transit:350,homologation:300,prep:800,admin:300,douane:0},
 JP:{transport:2500,agent:1500,transit:1300,homologation:3500,prep:1000,admin:300,douane:10}
};
function calcul(o,ref){
  const fx=o.devise==='CHF'?(o.fxCHF||1.0646):o.devise==='JPY'?(o.fxJPY||1/180.17):1;
  const prixEUR=o.prix*fx;
  let achat, regimeRevente='TVA', tvaNote='';
  if(UE.includes(o.pays)){
    const t=TVA_UE[o.pays];
    if(o.tva==='deductible'){achat=prixEUR/(1+t/100); tvaNote='TVA '+o.pays+' '+t+' % récupérée (livraison intracommunautaire HT)';}
    else {achat=prixEUR; regimeRevente='MARGE'; tvaNote='Régime de la marge : TVA 20 % due sur la marge seulement';}
  } else if(o.pays==='CH'){
    achat=o.tva==='deductible'?prixEUR/1.081:prixEUR; tvaNote=o.tva==='deductible'?'TVA suisse 8,1 % déduite à l\'export ; TVA import 20 % récupérable':'TVA import 20 % récupérable';
  } else { achat=prixEUR; tvaNote='TVA import 20 % récupérable (neutre)'; }
  const c={transport:o.transport||0,agent:o.agent||0,transit:o.transit||0,homologation:o.homologation||0,prep:o.prep||0,admin:o.admin||0};
  let douane=0;
  if(!UE.includes(o.pays)){ const base=achat+c.agent+(o.pays==='JP'?c.transport:c.transport*0.5); douane=base*(o.douane||0)/100; }
  const m=o.malusManuel!=null&&o.malusManuel!==''?{total:Number(o.malusManuel),manuel:true,alerts:['Malus saisi manuellement']}:calculMalus(o,ref);
  const frais=c.transport+c.agent+c.transit+c.homologation+c.prep+c.admin;
  const coutRevient=achat+douane+frais+m.total;
  const pv=o.prixFR||0; let caNet,tvaRevente;
  if(regimeRevente==='MARGE'){ tvaRevente=Math.max(0,pv-achat)*0.2/1.2; caNet=pv-tvaRevente; }
  else { tvaRevente=pv-pv/1.2; caNet=pv/1.2; }
  const marge=caNet-coutRevient;
  const cible=o.cible||5000;
  const coutHorsAchat=douane+frais+m.total;
  const pvMin=regimeRevente==='MARGE'?(6*(achat+coutHorsAchat+cible)-achat)/5:1.2*(coutRevient+cible);
  // prix d'achat max (devise de l'annonce) pour tenir la marge cible
  const r=(o.douane||0)/100, fraisMalus=frais+m.total;
  let achatMaxEUR;
  if(regimeRevente==='MARGE') achatMaxEUR=(pv*5/6-fraisMalus-cible)*6/5;
  else { const douaneFixe=o.pays==='JP'?r*(c.agent+c.transport):o.pays==='CH'?r*(c.agent+c.transport*0.5):0;
         achatMaxEUR=(caNet-fraisMalus-douaneFixe-cible)/(1+(UE.includes(o.pays)?0:r)); }
  let achatMaxAnnonce=achatMaxEUR;
  if(o.tva==='deductible'&&UE.includes(o.pays)) achatMaxAnnonce*=1+TVA_UE[o.pays]/100;
  if(o.tva==='deductible'&&o.pays==='CH') achatMaxAnnonce*=1.081;
  achatMaxAnnonce/=fx;
  return {fx,prixEUR,achat,douane,frais,c,malus:m,coutRevient,pv,caNet,tvaRevente,regimeRevente,tvaNote,marge,pvMin,achatMaxAnnonce,cible};
}
if(typeof module!=='undefined') module.exports={TVA_UE,UE,calcul,calculMalus,BAREMES,T,S,DEFAUTS,decotePct,moisEcoules};
