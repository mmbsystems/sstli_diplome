import {readFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join} from 'node:path';
process.loadEnvFile('.env.local');
// Read sensitive values only in memory; never print them or account records.
const accounts=JSON.parse(readFileSync('config/admins.json','utf8'));
const forbidden=['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY',process.env.SUPABASE_SECRET_KEY,process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.AUTH_SECRET,process.env.JWT_SECRET,...accounts.map(account=>account.passwordHash)].filter(value=>typeof value==='string'&&value.length>0);
let count=0;
function scan(dir,generatedOnly=false){
 if(!existsSync(dir))return;
 for(const name of readdirSync(dir)){
  const path=join(dir,name);
  if(statSync(path).isDirectory()){scan(path,generatedOnly);continue;}
  if(generatedOnly&&!/\.(html|rsc|body|meta)$/.test(name))continue;
  const text=readFileSync(path,'utf8');count++;
  if(forbidden.some(secret=>text.includes(secret)))throw new Error('Client secret detected in '+path);
  for(const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]){
   let payload;try{payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{continue;}
   if(payload.role==='service_role')throw new Error('Privileged JWT in '+path);
  }
 }
}
scan('.next/static');scan('public');scan('out');scan('.next/server/app',true);
console.log(JSON.stringify({filesScanned:count,secretHits:0}));
