// watcher.js

// --- 環境変数の読み込み ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID   = process.env.CHAT_ID;
const TARGET_URL = "https://pointlessjourney.jp/";

// 確認用ログ（BOT_TOKEN や CHAT_ID がちゃんと読めてるかチェック）
console.log("BOT_TOKEN:", BOT_TOKEN ? "設定済み" : "未設定");
console.log("CHAT_ID:", CHAT_ID ? "設定済み" : "未設定");

// --- 必要なモジュール読み込み ---
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const STATE_FILE = "pointless_seen.json";
const statePath = path.join(__dirname, STATE_FILE);

// --- 過去通知URLの読み書き ---
function loadSeen() {
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch (e) {
      return [];
    }
  }
  return [];
}
function saveSeen(arr) {
  fs.writeFileSync(statePath, JSON.stringify(arr));
}

// --- URL抽出 ---
function extractLinks(html) {
  const re = /<a[^>]*href=(?:'|")([^'"]+)(?:'|")[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const map = {};
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    let txt = m[2].replace(/<[^>]*>/g, "").trim() || "";
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("javascript:")
    )
      continue;
    if (href.startsWith("/"))
      href = TARGET_URL.replace(/\/$/, "") + href;
    map[href] = { url: href, title: txt };
  }
  return Object.values(map);
}

// --- Telegram送信 ---
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });
    return await res.json();
  } catch (e) {
    console.log("Telegram送信失敗:", e);
    return null;
  }
}

// --- メイン処理 ---
async function main() {
  const seen = loadSeen(); // 過去通知URL
  let html;

  try {
    const res = await fetch(TARGET_URL, {
      headers: { "User-Agent": "Mozilla/5.0 PointlessWatcher/1.0" },
    });
    html = await res.text();
  } catch (e) {
    console.log("サイト取得失敗:", e);
    return;
  }

  const items = extractLinks(html);
  const seenSet = new Set(seen);
  const newItems = items.filter((it) => !seenSet.has(it.url));

  if (newItems.length === 0) {
    console.log("新着なし");
    return;
  }

  // 新着最大5件通知
  const toSend = newItems.slice(0, 5);
  for (let it of toSend) {
    const message = `🆕 新着検知\n${it.title ? it.title + "\n" : ""}${it.url}`;
    await sendTelegram(message);
    seenSet.add(it.url);
  }

  saveSeen(Array.from(seenSet));
  console.log(`通知送信完了: ${toSend.length} 件`);
}

// 実行
main();
