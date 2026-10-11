/* Local replay annotations. Separate from session records and cloud synchronization. */
(function(g){
'use strict';
function keyFor(trace){
 var s=trace.session,h=2166136261,j=5381;
 // Stable across saved-record IDs and lossless track reloads; compare raw GPS/time only.
 var text=JSON.stringify([s.startEpoch,(s.samples||[]).map(function(p){return [p.t,p.lat,p.lng]})]);
 for(var i=0;i<text.length;i++){h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;j=(Math.imul(j,33)^text.charCodeAt(i))>>>0}
 return 'workspace:'+s.startEpoch+':'+text.length+':'+h.toString(16)+':'+j.toString(16)
}
function storageKey(key){return (g.RDStorage?g.RDStorage.nsPrefix():'rd_anon_')+'replay_workspace_v1:'+key}
function load(key){var data;try{data=JSON.parse(g.localStorage.getItem(storageKey(key))||'null')}catch(e){}return data&&Array.isArray(data.notes)&&Array.isArray(data.segments)&&Array.isArray(data.videos)?data:{notes:[],segments:[],videos:[]}}
function save(key,data,expectedScope){var scoped=storageKey(key);if(expectedScope&&scoped!==expectedScope)throw new Error('Replay account context changed');g.localStorage.setItem(scoped,JSON.stringify(data));return data}
g.RDReplayLocal={keyFor:keyFor,scopeKey:storageKey,load:load,save:save};
})(window);
