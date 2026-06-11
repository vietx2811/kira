const pendingCaptureKey = 'pendingCapture';
const captureEndpoint = 'http://127.0.0.1:47653/capture';
const contextEndpoint = 'http://127.0.0.1:47653/context';
const fileTitle = document.getElementById('file-title');
const statusNode = document.getElementById('status');
const nodeList = document.getElementById('node-list');
const combo = document.getElementById('combo');
const comboInput = document.getElementById('combo-input');
const comboList = document.getElementById('combo-list');
let pendingCapture = null;
let pendingComboCapture = null;
let currentContext = null;
void init();
async function init() {
    pendingCapture = await loadPendingCapture();
    currentContext = await loadCaptureContext();
    renderContext();
    wireDropTarget(document.querySelector('[data-target="undecided"]'), (event) => {
        const capture = captureFromDrop(event) ?? pendingCapture;
        if (!capture)
            return setStatus('No image found');
        void sendAndClose({ ...capture, captureIntent: 'undecided' });
    });
    wireDropTarget(document.querySelector('[data-target="create"]'), (event) => {
        const capture = captureFromDrop(event) ?? pendingCapture;
        if (!capture)
            return setStatus('No image found');
        pendingComboCapture = { ...capture, captureIntent: 'create-or-select' };
        combo.hidden = false;
        renderComboOptions();
        window.setTimeout(() => comboInput.focus(), 20);
    });
    comboInput.addEventListener('input', renderComboOptions);
    comboInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter')
            return;
        const title = comboInput.value.trim();
        if (!title || !pendingComboCapture)
            return;
        event.preventDefault();
        void sendAndClose({ ...pendingComboCapture, createIdeaTitle: title, captureIntent: 'create-or-select' });
    });
}
async function loadPendingCapture() {
    const stored = await chrome.storage.local.get([pendingCaptureKey]);
    return stored.pendingCapture ?? null;
}
async function loadCaptureContext() {
    try {
        const response = await fetch(contextEndpoint);
        if (!response.ok)
            return null;
        return (await response.json());
    }
    catch {
        return null;
    }
}
function renderContext() {
    fileTitle.textContent = currentContext?.fileTitle || 'Open KIRA to target nodes';
    nodeList.innerHTML = '';
    const nodes = Array.isArray(currentContext?.nodes) ? currentContext.nodes.slice(0, 24) : [];
    if (nodes.length === 0) {
        nodeList.innerHTML = '<div class="node-card"><strong>No nodes from KIRA yet</strong><span>Drop left to keep undecided.</span></div>';
        return;
    }
    for (const node of nodes) {
        const card = document.createElement('div');
        card.className = 'node-card';
        card.innerHTML = `${node.thumb ? `<img src="${escapeHtml(node.thumb)}" alt="" />` : ''}<span>${escapeHtml(node.kind)}</span><strong>${escapeHtml(node.title)}</strong>${node.subtitle ? `<span>${escapeHtml(node.subtitle)}</span>` : ''}`;
        wireDropTarget(card, (event) => {
            const capture = captureFromDrop(event) ?? pendingCapture;
            if (!capture)
                return setStatus('No image found');
            void sendAndClose({ ...capture, targetNode: { kind: node.kind, id: node.id }, captureIntent: 'target-node' });
        });
        nodeList.append(card);
    }
}
function renderComboOptions() {
    const query = comboInput.value.trim().toLowerCase();
    const nodes = (Array.isArray(currentContext?.nodes) ? currentContext.nodes : [])
        .filter((node) => !query || node.title.toLowerCase().includes(query) || node.kind.includes(query))
        .slice(0, 6);
    comboList.innerHTML = '';
    if (query) {
        comboList.append(comboButton(`Create "${comboInput.value.trim()}"`, () => {
            if (!pendingComboCapture)
                return;
            void sendAndClose({ ...pendingComboCapture, createIdeaTitle: comboInput.value.trim(), captureIntent: 'create-or-select' });
        }));
    }
    for (const node of nodes) {
        comboList.append(comboButton(`${node.kind}: ${node.title}`, () => {
            if (!pendingComboCapture)
                return;
            void sendAndClose({ ...pendingComboCapture, targetNode: { kind: node.kind, id: node.id }, captureIntent: 'create-or-select' });
        }));
    }
}
function comboButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'node-card';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}
function wireDropTarget(target, onDrop) {
    if (!(target instanceof HTMLElement))
        return;
    target.addEventListener('dragenter', (event) => {
        event.preventDefault();
        target.classList.add('is-over');
    });
    target.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (event.dataTransfer)
            event.dataTransfer.dropEffect = 'copy';
    });
    target.addEventListener('dragleave', () => target.classList.remove('is-over'));
    target.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        target.classList.remove('is-over');
        onDrop(event);
    });
}
function captureFromDrop(event) {
    const url = extractUrl(event.dataTransfer);
    if (!url)
        return null;
    return {
        kiraCapture: 1,
        kind: 'image',
        url,
        title: pendingCapture?.title || titleFromUrl(url),
        source: pendingCapture?.source || url,
        pageUrl: pendingCapture?.pageUrl,
        capturedAt: new Date().toISOString(),
    };
}
function extractUrl(dataTransfer) {
    if (!dataTransfer)
        return null;
    const htmlUrl = extractImageUrlFromHtml(dataTransfer.getData('text/html'));
    if (htmlUrl)
        return htmlUrl;
    const uri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
    return toCaptureUrl(uri);
}
function extractImageUrlFromHtml(html) {
    if (!html.trim())
        return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const candidate = doc.querySelector('img')?.getAttribute('src')
        || doc.querySelector('source')?.getAttribute('srcset')?.split(',')[0]?.trim().split(/\s+/)[0];
    return candidate ? toCaptureUrl(candidate, pendingCapture?.pageUrl) : null;
}
function toCaptureUrl(value, base) {
    try {
        const url = new URL(value, base);
        return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:' ? url.toString() : null;
    }
    catch {
        return null;
    }
}
async function sendAndClose(capture) {
    setStatus('Sending to KIRA');
    try {
        const response = await fetch(captureEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capture),
        });
        if (!response.ok)
            throw new Error('KIRA unavailable');
        await chrome.storage.local.remove([pendingCaptureKey]);
        window.close();
    }
    catch {
        setStatus('KIRA unavailable');
    }
}
function setStatus(message) {
    statusNode.textContent = message;
}
function titleFromUrl(value) {
    try {
        const url = new URL(value);
        return url.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || url.hostname;
    }
    catch {
        return 'Web image';
    }
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] ?? char));
}
export {};
