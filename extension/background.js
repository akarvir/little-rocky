const WS_URL = 'ws://127.0.0.1:7331'
const BLOCKLIST = ['twitter.com', 'x.com', 'youtube.com', 'instagram.com', 'tiktok.com']
const RECONNECT_DELAY_MS = 3000

let ws = null
let activeBlockedTabId = null

function isBlocked(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKLIST.some(b => host === b || host.endsWith(`.${b}`))
  } catch {
    return false
  }
}

// MV3 service workers terminate after ~30s of inactivity. setTimeout does not
// keep the worker alive, so reconnect relies on the next tab event restarting
// the worker and calling connect() again from module scope.
function connect() {
  try {
    ws = new WebSocket(WS_URL)

    ws.addEventListener('open', () => {
      console.log('[rocky-ext] connected')
    })

    ws.addEventListener('close', () => {
      ws = null
      setTimeout(connect, RECONNECT_DELAY_MS)
    })

    ws.addEventListener('error', () => {
      ws?.close()
    })
  } catch {
    setTimeout(connect, RECONNECT_DELAY_MS)
  }
}

function send(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

function notifyDistraction(url) {
  send({ type: 'distraction', url })
}

function notifyDistractionEnd() {
  send({ type: 'distraction_end' })
}

function setActiveBlocked(tabId, url) {
  const blocked = url ? isBlocked(url) : false
  if (blocked) {
    activeBlockedTabId = tabId
    notifyDistraction(url)
  } else if (activeBlockedTabId !== null) {
    activeBlockedTabId = null
    notifyDistractionEnd()
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
    if (!activeTab || activeTab.id !== tabId) return
    setActiveBlocked(tabId, tab.url)
  })
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab || !tab.url) return
    setActiveBlocked(tabId, tab.url)
  })
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeBlockedTabId) {
    activeBlockedTabId = null
    notifyDistractionEnd()
  }
})

connect()
