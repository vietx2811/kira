const pendingCaptureKey = 'pendingCapture';
const captureEndpoint = 'http://127.0.0.1:47653/capture';
const dragWindowPath = 'drag-window.html';
let dragWindowId = null;
let dragWindowOpening = false;
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'kira-copy-image',
        title: 'Capture Image to KIRA',
        contexts: ['image'],
    });
    chrome.contextMenus.create({
        id: 'kira-copy-page',
        title: 'Capture Page to KIRA',
        contexts: ['page'],
    });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const tabTitle = tab?.title?.trim() || 'Untitled';
    const tabUrl = tab?.url || info.pageUrl || '';
    const capture = info.menuItemId === 'kira-copy-image' && info.srcUrl
        ? {
            kiraCapture: 1,
            kind: 'image',
            url: info.srcUrl,
            title: tabTitle,
            source: tabUrl || info.srcUrl,
            pageUrl: tabUrl,
            previewUrl: info.srcUrl,
            capturedAt: new Date().toISOString(),
        }
        : {
            kiraCapture: 1,
            kind: 'page',
            url: tabUrl,
            title: tabTitle,
            source: tabUrl,
            capturedAt: new Date().toISOString(),
        };
    void sendOrStageCapture(capture);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isOpenDragWindowMessage(message))
        return;
    void openDragWindow(message.capture)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
    return true;
});
chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === dragWindowId)
        dragWindowId = null;
});
async function sendOrStageCapture(capture) {
    if (await postCapture(capture))
        return;
    await chrome.storage.local.set({ [pendingCaptureKey]: capture });
    await chrome.action?.openPopup?.();
}
async function openDragWindow(capture) {
    if (dragWindowOpening)
        return;
    dragWindowOpening = true;
    try {
        await chrome.storage.local.set({ [pendingCaptureKey]: capture });
        const windowOptions = {
            width: 520,
            height: 440,
            left: Math.max(40, Math.round((globalThis.screen?.availWidth ?? 1440) / 2 - 260)),
            top: Math.max(40, Math.round((globalThis.screen?.availHeight ?? 900) - 520)),
            focused: true,
        };
        if (dragWindowId !== null) {
            try {
                await chrome.windows.update(dragWindowId, windowOptions);
                return;
            }
            catch {
                dragWindowId = null;
            }
        }
        const created = await chrome.windows.create({
            url: chrome.runtime.getURL(dragWindowPath),
            type: 'popup',
            ...windowOptions,
        });
        dragWindowId = created.id ?? null;
    }
    finally {
        dragWindowOpening = false;
    }
}
function isOpenDragWindowMessage(message) {
    if (!message || typeof message !== 'object')
        return false;
    const candidate = message;
    return candidate.type === 'kira-open-drag-window'
        && candidate.capture?.kiraCapture === 1
        && (candidate.capture.kind === 'image' || candidate.capture.kind === 'page')
        && typeof candidate.capture.url === 'string';
}
async function postCapture(capture) {
    try {
        const response = await fetch(captureEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capture),
        });
        return response.ok;
    }
    catch {
        return false;
    }
}
export {};
