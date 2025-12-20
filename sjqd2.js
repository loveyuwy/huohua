const $ = new Env("声荐调试版");
const tokenKey = "shengjian_auth_token";

// --- 调试探测逻辑 ---
let isSilent = false;
let debugInfo = "未获取到参数";

if (typeof $argument !== "undefined") {
  const rawArg = $argument;
  const argType = typeof $argument;
  const argStr = String($argument).toLowerCase();
  
  // 核心判断
  if (argStr.includes("true") || argStr.includes("#") || argStr.includes("1")) {
    isSilent = true;
  }
  
  debugInfo = `原始值: [${rawArg}], 类型: [${argType}], 判定静默: [${isSilent}]`;
}

console.log(`🔍 调试信息: ${debugInfo}`);

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

(async () => {
  if (!token) {
    if (!isSilent) $.notify("❌ 调试: 未找到Token", "", "请先获取。");
    return $.done();
  }

  // 模拟请求结果进行测试
  const signMsg = "📋 签到: 调试中";
  const flowerMsg = "🌸 领花: 调试中";
  const body = `${signMsg}\n${flowerMsg}`;

  // 关键：根据判定结果决定是否弹窗
  if (isSilent) {
    console.log(`✅ [静默生效] 拦截通知内容:\n${body}`);
  } else {
    $.notify("声荐任务结果 (非静默)", "参数检测中", `${body}\n\n${debugInfo}`);
  }

})().finally(() => $.done());

// --- 简化版 Env (排除所有 arguments 冲突) ---
function Env(n){this.name=n;this.notify=(t,s,b)=>{if(typeof $notification!="undefined")$notification.post(t,s,b);else if(typeof $notify!="undefined")$notify(t,s,b);else console.log(`${t}\n${s}\n${b}`)};this.read=k=>{if(typeof $persistentStore!="undefined")return $persistentStore.read(k);if(typeof $prefs!="undefined")return $prefs.valueForKey(k)};this.done=v=>{if(typeof $done!="undefined")$done(v)}}
