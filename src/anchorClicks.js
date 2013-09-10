
function detectLeftButton(evt) {
    evt = evt || window.event;
    var button = evt.which || evt.button;
    return button == 1;
}

function interceptAnchorClicks(router) {
  function handler(evt) {
    if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || !detectLeftButton(evt)) return;

    var anchor = anchorTarget(evt.target);

    if (!anchor) return;
    if (anchor.getAttribute('target') == '_blank') return;
    if (anchor.hostname != location.hostname) return;

    evt.preventDefault();
    router.state(anchor.getAttribute('href'));
  }
  
  if (document.addEventListener) { document.addEventListener('click', handler); }
  else if (document.attachEvent) { document.attachEvent('onclick', handler); }
}


function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target;
    target = target.parentNode;
  }
}