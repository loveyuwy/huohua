const $ = new Env("应用更新检测");

// ========== 智能图标库 ==========
const iconDB = {
  exactMatch: {
    "微信": "💬", "WeChat": "💬",
    "QQ": "🐧",
    "支付宝": "💰", "Alipay": "💰",
    "淘宝": "🛒", "Taobao": "🛒",
    "京东": "🐶",
    "微博": "👁️", "Weibo": "👁️",
    "知乎": "📘",
    "Bilibili": "📺", "哔哩哔哩": "📺",
    "YouTube": "▶️",
    "Twitter": "🐦", "X": "𝕏",
    "Instagram": "📷",
    "Telegram": "✈️", "TG": "✈️",
    "Surge": "⚡️",
    "Shadowrocket": "🚀",
    "Loon": "🎈",
    "Quantumult X": "🌀", "圈X": "🌀",
    "Spotify": "🎵",
    "网易云音乐": "🎧",
    "QQ音乐": "🎵",
    "高德地图": "🗺️",
    "百度地图": "📍",
    "美团": "🍔",
    "饿了么": "🥡",
    "小红书": "📕",
    "抖音": "🎵", "TikTok": "🎵",
    "Netflix": "🎬",
    "夸克": "🌌",
    "UC浏览器": "🐿️"
  },
  
  keywordMatch: {
    "银行": "🏦", "Bank": "🏦",
    "视频": "🎬", "影视": "🍿", "播放器": "▶️",
    "音乐": "🎵", "听书": "🎧",
    "天气": "⛅️", "Weather": "⛅️",
    "邮件": "📧", "邮箱": "📧", "Mail": "📧",
    "浏览器": "🌐", "Browser": "🌐",
    "新闻": "📰", "资讯": "📰",
    "游戏": "🎮", "Game": "🎮",
    "相机": "📷", "照片": "🖼️",
    "打车": "🚕", "出行": "🚗",
    "外卖": "🛵", "买菜": "🥬",
    "笔记": "📝", "备忘录": "📒",
    "翻译": "🔤",
    "钱包": "👛",
    "阅读": "📖", "小说": "📚"
  },
  
  categoryMatch: {
    "代理工具": "🧰",
    "社交应用": "👥",
    "系统工具": "⚙️",
    "影音娱乐": "🍿",
    "生活服务": "☕️",
    "金融理财": "💹",
    "学习办公": "📚",
    "购物消费": "🛍️",
    "出行导航": "🧭"
  }
};

function getSmartIcon(appName, category, customIcon) {
  if (customIcon) return customIcon;
  if (iconDB.exactMatch[appName]) return iconDB.exactMatch[appName];
  for (const keyword in iconDB.keywordMatch) {
    if (appName.includes(keyword) || appName.toLowerCase().includes(keyword.toLowerCase())) {
      return iconDB.keywordMatch[keyword];
    }
  }
  if (category && iconDB.categoryMatch[category]) return iconDB.categoryMatch[category];
  return "📱";
}

// ========== 参数解析（适配 Loon 插件格式） ==========
let appList = [];
const argStr = typeof $argument !== 'undefined' ? $argument : "";

// 解析 key1=value1&key2=value2...
const params = {};
argStr.split('&').forEach(pair => {
  const eqIndex = pair.indexOf('=');
  if (eqIndex > 0) {
    const key = decodeURIComponent(pair.substring(0, eqIndex));
    const val = decodeURIComponent(pair.substring(eqIndex + 1));
    params[key] = val;
  }
});

// 收集 应用1 ~ 应用20
const appFields = [];
for (let i = 1; i <= 20; i++) {
  const field = `应用${i}`;
  if (params[field] && params[field].trim() !== '') {
    appFields.push(params[field].trim());
  }
}
const rawApps = appFields.join(',');

// 解析应用配置
if (rawApps) {
  const items = rawApps.replace(/[\[\]]/g, "").split(/[;，,]/);
  items.forEach(item => {
    if (!item || item.trim() === "") return;
    const parts = item.split('@');
    if (parts.length >= 2 && parts[0].trim() !== "" && parts[1].trim() !== "") {
      const appName = parts[0].trim();
      const bundleId = parts[1].trim();
      const customIcon = parts[2] ? parts[2].trim() : "";
      const category = parts[3] ? parts[3].trim() : "未分类";
      appList.push({
        name: appName,
        bundleId: bundleId,
        icon: getSmartIcon(appName, category, customIcon),
        category: category
      });
    }
  });
}

if (appList.length === 0) {
  console.log("⚠️ 未在模块参数中配置任何应用数据，脚本结束。");
  $.done();
} else {
  console.log(`✅ 成功读取 ${appList.length} 个应用配置，开始检测...`);
}

