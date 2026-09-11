/**
 * Tiranga Pay - Live Chat Frontend Engine (Firebase Realtime DB, secure)
 * Chat is tied to the signed-in Firebase user. The admin view is authorized by
 * real `admins/{uid}` membership (the ?admin=1 flag is only a UI hint).
 * Requires: firebase-config.js loaded first + firebase-auth-compat.js
 */

let guestChatPollTimer = null;
let lastMsgId = 0;
let currentSessionToken = '';
let isSendingMsg = false;
let guestSelectedImgFile = null;
let chatIsAdminParam = new URLSearchParams(window.location.search).get('admin') === '1';
let chatAuth = null;      // auth instance for the chat DB (user app or admin app)
let chatDB = null;        // database instance used by this chat page
let chatUser = null;      // signed-in Firebase user object (or null)
let chatIsAdmin = false;  // real admin membership (not the URL param)
let chatAdminName = '';

let tpChatBootPromise = null;
function tpChatBoot() {
    if (tpChatBootPromise) return tpChatBootPromise;
    tpChatBootPromise = (async () => {
        if (chatIsAdminParam) {
            // Admin app: chat data is shared in the same DB; use the admin session
            if (!firebase.apps.some(a => a.name === 'tpAdminApp')) {
                firebase.initializeApp(TP_FIREBASE_CONFIG, 'tpAdminApp');
            }
            chatAuth = firebase.auth(firebase.app('tpAdminApp'));
            chatDB = firebase.database(firebase.app('tpAdminApp'));
        } else {
            chatAuth = tpAuth;
            chatDB = tpDB;
        }
        if (!chatAuth) return;

        await new Promise(resolve => {
            chatAuth.onAuthStateChanged(u => { chatUser = u; resolve(); });
        });

        if (chatUser && chatIsAdminParam) {
            const snap = await chatDB.ref('admins/' + chatUser.uid).once('value').catch(() => null);
            chatIsAdmin = !!(snap && snap.exists());
            chatAdminName = snap && snap.val() ? (snap.val().name || snap.val().email || 'Support Agent') : 'Support Agent';
        }
    })();
    return tpChatBootPromise;
}

function chatRef(path) {
    return chatDB.ref(path);
}

document.addEventListener('DOMContentLoaded', async () => {
    initTopicPills();
    await tpChatBoot();

    // Chat now requires a signed-in account (rules enforce ownership).
    if (!chatUser) {
        showToast('Please login to use support chat.', 'info');
        window.location.href = '../login.html';
        return;
    }

    initGuestChatForm();
    initActiveChatSession();
    if (document.getElementById('guestSessionsListContainer')) {
        loadGuestSessionsList();
    }
});

/**
 * Handle Quick Topic Selection Pills
 */
function initTopicPills() {
    document.querySelectorAll('.topic-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.topic-pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const topic = btn.getAttribute('data-topic');
            const subjectInput = document.getElementById('chat_subject');
            if (subjectInput) {
                subjectInput.value = topic;
                subjectInput.focus();
            }
        });
    });
}

/**
 * Handle Start Live Chat Form Submission (creates session in Firebase)
 */
