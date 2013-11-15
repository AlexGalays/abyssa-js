var interceptAnchorClicks = (function (window) {
  if (!window || !window.document) return;

  var location = getLocationObject();

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

  function matchProtocolHostAgainstLocation(anchor) {
    /* IE can lose the `protocol`, `host`, `port`, `hostname` properties when setting a relative href from JS.
     * Moreover, in some cases IE returns incorrect parts for the initial href (having the correct `href` value).
     * We use a temporary anchor to reparse the values from `href` which is always absolute.
     * @see http://stackoverflow.com/questions/10755943/ie-forgets-an-a-tags-hostname-after-changing-href
     */
    var tempAnchor = window.document.createElement("A");
    tempAnchor.href = anchor.href;

    /* In IE, the temporary anchor is discovered to have `port` === "80" by default,
     * the `host` therefore contains ":80" part;
     * the location object has got `port` === "" by default and port specification is missing from the `host` value.
     * So, we cannot compare `host` and have to compare `hostname` and `port` separately.
     */

    // Compare protocol scheme, hostname and port:
    return (tempAnchor.protocol === location.protocol && tempAnchor.hostname === location.hostname && (tempAnchor.port || '80') === (location.port || '80'));
  }

  return function (router, container) {
    if (!container) {
      container = window.document;
    }

    function handler(e) {
      var event = e || window.event;
      var target = event.target || event.srcElement;
      var defaultPrevented = "defaultPrevented" in event ? event['defaultPrevented'] : event.returnValue === false;

      if (
        defaultPrevented
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
        || !detectLeftButton(event)
      ) {
        return;
      }

      var anchor = anchorTarget(target);

      // Check if we can navigate in-page:
      if (
        !anchor
        || !anchor.getAttribute('href', 2) //< Empty href attribute.
        || anchor.getAttribute('target') //< Non-empty target attribute.
        || !matchProtocolHostAgainstLocation(anchor) //< Different protocol scheme, hostname or port.
        || /([a-z0-9_\-]+\:)?\/\/[^@]+@/.test(anchor.href) //< Non-empty username/password.
      ) {
        return;
      }

      if (event.preventDefault) { event.preventDefault(); }
      else { event.returnValue = false; }

      router.state(urlPathQuery(anchor));
    }

    if (container.addEventListener) { container.addEventListener('click', handler); }
    else if (container.attachEvent) { container.attachEvent('onclick', handler); }

    // Return a teardown function:
    return function () {
      if (container.removeEventListener) { container.removeEventListener('click', handler); }
      else if (container.detachEvent) { container.detachEvent('onclick', handler); }
    };
  };
}(this));
// Export for external usage and tests:
Abyssa.interceptAnchorClicks = interceptAnchorClicks;
