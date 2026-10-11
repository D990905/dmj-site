/* v2 shared analysis workspace: one frame drives production Track/Graph/Table/Polar. */
(function(g){
  'use strict';
  var P=g.RDAnalysisWorkspace,store=P.createAnalysisStore(),host=null,frame=null,views=[],pending=null;
  function el(tag,text,parent){
    var n=document.createElement(tag);
    if(text!=null)n.textContent=text;
    if(parent)parent.appendChild(n);
    return n
  }
  function button(text,parent,fn){
    var n=el('button',text,parent);
    n.type='button';
    n.className='btn btn-sm btn-outline-primary';
    n.addEventListener('click',fn);
    return n
  }
  function select(label,choices,parent){
    var l=el('label',label+' ',parent),n=el('select',null,l);
    n.className='form-select form-select-sm';
    choices.forEach(function(x){
      var o=el('option',x[1],n);
      o.value=x[0]
    });
    return n
  }
  function viewHost(parent,key,title){
    var box=el('div',null,parent);
    box.className='p0-view-card';
    el('h5',title,box);
    var h=el('div',null,box);
    h.dataset.p0View=key;
    return h;
  }
  function number(label,parent){
    var l=el('label',label+' ',parent),n=el('input',null,l);
    n.type='number';
    n.step='any';
    n.className='form-control form-control-sm';
    return n
  }
  function destroy(){
    views.forEach(function(v){
      if(v.graph)v.graph.destroy();
      if(v.map)v.map.map.remove()
    });
    views=[]
  }
  function choose(ids,filter){
    pending=filter;
    var s=store.getSnapshot();
    for(var id of frame.calculationRiderIds){
      var r=frame.riders[id],p=r.samples.find(function(p){
        return ids.indexOf(p._sampleId)>=0
      });
      if(p){
        store.dispatch({
          type:'inspection',utcMs:p._utcMs,riderId:id,originView:'bin'
        });
        break
      }
    }
    var b=host.querySelector('[data-p0-apply-bin]');
    if(b){
      b.disabled=false;
      b.textContent='선택한 빈 조건으로 분석'
    }
  }
  function mount(){
    if(host&&host.isConnected)return;
    var timeline=document.getElementById('chart-timeline');
    if(!timeline)return;
    host=el('section');
    host.id='analysis-workspace-p0';
    host.className='card my-3';
    host.setAttribute('aria-label','공통 라이딩 분석');
    var anchor=timeline.closest('.card')||timeline;
    anchor.parentNode.insertBefore(host,anchor.nextSibling)
  }
  function updateInspection(){
    if(!host)return;
    var s=store.getSnapshot(),utc=s.inspection.utcMs,n=host.querySelector('[data-p0-inspection]');
    if(n)n.textContent=utc==null?'검사 시각 미선택':new Date(utc).toISOString()+' · 검사 커서는 분석 구간을 바꾸지 않습니다';
    views.forEach(function(v){
      var st=P.sampleAtUtc(v.trace,utc,s.policy.gapSec);
      if(v.map)v.map.setInspection(st.sample||null);
      if(v.graph&&utc!=null)v.graph.setInspection(utc/1000);
      if(v.polar&&v.polar.setInspection)v.polar.setInspection(st.sample||null,utc);
      var p=st.sample,row=v.info;
      if(row){
        var outside=frame.selection&&utc!=null&&(utc<frame.selection.fromUtcMs||utc>=frame.selection.toUtcMs);
        row.textContent=st.status==='missing'?'해당 시각: 측정 없음 ('+st.reason+')':('해당 시각: '+st.status+' · '+(p.speed==null?'속도 없음':(p.speed*1.94384).toFixed(1)+' kt')+(outside?' · 분석 구간 밖':''));
      }
      if(v.polarInfo)v.polarInfo.textContent=st.status==='missing'?'폴라 검사: 해당 시각 측정 없음':('폴라 검사: GPS 진행방향 '+(p.heading==null?'없음':p.heading.toFixed(1)+'°'));
      v.cells.forEach(function(c){
        c.node.style.outline=utc!=null&&(st.sampleIds||[]).some(function(id){
          return c.ids.indexOf(id)>=0
        })?'2px solid #ffd43b':''
      })
    });
  }
  function redraw(){
    mount();
    if(!host)return;
    destroy();
    host.replaceChildren();
    var s=store.getSnapshot();
    frame=P.buildAnalysisFrame(s);
    host.dataset.queryKey=frame.queryKey;
    el('h3','공통 라이딩 분석',el('div',null,host));
    var controls=el('div',null,host);
    controls.className='card-body d-flex flex-wrap gap-2 p0-controls';
    var range=frame.selection;
    var start=number('시작 (UTC)',controls),end=number('종료 (UTC)',controls);
    start.type=end.type='datetime-local';
    start.step=end.step='.001';
    start.value=range?new Date(range.fromUtcMs).toISOString().slice(0,-1):'';
    end.value=range?new Date(range.toUtcMs).toISOString().slice(0,-1):'';
    button('구간 적용',controls,function(){
      store.dispatch({
        type:'selection',interval:{
          fromUtcMs:Date.parse(start.value+'Z'),toUtcMs:Date.parse(end.value+'Z')
        },expectedDataRevision:s.dataRevision
      })
    });
    button('전체 시간',controls,function(){
      store.dispatch({
        type:'selection',interval:null
      })
    });
    var zone=select('레그',[['','전체'],['upwind','풍상'],['downwind','풍하']],controls),tack=select('택',[['','전체'],['P','Port'],['S','Starboard']],controls),man=select('턴',[['all','전체'],['remove','제외'],['only','턴만']],controls);
    zone.value=(s.filters.zones||[])[0]||'';
    tack.value=(s.filters.tacks||[])[0]||'';
    man.value=s.filters.maneuvers||'all';
    var gear=select('장비',[['','전체']].concat(s.fleet.openRiderIds.map(function(id){
      var t=s.fleet.riders[id].trace;
      return [t.gearId||'unknown',(t.gearId==='unknown'?'미지정':(t.label||id)+'의 장비')]
    })),controls);
    gear.value=(s.filters.gearIds||[])[0]||'';
    var low=number('풍속 최소 kt',controls),high=number('최대 kt',controls);
    if(s.filters.windKt){
      low.value=s.filters.windKt[0];
      high.value=s.filters.windKt[1]
    }
    button('필터 적용',controls,function(){
      var f={
        maneuvers:man.value
      };
      if(zone.value)f.zones=[zone.value];
      if(tack.value)f.tacks=[tack.value];
      if(gear.value)f.gearIds=[gear.value];
      if(low.value!==''&&high.value!=='')f.windKt=[Number(low.value),Number(high.value)];
      store.dispatch({
        type:'filters',filters:f,expectedDataRevision:s.dataRevision
      })
    });
    button('필터 취소',controls,redraw);
    button('필터 초기화',controls,function(){
      store.dispatch({
        type:'filters',filters:{
        }
      })
    });
    el('p','GPS COG 기반 CWA/VMG · 센서 heading 미사용 · 풍향 신뢰도 '+(s.wind.confidence||'미평가')+' · 북 기준 '+(s.wind.reference||'미확인')+' (진북/자북 확인 필요)',controls);
    var wind=number('풍향 °',controls);
    wind.value=s.wind.directionDeg==null?'':s.wind.directionDeg;
    button('풍향 적용',controls,function(){
      store.dispatch({
        type:'wind',directionDeg:wind.value===''?null:Number(wind.value)
      })
    });
    var applyBin=button('빈을 먼저 선택하세요',controls,function(){
      if(pending){
        store.dispatch({
          type:'filters',filters:Object.assign({
          },store.getSnapshot().filters,pending)
        });
        pending=null
      }
    });
    applyBin.dataset.p0ApplyBin='';
    applyBin.disabled=!pending;
    var inspect=el('p',null,host);
    inspect.dataset.p0Inspection='';
    var roster=el('div',null,host);
    roster.className='card-body';
    s.fleet.openRiderIds.forEach(function(id){
      var r=s.fleet.riders[id],line=el('div',null,roster);
      el('span',(r.trace.label||id)+' ',line);
      var role=select('표시',[['normal','표시'],['watch','관찰'],['focus','집중'],['hidden','숨김']],line);
      role.value=r.presentationRole;
      role.addEventListener('change',function(){
        store.dispatch({
          type:'role',riderId:id,role:role.value
        })
      });
      var l=el('label',' 계산 포함 ',line),cb=el('input',null,l);
      cb.type='checkbox';
      cb.checked=r.calculationIncluded;
      cb.addEventListener('change',function(){
        store.dispatch({
          type:'included',riderId:id,included:cb.checked
        })
      });
      var offset=number('시계 보정(초)',line);
      offset.value=(r.clock.offsetMs||0)/1000;
      offset.disabled=r.clock.epochAnchorMs==null;
      button('보정 적용',line,function(){
        store.dispatch({
          type:'clock',riderId:id,clock:Object.assign({
          },r.clock,{
            offsetMs:Number(offset.value)*1000,provenance:'manual-correction'
          })
        })
      });
      button('닫기',line,function(){
        store.dispatch({
          type:'close',riderId:id
        })
      });
      el('small',' 숨겨도 계산에 포함됩니다.',line)
    });
    frame.pairs.forEach(function(p){
      el('p',p.riderIds.join(' ↔ ')+' · 속도 비교 유효 교집합 '+p.overlapSec.toFixed(2)+'초',host)
    });
    s.fleet.openRiderIds.forEach(function(id){
      var rider=frame.riders[id],record=s.fleet.riders[id];
      if(record.presentationRole==='hidden')return;
      var section=el('div',null,host);
      section.className='card-body';
      section.dataset.riderId=id;
      el('h4',(record.trace.label||id)+(record.calculationIncluded?'':' · 계산 제외, 보기만')+' · 유효 '+rider.eligibleSec.toFixed(2)+'초 / 요청 '+rider.requestedSec.toFixed(2)+'초 · '+Math.round(rider.coverage*100)+'%',section);
      if(rider.unavailableReason){
        el('p','분석 불가: '+rider.unavailableReason,section);
        return
      }
      var session=P.sessionForView(rider),v={
        trace:record.trace,rider:rider,cells:[]
      };
      views.push(v);
      var grid=el('div',null,section);
      grid.className='p0-view-grid';
      var mh=viewHost(grid,'track','Track · 위치');
      if(g.RDMapV2)v.map=g.RDMapV2.render(mh,session,{
        maneuvers:[]
      },{
        height:260,onInspection:function(p){
          store.dispatch({
            type:'inspection',utcMs:p._utcMs,riderId:id,originView:'track'
          })
        }
      });
      var gh=viewHost(grid,'graph','Graph · UTC 시간축');
      if(g.RDChartStack&&g.uPlot)v.graph=g.RDChartStack.render(gh,session,{
        maneuvers:[]
      },{
        compress:false,timeOriginSec:range.fromUtcMs/1000,xRange:[0,(range.toUtcMs-range.fromUtcMs)/1000],syncId:'p0-'+id,onInspection:function(sec){
          store.dispatch({
            type:'inspection',utcMs:sec*1000,riderId:id,originView:'graph'
          })
        },onSelect:function(st){
          store.dispatch({
            type:'selection',interval:st?{
              fromUtcMs:((st.realFromSec==null?st.fromSec:st.realFromSec)+range.fromUtcMs/1000)*1000,toUtcMs:((st.realToSec==null?st.toSec:st.realToSec)+range.fromUtcMs/1000)*1000
            }:null
          })
        }
      });
      v.info=el('p',null,gh.parentNode);
      var ph=viewHost(grid,'polar','Polar · 각도별 속도');
      if(record.calculationIncluded&&g.RDAnalysis&&g.RDPolar){
        var polar=g.RDAnalysis.computePolar(session,s.wind.directionDeg,7.5);
        if(polar)v.polar=g.RDPolar.render(ph,polar,{
          size:360,band:true,minN:1,minSeconds:15,onBin:function(bin,side){
            var from=bin-3.75,to=bin+3.75,ids=rider.samples.filter(function(p){
              return p._weightSec>0&&p.twa>=from&&p.twa<to&&p.tack===side
            }).map(function(p){
              return p._sampleId
            });
            choose(ids,{
              polarBin:{
                from:from,to:to,side:side
              }
            })
          }
        });
        else el('p','풍향 미지정: 폴라 분석 불가',ph)
      }
      v.polarInfo=el('p',null,ph.parentNode);
      var th=viewHost(grid,'table','Table · 시간가중 비교');
      if(record.calculationIncluded&&g.RDBinTable){
        var table=g.RDBinTable.build(session,{
          rowDim:'zone',colDim:'tack',metric:'speed',windDir:s.wind.directionDeg,minSeconds:15,minSpeedKt:0,weights:rider.weights
        });
        if(table){
          var tb=el('table',null,th);
          tb.className='table table-sm';
          var hr=el('tr',null,tb);
          el('th','레그 / 택',hr);
          table.cols.forEach(function(c){
            el('th',c.label,hr)
          });
          table.grid.forEach(function(row,i){
            var tr=el('tr',null,tb);
            el('th',table.rows[i].label,tr);
            row.forEach(function(c){
              var td=el('td',null,tr),ids=c.sampleIds||[];
              v.cells.push({
                node:td,ids:ids
              });
              var b=button(c.value==null?'측정 없음':c.value.toFixed(2)+' '+table.metric.unit,td,function(){
                choose(ids,{
                  sampleIds:ids
                })
              });
              b.disabled=!ids.length;
              el('small',' · '+c.seconds.toFixed(2)+'초',td)
            })
          })
        }
        else el('p','현재 조건의 표 자료 없음',th)
      }
    });
    updateInspection();
  }
  store.subscribe(function(s,a){
    if(a.type==='inspection')updateInspection();
    else redraw()
  });
  function open(session,analysis,meta){
    meta=meta||{
    };
    var id=String(meta.id||('session-'+session.startEpoch));
    var detected=analysis&&analysis.maneuvers;
    if(!detected && g.RDAnalysis && session.hasTime) detected=g.RDAnalysis.detectManeuvers(session,meta.windDir!=null?meta.windDir:store.getSnapshot().wind.directionDeg);
    var mans=(detected||[]).map(function(m){
      return Object.assign({},m,{startIdx:m.startIdx,endIdx:m.endIdx})
    });
    store.dispatch({
      type:'open',trace:{
        id:id,label:meta.label||id,session:session,gearId:meta.gearId||'unknown',windSpeedKt:typeof meta.windSpeedKt==='number'?meta.windSpeedKt:null,maneuvers:mans
      }
    });
    if(meta.windDir!=null)store.dispatch({
      type:'wind',directionDeg:meta.windDir,source:meta.windSource||'unknown',reference:meta.windReference||'unknown',confidence:meta.windConfidence||null
    });
  }
  function resizeViews(){
    views.forEach(function(v){if(v.map&&v.map.resize)v.map.resize();if(v.graph&&v.graph.resize)v.graph.resize();});
  }
  if(document.addEventListener)document.addEventListener('shown.bs.tab',resizeViews);
  if(g.addEventListener)g.addEventListener('resize',resizeViews);
  g.RDP0Panel={
    open:open,store:store,getFrame:function(){
      return frame
    },destroy:destroy
  };
})(typeof window!=='undefined'?window:globalThis);
