/*************************************************
 * 声荐每日签到（Loon 专用最终版）
 * - 仅支持 Loon CRON
 * - 静默完全由 Argument:silent_switch 控制
 * - 防止被错误当作 http-response 执行
 *************************************************/

// ===== ① 防止被错误上下文执行（关键）=====
if (typeof $response !== "undefined") {
  console.log("⚠️ sjqd2.js 被错误地以 http-response 方式执行，已中断");
  $done({});
  return;
}

// ===== ② Env（仅保留 Loon 所需能力）=====
const $ = new Env("声荐每日任务");

// ===== ③ 静默开关（Loon 唯一可信来源）=====
let isSilent = false;
if (typeof $prefs !== "undefined") {
  const v = $prefs.valueForKey("silent_switch");
  isSilent = v === true || v === "true";
}

// 日志统一
console.log(`[运行模式] ${isSilent ? "静默运行（通知关闭）" : "普通运行（通知开启）"}`);

// ===== ④ Token =====
const TOKEN_KEY = "shengjian_auth_token";
const rawToken = $.read(TOKEN_KEY);
const token = rawToken
  ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`)
  : null;

if (!token) {
  notifyForce("❌ 声荐任务失败", "未找到 Token", "请先打开声荐小程序获取 Token");
  $.done();
  return;
}

// ===== ⑤ 通用请求头 =====
const headers = {
  Authorization: token,
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  Referer:
    "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html",
};

// ===== ⑥ 功能函数 =====
function signIn() {
  return new Promise((resolve) => {
    $.put(
      {
        url: "https://xcx.myinyun.com:4438/napi/gift",
        headers,
        body: "{}",
      },
      (err, res, data) => {
        if (err) return resolve({ t: "error", m: "📡 签到：网络错误" });

        const code = res?.status || res?.statusCode;
        if (code === 401)
          return resolve({ t: "token", m: "Token 已过期" });

        try {
          const r = JSON.parse(data);
          if (r.msg === "ok") {
            resolve({
              t: "ok",
              m: `✅ 签到：${r.data?.prizeName || "成功"}`,
            });
          } else if (String(r.msg).includes("已经")) {
            resolve({ t: "info", m: "📋 今天已签到" });
          } else {
            resolve({ t: "error", m: `🚫 签到失败：${r.msg}` });
          }
        } catch {
          resolve({ t: "error", m: "🤯 签到解析失败" });
        }
      }
    );
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post(
      {
        url: "https://xcx.myinyun.com:4438/napi/flower/get",
        headers,
        body: "{}",
      },
      (err, res, data) => {
        if (err) return resolve({ t: "info", m: "⏰ 未到领花时间" });
        if (data === "true")
          return resolve({ t: "ok", m: "🌺 已领取小红花" });

        try {
          const r = JSON.parse(data);
          if (r.statusCode === 401)
            resolve({ t: "token", m: "Token 已过期" });
          else resolve({ t: "info", m: `🌸 ${r.message || "已领取"}` });
        } catch {
          resolve({ t: "info", m: "👍 小红花已领过" });
        }
      }
    );
  });
}

// ===== ⑦ 主流程 =====
(async () => {
  const [a, b] = await Promise.all([signIn(), claimFlower()]);

  // Token 问题：无视静默，强制通知
  if (a.t === "token" || b.t === "token") {
    notifyForce("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取");
    return $.done();
  }

  const msgs = [];
  a.m && msgs.push(a.m);
  b.m && msgs.push(b.m);
  const body = msgs.join("\n");

  notifyNormal("声荐任务结果", "", body);
  $.done();
})().catch((e) => {
  notifyForce("💥 声荐脚本异常", "", String(e));
  $.done();
});

// ===== ⑧ 通知封装 =====
function notifyNormal(title, sub, body) {
  if (isSilent) {
    console.log(`[静默拦截]\n${title}\n${body}`);
    return;
  }
  $.notify(title, sub, body);
}

function notifyForce(title, sub, body) {
  $.notify(title, sub, body);
}

// ===== ⑨ Env（仅 Loon 必需）=====
function Env(name) {
  this.name = name;
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") {
      $notification.post(t, s, b);
    } else {
      console.log(`${t}\n${s}\n${b}`);
    }
  };
  this.read = (k) => {
    if (typeof $prefs !== "undefined") return $prefs.valueForKey(k);
  };
  this.put = (r, c) => {
    if (typeof $http !== "undefined") $http.put(r, c);
  };
  this.post = (r, c) => {
    if (typeof $http !== "undefined") $http.post(r, c);
  };
  this.done = () => {
    if (typeof $done !== "undefined") $done();
  };
}
