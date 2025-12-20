/*
声荐每日任务 - 极致兼容版
*/

const $ = new Env("声荐组合任务");
const tokenKey = "shengjian_auth_token";

// --- 参考酷我脚本的参数提取逻辑 ---
const ARGS = (() => {
    let silent = false;
    let input = null;

    if (typeof $argument !== "undefined" && $argument !== "") {
        input = $argument;
    } else if (typeof $environment !== "undefined" && $environment.sourcePath) {
        input = $environment.sourcePath.split(/[?#]/)[1];
    }

    if (input) {
        // 强制转为字符串并清洗
        let str = String(input).toLowerCase();
        // 判定静默的关键词：存在 "true"、"1"、"#" 或者 "silent=true"
        if (str.includes("true") || str.includes("1") || str.includes("#") || str.includes("silent=true")) {
            silent = true;
        }
    }
    return { silent };
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
    console.log(`--- 声荐任务开始 ---`);
    console.log(`检测到静默参数: ${JSON.stringify(ARGS)}`);
    console.log(`最终静默判定: ${ARGS.silent ? "开启 (不通知)" : "关闭 (正常通知)"}`);

    if (!token) {
        $.notify("❌ 声荐失败", "未找到令牌", "请先打开小程序获取。");
        return $.done();
    }

    const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);

    if (signRes.status === 'token_error' || flowerRes.status === 'token_error') {
        $.notify("🛑 声荐过期", "Token 已失效", "请重新获取令牌。");
        return $.done();
    }

    const body = [signRes.message, flowerRes.message].filter(Boolean).join("\n");
    const hasError = signRes.status === 'error' || flowerRes.status === 'error';

    // 静默逻辑
    if (ARGS.silent && !hasError) {
        console.log(`[静默执行记录]:\n${body}`);
    } else {
        $.notify(hasError ? "❌ 声荐异常" : "✅ 声荐完成", "", body);
    }

    $.done();
})().catch((e) => {
    $.log(`脚本执行异常: ${e}`);
    $.done();
});

// --- 业务函数 ---
function signIn() {
  return new Promise((resolve) => {
    $.put({url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}"}, (err, res, data) => {
      if (err) return resolve({status: 'error', message: '📡 签到: 网络错误'});
      try {
        const result = JSON.parse(data);
        if (result.msg === "ok") resolve({status: 'success', message: `✅ 签到: ${result.data?.prizeName || "成功"}`});
        else resolve({status: result.msg.includes("已经") ? 'info' : 'error', message: `📋 签到: ${result.msg}`});
      } catch(e) { resolve({status: 'error', message: '🤯 签到解析失败'}); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}"}, (err, res, data) => {
      if (data === "true") resolve({status: 'success', message: '🌺 已领小红花'});
      else resolve({status: 'info', message: '🌸 领花: 已领过或未到时间'});
    });
  });
}

// --- Env 兼容层 ---
function Env(name) {
    this.name = name;
    this.isLoon = typeof $loon !== "undefined";
    this.isSurge = typeof $httpClient !== "undefined" && !this.isLoon;
    this.log = console.log;
    this.read = (k) => (this.isSurge || this.isLoon) ? $persistentStore.read(k) : null;
    this.notify = (t, s, b) => (this.isSurge || this.isLoon) ? $notification.post(t, s, b) : console.log(`${t}\n${s}\n${b}`);
    this.put = (o, c) => $httpClient.put(o, (e, r, d) => c(e, r, d));
    this.post = (o, c) => $httpClient.post(o, (e, r, d) => c(e, r, d));
    this.done = (v = {}) => $done(v);
}
