/*
声荐每日自动签到
脚本说明：支持自定义静默运行。
*/

const $ = new Env("声荐自动签到");
const tokenKey = "shengjian_auth_token";

let isSilent = false;
if (typeof $argument !== "undefined" && $argument) {
  const argStr = String($argument).toLowerCase();
  console.log(`[参数检查] 当前参数内容: ${argStr}`);
  
  // 1. 正常逻辑：只有明确包含 true, # 或 1 时才静默
  if (argStr.includes("true") || argStr.includes("#") || argStr.includes("1")) {
    isSilent = true;
  }
  
  // 2. 容错处理：如果 Loon 没能正确替换变量（显示为 {silent_switch}），则视为不静默，确保通知触达
  if (argStr.includes("{silent_switch}")) {
    console.log("⚠️ 检测到 Loon 变量未正确替换，默认关闭静默模式以显示通知。");
    isSilent = false; 
  }
}

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
  if (!token) {
    if (!isSilent) $.notify("❌ 声荐失败", "未找到Token", "请打开小程序获取。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取令牌。");
    return $.done();
  }

  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (isSilent) {
    console.log(`[静默运行] 已拦截以下通知内容:\n${body}`);
  } else {
    $.notify("声荐任务结果", "", body);
  }
})().catch((e) => {
  console.log(`[脚本异常] ${e}`);
  if (!isSilent) $.notify("💥 声荐脚本崩溃", "", String(e));
}).finally(() => $.done());

function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err) return resolve({ status: 'error', message: '📡 签到: 网络错误' });
      const code = res ? (res.status || res.statusCode) : 0;
      if (code === 401) return resolve({ status: 'token_error' });
      try {
        const result = JSON.parse(data || "{}");
        if (result.msg === "ok") resolve({ status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        else if (String(result.msg || "").includes("已经")) resolve({ status: 'info', message: '📋 签到: 已签到' });
        else resolve({ status: 'error', message: `🚫 签到: ${result.msg || "未知"}` });
      } catch (e) { resolve({ status: 'error', message: '🤯 解析失败' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (err || !data) return resolve({ status: 'info', message: '🌸 领花: 正常' });
      if (data === "true") return resolve({ status: 'success', message: '🌺 已领小红花' });
      try {
        const obj = JSON.parse(data);
        if (obj.statusCode === 401) resolve({ status: 'token_error' });
        else resolve({ status: 'info', message: `🌸 领花: ${obj.message || '已领'}` });
      } catch (e) { resolve({ status: 'info', message: '👍 领花: 记录正常' }); }
    });
  });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
