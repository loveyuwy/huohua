// 名称: 增强版代理工具 & 微信更新检测 (修复回退问题版)
// 描述: 应用更新检测脚本 - 增加版本号比对逻辑
// 作者: 〈ザㄩメ火华

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
    bundleId: "com.nssurge.inc.surge-ios",
    icon: "⚡️",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.nssurge.inc.surge"
  },
  {
    name: "Loon",
    bundleId: "com.ruikq.decar",
    icon: "🎈",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.ruikq.decar" 
  },
  {
    name: "Quantumult X",
    bundleId: "com.crossutility.quantumult-x",
    icon: "🌀",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.crossutility.quantumult-x"
  },
  // 微信
  {
    name: "微信",
    bundleId: "com.tencent.xin",
    icon: "💬",
    category: "社交应用",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.tencent.xin"
  }
];

// 版本号比较函数 (核心修复)
// 返回 1: v1 > v2 (有新版本)
// 返回 -1: v1 < v2 (API回退，忽略)
// 返回 0: v1 == v2 (无变化)
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

// 增强版请求函数 - 优化超时和错误处理
async function enhancedFetch(app) {
  const isWeChat = app.bundleId === "com.tencent.xin";
  const isSurge = app.name === "Surge";
  
  // 为 Surge 添加备用 bundleId
  const surgeAlternativeBundleId = "com.nssurge.inc.surge";
  
  let urls;
  
  if (isWeChat) {
    urls = [
      "https://itunes.apple.com/hk/lookup?bundleId=com.tencent.xin",
      "https://itunes.apple.com/cn/lookup?bundleId=com.tencent.xin",
      "https://itunes.apple.com/us/lookup?bundleId=com.tencent.xin"
    ];
  } else if (isSurge) {
    // Surge 特殊处理：尝试多个 bundleId
    urls = [
      `https://itunes.apple.com/hk/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/hk/lookup?bundleId=${surgeAlternativeBundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${surgeAlternativeBundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${surgeAlternativeBundleId}`
    ];
  } else {
    urls = [
      app.fallbackUrl || `https://itunes.apple.com/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
      `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`
    ];
  }
  
  let lastError;
  
  for (const [index, url] of urls.entries()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      // 增加请求间隔，避免被限流
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
      }
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const version = data.results[0].version;
          const usedBundleId = url.includes(surgeAlternativeBundleId) ? surgeAlternativeBundleId : app.bundleId;
          console.log(`✅ ${app.icon} ${app.name} 成功获取版本: ${version} (${url})`);
          return { app, version, usedBundleId };
        } else {
          throw new Error(`API返回空数据`);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      // console.log(`⚠️ ${app.icon} ${app.name} 请求异常 [${index + 1}/${urls.length}]: ${error.message}`);
    }
  }
  
  throw new Error(`所有API请求失败: ${lastError?.message || '未知错误'}`);
}

(async () => {
  let hasUpdate = false;
  const results = {
    updated: { "代理工具": [], "社交应用": [] },
    failed: [],
    current: []
  };
  
  const startTime = Date.now();
  
  // 并行执行所有请求
  const promises = appList.map(app => enhancedFetch(app));
  const outcomes = await Promise.allSettled(promises);
  
  const writePromises = [];

  // 处理所有结果
  outcomes.forEach((outcome, index) => {
    const app = appList[index];
    
    if (outcome.status === 'fulfilled') {
      const { version: latest } = outcome.value;
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $persistentStore.read(key);
      
      if (!savedVersion) {
        // 首次运行，直接保存
        writePromises.push($persistentStore.write(latest, key));
        results.current.push({
          app,
          version: latest,
          status: '首次记录'
        });
      } else {
        // 核心修改：使用 compareVersions 判断
        const compareResult = compareVersions(latest, savedVersion);
        
        if (compareResult === 1) { 
          // 只有 latest > savedVersion 才算更新
          hasUpdate = true;
          results.updated[app.category].push({
            app,
            oldVersion: savedVersion,
            newVersion: latest
          });
          writePromises.push($persistentStore.write(latest, key));
        } else if (compareResult === -1) {
          // API 返回了旧版本，忽略本次结果，保留本地较新版本
          console.log(`⚠️ ${app.name} API数据滞后 (${latest} < ${savedVersion})，保持本地新版，跳过更新。`);
          results.current.push({
            app,
            version: savedVersion, // 显示本地的最新版
            status: 'API回退'
          });
        } else {
          // 版本相同
          results.current.push({
            app,
            version: latest,
            status: '最新版'
          });
        }
      }
    } else {
      results.failed.push({
        app,
        error: outcome.reason.message
      });
    }
  });

  // 等待所有存储操作完成
  await Promise.all(writePromises);

  // 生成通知内容
  const now = new Date();
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 修改通知条件：只在有更新或查询失败时发送通知
  if (hasUpdate || results.failed.length > 0) {
    const title = hasUpdate ? "📱 发现应用更新" : "❌ 应用检测失败";
    let subtitle = hasUpdate ? "✨ 有应用可更新" : "⚠️ 部分应用查询失败";
    
    let body = "";
    let hasContent = false;
    
    // 更新详情
    if (hasUpdate) {
      for (const category of ["代理工具", "社交应用"]) {
        const updates = results.updated[category];
        if (updates.length > 0) {
          if (hasContent) body += "\n";
          body += `🆕 ${category}更新:\n`;
          body += updates.map(u => 
            `${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`
          ).join("\n");
          hasContent = true;
        }
      }
    }
    
    // 失败应用
    if (results.failed.length > 0) {
      if (hasContent) body += "\n";
      body += `❌ 查询失败:\n`;
      body += results.failed.map(f => 
        `${f.app.icon} ${f.app.name}: ${f.error}`
      ).join("\n");
      hasContent = true;
    }
    
    // 当前版本（只有在有更新的情况下才显示）
    if (hasUpdate && results.current.length > 0) {
      if (hasContent) body += "\n";
      body += `✅ 最新版应用:\n`;
      body += results.current.map(c => 
        `${c.app.icon} ${c.app.name}: ${c.version}`
      ).join("\n");
      hasContent = true;
    }
    
    // 统计信息
    body += `\n\n⏱️ 检测耗时: ${executionTime}秒`;
    body += `\n📅 ${now.toLocaleString("zh-CN", { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}`;
    
    // 添加提示
    if (results.failed.length > 0) {
      body += `\n\n💡 提示: ${results.failed.length}个应用查询失败，可能因区域限制或网络问题`;
    }
    
    body += "\n🔔 每日自动检测";
    
    $notification.post(title, subtitle, body);
  } else {
    // 没有更新且没有失败时，只记录日志，不发送通知
    console.log("📱 所有应用均为最新版本且检测成功，无需通知");
  }
  
  // 调试日志
  console.log("=".repeat(40));
  console.log(`应用更新检测完成 (${executionTime}s)`);
  
  if (results.updated["代理工具"].length + results.updated["社交应用"].length > 0) {
    console.log("✨ 发现以下更新:");
    for (const category of ["代理工具", "社交应用"]) {
      results.updated[category].forEach(u => {
        console.log(`  ${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`);
      });
    }
  } else {
    console.log("✨ 未发现应用更新");
  }
  
  if (results.current.length > 0) {
    console.log("✅ 检查成功的应用:");
    results.current.forEach(c => {
      // 增加状态显示，方便查看是否触发了 API 回退保护
      console.log(`  ${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : (c.status === 'API回退' ? ' (⚠️API数据旧，已忽略)' : '')}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log("❌ 查询失败的应用:");
    results.failed.forEach(f => {
      console.log(`  ${f.app.icon} ${f.app.name}: ${f.error}`);
    });
  }
  
  console.log("=".repeat(40));
  $done();
})();
