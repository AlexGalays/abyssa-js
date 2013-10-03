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

      // Check if we can navigate in-page:
      if (
        !anchor
        || anchor.getAttribute('target') //< Non-empty target.
        || anchor.host !== window.location.host //< Different host (including port).
        || anchor.protocol !== window.location.protocol //< Different protocol scheme.
        || /([a-z0-9_\-]+\:)?\/\/[^@]+@/.test(anchor.href) //< Non-empty username/password.
      ) { return; }

      evt.preventDefault();
      router.state(urlPathQuery(anchor));
    }

    if (window.document.addEventListener) { window.document.addEventListener('click', handler); }
    else if (window.document.attachEvent) { window.document.attachEvent('onclick', handler); }
  };
}(this));
