const $ = new Env("声荐任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 完全对齐酷我的参数解析逻辑 ---
const ARGS = (() => {
    let args = { notify: "1" };
    if (typeof $argument !== "undefined" && $argument) {
        let str = $argument.trim();
        if (str.includes("=")) {
            str.split('&').forEach(item => {
                let [k, v] = item.split('=');
                if (k) args[k] = v;
            });
        }
    }
    return args;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

// --- 汇总逻辑 ---
const now = new Date();
const hour = now.getHours();
const isLastRun = (hour === 22); // 22点汇总

(async () => {
    if (!token) {
        $.notify("声荐失败", "", "❌ 未找到令牌，请打开小程序");
        return $.done();
    }

    const commonHeaders = {
        "Authorization": token,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
        "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
    };

    // 执行任务
    const [signRes, flowerRes] = await Promise.all([
        performTask("https://xcx.myinyun.com:4438/napi/gift", "PUT", commonHeaders),
        performTask("https://xcx.myinyun.com:4438/napi/flower/get", "POST", commonHeaders)
    ]);

    // 记录结果
    let stats = getDailyStats();
    stats.logs.push(`[${hour}:00] ${signRes} / ${flowerRes}`);
    saveDailyStats(stats);

    // 通知判断
    if (ARGS.notify === "1") {
        // 加上时间戳标题，防止 Surge 以为是重复通知而拦截
        $.notify(`声荐报告 (${hour}:00)`, "", `${signRes}\n${flowerRes}`);
    } else if (isLastRun) {
        $.notify("📊 声荐今日汇总", `共执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
    }

    $.done();
})();

// --- 工具函数 ---
async function performTask(url, method, headers) {
    return new Promise(resolve => {
        const req = { url, headers, body: "{}" };
        const handler = (err, res, data) => {
            if (err) return resolve("❌ 网络错误");
            try {
                const json = JSON.parse(data);
                if (url.includes("gift")) return resolve(json.msg === "ok" ? "✅ 签到成功" : `📋 ${json.msg}`);
                return resolve(data === "true" ? "🌺 领花成功" : "🌸 已领过");
            } catch (e) { resolve("🤔 响应异常"); }
        };
        method === "PUT" ? $.put(req, handler) : $.post(req, handler);
    });
}

function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = JSON.parse($.read(statsKey) || "{}");
    return (stats.date === today) ? stats : { date: today, logs: [] };
}

function saveDailyStats(s) { $.write(JSON.stringify(s), statsKey); }

function Env(n) {
    this.read = k => $persistentStore.read(k);
    this.write = (v, k) => $persistentStore.write(v, k);
    this.notify = (t, s, b) => $notification.post(t, s, b);
    this.put = (r, c) => $httpClient.put(r, c);
    this.post = (r, c) => $httpClient.post(r, c);
    this.done = () => $done({});
}
