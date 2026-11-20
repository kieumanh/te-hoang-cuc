import { Chess } from 'chess.js';
export const games={go:'Cờ vây',xiangqi:'Cờ tướng',chess:'Cờ vua'};
const square=i=>'abcdefgh'[i%8]+(8-Math.floor(i/8));
const index=s=>'abcdefgh'.indexOf(s[0])+(8-Number(s[1]))*8;
const values={p:1,n:3,b:3,r:5,q:9,k:50,c:4,e:2,a:2};
function around(i,w,h){return [i%w?i-1:-1,i%w<w-1?i+1:-1,i-w,i+w].filter(j=>j>=0&&j<w*h)}
function region(b,i,w){const group=new Set([i]),air=new Set();for(const k of group)for(const j of around(k,w,w)){if(b[j]===b[i])group.add(j);else if(!b[j])air.add(j)}return {group,air}}
function goMove(s,i){
 if(!Number.isInteger(i)||i<0||i>=s.b.length||s.b[i])return null;
 const b=s.b.slice();b[i]=s.turn;let taken=0;
 for(const j of around(i,s.w,s.h))if(b[j]===-s.turn){const {group,air}=region(b,j,s.w);if(!air.size)for(const k of group){b[k]=0;taken++}}
 const {air}=region(b,i,s.w);if(!air.size||s.seen.has(b.join(',')))return null;
 return {b,taken,air:air.size};
}
export function scoreGo(s){let black=0,white=6.5;const seen=new Set();for(let i=0;i<s.b.length;i++){if(s.b[i]===1){black++;continue}if(s.b[i]===-1){white++;continue}if(seen.has(i))continue;
 const group=new Set([i]),colors=new Set();for(const k of group){seen.add(k);for(const j of around(k,s.w,s.h))if(s.b[j])colors.add(s.b[j]);else group.add(j)}
 if(colors.size===1){if(colors.has(1))black+=group.size;else white+=group.size}
 }return {black,white}}
function xiStart(){const b=Array(90).fill(null);for(const [y,side] of [[0,-1],[9,1]]){
 [...'rneakaenr'].forEach((p,x)=>b[y*9+x]={p,side});const row=side===1?7:2;for(const x of [1,7])b[row*9+x]={p:'c',side};for(const x of [0,2,4,6,8])b[(side===1?6:3)*9+x]={p:'p',side}}return b}
function xiCan(b,f,t){const piece=b[f];if(!piece||f===t||b[t]?.side===piece.side)return false;
 const x=f%9,y=Math.floor(f/9),u=t%9,v=Math.floor(t/9),dx=u-x,dy=v-y,a=Math.abs(dx),d=Math.abs(dy),own=piece.side===1;
 const palace=u>=3&&u<=5&&(own?v>=7:v<=2);
 let screens=0;if(!a||!d){const step=Math.sign(dx)+9*Math.sign(dy);for(let i=f+step;i!==t;i+=step)if(b[i])screens++}
 switch(piece.p){
 case 'k':return (palace&&a+d===1)||(!a&&b[t]?.p==='k'&&screens===0);
 case 'a':return palace&&a===1&&d===1;
 case 'e':return (own?v>=5:v<=4)&&a===2&&d===2&&!b[(f+t)/2];
 case 'n':return a*d===2&&!b[f+(a===2?Math.sign(dx):9*Math.sign(dy))];
 case 'r':return (!a||!d)&&!screens;
 case 'c':return (!a||!d)&&screens===(b[t]?1:0);
 case 'p':return (!a&&dy===(own?-1:1))||((own?y<=4:y>=5)&&a===1&&!d);
 }}
function xiMoves(s){const result=[];for(let f=0;f<90;f++)if(s.b[f]?.side===s.turn)for(let t=0;t<90;t++){
 if(!xiCan(s.b,f,t)||s.b[t]?.p==='k')continue;const b=s.b.slice();b[t]=b[f];b[f]=null;const king=b.findIndex(p=>p?.p==='k'&&p.side===s.turn);
 if(!b.some((p,i)=>p?.side===-s.turn&&xiCan(b,i,king)))result.push({f,t})}return result}
