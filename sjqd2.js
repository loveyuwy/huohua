const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";

/* ========= 静默参数解析（终极稳定版） ========= */
let isSilent = false;

if (typeof $argument !== "undefined") {
  const raw = String($argument).trim().toLowerCase();

  if (
    raw === "1" ||
    raw === "true" ||
    raw === "#" ||
    raw === "silent"
  ) {
    isSilent = true;
  }
}

console.log(`[参数检查] 传入参数为: ${String($argument)}`);
console.log(`[运行模式] ${isSilent ? "静默运行" : "普通运行 (展示通知)"}`);

/* ========= Token ========= */
const rawToken = $.read(tokenKey);
const token = rawToken
  ? rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`
  : null;

const commonHeaders = {
  Authorization: token,
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  Referer:
    "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html",
};

/* ========= 签到 ========= */
function signIn() {
  return new Promise((resolve) => {
    $.put(
      {
        url: "https://xcx.myinyun.com:4438/napi/gift",
        headers: commonHeaders,
        body: "{}",
      },
      (err, res, data) => {
        if (err) return resolve({ status: "error", message: "📡 签到：网络错误" });
        const code = res?.status || res?.statusCode || 0;
        if (code === 401)
          return resolve({ status: "token_error", message: "Token 已过期" });

        try {
          const r = JSON.parse(data);
          if ((code === 200 || code === "200") && r.msg === "ok") {
            resolve({
              status: "success",
              message: `✅ 签到：${r.data?.prizeName || "成功"}`,
            });
          } else if (String(r.msg || "").includes("已经")) {
            resolve({ status: "info", message: "📋 今日已签到" });
          } else {
            resolve({
              status: "error",
              message: `🚫 签到失败：${r.msg || "未知错误"}`,
            });
          }
        } catch {
          resolve({ status: "error", message: "🤯 签到解析失败" });
        }
      }
    );
  });
}

/* ========= 领花 ========= */
function claimFlower() {
  return new Promise((resolve) => {
    $.post(
      {
        url: "https://xcx.myinyun.com:4438/napi/flower/get",
        headers: commonHeaders,
        body: "{}",
      },
      (err, res, data) => {
        if (err) return resolve({ status: "info", message: "⏰ 未到领取时间" });
        if (data === "true")
          return resolve({ status: "success", message: "🌺 小红花已领取" });

        try {
          const r = JSON.parse(data);
          if (r.statusCode === 401)
            resolve({ status: "token_error", message: "Token 已过期" });
          else
            resolve({
              status: "info",
              message: `🌸 领花：${r.message || "已领取"}`,
            });
        } catch {
          resolve({ status: "info", message: "👍 小红花已领取" });
        }
      }
    );
  });
}

/* ========= 主流程 ========= */
(async () => {
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到 Token", "请先打开声荐小程序获取令牌");
    return $.done();
  }

  const [sign, flower] = await Promise.all([signIn(), claimFlower()]);

  if (sign.status === "token_error" || flower.status === "token_error") {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取");
    return $.done();
  }

  const msg = [sign.message, flower.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默运行] 通知已抑制:\n${msg}`);
  } else {
    $.notify("声荐任务结果", "", msg);
  }

  $.done();
})().catch((e) => {
  $.notify("💥 声荐脚本异常", "", String(e));
  $.done();
});

/* ========= Env ========= */
function Env(n) {
  this.name = n;
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined")
      $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    else console.log(`${t}\n${s}\n${b}`);
  };
  this.read = (k) => {
    if (typeof $persistentStore !== "undefined")
      return $persistentStore.read(k);
    if (typeof $prefs !== "undefined") return $prefs.valueForKey(k);
  };
  this.put = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.put(r, c);
    else if (typeof $http !== "undefined") $http.put(r, c);
  };
  this.post = (r, c) => {
    if (typeof $httpClient !== "undefined") $httpClient.post(r, c);
    else if (typeof $http !== "undefined") $http.post(r, c);
  };
  this.done = (v) => {
    if (typeof $done !== "undefined") $done(v);
  };
}
