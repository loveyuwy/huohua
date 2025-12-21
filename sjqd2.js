/**************************************
 * 声荐每日自动签到（通用版）
 * 支持：Loon / Surge / Quantumult X
 * 作者：〈ザㄩメ火华
 **************************************/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

/* ========= 静默参数解析 ========= */
let isSilent = false;

if (typeof $argument !== "undefined" && $argument !== null) {
  const argStr = String($argument).toLowerCase().trim();
  console.log(`[参数检查] 当前参数内容: ${argStr}`);

  // 只认 true / 1，彻底避免 Loon {silent_switch} Bug
  if (argStr === "true" || argStr === "1") {
    isSilent = true;
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken
  ? rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`
  : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  "Referer":
    "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

/* ========= 主流程 ========= */
(async () => {
  if (!token) {
    if (!isSilent) {
      $.notify("❌ 声荐失败", "未找到 Token", "请先打开声荐小程序获取令牌");
    }
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([
    signIn(),
    claimFlower()
  ]);

  if (
    signResult.status === "token_error" ||
    flowerResult.status === "token_error"
  ) {
    if (!isSilent) {
      $.notify("🛑 声荐认证失败", "Token 已失效", "请重新进入小程序获取");
    }
    return $.done();
  }

  const body = [signResult.message, flowerResult.message]
    .filter(Boolean)
    .join("\n");

  if (isSilent) {
    console.log(`[静默模式] 已拦截通知内容:\n${body}`);
  } else {
    $.notify("🎧 声荐任务结果", "", body);
  }
})()
  .catch((e) => {
    console.log(`[脚本异常] ${e}`);
    if (!isSilent) {
      $.notify("💥 声荐脚本异常", "", String(e));
    }
  })
  .finally(() => $.done());

/* ========= 签到 ========= */
function signIn() {
  return new Promise((resolve) => {
    $.put(
      {
        url: "https://xcx.myinyun.com:4438/napi/gift",
        headers: commonHeaders,
        body: "{}"
      },
      (err, res, data) => {
        if (err) {
          return resolve({
            status: "error",
            message: "📡 签到：网络错误"
          });
        }

        const code = res?.status || res?.statusCode || 0;
        if (code === 401) return resolve({ status: "token_error" });

        try {
          const result = JSON.parse(data || "{}");

          if (result.msg === "ok") {
            resolve({
              status: "success",
              message: `✅ 签到：${result.data?.prizeName || "成功"}`
            });
          } else if (String(result.msg).includes("已经")) {
            resolve({
              status: "info",
              message: "📋 签到：已签到"
            });
          } else {
            resolve({
              status: "error",
              message: `🚫 签到：${result.msg || "未知错误"}`
            });
          }
        } catch {
          resolve({
            status: "error",
            message: "🤯 签到：返回解析失败"
          });
        }
      }
    );
  });
}

/* ========= 领小红花 ========= */
function claimFlower() {
  return new Promise((resolve) => {
    $.post(
      {
        url: "https://xcx.myinyun.com:4438/napi/flower/get",
        headers: commonHeaders,
        body: "{}"
      },
      (err, res, data) => {
        if (err || !data) {
          return resolve({
            status: "info",
            message: "🌸 领花：正常"
          });
        }

        if (data === "true") {
          return resolve({
            status: "success",
            message: "🌺 已领取小红花"
          });
        }

        try {
          const obj = JSON.parse(data);
          if (obj.statusCode === 401) {
            resolve({ status: "token_error" });
          } else {
            resolve({
              status: "info",
              message: `🌸 领花：${obj.message || "已领取"}`
            });
          }
        } catch {
          resolve({
            status: "info",
            message: "👍 领花：记录正常"
          });
        }
      }
    );
  });
}

/* ========= Env ========= */
function Env(name) {
  this.name = name;

  this.notify = (title, subtitle, body) => {
    if (typeof $notification !== "undefined") {
      $notification.post(title, subtitle, body);
    } else if (typeof $notify !== "undefined") {
      $notify(title, subtitle, body);
    } else {
      console.log(`${title}\n${subtitle}\n${body}`);
    }
  };

  this.read = (key) => {
    if (typeof $persistentStore !== "undefined") {
      return $persistentStore.read(key);
    }
    if (typeof $prefs !== "undefined") {
      return $prefs.valueForKey(key);
    }
    return null;
  };

  this.put = (opts, cb) => {
    if (typeof $httpClient !== "undefined") {
      $httpClient.put(opts, cb);
    }
  };

  this.post = (opts, cb) => {
    if (typeof $httpClient !== "undefined") {
      $httpClient.post(opts, cb);
    }
  };

  this.done = (value) => {
    if (typeof $done !== "undefined") {
      $done(value);
    }
  };
}
