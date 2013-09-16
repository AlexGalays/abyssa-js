var interceptAnchorClicks = (function (window) {
  if (!window || !window.document || !window.location) return;

  function detectLeftButton(evt) {
    evt = evt || window.event;
    var button = evt.which || evt.button;
    return (button === 1);
  }

  function anchorTarget(target) {
    while (target) {
      if (target.nodeName === 'A') return target;
      target = target.parentNode;
    }
  }

  return function (router) {
    function handler(evt) {
      if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || !detectLeftButton(evt)) return;

      var anchor = anchorTarget(evt.target);

      if (!anchor) return;
      if (anchor.getAttribute('target') === '_blank') return;
      if (anchor.hostname !== window.location.hostname) return;

      evt.preventDefault();
      router.state(anchor.getAttribute('href'));
    }

    if (window.document.addEventListener) { window.document.addEventListener('click', handler); }
    else if (window.document.attachEvent) { window.document.attachEvent('onclick', handler); }
  };
}(this));
