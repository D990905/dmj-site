/* Shared UTC analysis contract. Raw sessions are never mutated. */
(function(g){
  'use strict';
  var channels=['speed','heading','twa','vmg','hr','heel','pitch'];
  function finite(v){
    return typeof v==='number'&&isFinite(v)
  }
  function freeze(o){
    if(o&&typeof o==='object'&&!Object.isFrozen(o)){
      Object.keys(o).forEach(function(k){
        freeze(o[k])
      });
      Object.freeze(o)
    }
    return o
  }
  function copy(o){
    return JSON.parse(JSON.stringify(o))
  }
  function clockOf(t){
    return t.clock||{
      mode:'utc',epochAnchorMs:t.session.startEpoch,localAnchorSec:0,localKey:'t',scale:1,offsetMs:0,provenance:'source-utc'
    }
  }
  function toUtc(t,p){
    var c=clockOf(t);
    if(c.mode!=='utc'||!finite(c.epochAnchorMs)||!finite(p[c.localKey]))return null;
    return c.epochAnchorMs+(p[c.localKey]-(c.localAnchorSec||0))*1000*(c.scale==null?1:c.scale)+(c.offsetMs||0)
  }
  function elapsedAtUtc(t,utc){
    var c=clockOf(t);if(c.mode!=='utc'||!finite(c.epochAnchorMs)||!finite(utc)||!(c.scale==null||c.scale>0))return null;
    return (utc-c.epochAnchorMs-(c.offsetMs||0))/1000/(c.scale==null?1:c.scale)+(c.localAnchorSec||0)
  }
  function angle(a,b){
    var d=(b-a)%360;
    if(d>180)d-=360;
    if(d<=-180)d+=360;
    return d
  }
  function derived(p,wind){
    var q=Object.assign({
    },p);
    // Never carry a projection from an earlier wind/source into this frame.
    q.twa=null;q.vmg=null;q.tack=null;q.zone=null;q._windDirectionDeg=null;
    if(finite(wind)&&finite(q.heading)){
      var d=angle(wind,q.heading);
      q._windDirectionDeg=wind;
      q.twa=Math.abs(d);
      q.tack=d>=0?'P':'S';
      q.zone=q.twa<90?'upwind':'downwind';
      q.vmg=finite(q.speed)?q.speed*Math.cos(d*Math.PI/180):null
    }
    return q
  }
  function linked(t,i,j,gap){
    var S=t.session.samples;
    if(i<0||j>=S.length||S[i].gpsOutlier||S[j].gpsOutlier)return false;
    var dt=toUtc(t,S[j])-toUtc(t,S[i]);
    if(!(dt>0&&dt<=gap*1000))return false;
    var legs=t.session.legs||[{
      start:0,end:S.length-1
    }];
    return legs.some(function(l){
      return i>=l.start&&j<=l.end
    })
  }
  function sampleAtUtc(t,utc,gap){
    gap=gap||4;
    var S=t.session.samples||[];
    if(!finite(utc)||!S.length||toUtc(t,S[0])==null)return {
      status:'missing',reason:'unknown-clock'
    };
    var lo=0,hi=S.length-1;
    while(lo<=hi){
      var m=(lo+hi)>>1,v=toUtc(t,S[m]);
      if(v===utc){
        if(S[m].gpsOutlier)return {
          status:'missing',reason:'rejected-sample'
        };
        return {
          status:'measured',sample:Object.assign({
          },S[m]),sampleIds:[sampleId(t,S[m],m)],utcMs:utc
        }
      }
      if(v<utc)lo=m+1;
      else hi=m-1
    }
    var i=hi,j=lo;
    if(!linked(t,i,j,gap))return {
      status:'missing',reason:'gap-or-outside'
    };
    var a=S[i],b=S[j],u=toUtc(t,a),v=toUtc(t,b),f=(utc-u)/(v-u),p={
      t:a.t+(b.t-a.t)*f
    };
    ['lat','lng'].concat(channels).forEach(function(k){
      p[k]=finite(a[k])&&finite(b[k])?(k==='heading'?((a[k]+angle(a[k],b[k])*f+360)%360):k==='lng'?((a[k]+angle(a[k],b[k])*f+540)%360)-180:a[k]+(b[k]-a[k])*f):null
    });
    if(finite(a._windDirectionDeg)&&a._windDirectionDeg===b._windDirectionDeg)p=derived(p,a._windDirectionDeg);
    return {
      status:'interpolated',sample:p,utcMs:utc,bracketMs:v-u,sampleIds:[sampleId(t,a,i),sampleId(t,b,j)]
    }
  }
  function union(a){
    a=a.filter(function(x){
      return x[1]>x[0]
    }).sort(function(x,y){
      return x[0]-y[0]
    });
    var r=[];
    a.forEach(function(x){
      var p=r[r.length-1];
      if(p&&x[0]<=p[1])p[1]=Math.max(p[1],x[1]);
      else r.push(x.slice())
    });
    return r
  }
  function intersect(a,b){
    var r=[];
    a.forEach(function(x){
      b.forEach(function(y){
        var l=Math.max(x[0],y[0]),h=Math.min(x[1],y[1]);
        if(h>l)r.push([l,h])
      })
    });
    return union(r)
  }
  function seconds(a){
    return a.reduce(function(s,x){
      return s+(x[1]-x[0])/1000
    },0)
  }
  function cut(a,filters){
    if(filters.includeIntervals)a=intersect(a,filters.includeIntervals.map(function(x){
      return [x.fromUtcMs,x.toUtcMs]
    }));
    (filters.excludeIntervals||[]).forEach(function(x){
      var r=[];
      a.forEach(function(y){
        if(y[0]<x.fromUtcMs)r.push([y[0],Math.min(y[1],x.fromUtcMs)]);
        if(y[1]>x.toUtcMs)r.push([Math.max(y[0],x.toUtcMs),y[1]])
      });
      a=union(r)
    });
    return a
  }
  function sampleId(t,p,i){
    return t.id+':'+(p.sourceOrdinal==null?i:p.sourceOrdinal)
  }
  function eligible(p,t,i,f,utc){
    if(p.gpsOutlier)return false;
    if(f.zones&&f.zones.indexOf(p.zone)<0)return false;
    if(f.tacks&&f.tacks.indexOf(p.tack)<0)return false;
    if(f.gearIds&&f.gearIds.indexOf(t.gearId)<0)return false;
    if(f.windKt&&(!finite(t.windSpeedKt)||t.windSpeedKt<f.windKt[0]||t.windSpeedKt>f.windKt[1]))return false;
    if(f.sampleIds&&f.sampleIds.indexOf(sampleId(t,p,i))<0)return false;
    if(f.polarBin&&(!finite(p.twa)||p.twa<f.polarBin.from||p.twa>=f.polarBin.to||p.tack!==f.polarBin.side))return false;
    var ranges=f.values||{
    };
    if(!Object.keys(ranges).every(function(k){
      return finite(p[k])&&p[k]>=ranges[k][0]&&p[k]<=ranges[k][1]
    }))return false;
    var on=(t.maneuvers||[]).some(function(m){
      var pad=(f.maneuverPaddingSec||0)*1000;
      var from=m.startIdx!=null?toUtc(t,t.session.samples[m.startIdx]):m.fromUtcMs;
      var to=m.endIdx!=null?toUtc(t,t.session.samples[m.endIdx]):m.toUtcMs;
      return finite(from)&&finite(to)&&utc>=from-pad&&utc<=to+pad
    });
    if(f.maneuvers==='remove'&&on)return false;
    if(f.maneuvers==='only'&&!on)return false;
    return true
  }
  function query(s){
    return {
      dataRevision:s.dataRevision,selection:s.selection,filters:s.filters,wind:s.wind,policy:s.policy,riders:s.fleet.openRiderIds.filter(function(id){
        return s.fleet.riders[id].calculationIncluded
      }).map(function(id){
        return {
          id:id,clock:s.fleet.riders[id].clock
        }
      })
    }
  }
  function buildAnalysisFrame(s){
    var q=query(s),key=JSON.stringify(q),range=s.selection;
    if(!range){
      var times=[];
      q.riders.forEach(function(r){
        var t=s.fleet.riders[r.id].trace,S=t.session.samples;
        if(S.length){
          var a=toUtc(t,S[0]),b=toUtc(t,S[S.length-1]);
          if(finite(a)&&finite(b))times.push([a,b])
        }
      });
      range=times.length?{
        fromUtcMs:Math.min.apply(null,times.map(function(x){
          return x[0]
        })),toUtcMs:Math.max.apply(null,times.map(function(x){
          return x[1]
        }))
      }:null
    }
    var out={
      queryKey:key,revision:s.committedRevision,selection:range,calculationRiderIds:q.riders.map(function(r){
        return r.id
      }),riders:{
      },pairs:[]
    };
    s.fleet.openRiderIds.map(function(id){
      return {
        id:id
      }
    }).forEach(function(r){
      var t=s.fleet.riders[r.id].trace,S=t.session.samples,items=[],weights=[],supports=[],cs={
      },num=0,den=0;
      channels.forEach(function(k){
        cs[k]=[]
      });
      S.forEach(function(raw,i){
        var utc=toUtc(t,raw),p=derived(raw,s.wind.directionDeg),a=utc,b=utc;
        if(range&&finite(utc)&&eligible(p,t,i,s.filters,utc)){
          if(linked(t,i-1,i,s.policy.gapSec))a=(toUtc(t,S[i-1])+utc)/2;
          if(linked(t,i,i+1,s.policy.gapSec))b=(utc+toUtc(t,S[i+1]))/2;
          var iv=cut(intersect([[a,b]],[[range.fromUtcMs,range.toUtcMs]]),s.filters);
          var w=seconds(iv);
          supports=supports.concat(iv);
          weights[i]=w;
          p._sampleId=sampleId(t,p,i);
          p._utcMs=utc;
          p._weightSec=w;
          items[i]=p;
          channels.forEach(function(k){
            if(finite(p[k]))cs[k]=cs[k].concat(iv)
          });
          if(finite(p.speed)){
            num+=p.speed*w;
            den+=w
          }
        }
        else{
          weights[i]=0;
          items[i]=Object.assign({
          },p,{
            _sampleId:sampleId(t,p,i),_utcMs:utc,_weightSec:0,_excluded:true
          })
        }
      });
      var su=union(supports),valid={
      };
      channels.forEach(function(k){
        valid[k]=union(cs[k])
      });
      var sec=seconds(su),requested=range?(range.toUtcMs-range.fromUtcMs)/1000:0;
      out.riders[r.id]={
        trace:t,samples:items,weights:weights,support:su,metricSupport:valid,requestedSec:requested,eligibleSec:sec,coverage:requested?sec/requested:0,avgSpeedMs:den?num/den:null,unavailableReason:sec?null:(toUtc(t,S[0]||{
        })==null?'unknown-clock':'no-eligible-support')
      };
    });
    for(var i=0;i<q.riders.length;i++)for(var j=i+1;j<q.riders.length;j++){
      var a=q.riders[i].id,b=q.riders[j].id,iv=intersect(out.riders[a].metricSupport.speed,out.riders[b].metricSupport.speed);
      out.pairs.push({
        riderIds:[a,b],overlapSec:seconds(iv),support:iv
      })
    }
    return out
  }
  function createAnalysisStore(){
    var s=freeze({
      schemaVersion:1,dataRevision:0,committedRevision:0,selection:null,inspection:{
        utcMs:null,riderId:null,originView:null
      },fleet:{
        openRiderIds:[],primaryRiderId:null,riders:{
        }
      },filters:{
      },wind:{
        directionDeg:null,revision:0
      },policy:{
        gapSec:4,gapVersion:'p0-4sec',coverageVersion:'p0-midpoint'
      }
    }),listeners=[];
    function dispatch(a){
      if(a.expectedDataRevision!=null&&a.expectedDataRevision!==s.dataRevision)return false;
      var n=Object.assign({
      },s),calc=true;
      if(a.type==='open'){
        var t=copy(a.trace);
        t.clock=clockOf(t);
        t.id=String(t.id);
        n.fleet=copy(s.fleet);
        var previous=s.fleet.riders[t.id];
        if(previous&&previous.clock.provenance==='manual-correction'){
          t.clock=previous.clock;
        }
        n.fleet.riders[t.id]={
          trace:t,clock:t.clock,calculationIncluded:previous?previous.calculationIncluded:true,presentationRole:previous?previous.presentationRole:'normal'
        };
        if(n.fleet.openRiderIds.indexOf(t.id)<0)n.fleet.openRiderIds.push(t.id);
        if(!n.fleet.primaryRiderId)n.fleet.primaryRiderId=t.id;
        n.dataRevision++
      }
      else if(a.type==='close'){
        n.fleet=copy(s.fleet);
        delete n.fleet.riders[a.riderId];
        n.fleet.openRiderIds=n.fleet.openRiderIds.filter(function(x){
          return x!==a.riderId
        });
        if(n.fleet.primaryRiderId===a.riderId)n.fleet.primaryRiderId=n.fleet.openRiderIds[0]||null;
        n.dataRevision++
      }
      else if(a.type==='selection'){
        if(a.interval&&(!finite(a.interval.fromUtcMs)||!finite(a.interval.toUtcMs)||a.interval.toUtcMs<=a.interval.fromUtcMs))return false;
        n.selection=a.interval?copy(a.interval):null
      }
      else if(a.type==='filters')n.filters=copy(a.filters||{
      });
      else if(a.type==='wind')n.wind={
        directionDeg:finite(a.directionDeg)?a.directionDeg:null,reference:a.reference||'unknown',source:a.source||'manual',sourceId:a.sourceId||null,confidence:a.confidence||null,revision:s.wind.revision+1
      };
      else if(a.type==='inspection'){
        if (s.inspection.utcMs === (finite(a.utcMs)?a.utcMs:null) && s.inspection.riderId===(a.riderId||null)) return false;
        calc=false;
        n.inspection={
          utcMs:finite(a.utcMs)?a.utcMs:null,riderId:a.riderId||null,originView:a.originView||null
        }
      }
      else if(a.type==='role'||a.type==='included'||a.type==='clock'){
        if(!s.fleet.riders[a.riderId])return false;
        n.fleet=Object.assign({
        },s.fleet,{
          riders:Object.assign({
          },s.fleet.riders)
        });
        var r=Object.assign({
        },n.fleet.riders[a.riderId]);
        n.fleet.riders[a.riderId]=r;
        if(a.type==='role'){
          if(['normal','watch','focus','hidden'].indexOf(a.role)<0)return false;
          r.presentationRole=a.role;
          calc=false
        }
        else if(a.type==='included')r.calculationIncluded=!!a.included;
        else {
          r.clock=copy(a.clock);
          r.trace=Object.assign({
          },r.trace,{
            clock:r.clock
          });
          n.dataRevision++
        }
      }
      else return false;
      if(calc)n.committedRevision++;
      s=freeze(n);
      listeners.slice().forEach(function(fn){
        fn(s,a)
      });
      return true
    }
    return {
      getSnapshot:function(){
        return s
      },dispatch:dispatch,subscribe:function(fn){
        listeners.push(fn);
        return function(){
          listeners=listeners.filter(function(x){
            return x!==fn
          })
        }
      },commitSelection:function(interval,revision){
        return dispatch({
          type:'selection',interval:interval,expectedDataRevision:revision
        })
      },applyFilters:function(filters,revision){
        return dispatch({
          type:'filters',filters:filters,expectedDataRevision:revision
        })
      },setInspection:function(cursor){
        return dispatch(Object.assign({
          type:'inspection'
        },cursor))
      },setPresentationRole:function(id,role){
        return dispatch({
          type:'role',riderId:id,role:role
        })
      },setCalculationIncluded:function(id,value){
        return dispatch({
          type:'included',riderId:id,included:value
        })
      },setWind:function(wind){
        return dispatch(Object.assign({
          type:'wind'
        },wind))
      }
    }
  }
  function sessionForView(r){
    var src=r.trace.session,S=r.samples.map(function(p){
      var q=Object.assign({
      },p);
      q.t=p._utcMs/1000;
      if(p._excluded||!p._weightSec){
        channels.forEach(function(k){
          q[k]=null
        });
        q.gpsOutlier=true
      }
      return q
    });
    return Object.assign({
    },src,{
      samples:S,startEpoch:0,cfg:Object.assign({
      },src.cfg,{
        gapThresholdSec:4
      }),analysisWeights:r.weights
    })
  }
  var API={
    createAnalysisStore:createAnalysisStore,buildAnalysisQuery:query,buildAnalysisFrame:buildAnalysisFrame,toUtc:toUtc,sampleAtUtc:sampleAtUtc,sessionForView:sessionForView,acceptFrame:function(f,s){
      return f.queryKey===JSON.stringify(query(s))
    },elapsedAtUtc:elapsedAtUtc,intersect:intersect,seconds:seconds
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  else g.RDAnalysisWorkspace=API;
})(typeof window!=='undefined'?window:globalThis);
