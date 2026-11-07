(()=>{'use strict';
const config=window.MILO_ADMIN_CONFIG||{};
const ENDPOINT=String(config.endpoint||'').trim();
const TOKEN_KEY='milo-admin-session-v3';
let frame,frameReady=false,waiting=new Map(),seq=0,origin='';
function session(){return sessionStorage.getItem(TOKEN_KEY)||''}
function setSession(token){if(token)sessionStorage.setItem(TOKEN_KEY,token);else sessionStorage.removeItem(TOKEN_KEY)}
function ensureFrame(){
 if(frame)return Promise.resolve();
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(ENDPOINT))return Promise.reject(Error('يجب ضبط رابط نشر Apps Script في config.js'));
 return new Promise((resolve,reject)=>{
  const f=document.createElement('iframe');f.title='MILO Admin secure bridge';f.style.cssText='position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none';f.src=ENDPOINT+'?milo_admin_bridge=1';
  const watchdog=setTimeout(()=>{reject(Error('تعذر تحميل جسر Apps Script، تأكد من نشر Code.gs و Bridge.html والصلاحية Anyone.'));},12000);
  f.onload=()=>{clearTimeout(watchdog);frame=f;resolve()};f.onerror=()=>{clearTimeout(watchdog);reject(Error('تعذر الاتصال بخادم Apps Script'))};document.body.append(f);
 });
}
window.addEventListener('message',e=>{
 if(!frame||e.source!==frame.contentWindow)return;
 // Strictly accept replies from Google Apps Script page / its googleusercontent iframe.
 if(e.origin!=='https://script.google.com'&&!e.origin.endsWith('.googleusercontent.com'))return;
 const d=e.data;if(!d||d.source!=='milo-admin-bridge-v2'||!waiting.has(d.id))return;
 const pending=waiting.get(d.id);waiting.delete(d.id);clearTimeout(pending.timer);
 if(d.ok)pending.resolve(d.data||{});else{const err=Error(d.error||'رفض الخادم الطلب');err.code=d.code;pending.reject(err)}
});
async function call(action,payload={}){
 await ensureFrame();
 return new Promise((resolve,reject)=>{
  const id='r'+(++seq)+'_'+Date.now();const timer=setTimeout(()=>{waiting.delete(id);reject(Error('انتهت مهلة الاتصال بالخادم، ربما رابط Apps Script لا يحتوي على جسر ميلو للإدارة.'))},20000);
  waiting.set(id,{resolve,reject,timer});frame.contentWindow.postMessage({source:'milo-admin-parent-v2',id,action,payload,token:session()},'*');
 });
}
async function login(username,password){const r=await call('login',{username,password});if(!r.token)throw Error('الخادم لم يُرجع جلسة موثقة');setSession(r.token);return r}
async function check(){if(!session())throw Error('لا توجد جلسة');try{return await call('check',{})}catch(e){setSession('');throw e}}
async function logout(){try{if(session())await call('logout',{})}finally{setSession('')}}
window.MiloAdminAPI={call,login,check,logout,hasSession:()=>!!session()};
})();
