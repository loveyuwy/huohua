const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";
let isScriptFinished = false;

// --- 最终加固版静默参数解析 ---
let isSilent = false;
if (typeof $argument !== "undefined" && $argument) {
  // 打印日志以便排查：在 Surge 日志里看这一行输出什么
  console.log(`[参数检查] 原始参数内容: ${$argument}`);
  
  const argStr = String($argument).toLowerCase();
  // 只要包含 true, 1, 或者 # 号中任意一个，即开启静默
  if (argStr.includes("true") || argStr.includes("1") || argStr.includes("#")) {
    isSilent = true;
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

// ... (commonHeaders, signIn, claimFlower 函数部分保持不变) ...
const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

function signIn() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data);
        if ((code === 200 || code === "200") && result.msg === "ok") {
          resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天已签到' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知错误"}` });
        }
      } catch { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" };
    $.post(req, (err, res, data) => {
      if (err) return resolve({ status: 'info', message: '⏰ 领花: 未到时间' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token 已过期' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '未知'}` });
      } catch { resolve({ status: 'info', message: '👍 领花: 已领过' }); }
    });
  });
}

// ----------------- 主逻辑 -----------------
(async () => {
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行“声荐获取令牌”脚本。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新打开小程序获取令牌。");
    return $.done();
  }

  const lines = [];
  if (signResult.message) lines.push(signResult.message);
  if (flowerResult.message) lines.push(flowerResult.message);
  const body = lines.join("\n");

  if (isSilent) {
    console.log(`[静默模式] 拦截通知内容:\n${body}`);
  } else {
    $.notify("声荐任务结果", "", body);
  }

  $.done();
})().catch((e) => { $.notify("💥 声荐脚本异常", "", String(e)); $.done(); });

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c);else if(typeof $http!="undefined")$http.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c);else if(typeof $http!="undefined")$http.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
surge的静默通知开关有效果，没问题。但loon的静默通知开关打开和关闭都会通知，什么问题？帮我改一下