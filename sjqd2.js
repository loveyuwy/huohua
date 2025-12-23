/**
 * 声荐自动化脚本 - 增强防拦截版
 * 修改日期: 2025-12-23
 */

const $ = new Env("声荐任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 1. 参数解析 (完全对照酷我逻辑) ---
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

const now = new Date();
const hour = now.getHours();
const isLastRun = (hour === 22);

(async () => {
    console.log(`[参数检查] notify=${ARGS.notify}, 当前小时=${hour}`);
    
    if (!token) {
        $.notify("声荐助手", "❌ 未找到 Token", "请重新打开小程序获取");
        return $.done();
    }

    const commonHeaders = {
        "Authorization": token,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
        "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
    };

    // --- 2. 执行任务 ---
    const [signRes, flowerRes] = await Promise.all([
        performTask("https://xcx.myinyun.com:4438/napi/gift", "PUT", commonHeaders),
        performTask("https://xcx.myinyun.com:4438/napi/flower/get", "POST", commonHeaders)
    ]);

    // --- 3. 记录日志 ---
    let stats = getDailyStats();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    stats.logs.push(`[${timeStr}] ${signRes} | ${flowerRes}`);
    saveDailyStats(stats);

    // --- 4. 通知判断 (防拦截逻辑) ---
    if (ARGS.notify === "1") {
        // 核心改动：在标题中加入随机后缀和动态时间戳，彻底打破系统拦截
        const randomID = Math.random().toString(36).slice(-3).toUpperCase();
        const title = `声荐任务 [${timeStr}] - ${randomID}`;
        const content = `${signRes}\n${flowerRes}`;
        
        $.notify(title, "", content);
    } else if (isLastRun) {
        $.notify("📊 声荐今日汇总", `今日已执行 ${stats.logs.length} 次`, stats.logs.join("\n"));
    } else {
        console.log(`[静默模式] 已存入汇总，不触发即时通知`);
    }

    $.done();
})();

// --- 工具函数 ---
async function performTask(url, method, headers) {
    return new Promise(resolve => {
        const req = { url, headers, body: "{}" };
        const handler = (err, res, data) => {
            if (err) return resolve("网络错误");
            try {
                const json = JSON.parse(data);
                if (url.includes("gift")) {
                    return resolve(json.msg === "ok" ? `✅ 获得:${json.data?.prizeName}` : `📋 ${json.msg}`);
                }
                return resolve(data === "true" ? "🌺 领花成功" : "🌸 已领过");
            } catch (e) { 
                resolve(data === "false" ? "🌸 已领过" : "解析异常"); 
            }
        };
        method === "PUT" ? $.put(req, handler) : $.post(req, handler);
    });
}

function getDailyStats() {
    const today = now.toISOString().slice(0, 10);
    let stats = {};
    try { stats = JSON.parse($.read(statsKey) || "{}"); } catch (e) {}
    return (stats.date === today) ? stats : { date: today, logs: [] };
}

function saveDailyStats(s) { $.write(JSON.stringify(s), statsKey); }

// --- 环境兼容层 ---
function Env(n) {
    this.read = k => $persistentStore.read(k);
    this.write = (v, k) => $persistentStore.write(v, k);
    this.notify = (t, s, b) => {
        $notification.post(t, s, b);
        console.log(`推送通知: ${t}\n${s}\n${b}`);
    };
    this.put = (r, c) => $httpClient.put(r, c);
    this.post = (r, c) => $httpClient.post(r, c);
    this.done = () => $done({});
}
