/**************************************
 * 声荐每日自动签到（最终稳定版）
 * 兼容：Loon / Surge / Quantumult X
 * 静默控制：persistentStore（Loon）/ argument（Surge/QX）
 * 作者：〈ザㄩメ火华
 **************************************/

const $ = new Env("声荐自动签到");
const TOKEN_KEY = "shengjian_auth_token";
const SILENT_KEY = "silent_switch";

/* ========= 静默模式判断（核心） ========= */
function isSilentMode() {
  // Loon：从持久化存储读取插件 switch
  if (typeof $persistentStore !== "undefined") {
    const v = $persistentStore.read(SILENT_KEY);
    return v === true || v === "true" || v === "1";
  }

  // Surge / Quantumult X：兜底支持 argument
  if (typeof $argument !== "undefined" && $argument !== null) {
    const a = String($argument).toLowerCase().trim();
    return a === "true" || a === "1";
  }

  return false;
}

const isSilent = isSilentMode();
console.log(`[运行模式] ${isSilent ? "静默运行" : "普通运行（通知开启）"}`);

/* ========= Token ========= */
const rawToken = $.read(TOKEN_KEY);
const token = rawToken
  ? rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`
  : null;

const headers = {
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
    notify("❌ 声荐失败", "未找到 Token", "请先打开声荐小程序获取令牌");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([
    signIn(),
    claimFlower()
  ]);

  if (signRes.status === "token_error" || flowerRes.status === "token_error") {
    notify("🛑 声荐认证失败", "Token 已失效", "请重新进入小程序获取");
    return $.done();
  }

  const msg = [signRes.message, flowerRes.message]
    .filter(Boolean)
    .join("\n");

  notify("🎧 声荐任务结果", "", msg);
})()
  .catch((e) => {
    console.log(`[脚本异常] ${e}`);
    notify("💥 声荐脚本异常", "", String(e));
  })
  .finally(() => $.done());

/* ========= 签到 ========= */
function signIn() {
  return new Promise((resolve) => {
    $.put(
      {
        url: "https://xcx.myinyun.com:4438/napi/gift",
        headers,
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
          const obj = JSON.parse(data || "{}");
          if (obj.msg === "ok") {
            resolve({
              status: "success",
              message: `✅ 签到：${obj.data?.prizeName || "成功"}`
            });
          } else if (String(obj.msg).includes("已经")) {
            resolve({
              status: "info",
              message: "📋 签到：已签到"
            });
          } else {
            resolve({
              status: "error",
              message: `🚫 签到：${obj.msg || "未知错误"}`
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
        headers,
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

/* ========= 通知封装 ========= */
function notify(title, subtitle, body) {
  if (isSilent) {
    console.log(`[静默拦截通知]\n${title}\n${subtitle}\n${body}`);
    return;
  }
  $.notify(title, subtitle, body);
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

  this.done = (v) => {
    if (typeof $done !== "undefined") {
      $done(v);
    }
  };
}
