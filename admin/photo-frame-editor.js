(function(){'use strict';
const O=window.DMJOutlet;
function create(host,{allowed,changed,save,getItem,getUrls}){
 let photo=null,src='',initial=null,state=null,drag=null,dimensions=null,view='pc';const baselines=new WeakMap();
 const panel=O.el('section','outlet-frame-editor'),heading=O.el('h2','','대표 사진 크기 · 위치'),hint=O.el('p','outlet-hint','사진을 드래그하거나 화살표 키로 이동하세요. 원본 비율과 윙 끝을 보존합니다. 설정은 고객 카드에만 적용하며 상세 사진은 원본 전체를 보여줍니다.');
 const stage=O.el('div','outlet-card-photo outlet-frame-stage'),img=O.el('img'),controls=O.el('div','outlet-frame-controls'),label=O.el('label','','사진 크기'),slider=O.el('input'),readout=O.el('output'),message=O.el('p','outlet-hint'),actions=O.el('div','outlet-actions'),preview=O.el('div','outlet-frame-preview'),tabs=O.el('div','outlet-actions'),previewTitle=O.el('h3','','고객 카드 미리보기');
 stage.tabIndex=0;stage.setAttribute('role','group');stage.setAttribute('aria-label','대표 사진 위치 조절. 드래그 또는 화살표 키로 이동');img.alt='대표 사진 위치 조절';img.draggable=false;stage.append(img);
 slider.type='range';slider.min='50';slider.max='160';slider.step='1';slider.setAttribute('aria-label','대표 사진 크기');label.append(slider,readout);controls.append(label);
 function button(text,fn,box=actions){const b=O.el('button','',text);b.type='button';b.onclick=()=>{if(allowed()&&photo)fn()};box.append(b);return b}
 function write(raw){if(!allowed()||!photo)return;state=O.photoFrameState(photo,dimensions,raw);if(!state)return;photo.card_frame={version:1,zoom:state.zoom,x:state.x,y:state.y};changed();paint()}
 function drawPreview(){preview.replaceChildren();if(!photo)return;const item=getItem();if(!item)return;const card=O.card(item,getUrls(),'../');preview.dataset.view=view;preview.append(card)}
 function paint(){if(!state)return;stage.dataset.wingFrame='true';stage.style.setProperty('--wing-image-width',state.width+'%');stage.style.setProperty('--wing-image-left',state.left+'%');stage.style.setProperty('--wing-image-top',state.top+'%');slider.max=String(Math.floor(state.maxZoom*100));slider.value=String(Math.round(state.zoom*100));readout.textContent=Math.round(state.zoom*100)+'%';message.textContent='이 사진 최대 '+Math.floor(state.maxZoom*100)+'% · 가로 '+state.x.toFixed(1)+'% · 세로 '+state.y.toFixed(1)+'% 이동 · 윙 끝이 잘리지 않는 범위로 제한됩니다.';drawPreview()}
 slider.oninput=()=>write({version:1,zoom:Number(slider.value)/100,x:state?.x||0,y:state?.y||0});
 button('가운데 정렬',()=>write({version:1,zoom:state?.zoom||1,x:0,y:0}));
 button('기본값으로 초기화',()=>{delete photo.card_frame;state=O.photoFrameState(photo,dimensions);changed();paint()});
 button('저장 전 변경 취소',()=>{if(initial)photo.card_frame={...initial};else delete photo.card_frame;state=O.photoFrameState(photo,dimensions);changed();paint()});
 button('사진 설정 저장',()=>{endDrag();save()});
 const pc=button('PC 1280px',()=>{view='pc';pc.setAttribute('aria-pressed','true');mobile.setAttribute('aria-pressed','false');drawPreview()},tabs),mobile=button('모바일 390px',()=>{view='mobile';pc.setAttribute('aria-pressed','false');mobile.setAttribute('aria-pressed','true');drawPreview()},tabs);pc.setAttribute('aria-pressed','true');mobile.setAttribute('aria-pressed','false');
 function endDrag(){if(drag&&stage.hasPointerCapture(drag.id))stage.releasePointerCapture(drag.id);drag=null}
 stage.addEventListener('pointerdown',e=>{if(!allowed()||!state||e.isPrimary===false||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,frame:{version:1,zoom:state.zoom,x:state.x,y:state.y}};stage.setPointerCapture(e.pointerId);e.preventDefault()});
 stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id||!allowed())return;const box=stage.getBoundingClientRect();write({...drag.frame,x:drag.frame.x+(e.clientX-drag.x)/box.width*100,y:drag.frame.y+(e.clientY-drag.y)/box.height*100})});
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>stage.addEventListener(name,endDrag));
 stage.addEventListener('keydown',e=>{if(!allowed()||!state)return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},m=moves[e.key];if(!m)return;e.preventDefault();const step=e.shiftKey?5:1;write({version:1,zoom:state.zoom,x:state.x+m[0]*step,y:state.y+m[1]*step})});
 panel.append(heading,hint,stage,controls,message,actions,O.el('p','outlet-hint','저장은 상품 정보와 함께 반영됩니다. 초기화·취소는 저장 전까지 고객 화면에 반영되지 않습니다.'),previewTitle,tabs,preview);host.append(panel);panel.hidden=true;
 return {update(next,nextSrc){endDrag();if(next===photo&&nextSrc===src){drawPreview();return}photo=next;src=nextSrc||'';dimensions=null;state=null;if(photo&&!baselines.has(photo))baselines.set(photo,photo.card_frame?{...photo.card_frame}:null);initial=photo?baselines.get(photo):null;panel.hidden=!photo;if(!photo){img.removeAttribute('src');preview.replaceChildren();return}slider.disabled=true;img.onload=()=>{if(!photo||img.getAttribute('src')!==src)return;dimensions={width:img.naturalWidth,height:img.naturalHeight};state=O.photoFrameState(photo,dimensions);slider.disabled=false;paint()};img.onerror=()=>{message.textContent='대표 사진을 불러오지 못했습니다. 사진 연결 후 조정해 주세요.';slider.disabled=true};img.src=src;},refresh:drawPreview};
}
window.DMJPhotoFrameEditor={create};
})();
