// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1: SECURE API & AUTHENTICATION ENGINE
// Handles JWT tokens, login state, and secure backend communication
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The Master Fetch Wrapper
 * Automatically injects the JWT token into every request.
 */
async function secureApiCall(action, payload) {
  // Falls back to localStorage if the input field isn't rendered yet
  const url = G('gasUrl')?.value || localStorage.getItem('sif_url');
  if (!url) throw new Error("Backend URL missing. Please set it in Step 12.");

  const token = localStorage.getItem('sif_session_token');

  const requestBody = {
    action: action,
    token: token,
    data: payload
  };

  // Notice: We use standard CORS now. No more opaque responses.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(requestBody)
  });

  const jsonResponse = await res.json();
  if (jsonResponse.status !== 'ok') {
    throw new Error(jsonResponse.message || "API Error");
  }
  return jsonResponse;
}

/**
 * Agent Login Handshake
 */
async function loginAgent(agentId, password) {
  try {
    const response = await secureApiCall('login', { agentId, password });

    // Lock the token into the browser's vault
    localStorage.setItem('sif_session_token', response.token);
    localStorage.setItem('sif_agent_name', response.agentName);

    toast(`✅ Welcome back, ${response.agentName}`);
    return true;
  } catch (error) {
    toast(`❌ Login Failed: ${error.message}`);
    return false;
  }
}

/**
 * Agent Logout
 */
function logoutAgent() {
  localStorage.removeItem('sif_session_token');
  localStorage.removeItem('sif_agent_name');
  toast('🔒 Logged out securely.');
  // Force reload to clear all sensitive DOM state
  setTimeout(() => location.reload(), 1000);
}

/**
 * The Main Submission Router (Online / Offline)
 */
async function submitWithOfflineSupport() {
  const btn = G('submitBtn');
  if (!btn) return;

  btn.innerHTML = '<span class="spinner"></span> Securing…';
  btn.disabled = true;

  // We will define collectFormData() in app.js later
  const payload = collectFormData();

  // 1. Check Auth State
  if (!localStorage.getItem('sif_session_token')) {
    toast('⚠ You must be logged in to submit.');
    btn.innerHTML = '📤 Encrypt & Send';
    btn.disabled = false;
    // Optional: Trigger a login modal here if you build one
    return;
  }

  // 2. Check Network State
  if (!navigator.onLine) {
    saveToOfflineQueue(payload);
    btn.innerHTML = '📤 Encrypt & Send';
    btn.disabled = false;
    return;
  }

  // 3. Attempt Secure Transmission
  try {
    toast('🔒 Securing & sending…', 3000);
    const response = await secureApiCall('submit', payload);

    // Success UI Updates
    const b = G('submitResult');
    b.style.display = 'block';
    b.style.borderColor = 'var(--success)';
    b.style.color = 'var(--success)';
    btn.innerHTML = '✅ Submitted';
    b.innerHTML = `✅ <strong>Verified & Sent!</strong><br>File: ${response.fileNo}<br><br><button class="btn btn-primary btn-sm" style="width:100%" onclick="resetApp()">Start New Report</button>`;

    localStorage.removeItem('sif_draft');

    // We will define saveToHistory() in app.js later
    if (typeof saveToHistory === 'function') await saveToHistory(true);

  } catch (e) {
    if (e.message.includes("Unauthorized") || e.message.includes("token")) {
      toast('🔒 Session expired. Please log in again.');
      logoutAgent();
    } else {
      toast('📡 Network error. Saving offline…', 4000);
      saveToOfflineQueue(payload);
    }
    btn.innerHTML = '📤 Encrypt & Send';
    btn.disabled = false;
  }
}

/**
 * Offline Queue Management
 */
function saveToOfflineQueue(payload) {
  let queue = JSON.parse(localStorage.getItem('sif_offline_queue') || '[]');

  // Prevent duplicates
  if (!queue.find(i => i.fileNo === payload.fileNo)) {
    queue.push(payload);
    localStorage.setItem('sif_offline_queue', JSON.stringify(queue));
  }

  // We will define updateQueueUI() in ui.js later
  if (typeof updateQueueUI === 'function') updateQueueUI();

  const b = G('submitResult');
  if (b) {
    b.style.display = 'block';
    b.style.borderColor = 'var(--warn)';
    b.style.color = 'var(--warn)';
    b.innerHTML = `⚠️ <strong>Saved Locally</strong><br>Waiting for network to sync ${payload.fileNo}.`;
  }
  localStorage.removeItem('sif_draft');
}

/**
 * Sync Offline Queue to Backend
 */
async function syncOfflineQueue() {
  if (!navigator.onLine) return toast('❌ Still offline');

  let queue = JSON.parse(localStorage.getItem('sif_offline_queue') || '[]');
  if (!queue.length) return;

  const btn = G('syncBtn');
  if (btn) { btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }

  let successes = [];

  for (let item of queue) {
    try {
      const r = await secureApiCall('submit', item);
      if (r.status === 'ok') successes.push(item.fileNo);
    } catch (e) {
      console.error("Sync failed for", item.fileNo, e.message);
      if (e.message.includes("Unauthorized")) {
        toast("Session expired. Cannot sync.");
        break; // Stop syncing if token is dead
      }
    }
  }

  // Remove successful items from queue
  queue = queue.filter(i => !successes.includes(i.fileNo));
  localStorage.setItem('sif_offline_queue', JSON.stringify(queue));

  if (typeof updateQueueUI === 'function') updateQueueUI();

  if (btn) { btn.innerHTML = '🔄 Sync'; btn.disabled = false; }
  if (successes.length) toast(`✅ Synced ${successes.length} item(s)!`, 4000);
}