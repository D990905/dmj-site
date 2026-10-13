(function () {
  'use strict';
  var summaryY = 0, returnKey = null, detailOpen = false, navigationId = 0, backPending = false;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function jump(y) {
    var root=document.documentElement, previous=root.style.scrollBehavior;
    root.style.scrollBehavior='auto';
    window.scrollTo(0,y);
    root.style.scrollBehavior=previous;
  }
  function hashKey() {
    var match = /^#skill-detail=(.+)$/.exec(location.hash);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch (_) { return null; }
  }
  function target(key) {
    if (key === 'overall') {
      var body = document.getElementById('overall-body');
      return body && body.innerHTML ? { title:'진단 해석', html:body.innerHTML } : null;
    }
    var card = Array.prototype.find.call(document.querySelectorAll('[data-axis-key]'), function (e) { return e.dataset.axisKey === key; });
    var detail = card && card.querySelector('.skill-weakness-card__detail');
    return detail ? { title:card.querySelector('h3').textContent, html:detail.innerHTML } : null;
  }
  function show(key, restore) {
    var content = key && target(key), panel = document.getElementById('skill-detail-view');
    var wasOpen = detailOpen;
    detailOpen = !!content;
    document.querySelectorAll('[data-toggle-detail]').forEach(function (b) {b.setAttribute('aria-expanded', detailOpen && b.closest('[data-axis-key]').dataset.axisKey === key ? 'true' : 'false');});
    document.documentElement.classList.toggle('skill-detail-mode', detailOpen);
    panel.hidden = !detailOpen;
    if (content) {
      panel.dataset.kind = key === 'overall' ? 'overall' : 'axis';
      document.getElementById('skill-detail-title').textContent = content.title;
      document.getElementById('skill-detail-content').innerHTML = content.html;
      jump(0);
      document.getElementById('skill-detail-title').focus({preventScroll:true});
      requestAnimationFrame(function () { if (detailOpen) jump(0); });
    } else {
      document.getElementById('skill-detail-content').replaceChildren();
      if (wasOpen || restore) {
        var state = history.state || {};
        var y = Number.isFinite(state.skillSummaryY) ? state.skillSummaryY : summaryY;
        var trigger = returnKey === 'overall' ? document.querySelector('[data-skill-overall]') : Array.prototype.find.call(document.querySelectorAll('[data-axis-key]'), function (e) {return e.dataset.axisKey === returnKey;});
        if (trigger) (trigger.querySelector('[data-toggle-detail]') || trigger).focus({preventScroll:true});
        requestAnimationFrame(function () { jump(y); });
      }
    }
  }
  function open(key) {
    if (!target(key) || (detailOpen && hashKey() === key)) return;
    summaryY = window.scrollY;
    returnKey = key;
    document.querySelectorAll('[data-toggle-detail]').forEach(function (b) {b.setAttribute('aria-expanded', b.closest('[data-axis-key]').dataset.axisKey === key ? 'true' : 'false');});
    history.replaceState(Object.assign({},history.state,{skillSummaryY:summaryY}),'',location.href);
    history.pushState(Object.assign({},history.state,{skillDetail:key,skillNavigationId:++navigationId,skillSummaryY:summaryY}),'',location.pathname+location.search+'#skill-detail='+encodeURIComponent(key));
    show(key);
  }
  function back() {
    if (!detailOpen || backPending) return;
    backPending = true;
    if (history.state && history.state.skillNavigationId) history.back();
    else {
      history.replaceState(Object.assign({},history.state,{skillDetail:null}),'',location.pathname+location.search+'#assessment');
      show(null,true);
      backPending = false;
    }
  }
  function clear() {
    if (detailOpen || hashKey()) history.replaceState({},'',location.pathname+location.search+'#assessment');
    returnKey=null;
    show(null);
  }
  window.DMJSkillNavigation = {open:open,clear:clear};
  document.addEventListener('DOMContentLoaded',function () {
    document.querySelectorAll('[data-skill-back]').forEach(function (b) {b.addEventListener('click',back);});
    var overall = document.querySelector('[data-skill-overall]');
    if (overall) overall.addEventListener('click',function () {open('overall');});
    show(hashKey());
  });
  window.addEventListener('popstate',function () {backPending=false;show(hashKey(),true);});
  window.addEventListener('hashchange',function () {show(hashKey(),true);});
})();
