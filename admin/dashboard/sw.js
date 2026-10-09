// Retire only the former public orchestrator PWA and its own caches.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('sailtech-orchestrator-')).map(name=>caches.delete(name)));
 await self.registration.unregister();
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){const url=new URL(client.url);if(url.origin===self.location.origin&&url.pathname.startsWith('/admin/dashboard/'))await client.navigate('/admin/index.html');}
})()));
