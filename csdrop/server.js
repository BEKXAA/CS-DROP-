// CS DROP server — faqat Node.js 22+ kerak, hech narsa o'rnatish shart emas
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {DatabaseSync}=require('node:sqlite');
const PORT=process.env.PORT||3000;
const ADMIN_LOGIN='admin123',ADMIN_PASS='admin123'; // xohlasangiz o'zgartiring
const db=new DatabaseSync(path.join(__dirname,'csdrop.db'));
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,name TEXT,salt TEXT,hash TEXT,bio TEXT DEFAULT '',avatar TEXT DEFAULT '',coins INTEGER DEFAULT 0,created INTEGER);
CREATE TABLE IF NOT EXISTS inv(id INTEGER PRIMARY KEY,uid INTEGER,item TEXT);
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY,uid INTEGER,text TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS sess(token TEXT PRIMARY KEY,uid INTEGER,admin INTEGER DEFAULT 0);`);
const ITEMS=[
{id:'ak',n:'AK-47 | Redline',g:'CS2',t:'gun',c:'#d6322b',r:2},{id:'awp',n:'AWP | Asiimov',g:'CS2',t:'gun',c:'#f2f2f2',r:3},
{id:'m4',n:'M4A4 | Howl',g:'CS2',t:'gun',c:'#ff7a2a',r:3},{id:'dg',n:'Desert Eagle | Blaze',g:'CS2',t:'gun',c:'#ff9d00',r:2},
{id:'gl',n:'Glock-18 | Fade',g:'CS2',t:'gun',c:'#c86bff',r:1},{id:'usp',n:'USP-S | Neo-Noir',g:'CS2',t:'gun',c:'#3a3f66',r:1},
{id:'kar',n:'Karambit | Fade',g:'CS2',t:'knife',c:'#ff6b9a',r:4},{id:'bfk',n:'Butterfly | Doppler',g:'CS2',t:'knife',c:'#35c8ff',r:4},
{id:'akr',n:'AKR | Dragon',g:'Standoff 2',t:'gun',c:'#2fbf71',r:2},{id:'m40',n:'M40 | Fury',g:'Standoff 2',t:'gun',c:'#e0443e',r:2},
{id:'fp',n:'FP-6 | Neon',g:'Standoff 2',t:'gun',c:'#3df5ff',r:1},{id:'tec',n:'TEC-9 | Rust',g:'Standoff 2',t:'gun',c:'#9a6a3a',r:0},
{id:'kun',n:'Kunai | Gold',g:'Standoff 2',t:'knife',c:'#ffc933',r:4},{id:'ka',n:'Karambit | Ice',g:'Standoff 2',t:'knife',c:'#8fe4ff',r:3},
{id:'c1',n:'100 Coin',g:'Coin',t:'coin',c:'#ffc933',r:0,v:100},{id:'c2',n:'500 Coin',g:'Coin',t:'coin',c:'#ffb300',r:2,v:500},{id:'c3',n:'2000 Coin',g:'Coin',t:'coin',c:'#ff8a00',r:4,v:2000}];
const CASES=[
{id:'k1',n:'CS2 Case',g:'CS2',p:100,c:'#2f6bff',it:['ak','awp','m4','dg','gl','usp','kar','bfk','c1']},
{id:'k2',n:'Standoff 2 Case',g:'Standoff 2',p:100,c:'#2fbf71',it:['akr','m40','fp','tec','kun','ka','c1']},
{id:'k3',n:'Gold Case',g:'CS2',p:300,c:'#ffb300',it:['kar','bfk','kun','m4','awp','c2','c3','ka']}];
const W=[50,28,14,6,2],SELL=[5,15,40,120,300],IM=Object.fromEntries(ITEMS.map(i=>[i.id,i]));
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const q=(s,...a)=>db.prepare(s).all(...a), one=(s,...a)=>db.prepare(s).get(...a), run=(s,...a)=>db.prepare(s).run(...a);
function body(req){return new Promise((ok,no)=>{let b='';req.on('data',d=>{b+=d;if(b.length>2e6){no();req.destroy()}});req.on('end',()=>{try{ok(JSON.parse(b||'{}'))}catch{ok({})}})})}
function who(req){const m=/t=([a-f0-9]+)/.exec(req.headers.cookie||'');return m&&one('SELECT * FROM sess WHERE token=?',m[1])}
function newSess(res,uid,admin){const t=crypto.randomBytes(24).toString('hex');run('INSERT INTO sess(token,uid,admin) VALUES(?,?,?)',t,uid,admin?1:0);res.setHeader('Set-Cookie',`t=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`)}
const pub=u=>({id:u.id,email:u.email,name:u.name,bio:u.bio,avatar:u.avatar,coins:u.coins});
function me(uid){const u=one('SELECT * FROM users WHERE id=?',uid);return{...pub(u),inv:q('SELECT id,item FROM inv WHERE uid=? ORDER BY id DESC',uid),msgs:q('SELECT text,created FROM msgs WHERE uid=? ORDER BY id DESC',uid)}}
const routes={
async 'POST /api/signup'(req,res,b){
 const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim().slice(0,30),pw=String(b.password||'');
 if(!/^\S+@\S+\.\S+$/.test(email))throw'Email noto\'g\'ri';if(pw.length<6)throw'Parol kamida 6 belgi';if(!name)throw'Ism kiriting';
 if(one('SELECT id FROM users WHERE email=?',email))throw'Bu email band';
 const salt=crypto.randomBytes(16).toString('hex');
 const r=run('INSERT INTO users(email,name,salt,hash,created) VALUES(?,?,?,?,?)',email,name,salt,hash(pw,salt),Date.now());
 newSess(res,Number(r.lastInsertRowid));return{ok:1}},
async 'POST /api/login'(req,res,b){
 const u=one('SELECT * FROM users WHERE email=?',String(b.email||'').trim().toLowerCase());
 if(!u||hash(String(b.password||''),u.salt)!==u.hash)throw'Email yoki parol xato';newSess(res,u.id);return{ok:1}},
async 'POST /api/admin-login'(req,res,b){if(b.login!==ADMIN_LOGIN||b.password!==ADMIN_PASS)throw'Login yoki parol xato';newSess(res,0,1);return{ok:1}},
async 'POST /api/logout'(req,res){const s=who(req);if(s)run('DELETE FROM sess WHERE token=?',/t=([a-f0-9]+)/.exec(req.headers.cookie)[1]);return{ok:1}},
async 'GET /api/catalog'(){return{items:ITEMS,cases:CASES,sell:SELL}},
async 'GET /api/me'(req){const s=who(req);if(!s)return{user:null};return s.admin?{admin:1}:{user:me(s.uid)}},
async 'POST /api/profile'(req,res,b,s){
 const av=String(b.avatar||'');if(av&&!/^data:image\/(png|jpe?g|webp);base64,/.test(av))throw'Rasm formati xato';if(av.length>600000)throw'Rasm katta';
 run('UPDATE users SET name=?,bio=?,avatar=? WHERE id=?',String(b.name||'').trim().slice(0,30)||'User',String(b.bio||'').slice(0,300),av,s.uid);return me(s.uid)},
async 'POST /api/open'(req,res,b,s){
 const k=CASES.find(c=>c.id===b.caseId);if(!k)throw'Keys topilmadi';const u=one('SELECT * FROM users WHERE id=?',s.uid);
 if(u.coins<k.p)throw'Coin yetmaydi. Admin bilan bog\'laning';
 const pool=k.it.map(i=>IM[i]);let x=Math.random()*pool.reduce((a,i)=>a+W[i.r],0),w=pool[0];for(const i of pool){x-=W[i.r];if(x<=0){w=i;break}}
 run('UPDATE users SET coins=coins-? WHERE id=?',k.p,s.uid);
 if(w.t==='coin')run('UPDATE users SET coins=coins+? WHERE id=?',w.v,s.uid);else run('INSERT INTO inv(uid,item) VALUES(?,?)',s.uid,w.id);
 return{won:w.id,user:me(s.uid)}},
async 'POST /api/sell'(req,res,b,s){const r=one('SELECT * FROM inv WHERE id=? AND uid=?',b.invId,s.uid);if(!r)throw'Topilmadi';
 run('DELETE FROM inv WHERE id=?',r.id);run('UPDATE users SET coins=coins+? WHERE id=?',SELL[IM[r.item].r],s.uid);return me(s.uid)},
async 'GET /api/admin/users'(){return q('SELECT id,email,name,bio,avatar,coins,created,(SELECT COUNT(*) FROM inv WHERE uid=users.id) AS items FROM users ORDER BY id DESC')},
async 'POST /api/admin/coins'(req,res,b){const a=parseInt(b.amount);if(!a)throw'Miqdor kiriting';
 run('UPDATE users SET coins=MAX(0,coins+?) WHERE id=?',a,b.userId);return{ok:1}},
async 'POST /api/admin/message'(req,res,b){if(!String(b.text||'').trim())throw'Matn bo\'sh';run('INSERT INTO msgs(uid,text,created) VALUES(?,?,?)',b.userId,String(b.text).slice(0,500),Date.now());return{ok:1}}};
http.createServer(async(req,res)=>{
 const url=req.url.split('?')[0],key=req.method+' '+url;
 try{
  if(routes[key]){
   const s=who(req);
   if(url.startsWith('/api/admin/')&&!(s&&s.admin))throw'Ruxsat yo\'q';
   if(['/api/profile','/api/open','/api/sell'].includes(url)&&!(s&&!s.admin))throw'Avval kiring';
   const out=await routes[key](req,res,req.method==='POST'?await body(req):{},s);
   res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(out))}
  if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fs.readFileSync(path.join(__dirname,'public','index.html')))}
  res.statusCode=404;res.end()
 }catch(e){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:typeof e==='string'?e:'Server xatosi'}));if(typeof e!=='string')console.error(e)}
}).listen(PORT,()=>console.log('CS DROP ishlayapti: http://localhost:'+PORT));
