/* Location-derived tile requests stay disabled until separately authorized. */
(function(g){
'use strict';
if(!g.L)return;
// Tile layers normally supply this bound; keep it when their network is blocked.
if(g.L.Map)g.L.Map.mergeOptions({maxZoom:19});
var original=g.L.tileLayer;
g.L.tileLayer=function(){return g.RD_MAP_TILES_APPROVED===true?original.apply(this,arguments):g.L.layerGroup()};
})(window);
