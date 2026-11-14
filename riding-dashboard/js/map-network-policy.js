/* Restore requested basemaps using the existing OSM / Esri providers only.
 * Does not alter CSP, auth, API access, or track upload permissions. */
(function(g){
'use strict';
if(!g.L)return;
if(g.L.Map)g.L.Map.mergeOptions({maxZoom:19});
var original=g.L.tileLayer;
var approved=[
 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
];
g.RD_MAP_TILES_APPROVED=true;
g.L.tileLayer=function(url){
 if(g.RD_MAP_TILES_APPROVED===true && approved.indexOf(url)!==-1)return original.apply(this,arguments);
 return g.L.layerGroup();
};
})(window);
