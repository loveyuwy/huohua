// 使用 var 彻底解决变量冲突报错
var $ = new Env("声荐稳定版");
var tokenKey = "shengjian_auth_token";

// --- 【手动设置区】 ---
// true  = 开启静默（不发通知）
// false = 关闭静默（正常通知）
var manualSilent = true; 
// ----------------------

var rawToken = $.read(tokenKey);
var token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

var commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
  if (!token) {
    if (!manualSilent) $.notify("❌ 声荐失败", "未找到Token", "请获取。");
    return $.done();
  }

  const [signResult, flowerResult] = await Promise.all([signIn(), claimFlower()]);

  // Token 失效关系到脚本存续，建议保持弹窗
  if (signResult.status === 'token_error' || flowerResult.status === 'token_error') {
    $.notify("🛑 声荐认证失败", "Token 已过期", "请重新获取。");
    return $.done();
  }

  const body = [signResult.message, flowerResult.message].filter(Boolean).join("\n");

  if (manualSilent) {
    console.log(`[静默成功] 任务已完成，拦截通知:\n${body}`);
  } else {
    $.notify("声荐结果", "", body);
  }
})().catch((e) => {
  console.log(`[异常] ${e}`);
  if (!manualSilent) $.notify("💥 声荐异常", "", String(e));
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
        else resolve({ status: 'error', message: `🚫 签到: ${result.msg || "错误"}` });
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
      } catch (e) { resolve({ status: 'info', message: '👍 领花: 正常' }); }
    });
  });
}

function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.put=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.put(r,c)};this.post=(r,c)=>{if(typeof $httpClient!="undefined")$httpClient.post(r,c)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