function initGuestChatForm() {
    const form = document.getElementById('guestStartChatForm');
    if (!form) return;

    // Lock the identity to the signed-in account
    const emailInput = document.getElementById('chat_email');
    const nameInput = document.getElementById('chat_name');
    if (emailInput && chatUser) {
        emailInput.value = chatUser.email || '';
        emailInput.setAttribute('readonly', 'readonly');
    }
    if (nameInput && chatUser && !nameInput.value) {
        nameInput.value = localStorage.getItem('tp_user_name') || (chatUser.email ? chatUser.email.split('@')[0] : '');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!chatDB) { showToast('Firebase not connected. Check firebase-config.js', 'error'); return; }
        if (!chatUser) { showToast('Please login first.', 'error'); return; }

        const name = ((nameInput && nameInput.value) || localStorage.getItem('tp_user_name') || '').trim();
        const email = (chatUser.email || '').trim();
        const subjectInput = document.getElementById('chat_subject');
        const msgInput = document.getElementById('chat_message');

        const subject = subjectInput ? subjectInput.value.trim() : '';
        const message = msgInput ? msgInput.value.trim() : '';

        // Validation
        if (!name || name.length < 2) {
            showToast('Please enter your full name (minimum 2 characters).', 'error');
            if (nameInput) nameInput.focus();
            return;
        }
        if (!email) {
            showToast('Your account email is missing.', 'error');
            return;
        }
        if (!subject || subject.length < 3) {
            showToast('Please enter a valid subject.', 'error');
            if (subjectInput) subjectInput.focus();
            return;
        }
        if (!message || message.length < 3) {
            showToast('Please describe your issue in the message field.', 'error');
            if (msgInput) msgInput.focus();
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Starting Chat...</span>';
        }

        try {
            const token = tpId();
            const now = tpNow();

            await chatRef('chats/' + token).set({
                name: name,
                email: email,
                subject: subject,
                status: 'open',
                created_at: now,
                last_message: message,
                last_message_time: tpFormatTime(now)
            });

            // Personal index so the owner can list their own sessions securely
            await chatRef('chat_index/' + chatUser.uid + '/' + token).set(true);

            await chatRef('chats/' + token + '/messages').push({
                sender_type: 'system',
                sender: 'system',
                message: 'Support session started. Our team typically responds within minutes.',
                created_at: now,
                formatted_time: tpFormatTime(now)
            });

            await chatRef('chats/' + token + '/messages').push({
                sender_type: 'guest',
                sender: name,
                message: message,
                created_at: now,
                formatted_time: tpFormatTime(now)
            });

            localStorage.setItem('tp_chat_email', email);
            localStorage.setItem('tp_chat_name', name);

            showToast('Support chat session created!', 'success');
            window.location.href = 'guest-chat-room.html?token=' + encodeURIComponent(token);
        } catch (err) {
            showToast('Error creating chat session. Check Firebase rules.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origBtnText;
            }
        }
    });
}

/**
 * Initialize Active Chat Room & Real-time Polling
 */
function initActiveChatSession() {
    const chatContainer = document.getElementById('chatMessagesViewport');
    if (!chatContainer) return;

    currentSessionToken = chatContainer.getAttribute('data-token') || '';
    if (!currentSessionToken) return;

    // Fetch initial messages & start polling loop every 3 seconds
    fetchGuestMessages();
    guestChatPollTimer = setInterval(fetchGuestMessages, 3000);

    // Message Input Key Listeners
    const msgInput = document.getElementById('guestChatInput');
    const sendBtn = document.getElementById('btnGuestChatSend');

    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendGuestMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sendGuestMessage();
        });
    }

    // Close Session Button
    const closeBtn = document.getElementById('btnGuestCloseChat');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to close this support session?')) {
                closeGuestSession();
            }
        });
    }
}

/**
 * Fetch Live Chat Messages + session status from Firebase
 */
async function fetchGuestMessages() {
    if (!currentSessionToken || !chatDB) return;

    try {
        const [sessSnap, msgSnap] = await Promise.all([
            chatRef('chats/' + currentSessionToken).once('value'),
            chatRef('chats/' + currentSessionToken + '/messages').once('value')
        ]);

        const session = sessSnap.val();
        updateSessionStatusUI(session || { status: 'closed', close_reason: 'Session not found' });

        const raw = msgSnap.val() || {};
        const messages = Object.values(raw).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        if (messages && messages.length > 0) {
            appendGuestMessages(messages);
        }
    } catch (e) {
        // quiet fail on transient network glitches
    }
}

/**
 * Handle Guest Image File Selection with 2MB Limit Check & Warning Modal
 * (Validation kept; attachments are not uploaded in this demo)
 */
function handleGuestImageSelect(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB

    const validExts = /\.(jpe?g|png|webp)$/i;
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validExts.test(file.name) || (file.type && !validMimes.includes(file.type.toLowerCase()))) {
        showToast('Please select a JPG, JPEG, PNG or WEBP image.', 'error');
        input.value = '';
        clearGuestSelectedImage();
        return;
    }

    if (file.size > maxSizeBytes) {
        showGuestFileSizeAlert('Please select an image under 2 MB.');
        input.value = '';
        clearGuestSelectedImage();
        return;
    }

    guestSelectedImgFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const thumb = document.getElementById('guestImgPreviewThumb');
        const nameEl = document.getElementById('guestImgName');
        const bar = document.getElementById('guestImgPreviewBar');

        if (thumb) thumb.src = e.target.result;
        if (nameEl) nameEl.textContent = file.name + ` (${(file.size / 1024).toFixed(1)} KB)`;
        if (bar) bar.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function clearGuestSelectedImage() {
    guestSelectedImgFile = null;
    const input = document.getElementById('guestChatImgInput');
    if (input) input.value = '';
    const bar = document.getElementById('guestImgPreviewBar');
    if (bar) bar.style.display = 'none';
}

