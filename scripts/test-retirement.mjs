import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker, {retirementWorker} from '../retirement/_worker.js';
const old = 'https://polesheadlamp-id.pages.dev';
for (const path of ['/', '/orders/', '/login/', '/dashboard/', '/whatsapp/chats', '/embed/form/test', '//untrusted.example/path']) {
  const r = await worker.fetch(new Request(old + path + '?access_token=never-forward'));
  assert.equal(r.status,302); const target = new URL(r.headers.get('location'));
  assert.equal(target.origin,'https://rhi.polesheadlamp.id'); assert.equal(target.pathname,path); assert.equal(target.search,'');
}
assert.equal((await worker.fetch(new Request('https://rhi.polesheadlamp.id/orders'))).status,421);
assert.equal((await worker.fetch(new Request(old+'/orders',{method:'POST',body:'no-replay'}))).status,410);
const sw = await worker.fetch(new Request(old+'/sw.js'));
assert.equal(sw.status,200); assert.match(sw.headers.get('content-type'),/javascript/); assert.match(sw.headers.get('cache-control'),/no-store/);
const events={}, deleted=[], navigated=[]; let claimed=false,skipped=false,pending;
vm.runInNewContext(retirementWorker,{URL,Response,Promise,JSON,caches:{keys:async()=>['workbox-precache-v2-'+old+'/','other-cache'],delete:async n=>deleted.push(n)},self:{location:{origin:old},addEventListener:(n,h)=>events[n]=h,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;},matchAll:async()=>[{url:old+'/orders/',navigate:async u=>navigated.push(u)},{url:'https://rhi.polesheadlamp.id/orders/',navigate:async()=>{throw Error('Must not navigate new app');}}]}}});
events.install({waitUntil:p=>pending=p}); await pending;
events.activate({waitUntil:p=>pending=p}); await pending;
assert.ok(skipped&&claimed); assert.deepEqual(deleted,['workbox-precache-v2-'+old+'/']); assert.deepEqual(navigated,[old+'/orders/']);
events.fetch({request:{url:old+'/orders/?token=old',mode:'navigate'},respondWith:p=>pending=p}); assert.equal((await pending).headers.get('location'),'https://rhi.polesheadlamp.id/orders/');
events.fetch({request:{url:'https://old-backend.invalid/rest/v1/orders',mode:'cors'},respondWith:p=>pending=p}); assert.equal((await pending).status,410);
console.log('PASS: fixed destination, no token forwarding/POST replay, SW activation, existing-client navigation and old request block');
