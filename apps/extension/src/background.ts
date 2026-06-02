import type { PendingCapture } from './types'

const pendingCaptureKey = 'pendingCapture'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'vixio-copy-image',
    title: 'Capture Image to Vixio',
    contexts: ['image'],
  })
  chrome.contextMenus.create({
    id: 'vixio-copy-page',
    title: 'Capture Page to Vixio',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const tabTitle = tab?.title?.trim() || 'Untitled'
  const tabUrl = tab?.url || info.pageUrl || ''
  const capture: PendingCapture =
    info.menuItemId === 'vixio-copy-image' && info.srcUrl
      ? {
          vixioCapture: 1,
          kind: 'image',
          url: info.srcUrl,
          title: tabTitle,
          source: tabUrl || info.srcUrl,
          pageUrl: tabUrl,
          previewUrl: info.srcUrl,
          capturedAt: new Date().toISOString(),
        }
      : {
          vixioCapture: 1,
          kind: 'page',
          url: tabUrl,
          title: tabTitle,
          source: tabUrl,
          capturedAt: new Date().toISOString(),
        }

  void chrome.storage.local.set({ [pendingCaptureKey]: capture })
  void chrome.action?.openPopup?.()
})
