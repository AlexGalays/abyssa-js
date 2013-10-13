
function interceptAnchorClicks(router) {
  if (document.addEventListener)
    document.addEventListener('click', anchorClickHandler);
  else
    document.attachEvent('onclick', anchorClickHandler);
}

function anchorClickHandler(evt) {
  evt = evt || window.event;
  if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || !isLeftButtonClick(evt)) return;

  var anchor = anchorTarget(evt.target);

  if (!anchor) return;
  if (anchor.getAttribute('target') == '_blank') return;
  if (!isLocalLink(anchor)) return;

  evt.preventDefault();
  router.state(anchor.getAttribute('href'));
}

function isLeftButtonClick(evt) {
  evt = evt || window.event;
  var button = (evt.which !== undefined) ? evt.which : evt.button;
  return button == 1;
}

function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target;
    target = target.parentNode;
  }
}

function isLocalLink(anchor) {
  var host = anchor.host;

  // IE10 and below can lose the host property when setting a relative href from JS
  if (!host) {
    var tempAnchor = document.createElement("a");
    tempAnchor.href = anchor.href;
    host = tempAnchor.host;
  }

  return (host == location.host);
}