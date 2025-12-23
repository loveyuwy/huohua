const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats"; 

// ----------------- 参数解析 (增强兼容性) -----------------
const ARGS = (() => {
  let args = { notify: "1" }; // 默认开启通知
  if (typeof $argument !== "undefined" && $argument) {
    // 处理 notify=1 或 notify:1 这种格式
    const rawArgs = $argument.replace(/\s+/g, "");
    const parts = rawArgs.split(/[&,]/);
    parts.forEach(p => {
      let [k, v] = p.split(/[=:]/);
      if (k) args[k] = v;
    });
  }
  return args;
})();

console.log(`[参数检查] 当前通知模式: ${ARGS.notify === "1" ? "每次通知" : "22点汇总"}`);

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ----------------- 汇总逻辑 -----------------
function getDailyStats() {
  const today = new Date().toISOString().slice(0, 10);
  let stats = {};
  try { stats = JSON.parse($.read(statsKey) || "{}"); } catch (e) { stats = {}; }
  if (stats.date !== today) {
    stats = { date: today, logs: [] };
  }
  return stats;
}

function saveDailyStats(stats) {
  $.write(JSON.stringify(stats), statsKey);
}

// ----------------- 核心任务 -----------------
function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        } else {
          resolve({ status: 'info', message: `📋 签到: ${result.msg || "完成"}` });
        }
      } catch { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时或未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token失效' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已处理'}` });
      } catch { resolve({ status: 'info', message: '👍 领花: 已领过' }); }
    });
  });
}

// ----------------- 主流程 -----------------
(async () => {
  if (!token) {
    $.notify("❌ 声荐失败", "", "未找到令牌，请打开小程序获取");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);
  
  const now = new Date();
  const hour = now.getHours();
  const isLastRun = (hour === 22);

  // 记录日志
  let stats = getDailyStats();
  const logEntry = `[${hour}:00] ${signRes.message} / ${flowerRes.message}`;
  stats.logs.push(logEntry);
  saveDailyStats(stats);

  if (signRes.status === 'token_error' || flowerRes.status === 'token_error') {
    $.notify("🛑 声荐令牌过期", "", "请重新登录小程序");
    return $.done();
  }

  // 判断通知逻辑
  if (String(ARGS.notify) === "1") {
    // 每次运行都通知
    $.notify("声荐自动任务", "", `${signRes.message}\n${flowerRes.message}`);
  } else if (isLastRun) {
    // 仅在22点汇总通知
    $.notify("📊 声荐今日汇总", `累计执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
  } else {
    console.log(`[静默模式] 当前${hour}点，非汇总时间，日志已存。`);
  }

  $.done();
})().catch(e => { console.log(e); $.done(); });

// ----------------- Env 兼容层 -----------------
function Env(name) {
  this.name = name;
  this.read = k => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : null);
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : false);
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    console.log(`${t}\n${s}\n${b}`);
  };
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : null);
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : null);
  this.done = (v = {}) => (typeof $done !== "undefined" ? $done(v) : null);
}
