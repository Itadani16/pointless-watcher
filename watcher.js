console.log("BOT_TOKEN:", BOT_TOKEN);
console.log("CHAT_ID:", CHAT_ID);

// Node.js 版 PointlessWatcher
const fs = require("fs");
const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID   = process.env.CHAT_ID;
const TARGET_URL = "https://pointlessjourney.jp/";
const STATE_FILE = "pointless_seen.json";

// --- 過去通知URLの読み書き ---
function loadSeen() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); }
    catch(e){ return []; }
  }
  return [];
}
function saveSeen(arr) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(arr));
}

// --- HTML からリンク抽出 ---
function extractLinks(html) {
  const re = /<a[^>]*href=(?:'|")([^'"]+)(?:'|")[^>]*>([\s\S]*?)<\/a>/gi;
  let m, map = {};
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    let txt  = m[2].replace(/<[^>]*>/g,"").trim() || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    if (href.startsWith("/")) href = TARGET_URL.replace(/\/$/,"") + href;
    map[href] = {url: href, title: txt};
  }
  return Object.values(map);
}

// --- Telegram送信 ---
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({chat_id: CHAT_ID, text})
    });
  } catch(e){ console.log("Telegram送信失敗:", e); }
}

// --- メイン ---
(async () => {
  const seen = loadSeen();
  let html;
  try {
    const res = await fetch(TARGET_URL, { headers: { "User-Agent": "Mozilla/5.0" }});
    html = await res.text();
  } catch(e){ console.log("サイト取得失敗:", e); return; }

  const items = extractLinks(html);
  const seenSet = new Set(seen);
  const newItems = items.filter(it => !seenSet.has(it.url));
  if(newItems.length === 0){ console.log("新着なし"); return; }

  for(let it of newItems.slice(0,5)){
    const message = `🆕 新着検知\n${it.title ? it.title + "\n" : ""}${it.url}`;
    await sendTelegram(message);
    seenSet.add(it.url);
  }

  saveSeen(Array.from(seenSet));
  console.log(`通知送信完了: ${newItems.length} 件`);
})();