function showGuestFileSizeAlert(msg) {
    const msgEl = document.getElementById('guestFileSizeModalMsg');
    if (msgEl) msgEl.textContent = msg;
    const modal = document.getElementById('guestFileSizeModalOverlay');
    if (modal) modal.style.display = 'flex';
}

function closeGuestFileSizeModal() {
    const modal = document.getElementById('guestFileSizeModalOverlay');
    if (modal) modal.style.display = 'none';
}

function openGuestLightbox(url) {
    const img = document.getElementById('guestLightboxImg');
    if (img) img.src = url;
    const modal = document.getElementById('guestLightboxOverlay');
    if (modal) modal.style.display = 'flex';
}

function closeGuestLightbox() {
    const modal = document.getElementById('guestLightboxOverlay');
    if (modal) modal.style.display = 'none';
    const img = document.getElementById('guestLightboxImg');
    if (img) img.src = '';
}

/**
 * Message rendering — INCREMENTAL: only new bubbles are appended.
 */
let renderedMsgCount = 0;

function buildGuestBubble(msg) {
    const bubble = document.createElement('div');
    const hasText = Boolean(msg.message && msg.message.trim());

    if (msg.sender_type === 'guest') {
        bubble.className = 'chat-bubble guest';
        bubble.innerHTML = `
            ${hasText ? `<div>${escapeHtml(msg.message)}</div>` : ''}
            <div class="msg-meta">${escapeHtml(msg.formatted_time || '')}</div>
        `;
    } else if (msg.sender_type === 'admin') {
        bubble.className = 'chat-bubble admin';
        bubble.innerHTML = `
            <div class="agent-name">${IC_svg('headset')} ${escapeHtml(msg.sender || 'Support Agent')}</div>
            ${hasText ? `<div>${escapeHtml(msg.message)}</div>` : ''}
            <div class="msg-meta">${escapeHtml(msg.formatted_time || '')}</div>
        `;
    } else {
        bubble.className = 'chat-bubble system';
        bubble.innerHTML = `<span>${IC_svg('info')} ${escapeHtml(msg.message)}</span>`;
    }
    return bubble;
}

function appendGuestMessages(messages) {
    const container = document.getElementById('chatMessagesViewport');
    if (!container) return;

    if (messages.length <= renderedMsgCount) return; // nothing new → touch nothing

    const fresh = messages.slice(renderedMsgCount);
    fresh.forEach(msg => {
        container.appendChild(buildGuestBubble(msg));
    });
    renderedMsgCount = messages.length;

    container.scrollTop = container.scrollHeight;
}

/** Append a single locally-created message instantly (used after send). */
function appendSingleMessage(msg) {
    const container = document.getElementById('chatMessagesViewport');
    if (!container) return;

    container.appendChild(buildGuestBubble(msg));
    renderedMsgCount += 1;
    container.scrollTop = container.scrollHeight;
}

/**
 * Update UI for Closed/Expired states
 */
function updateSessionStatusUI(session) {
    const statusBadge = document.getElementById('chatStatusBadge');
    if (statusBadge && session.status) {
        statusBadge.className = `status-badge ${session.status}`;
        statusBadge.textContent = session.status.toUpperCase();
    }

    const inputBar = document.getElementById('guestMessageForm');
    const previewBar = document.getElementById('guestImgPreviewBar');
    const closedBanner = document.getElementById('chatClosedBanner');
    const closeBtn = document.getElementById('btnGuestCloseChat');

    if (session.status === 'closed' || session.status === 'expired') {
        if (inputBar) inputBar.style.display = 'none';
        if (previewBar) previewBar.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'none';
        if (closedBanner) {
            closedBanner.style.display = 'block';
            const desc = closedBanner.querySelector('.chat-closed-desc');
            if (desc) {
                desc.textContent = session.close_reason || (session.status === 'expired' ? 'This conversation has been closed due to inactivity.' : 'This support conversation was closed.');
            }
        }
        if (guestChatPollTimer) {
            clearInterval(guestChatPollTimer);
            guestChatPollTimer = null;
        }
    }
}

