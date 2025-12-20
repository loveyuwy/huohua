/*
声荐每日自动签到组合脚本
更新说明：支持 Surge (#号开关) 和 Loon (UI开关) 的静默通知功能。
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
let isScriptFinished = false;

// --- 增强型静默参数解析逻辑 ---
let isSilent = false;
if (typeof $argument !== "undefined" && $argument) {
  // 1. 兼容 Surge: 如果参数中包含 # 则视为开启静默
  if ($argument.indexOf("#") !== -1) {
    isSilent = true;
  }
  // 2. 兼容 Loon: 如果参数为 silent=true 或包含 true 则视为开启静默
  else if ($argument.indexOf("true") !== -1) {
    isSilent = true;
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ----------------- Step 1: 签到 -----------------
function signIn() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/gift",
      headers: commonHeaders,
      body: "{}"
    };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          const prize = result.data?.prizeName || "成功";
          resolve({ status: 'success', message: `✅ 签到: ${prize}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天签到次数已用完' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知错误"}` });
        }
      } catch {
        resolve({ status: 'error', message: '🤯 签到: 解析失败' });
      }
    });
  });
}

// ----------------- Step 2: 领取小红花 -----------------
function claimFlower() {
  return new Promise((resolve) => {
    const req = {
      url: "https://xcx.myinyun.com:4438/napi/flower/get",
      headers: commonHeaders,
      body: "{}"
    };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 超时或未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401)
          resolve({ status: 'token_error', message: 'Token 已过期' });
        else if (obj.statusCode === 400 && /未到领取时间/.test(obj.message || ""))
          resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
        else
          resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知响应'}` });
      } catch {
        if (data === 'false') resolve({ status: 'info', message: '👍 领花: 已领过' });
        else resolve({ status: 'info', message: '🤔 领花: 未知响应' });
      }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  console.log("--- 声荐组合任务开始执行 ---");
  console.log(`[参数检测] $argument: ${typeof $argument !== "undefined" ? $argument : "无"}`);
  console.log(`[运行模式] ${isSilent ? "静默模式 (仅重要错误通知)" : "普通模式 (始终通知)"}`);

  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    isScriptFinished = true;
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);
  console.log("--- 执行结果 ---");
  console.log(JSON.stringify([signResult, flowerResult], null, 2));

  // 关键错误处理：Token失效时，无论是否静默都必须通知用户
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取令牌。");
    isScriptFinished = true;
    return $.done();
  }

  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);

  const hasError = [signResult, flowerResult].some(r => r.status === 'error');
  const hasSuccess = [signResult, flowerResult].some(r => r.status === 'success');

  let title = "声荐任务结果";
  if (hasError) title = "❌ 声荐任务异常";
  else if (hasSuccess) title = "✅ 声荐签到完成";
  else title = "⚠️ 声荐任务提醒";

  const body = lines.join("\n");

  // 通知逻辑
  if (isSilent) {
    console.log(`[静默跳过通知] ${title}\n${body}`);
  } else {
    $.notify(title, "", body);
  }

  console.log("--- 声荐组合任务结束 ---");
  isScriptFinished = true;
  $.done();
})().catch((e) => {
  const errMsg = (e && typeof e === 'object') ? (e.message || JSON.stringify(e)) : String(e);
  if (!isScriptFinished) $.notify("💥 声荐脚本异常", "执行错误", errMsg);
  $.done();
});

// ----------------- Env 兼容层 -----------------
function Env(name) {
  this.name = name;
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    else console.log(`[通知] ${t}\n${s}\n${b}`);
  };
  this.read = (k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.read(k);
    if (typeof $prefs !== "undefined") return $prefs.valueForKey(k);
    return null;
  };
  this.write = (v, k) => {
    if (typeof $persistentStore !== "undefined") return $persistentStore.write(v, k);
    if (typeof $prefs !== "undefined") return $prefs.setValueForKey(v, k);
    return false;
  };
  this.put = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.put(r, c);
    else if (typeof $http !== "undefined") $http.put(r, c);
    else c && c("No HTTP PUT", null, null);
  };
  this.post = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.post(r, c);
    else if (typeof $http !== "undefined") $http.post(r, c);
    else c && c("No HTTP POST", null, null);
  };
  this.done = (v = {}) => typeof $done !== "undefined" && $done(v);
}
