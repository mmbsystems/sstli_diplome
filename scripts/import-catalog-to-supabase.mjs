// Default is read-only/offline plan. --execute requires an explicit transport.
// --mcp-request stages the verified transaction for the Supabase execute_sql tool;
// without that option, use SUPABASE_ACCESS_TOKEN from a secret manager in memory.
import { writeFileSync } from 'node:fs';
import { runImport } from './catalog-execution-lib.mjs';
const args=process.argv.slice(2);
try {
  const allowed=new Set(['--execute','--project-ref','--mcp-request']);
  for(let i=0;i<args.length;i++){if(!allowed.has(args[i])) throw new Error('Unknown argument'); if(args[i]!=='--execute' && (!args[++i]||args[i].startsWith('--'))) throw new Error('Missing argument value');}
  const project=args.includes('--project-ref')?args[args.indexOf('--project-ref')+1]:undefined;
  const path=args.includes('--mcp-request')?args[args.indexOf('--mcp-request')+1]:undefined;
  const result=await runImport({project,execute:args.includes('--execute'),transport:async request=>{
    if(path){writeFileSync(path,JSON.stringify(request),{flag:'wx'});return {mode:'staged for MCP; not executed yet',project:request.project_id};}
    const token=process.env.SUPABASE_ACCESS_TOKEN;
    if(!token) throw new Error('Missing management transport credential');
    const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({query:request.query}),signal:AbortSignal.timeout(75000)});
    if(!response.ok) throw new Error(`Import transport failed (${response.status}); inspect target before retry`);
    return await response.json();
  }});
  console.log(JSON.stringify(result,null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
