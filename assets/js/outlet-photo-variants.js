// Approved exact-path derivatives: 160 thumbnail, 640 detail, 1280 zoom; originals remain available on request or fallback.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DMJOutletPhotoVariants=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const enabled=true;
function plan(media){if(!media||media.type!=='image'||typeof media.path!=='string')return null;const source=media.path;if(!/^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(source))return null;const variant=edge=>source+'.preview-v1-'+edge+'.webp';return Object.freeze({source,strip:variant(160),hero:variant(640),zoom:variant(1280)})}
function requests(media){if(!enabled)return media;return media.flatMap(m=>{const p=plan(m);return p?[m,...['strip','hero','zoom'].map(k=>({type:'image',path:p[k]}))]:[m]})}
function sources(media,urls,kind){const original=urls[media.path]||media.url,p=enabled&&plan(media);const keys=kind==='strip'?['strip','hero','zoom']:kind==='hero'?['hero','zoom']:['zoom'];return [...new Set([...(p?keys.map(k=>urls[p[k]]):[]),original].filter(Boolean))]}
return Object.freeze({enabled,plan,requests,sources});
});
