const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";

// --- 静默参数解析 ---
let isSilent = false;
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase();
  // 兼容 Surge (#/1) 和 Loon (true)
  if (argStr.includes("#") || argStr.includes("1") || (argStr.includes("true") && !argStr.includes("false"))) {
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

function signIn() {
  return new Promise((resolve) => {
    const req = { url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" };
    $.put(req, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      // 增加 res 存在性检查，防止报错
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error', message: 'Token 已过期' });
      try {
        const result = JSON.parse(data || "{}");
        if ((code === 200 || code === "200") && result.msg === "ok") {
          resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        } else if (String(result.msg || "").includes("已经")) {
          resolve({ status: 'info', message: '📋 签到: 今天已签到' });
        } else {
          resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知错误"}` });
        }
      } catch (e) { resolve({ status: 'error', message: '🤯 签到: 解析失败' }); }
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
        const obj = JSON.parse(data || "{}");
        const code = res ? (res.status || res.statusCode) : 0;
        if (code === 401 || obj.statusCode === 401) resolve({ status: 'token_error', message: 'Token 已过期' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已领取'}` });
      } catch (e) { resolve({ status: 'info', message: '👍 领花: 任务完成' }); }
    });
  });
}

(async () => {
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先运行小程序获取。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  // Token 失效时强制通知，不走静默
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
})().catch((e) => {
  // 只有非静默模式下才弹出报错通知
  console.log(`[脚本异常] ${e}`);
  if (!isSilent) $.notify("💥 声荐脚本异常", "", String(e));
  $.done();
});

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c);else if(typeof $http!="undefined")$http.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c);else if(typeof $http!="undefined")$http.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
