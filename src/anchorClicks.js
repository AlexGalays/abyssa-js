
var interceptAnchorClicks = (function() {

  var ieButton;

  function anchorClickHandler(evt) {
    evt = evt || window.event;

    var defaultPrevented = ('defaultPrevented' in event)
      ? event.defaultPrevented
      : (event.returnValue === false);

    if (defaultPrevented || evt.metaKey || evt.ctrlKey || !isLeftButtonClick(evt)) return;

    var target = evt.target || evt.srcElement;
    var anchor = anchorTarget(target);
    if (!anchor) return;

    var href = anchor.getAttribute('href');

    if (href.charAt(0) == '#') return;
    if (anchor.getAttribute('target') == '_blank') return;
    if (!isLocalLink(anchor)) return;

    if (evt.preventDefault)
      evt.preventDefault();
    else
      evt.returnValue = false;

    router.state(href);
  }

  function isLeftButtonClick(evt) {
    evt = evt || window.event;
    var button = (evt.which !== undefined) ? evt.which : ieButton;
    return button == 1;
  }

  function anchorTarget(target) {
    while (target) {
      if (target.nodeName == 'A') return target;
      target = target.parentNode;
    }
  }

  // IE does not provide the correct event.button information on 'onclick' handlers 
  // but it does on mousedown/mouseup handlers.
  function rememberIeButton(evt) {
    ieButton = (evt || window.event).button;
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


  return function (router) {
    if (document.addEventListener)
      document.addEventListener('click', anchorClickHandler);
    else {
      document.attachEvent('onmousedown', rememberIeButton);
      document.attachEvent('onclick', anchorClickHandler);
    }
  };


})();