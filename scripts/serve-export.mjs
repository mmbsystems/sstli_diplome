import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Serve the exported site locally at the same repository path as GitHub Pages.
const root=fileURLToPath(new URL('../out/',import.meta.url));
const base='/sstli_diplome';
const port=Number(process.env.PORT||3000);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
await stat(path.join(root,'index.html')).catch(()=>{throw new Error('Run npm run build before npm start.')});
createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'||url.pathname===base){res.writeHead(302,{Location:`${base}/${url.search}`});res.end();return}
  if(!url.pathname.startsWith(`${base}/`)){res.writeHead(404);res.end('Not found');return}
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(base.length+1)));
  if(file!==path.resolve(root)&&!file.startsWith(root)){res.writeHead(403);res.end();return}
  const info=await stat(file);
  if(info.isDirectory()&&!url.pathname.endsWith('/')){res.writeHead(301,{Location:`${url.pathname}/${url.search}`});res.end();return}
  const target=info.isDirectory()?path.join(file,'index.html'):file;
  const body=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});
  res.end(req.method==='HEAD'?undefined:body);
 } catch {
  res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
  res.end(await readFile(path.join(root,'404.html')).catch(()=>Buffer.from('Not found')));
 }
}).listen(port,'127.0.0.1',()=>console.log(`Static export: http://localhost:${port}${base}/`));
