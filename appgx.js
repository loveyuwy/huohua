const $ = new Env("应用更新检测");

const appList = [
  // 代理工具
  {
    name: "Shadowrocket",
    bundleId: "com.liguangming.Shadowrocket",
    icon: "🚀",
    category: "代理工具"
  },
  {
    name: "Surge",
    bundleId: "com.nssurge.inc.surge-ios", // 仅保留 Surge 5 的 ID
    icon: "⚡️",
    category: "代理工具"
  },
  {
    name: "Loon",
    bundleId: "com.ruikq.decar",
    icon: "🎈",
    category: "代理工具"
  },
  {
    name: "Quantumult X",
    bundleId: "com.crossutility.quantumult-x",
    icon: "🌀",
    category: "代理工具"
  },
  // 微信
  {
    name: "微信",
    bundleId: "com.tencent.xin",
    icon: "💬",
    category: "社交应用"
  }
];

// 版本号比较函数
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

// 封装通用请求函数
function request(url) {
  return new Promise((resolve, reject) => {
    // 增加时间戳防止缓存
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

// 核心修复：多区域并发查询取最大值
async function enhancedFetch(app) {
  const isWeChat = app.bundleId === "com.tencent.xin";
  
  // 定义查询区域，US 通常更新最快
  let regions = ['US', 'HK', 'CN'];
  
  // Surge 和一些代理工具不在国区，减少无效请求
  if (["Surge", "Shadowrocket"].includes(app.name)) {
      regions = ['US', 'HK', 'JP'];
  }

  // 构建所有区域的请求 Promise
  const promises = regions.map(async (region) => {
    const url = `https://itunes.apple.com/${region}/lookup?bundleId=${app.bundleId}`;
    try {
      const response = await request(url);
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].version;
      }
    } catch (e) {
      // 忽略单个区域的失败
    }
    return null;
  });

  // 等待所有区域返回结果
  const results = await Promise.all(promises);
  
  // 过滤掉无效结果
  const validVersions = results.filter(v => v !== null);

  if (validVersions.length === 0) {
    throw new Error("所有区域查询失败");
  }

  // 对版本号进行排序，取最大值
  // sort 默认是字符串排序，我们需要用 compareVersions 逻辑来找最大的
  let maxVersion = validVersions[0];
  for (let i = 1; i < validVersions.length; i++) {
      if (compareVersions(validVersions[i], maxVersion) === 1) {
          maxVersion = validVersions[i];
      }
  }

  console.log(`✅ ${app.icon} ${app.name} 检测结果: ${maxVersion} (来源: [${regions.join(',')}])`);
  return { app, version: maxVersion };
}

(async () => {
  let hasUpdate = false;
  const results = {
    updated: { "代理工具": [], "社交应用": [] },
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
          // 防止分类不存在报错
          if (!results.updated[app.category]) results.updated[app.category] = [];
          results.updated[app.category].push({
            app,
            oldVersion: savedVersion,
            newVersion: latest
          });
          $.setdata(latest, key);
        } else if (compareResult === -1) {
          // 如果API返回旧版（极为罕见的情况，因为我们取了最大值），保持本地记录
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
      for (const category of ["代理工具", "社交应用"]) {
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
    
    // 如果有更新，顺便显示一下其他最新版的APP（可选，防止内容过长可注释掉）
    if (hasUpdate && results.current.length > 0) {
         body += `\n✅ 最新版应用:\n`;
         // 仅显示前3个防止通知太长
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

// =========================================
// 兼容性封装 (Env Class) - 已修复 Loon 适配
// =========================================
function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){const t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),console.log(t.join("\n"))}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}initGotEnv(t){this.got=this.got?this.got:require("got"),this.ckt=this.ckt?this.ckt:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.ckt.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
