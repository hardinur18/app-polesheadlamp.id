const TARGET = 'https://rhi.polesheadlamp.id';
export const retirementWorker = `
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n.startsWith('workbox-') && n.includes(self.location.origin)).map(n => caches.delete(n)));
  await self.clients.claim();
  const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await Promise.all(windows.filter(c => new URL(c.url).origin === self.location.origin).map(c => c.navigate(c.url).catch(() => undefined)));
})()));
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    const next = new URL('${TARGET}'); next.pathname = new URL(e.request.url).pathname;
    e.respondWith(Promise.resolve(Response.redirect(next.href,302)));
  } else {
    e.respondWith(Promise.resolve(new Response(JSON.stringify({error:'Aplikasi lama ditutup. Gunakan rhi.polesheadlamp.id.'}),{status:410,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})));
  }
});`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {'Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
    if (url.origin === TARGET) return new Response('Deployment host mismatch',{status:421,headers});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Aplikasi lama ditutup. Buka https://rhi.polesheadlamp.id',{status:410,headers});
    if (url.pathname === '/sw.js') return new Response(request.method === 'HEAD' ? null : retirementWorker,{headers:{...headers,'Content-Type':'application/javascript; charset=utf-8','Service-Worker-Allowed':'/'}});
    const next = new URL(TARGET); next.pathname = url.pathname;
    // Fresh login on RHI; never forward legacy auth tokens, query strings or POST bodies.
    return new Response(null,{status:302,headers:{...headers,Location:next.href}});
  },
};
