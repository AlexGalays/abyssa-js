
let router

function onMouseDown(evt) {
  const href = hrefForEvent(evt)

  if (href !== undefined)
    router.transitionTo(href)
}

function onMouseClick(evt) {
  const href = hrefForEvent(evt)

  if (href !== undefined) {
    evt.preventDefault()
    router.transitionTo(href)
  }
}

function hrefForEvent(evt) {
  if (evt.defaultPrevented || evt.metaKey || evt.ctrlKey || !isLeftButton(evt)) return

  const target = evt.target
  const anchor = anchorTarget(target)
  if (!anchor) return

  const dataNav = anchor.getAttribute('data-nav')

  if (dataNav == 'ignore') return
  if (evt.type == 'mousedown' && dataNav != 'mousedown') return

  let href = anchor.getAttribute('href')

  if (!href) return
  if (href.charAt(0) == '#') {
    if (router.options.urlSync != 'hash') return
    href = href.slice(1)
  }
  if (anchor.getAttribute('target') == '_blank') return
  if (!isLocalLink(anchor)) return

  // At this point, we have a valid href to follow.
  // Did the navigation already occur on mousedown though?
  if (evt.type == 'click' && dataNav == 'mousedown') {
    evt.preventDefault()
    return
  }

  return href
}

function isLeftButton(evt) {
  return evt.which == 1
}

function anchorTarget(target) {
  while (target) {
    if (target.nodeName == 'A') return target
    target = target.parentNode
  }
}

function isLocalLink(anchor) {
  let hostname = anchor.hostname
  let port = anchor.port
  let protocol = anchor.protocol

  // IE10 can lose the hostname/port property when setting a relative href from JS
  if (!hostname) {
    const tempAnchor = document.createElement("a")
    tempAnchor.href = anchor.href
    hostname = tempAnchor.hostname
    port = tempAnchor.port
    protocol = tempAnchor.protocol
  }
  
  const defaultPort = protocol.split(':')[0] === 'https' ? '443' : '80'

  const sameHostname = (hostname == location.hostname)
  const samePort = (port || defaultPort) == (location.port || defaultPort)

  return sameHostname && samePort
}


export default function interceptAnchors(forRouter) {
  router = forRouter

  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('click', onMouseClick)
}
