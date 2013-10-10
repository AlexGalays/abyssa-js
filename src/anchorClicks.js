var interceptAnchorClicks = (function (window) {
  if (!window || !window.document || !window.location) return;

  function detectLeftButton(event) {
    // Normalize mouse button for click event: 1 === left; 2 === middle; 3 === right
    var which = event.which, button = event.button;
    if ( !which && typeof button !== 'undefined' ) {
      // Note that in IE, 'click' event only fires from the left mouse button, so we fall back to 1 below:
      which = ( button & 1 ? 1 : ( button & 2 ? 3 : ( button & 4 ? 2 : 1 ) ) );
    }
    return (which === 1);
  }

  function anchorTarget(target) {
    while (target) {
      if (target.nodeName === 'A') return target;
      target = target.parentNode;
    }
  }

  return function (router) {
    function handler(e) {
      var event = e || window.event;
      var target = event.target || event.srcElement;
      var defaultPrevented = "defaultPrevented" in event ? event['defaultPrevented'] : event.returnValue === false;
      if (
        defaultPrevented ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        !detectLeftButton(event)
      ) {
        return;
      }

      var anchor = anchorTarget(target);

      // Check if we can navigate in-page:
      if (
        !anchor
        || anchor.getAttribute('target') //< Non-empty target.
        || anchor.host !== window.location.host //< Different host (including port).
        || anchor.protocol !== window.location.protocol //< Different protocol scheme.
        || /([a-z0-9_\-]+\:)?\/\/[^@]+@/.test(anchor.href) //< Non-empty username/password.
      ) { return; }

      if (event.preventDefault) { event.preventDefault(); }
      else { event.returnValue = false; }
      router.state(urlPathQuery(anchor));
    }

    if (window.document.addEventListener) { window.document.addEventListener('click', handler); }
    else if (window.document.attachEvent) { window.document.attachEvent('onclick', handler); }
  };
}(this));