// ========== 版本比较 ==========
function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// ========== 网络请求 ==========
function request(url) {
  return new Promise((resolve, reject) => {
    const timeUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
    $.get({ url: timeUrl }, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        try {
          const status = response.status || response.statusCode;
          if (status === 200) {
            const data = typeof body === 'string' ? JSON.parse(body) : body;
            resolve({ status, data });
          } else {
            reject(new Error(`HTTP ${status}`));
          }
        } catch (e) {
          reject(new Error("JSON解析失败"));
        }
      }
    });
  });
}

// ========== 多区并发检测 ==========
async function enhancedFetch(app) {
  let regions = ['US', 'HK', 'CN'];
  if (["Surge", "Shadowrocket", "Loon", "Quantumult X", "圈X"].includes(app.name)) {
    regions = ['US', 'HK', 'JP'];
  }

  const promises = regions.map(async (region) => {
    const url = `https://itunes.apple.com/${region}/lookup?bundleId=${app.bundleId}`;
    try {
      const response = await request(url);
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].version;
      }
    } catch (e) {}
    return null;
  });

  const results = await Promise.all(promises);
  const validVersions = results.filter(v => v !== null);
  if (validVersions.length === 0) throw new Error("所有区域查询失败");

  let maxVersion = validVersions[0];
  for (let i = 1; i < validVersions.length; i++) {
    if (compareVersions(validVersions[i], maxVersion) === 1) {
      maxVersion = validVersions[i];
    }
  }

  console.log(`✅ ${app.icon} ${app.name} 检测结果: ${maxVersion} (来源: [${regions.join(',')}])`);
  return { app, version: maxVersion };
}

// ========== 主流程 ==========
(async () => {
  let hasUpdate = false;
  const results = {
    updated: {},
    failed: [],
    current: []
  };
  
  const startTime = Date.now();
  const promises = appList.map(app => enhancedFetch(app));
  const outcomes = await Promise.allSettled(promises);
  
  outcomes.forEach((outcome, index) => {
    const app = appList[index];
    if (outcome.status === 'fulfilled') {
      const { version: latest } = outcome.value;
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $.getdata(key);
      
      if (!savedVersion) {
        $.setdata(latest, key);
        results.current.push({ app, version: latest, status: '首次记录' });
      } else {
        const compareResult = compareVersions(latest, savedVersion);
        if (compareResult === 1) {
          hasUpdate = true;
          if (!results.updated[app.category]) results.updated[app.category] = [];
          results.updated[app.category].push({
            app,
            oldVersion: savedVersion,
            newVersion: latest
          });
          $.setdata(latest, key);
        } else if (compareResult === -1) {
          console.log(`⚠️ ${app.name} API数据异常 (${latest} < ${savedVersion})，保持本地新版`);
          results.current.push({ app, version: savedVersion, status: 'API回退' });
        } else {
          results.current.push({ app, version: latest, status: '最新版' });
        }
      }
    } else {
      results.failed.push({ app, error: outcome.reason.message });
    }
  });

  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (hasUpdate || results.failed.length > 0) {
    const title = hasUpdate ? "📱 发现应用更新" : "❌ 应用检测失败";
    let subtitle = hasUpdate ? "✨ 有应用可更新" : "⚠️ 部分应用查询失败";
    let body = "";
    let hasContent = false;
    
    if (hasUpdate) {
      for (const category in results.updated) {
        if (results.updated[category] && results.updated[category].length > 0) {
          if (hasContent) body += "\n";
          body += `🆕 ${category}更新:\n`;
          body += results.updated[category].map(u => `${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`).join("\n");
          hasContent = true;
        }
      }
    }
    
    if (results.failed.length > 0) {
      if (hasContent) body += "\n";
      body += `❌ 查询失败:\n`;
      body += results.failed.map(f => `${f.app.icon} ${f.app.name}: ${f.error}`).join("\n");
    }
    
    if (hasUpdate && results.current.length > 0) {
      body += `\n✅ 最新版应用:\n`;
      body += results.current.slice(0, 3).map(c => `${c.app.icon} ${c.app.name}: ${c.version}`).join("\n");
      if(results.current.length > 3) body += `...以及其他 ${results.current.length - 3} 个`;
    }
    
    body += `\n⏱️ 耗时: ${executionTime}s`;
    $.msg(title, subtitle, body);
  } else {
    console.log("📱 所有应用均为最新版本且检测成功，无需通知");
  }
  
  console.log("=".repeat(40));
  if (hasUpdate) {
    console.log("✨ 发现更新:");
    Object.values(results.updated).flat().forEach(u => 
      console.log(`  ${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`)
    );
  } else {
    console.log("✨ 无更新");
  }
  
  if (results.current.length > 0) {
    console.log("✅ 当前状态:");
    results.current.forEach(c => 
      console.log(`  ${c.app.icon} ${c.app.name}: ${c.version} [${c.status}]`)
    );
  }
  console.log("=".repeat(40));
  
  $.done();
})();

// ========== Env 环境兼容层 ==========
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){const t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),console.log(t.join("\n"))}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}initGotEnv(t){this.got=this.got?this.got:require("got"),this.ckt=this.ckt?this.ckt:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.ckt.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}