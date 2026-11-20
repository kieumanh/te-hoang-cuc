import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {api} from '../src/server.js';
test('registration, approval cap, session, recovery, result validation and logout',async()=>{
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('schema.sql','utf8'));
const DB={prepare(q){const stmt=sql.prepare(q);function bound(params){return {bind:(...p)=>bound(p),first:async()=>stmt.get(...params)??null,all:async()=>({results:stmt.all(...params)}),run:async()=>({meta:{changes:stmt.run(...params).changes}})}}return bound([])},batch:async arr=>Promise.all(arr.map(q=>q.run()))};
const origin='https://test.invalid';
async function call(path,data,cookie){const r=await api(new Request(origin+'/api/'+path,{method:data?'POST':'GET',headers:{origin,cookie:cookie||''},...(data?{body:JSON.stringify(data)}:{})}),{DB});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const credentials={email:'admin@example.test',password:'testing-password'};
const registered=await call('register',credentials);assert.ok(registered.data.code);
assert.equal((await call('login',credentials)).status,403);
sql.exec("UPDATE users SET role='admin',status='active'");
const {cookie}=await call('login',credentials);assert.ok(cookie);assert.equal((await call('me',null,cookie)).data.user.role,'admin');
assert.equal((await call('members')).status,401);
for(let i=0;i<5;i++){const email='member'+i+'@example.test';await call('register',{...credentials,email});const id=sql.prepare('SELECT id FROM users WHERE email=?').get(email).id;assert.equal((await call('members',{id,action:'approve'},cookie)).status,i===4?400:200)}
assert.equal((await call('mentor',null,cookie)).data.enabled,false);
const event={type:'match',id:'duo-1',game:'go',w:9,moves:[{t:40}],mode:'duo',rival:0,level:0,result:1,resign:true};assert.equal((await call('activity',{event},cookie)).status,200);await call('activity',{event},cookie);assert.equal((await call('activity',null,cookie)).data.events.length,1);
assert.equal((await call('activity',{event:{...event,id:'bad-result',result:-1}},cookie)).status,400);
assert.equal((await call('activity',{event:{id:'exam-0',type:'exam',level:0,answer:0,cell:1}},cookie)).status,400);
const recovered=await call('recover',{...credentials,password:'a-new-password',code:registered.data.code});assert.ok(recovered.data.code);assert.equal((await call('me',null,cookie)).data.user,null);assert.equal((await call('recover',{...credentials,code:registered.data.code})).status,400);
const fresh=await call('login',{...credentials,password:'a-new-password'});assert.ok(fresh.cookie);await call('logout',{},fresh.cookie);assert.equal((await call('me',null,fresh.cookie)).data.user,null)
});
