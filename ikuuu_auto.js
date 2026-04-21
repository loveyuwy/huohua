const $ = new Env("iKuuu助手");
const checkinUrl = "https://ikuuu.win/user/checkin";

let isSilent = false;
if (typeof $argument !== 'undefined' && $argument) {
  if (typeof $argument === 'string') {
    isSilent = ($argument === 'silent=#' || $argument.indexOf('silent=#') > -1);
  } else {
    isSilent = ($argument === '#');
  }
}

if (typeof $request !== "undefined") {
  GetCookieOrCheckin();
} else {
  Checkin();
}

function GetCookieOrCheckin() {
  if ($request && $request.headers) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'];
    const url = $request.url;
    if (cookie && (url.indexOf("ikuuu.win") !== -1 || url.indexOf("ikuuu.nl") !== -1 || url.indexOf("ikuuu.fyi") !== -1)) {
      const saved = $.setdata(cookie, "ikuuu_cookie");
      if (saved) {
        $.msg($.name + " 🍪", "Cookie 更新成功 🎉", "检测到 ikuuu 访问，Cookie 已保存 🚀");
        $.log("✅ Cookie 更新成功: " + cookie);
      } else {
        $.msg($.name + " 🚫", "Cookie 保存失败", "无法写入数据 ⚠️");
      }
      $.done();
      return;
    }
  }
  Checkin();
}

function Checkin() {
  const cookie = $.getdata("ikuuu_cookie");

  if (!cookie) {
    $.msg($.name + " ⚠️", "未找到 Cookie", "请确保 MITM 包含 ikuuu 域名并访问网页登录 🚫");
    $.log("❌ 未找到 Cookie");
    $.done();
    return;
  }

  const headers = {
    "Cookie": cookie,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1",
    "Referer": "https://ikuuu.fyi/user",
    "Origin": "https://ikuuu.fyi",
    "X-Requested-With": "XMLHttpRequest"
  };

  const myRequest = {
    url: checkinUrl,
    method: "POST",
    headers: headers,
    body: "",
    timeout: 15000
  };

  $.log("▶️ 开始签到...");

  $.post(myRequest, (error, response, data) => {
    if (error) {
      $.msg($.name + " ❌", "网络错误", "无法连接到服务器 📶");
      $.log("❌ 网络错误: " + error);
    } else {
      try {
        const obj = JSON.parse(data);
        const now = new Date();
        const timeStr = now.getHours() + ":" + (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();

        if (obj.ret === 1) {
          $.log("✅ 签到成功: " + obj.msg);
          if (!isSilent) {
            $.msg($.name + " 🚀", "签到成功 ✅", `💎 奖励详情: ${obj.msg}\n⏱️ 执行时间: ${timeStr}`);
          }
        } else {
          $.log("⚠️ 签到结果: " + obj.msg);

          const isAlreadyCheckin = obj.msg && (
            obj.msg.indexOf("已经签到过") !== -1 ||
            obj.msg.indexOf("already checked") !== -1
          );

          if (isSilent && isAlreadyCheckin) {
            $.log("ℹ️ 今日已签到（静默模式，不通知）");
          } else {
            $.msg($.name + " 🔔", "签到提示", `📝 状态信息: ${obj.msg}\n📅 日期: ${now.toLocaleDateString()}`);
          }
        }
      } catch (e) {
        if (data && data.indexOf("404") !== -1) {
          $.log("❌ 接口 404 - 请检查 URL 是否正确");
          $.msg($.name + " ❌", "接口异常", "404 请检查域名是否变化");
        } else if (data && data.indexOf("html") !== -1) {
          $.msg($.name + " 🛑", "Cookie 已失效", "请重新访问 ikuuu 官网获取 Cookie 🔄");
          $.log("❌ Cookie 失效，返回了网页");
        } else {
          $.msg($.name + " ❌", "解析异常", "签到响应格式错误");
          $.log("❌ 解析失败: " + e);
        }
      }
    }
    $.done();
  });
}


function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),n={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(n,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);r=JSON.stringify(this.data);if(s)this.fs.writeFileSync(t,r);else{const t=i?e:t;this.fs.writeFileSync(t,r)}}}lodash_get(t,e,s){i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.headers.cookie&&(t.headers.Cookie=this.ckjar.getCookieStringSync(t.url)))}get(t,e=(()=>{})){t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.post(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method="POST",this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:s,...i}=t;this.got.post(s,i).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}log(...t){t.length>0&&(this.logs=[...this.logs,...t],console.log(t.join(this.logSeparator)))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}