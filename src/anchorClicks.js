
function interceptAnchorClicks(router) {
  document.addEventListener('click', function(evt) {
    if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || evt.button == 1) return;

    var anchor = anchorTarget(evt.target);

    if (!anchor) return;
    if (anchor.getAttribute('target') == '_blank') return;
    if (anchor.hostname != location.hostname) return;

    evt.preventDefault();
    router.state(anchor.getAttribute('href'));
  });
}


function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target;
    target = target.parentNode;
  }
}