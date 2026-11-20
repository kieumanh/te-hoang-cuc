import {api} from './server.js';
import assets from '../dist/assets.json';
export default {async fetch(req,env){const p=new URL(req.url).pathname;if(p.startsWith('/api/'))return api(req,env);const asset=Object.hasOwn(assets,p==='/'?'/index.html':p)?assets[p==='/'?'/index.html':p]:null;
if(!asset)return new Response('Không tìm thấy',{status:404});if(!['GET','HEAD'].includes(req.method))return new Response(null,{status:405});
return new Response(req.method==='HEAD'?null:Uint8Array.from(atob(asset[0]),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset[1], 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}})}};
