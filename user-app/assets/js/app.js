/**
 * Tiranga Pay - User Frontend Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initPasswordToggles();
    initCopyButtons();
    initAccordions();
    initChatPolling();
    applyIcons();
});

/**
 * PWA Install - Add TirangaPay to Home Screen (works on phone + PC)
 */
let tpDeferredInstall = null;

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    tpDeferredInstall = e;
});

window.addEventListener('appinstalled', function () {
    tpDeferredInstall = null;
    showToast('Tiranga Pay installed successfully!', 'success');
});

function tpInstallApp() {
    if (tpDeferredInstall) {
        tpDeferredInstall.prompt();
        tpDeferredInstall.userChoice.finally(() => { tpDeferredInstall = null; });
        return;
    }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        showToast('Tap the Share icon, then choose "Add to Home Screen".', 'info');
        return;
    }
    showToast('Use the Install icon in the browser address bar, or Share > "Add to Home Screen".', 'info');
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (err) {
            navigator.serviceWorker.register('../sw.js').catch(function (e2) {
                console.warn('SW registration failed:', e2);
            });
        });
    });
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.innerHTML = `<span>${IC_svg(type === 'success' ? 'check' : type === 'error' ? 'close' : 'info')}</span> <div>${escapeHtml(message)}</div>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Toggle Password Input Visibility
 */
function initPasswordToggles() {
    document.querySelectorAll('.input-toggle-pwd').forEach(btn => {
        btn.addEventListener('click', () => {
            const inputId = btn.getAttribute('data-target');
            const input = document.getElementById(inputId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = IC_svg('eyeOff');
                } else {
                    input.type = 'password';
                    btn.innerHTML = IC_svg('eye');
                }
            }
        });
    });
}

/**
 * Copy Text to Clipboard
 */
function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = btn.getAttribute('data-copy');
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Copied to clipboard!', 'success');
                });
            } else {
                const temp = document.createElement('input');
                temp.value = text;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                document.body.removeChild(temp);
                showToast('Copied to clipboard!', 'success');
            }
        });
    });
}

/**
 * Collapsible Accordions (e.g. How to Buy Quota?)
 */
function initAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            if (content) {
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
            }
        });
    });
}

/**
 * Escape HTML for Security
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Copy Text to Clipboard (with toast feedback)
 */
function copyText(text) {
    if (!text) { showToast('Nothing to copy.', 'error'); return false; }
    try {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'), () => showToast('Copy failed.', 'error'));
        } else {
            const temp = document.createElement('textarea');
            temp.value = text;
            temp.style.position = 'fixed';
            temp.style.opacity = '0';
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast('Copied to clipboard!', 'success');
        }
        return true;
    } catch (e) {
        showToast('Copy failed.', 'error');
        return false;
    }
}

/**
 * General Form Submit AJAX Handler
 */
async function submitForm(formElement, url, callback = null) {
    const formData = new FormData(formElement);
    const submitBtn = formElement.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Processing...</span>';
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message || 'Operation successful', 'success');
            if (callback) {
                callback(result);
            }
        } else {
            showToast(result.message || 'An error occurred', 'error');
        }
    } catch (err) {
        showToast('Network or server error. Please try again.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

/**
 * Live Chat AJAX Polling
 */
let chatPollInterval = null;
function initChatPolling() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    const convId = chatContainer.getAttribute('data-conversation-id');
    if (!convId) return;

    fetchMessages(convId);
    chatPollInterval = setInterval(() => fetchMessages(convId), 6000);
}

async function fetchMessages(convId) {
    const chatContainer = document.getElementById('chat-messages-container');
    if (!chatContainer) return;

    try {
        const res = await fetch(`/api/chat/poll.php?conversation_id=${convId}`);
        const data = await res.json();
        if (data.success && data.data.messages) {
            renderChatMessages(data.data.messages);
        }
    } catch (e) {
        // quiet fail on network blip
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = messages.map(msg => `
        <div class="chat-bubble ${msg.sender_type === 'user' ? 'user-msg' : 'admin-msg'}">
            <div class="msg-text">${escapeHtml(msg.message)}</div>
            <div class="msg-time">${escapeHtml(msg.created_at)}</div>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
}

/**
 * Toggle Guidelines Accordion Visibility
 */
function toggleGuidelines(el) {
    const card = el.closest('.guidelines-card');
    if (!card) return;
    const content = card.querySelector('.guidelines-content');
    const arrow = card.querySelector('.guidelines-arrow');
    if (!content) return;

    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    }
}

