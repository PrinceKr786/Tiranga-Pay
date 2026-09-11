/**
 * Tiranga Pay - Guest Live Chat Frontend Engine (Firebase Realtime DB)
 * Requires: firebase-config.js loaded first
 */

let guestChatPollTimer = null;
let lastMsgId = 0;
let currentSessionToken = '';
let isSendingMsg = false;
let currentSenderType = (new URLSearchParams(window.location.search).get('admin') === '1') ? 'admin' : 'guest';

document.addEventListener('DOMContentLoaded', () => {
    initTopicPills();
    initGuestChatForm();
    initActiveChatSession();
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!tpDB) { showToast('Firebase not connected. Check firebase-config.js', 'error'); return; }

        const nameInput = document.getElementById('chat_name');
        const emailInput = document.getElementById('chat_email');
        const subjectInput = document.getElementById('chat_subject');
        const msgInput = document.getElementById('chat_message');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const subject = subjectInput ? subjectInput.value.trim() : '';
        const message = msgInput ? msgInput.value.trim() : '';

        // Validation
        if (!name || name.length < 2) {
            showToast('Please enter your full name (minimum 2 characters).', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            showToast('Please enter a valid email address.', 'error');
            if (emailInput) emailInput.focus();
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

            await tpRef('chats/' + token).set({
                name: name,
                email: email,
                subject: subject,
                status: 'open',
                created_at: now,
                last_message: message,
                last_message_time: tpFormatTime(now)
            });

            await tpRef('chats/' + token + '/messages').push({
                sender_type: 'system',
                sender: 'system',
                message: 'Support session started. Our team typically responds within minutes.',
                created_at: now,
                formatted_time: tpFormatTime(now)
            });

            await tpRef('chats/' + token + '/messages').push({
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
    if (!currentSessionToken || !tpDB) return;

    try {
        const [sessSnap, msgSnap] = await Promise.all([
            tpRef('chats/' + currentSessionToken).once('value'),
            tpRef('chats/' + currentSessionToken + '/messages').once('value')
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

let guestSelectedImgFile = null;

/**
 * Handle Guest Image File Selection with 2MB Limit Check & Warning Modal
 * (Validation kept; attachments are not uploaded in this Firebase demo)
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
 * Never re-renders existing messages, so the chat never "refreshes"
 * more than needed.
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
            <div class="agent-name">${IC_svg('headset')} Support Agent</div>
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
    if (isSendingMsg || !currentSessionToken || !tpDB) return;

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

        const msgRef = tpRef('chats/' + currentSessionToken + '/messages').push();
        const newMsg = {
            sender_type: currentSenderType,
            sender: currentSenderType === 'admin'
                ? (localStorage.getItem('tp_admin_user') || 'Support Agent')
                : (localStorage.getItem('tp_chat_name') || 'Guest'),
            message: text,
            created_at: now,
            formatted_time: tpFormatTime(now)
        };
        await msgRef.set(newMsg);

        await tpRef('chats/' + currentSessionToken).update({
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
    if (!tpDB) return;
    try {
        await tpRef('chats/' + currentSessionToken).update({
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
 * Load Previous Sessions List for "Your Sessions" view
 */
async function loadGuestSessionsList() {
    const container = document.getElementById('guestSessionsListContainer');
    if (!container) return;
    if (!tpDB) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Firebase not connected.</div>';
        return;
    }

    try {
        const snap = await tpRef('chats').once('value');
        const raw = snap.val() || {};
        const isAdmin = (new URLSearchParams(window.location.search).get('admin') === '1');
        const myEmail = (localStorage.getItem('tp_chat_email') || '').toLowerCase();

        let sessions = Object.keys(raw).map(token => {
            const s = raw[token];
            s.token = token;
            return s;
        });

        // Admin sees all, guest sees only their own email
        if (!isAdmin && myEmail) {
            sessions = sessions.filter(s => (s.email || '').toLowerCase() === myEmail);
        }
        sessions.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

        if (sessions.length > 0) {
            container.innerHTML = sessions.map(s =>
                `<a href="guest-chat-room.html?token=${encodeURIComponent(s.token)}${isAdmin ? '&admin=1' : ''}" class="session-item-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div style="font-weight: 800; font-size: 14px; color: var(--text);">${escapeHtml(s.subject || 'Support Session')}</div>
                        <span class="status-badge ${s.status}">${(s.status || 'open').toUpperCase()}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        ${escapeHtml(s.last_message || 'No messages yet')}
                    </div>
                    ${isAdmin ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(s.name || '')} • ${escapeHtml(s.email || '')}</div>` : ''}
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