export function start(game,w=9){if(!Object.hasOwn(games,game))throw Error('Môn cờ không hợp lệ');const s={game,w,h:w,turn:1,moves:[],end:null,passes:0,taken:[0,0],seen:new Set()};
 if(game==='go'){if(![9,13,19].includes(w))throw Error('Kích thước bàn');s.b=Array(w*w).fill(0);s.seen.add(s.b.join(','))}
 if(game==='xiangqi'){s.w=9;s.h=10;s.b=xiStart();s.positions=new Map()}
 if(game==='chess'){s.w=s.h=8;s.chess=new Chess();refreshChess(s)}return s}
function refreshChess(s){s.b=s.chess.board().flat().map(p=>p?{p:p.type,side:p.color==='w'?1:-1}:null)}
export function legal(s){if(s.end!==null)return [];if(s.game==='go')return s.b.flatMap((v,t)=>!v&&goMove(s,t)?[{t}]:[]).concat({pass:true});if(s.game==='xiangqi')return xiMoves(s);return s.chess.moves({verbose:true}).map(m=>({f:index(m.from),t:index(m.to),...(m.promotion?{promotion:m.promotion}:{})}))}
export function play(s,m){if(s.end!==null||!m||typeof m!=='object')return false;
 if(s.game==='go'){if(m.pass===true){s.passes++;if(s.passes===2){const v=scoreGo(s);s.end=v.black>v.white?1:-1}}else{const res=goMove(s,m.t);if(!res)return false;s.b=res.b;s.seen.add(s.b.join(','));s.taken[s.turn===1?0:1]+=res.taken;s.passes=0}}
 else if(s.game==='chess'){if(!Number.isInteger(m.f)||!Number.isInteger(m.t)||m.f<0||m.t<0||m.f>63||m.t>63)return false;try{s.chess.move({from:square(m.f),to:square(m.t),promotion:m.promotion||'q'})}catch{return false}refreshChess(s);if(s.chess.isGameOver())s.end=s.chess.isCheckmate()?s.turn:0}
 else{if(!xiMoves(s).some(v=>v.f===m.f&&v.t===m.t))return false;s.b[m.t]=s.b[m.f];s.b[m.f]=null}
 s.moves.push(m);s.turn=-s.turn;if(s.game==='xiangqi'){const key=JSON.stringify(s.b)+s.turn;const n=(s.positions.get(key)||0)+1;s.positions.set(key,n);if(!xiMoves(s).length)s.end=-s.turn;else if(n>=3)s.end=0}return true}
export function suggest(s,level=1,style=0){
 const moves=legal(s);if(!moves.length)return null;const seed=s.moves.length*97+style*283+level*71;
 let best=-Infinity,choice=moves[0];for(const m of moves){
 const jitter=(Math.sin((m.t??-1)*293+(m.f??3)*67+seed)*43758.54)%1;
 let score=jitter*(level>2?.35:1.2);
 if(s.game==='go'){if(m.pass){const v=scoreGo(s);const winning=s.turn===1?v.black>v.white:v.white>v.black;score=s.passes&&winning?1000:-30}else{const r=goMove(s,m.t),adj=around(m.t,s.w,s.h);score+=r.taken*8+(r.air===1?-6:0)-Math.hypot(m.t%s.w-(s.w-1)/2,Math.floor(m.t/s.w)-(s.h-1)/2)*.09;
 if(adj.every(j=>s.b[j]===s.turn)&&!r.taken)score-=40;for(const j of adj)if(s.b[j]&&region(s.b,j,s.w).air.size===1)score+=2;else if(s.b[j]===-s.turn)score+=.3}}
 else{score+=(values[s.b[m.t]?.p]||0)*4+(m.promotion==='q'?20:0);score-=Math.abs(m.t%s.w-(s.w-1)/2)*.15;
 if(level>1){const b=s.b.slice();b[m.t]=b[m.f];b[m.f]=null;if(s.game==='xiangqi'&&b.some((p,i)=>p?.side===-s.turn&&xiCan(b,i,m.t)))score-=values[b[m.t].p]*2;
 if(s.game==='chess'){s.chess.move({from:square(m.f),to:square(m.t),promotion:m.promotion||'q'});if(s.chess.isAttacked(square(m.t),s.turn===1?'b':'w'))score-=values[b[m.t].p]*2;if(s.chess.isCheckmate())score+=1000;else if(s.chess.isCheck())score+=1;s.chess.undo()}}}
 if(score>best){best=score;choice=m}}
 return choice}
export function replay(game,w,moves){const s=start(game,w);for(const m of moves)if(!play(s,m))throw Error('Kỳ phổ có nước không hợp lệ');return s}
