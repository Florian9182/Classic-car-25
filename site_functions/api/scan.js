// Pages Function : relance la recherche via GitHub Actions (workflow scan.yml).
// Variables Cloudflare Pages : GH_TOKEN (secret), GH_REPO ("compte/depot").
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function onRequest({request,env}){
  if(!env.GH_TOKEN) return J({configured:false});
  const h={Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json','User-Agent':'radar-cc25','X-GitHub-Api-Version':'2022-11-28'};
  let repo=env.GH_REPO;
  if(!repo){const u=await fetch('https://api.github.com/user',{headers:h});if(!u.ok)return J({configured:false,error:'github_user'});repo=(await u.json()).login+'/radar-cc25';}
  const base='https://api.github.com/repos/'+repo+'/actions/workflows/scan.yml';
  const probe=await fetch(base,{headers:h});if(probe.status===404)return J({configured:false,error:'workflow_absent'});
  const last=async()=>{const r=await fetch(base+'/runs?per_page=1',{headers:h});if(!r.ok)return null;const d=await r.json();const x=(d.workflow_runs||[])[0];
    return x?{id:x.id,status:x.status,conclusion:x.conclusion,started:x.run_started_at||x.created_at,updated:x.updated_at}:null;};
  if(request.method==='POST'){
    const run=await last();
    if(run&&['queued','in_progress','waiting','requested','pending'].includes(run.status)) return J({configured:true,ok:true,already:true,run});
    const r=await fetch(base+'/dispatches',{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify({ref:'main'})});
    return J({configured:true,ok:r.status===204,previous:run&&run.id},r.status===204?200:502);
  }
  return J({configured:true,run:await last()});
}