/**
 * Send Guest/Admin Reply Message via Firebase (text only in this demo)
 */
async function sendGuestMessage() {
    if (isSendingMsg || !currentSessionToken || !chatDB || !chatUser) return;

    const input = document.getElementById('guestChatInput');
    const sendBtn = document.getElementById('btnGuestChatSend');

    const text = input ? input.value.trim() : '';
    if (!text) return;

    isSendingMsg = true;
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.6';
    }

    try {
        const now = tpNow();

        const senderName = chatIsAdmin
            ? (chatAdminName || 'Support Agent')
            : (localStorage.getItem('tp_chat_name') || chatUser.email || 'Guest');

        const msgRef = chatRef('chats/' + currentSessionToken + '/messages').push();
        const newMsg = {
            sender_type: chatIsAdmin ? 'admin' : 'guest',
            sender: senderName,
            message: text,
            created_at: now,
            formatted_time: tpFormatTime(now)
        };
        await msgRef.set(newMsg);

        await chatRef('chats/' + currentSessionToken).update({
            last_message: text,
            last_message_time: tpFormatTime(now)
        });

        if (input) input.value = '';
        clearGuestSelectedImage();
        appendSingleMessage(newMsg);
    } catch (err) {
        showToast('Error sending message. Check Firebase rules.', 'error');
    } finally {
        isSendingMsg = false;
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.style.opacity = '1';
        }
    }
}

/**
 * Close Session from Guest Side
 */
async function closeGuestSession() {
    if (!chatDB) return;
    try {
        await chatRef('chats/' + currentSessionToken).update({
            status: 'closed',
            close_reason: 'Closed by user',
            closed_at: tpNow()
        });
        showToast('Chat session closed.', 'info');
        fetchGuestMessages();
    } catch (err) {
        showToast('Error closing chat session.', 'error');
    }
}

/**
 * Load Previous Sessions List — admins see all, a user sees only their own
 */
async function loadGuestSessionsList() {
    const container = document.getElementById('guestSessionsListContainer');
    if (!container) return;
    await tpChatBoot();
    if (!chatDB) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Firebase not connected.</div>';
        return;
    }

    try {
        let sessions = [];
        if (chatIsAdmin) {
            const snap = await chatRef('chats').once('value');
            const raw = snap.val() || {};
            sessions = Object.keys(raw).map(token => { raw[token].token = token; return raw[token]; });
        } else if (chatUser) {
            const idxSnap = await chatRef('chat_index/' + chatUser.uid).once('value').catch(() => null);
            const tokens = Object.keys((idxSnap && idxSnap.val()) || {});
            const parts = await Promise.all(tokens.map(t => chatRef('chats/' + t).once('value').catch(() => null)));
            sessions = parts.map((s, i) => {
                const v = s && s.val();
                if (!v) return null;
                v.token = tokens[i];
                return v;
            }).filter(Boolean);
        }
        sessions.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

        if (sessions.length > 0) {
            container.innerHTML = sessions.map(s =>
                `<a href="guest-chat-room.html?token=${encodeURIComponent(s.token)}${chatIsAdmin ? '&admin=1' : ''}" class="session-item-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div style="font-weight: 800; font-size: 14px; color: var(--text);">${escapeHtml(s.subject || 'Support Session')}</div>
                        <span class="status-badge ${s.status}">${(s.status || 'open').toUpperCase()}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        ${escapeHtml(s.last_message || 'No messages yet')}
                    </div>
                    ${chatIsAdmin ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(s.name || '')} • ${escapeHtml(s.email || '')}</div>` : ''}
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; text-align: right;">
                        ${escapeHtml(s.last_message_time || '')}
                    </div>
                </a>`
            ).join('');
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">${IC_svg('chat')}</div>
                    <div style="font-weight: 700; font-size: 14px;">No previous chat sessions</div>
                    <div style="font-size: 12px; margin-top: 4px;">Click "+ New Chat" above to talk to our support team.</div>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load sessions.</div>';
    }
}