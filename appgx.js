// 名称: 增强版代理工具 & 微信更新检测
// 描述: 应用更新检测脚本
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
    fallbackUrl: "https://itunes.apple.com/us/lookup?bundleId=com.nssurge.inc.surge-ios"
  },
  { 
    name: "Loon", 
    bundleId: "com.ruikq.decar",
    icon: "🎈",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/us/lookup?bundleId=com.ruikq.decar"
  },
  {
    name: "Quantumult X",
    bundleId: "com.crossutility.quantumult-x",
    icon: "🌀", 
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/us/lookup?bundleId=com.crossutility.quantumult-x"
  },
  // 微信 - 添加香港API作为首选
  { 
    name: "微信", 
    bundleId: "com.tencent.xin",
    icon: "💬",
    category: "社交应用",
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.tencent.xin" // 改为香港API
  }
];

// 增强版请求函数 - 优化微信专用检测
async function enhancedFetch(app, retries = 3, initialDelay = 1000) {
  // 为微信使用专用API列表
  const isWeChat = app.bundleId === "com.tencent.xin";
  
  const urls = isWeChat ? [
    "https://itunes.apple.com/hk/lookup?bundleId=com.tencent.xin", // 香港API
    "https://itunes.apple.com/cn/lookup?bundleId=com.tencent.xin", // 中国API
    "https://itunes.apple.com/us/lookup?bundleId=com.tencent.xin"  // 美国API
  ] : [
    app.fallbackUrl || `https://itunes.apple.com/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`
  ];
  
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const [index, url] of urls.entries()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // 添加随机延迟避免请求风暴
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
        }
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.status === 200) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const version = data.results[0].version;
            console.log(`✅ ${app.icon} ${app.name} 成功获取版本: ${version} (${url})`);
            return version;
          } else {
            throw new Error(`API返回空数据 (${url})`);
          }
        } else {
          throw new Error(`HTTP ${response.status} (${url})`);
        }
      } catch (error) {
        lastError = error;
        console.log(`⚠️ ${app.icon} ${app.name} 请求异常 [尝试${attempt+1}/${retries}]: ${error.message}`);
      }
    }
    
    // 指数退避策略
    if (attempt < retries - 1) {
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`⏳ ${app.icon} ${app.name} 等待 ${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
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
  
  for (const app of appList) {
    try {
      const latest = await enhancedFetch(app);
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $persistentStore.read(key);
      
      if (!savedVersion) {
        await $persistentStore.write(latest, key);
        results.current.push({
          app,
          version: latest,
          status: '首次记录'
        });
      } else if (savedVersion !== latest) {
        hasUpdate = true;
        results.updated[app.category].push({
          app,
          oldVersion: savedVersion,
          newVersion: latest
        });
        await $persistentStore.write(latest, key);
      } else {
        results.current.push({
          app,
          version: latest,
          status: '最新版'
        });
      }
    } catch (error) {
      results.failed.push({
        app,
        error: error.message
      });
    }
  }
  

  // 生成通知内容
  const now = new Date();
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (hasUpdate || results.failed.length > 0) {
    const title = "📱 应用更新检测报告";
    let subtitle = hasUpdate ? "✨ 发现应用更新" : "⚠️ 检测到查询异常";
    
    let body = "";
    let hasContent = false;
    
    // 更新详情
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
    
    // 当前版本
    if (results.current.length > 0) {
      if (hasContent) body += "\n";
      body += `✅ 当前最新版本:\n`;
      body += results.current.map(c => 
        `${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : ''}`
      ).join("\n");
      hasContent = true;
    }
    
    // 失败应用
    if (results.failed.length > 0) {
      if (hasContent) body += "\n";
      body += `❌ 查询失败:\n`;
      body += results.failed.map(f => 
        `${f.app.icon} ${f.app.name}: ${f.error}`
      ).join("\n");
      body += "\nℹ️ 可能是网络问题或API限制";
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
    
    // 添加微信专用提示
    if (results.updated["社交应用"].some(u => u.app.name === "微信")) {
      body += "\n\n💡 微信提示: 国际版更新可能延迟，请确认App Store版本";
    }
    
    body += "\n🔔 每日自动检测 | 上午8点10分";
    
    $notification.post(title, subtitle, body);
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
  }
  
  if (results.current.length > 0) {
    console.log("✅ 当前最新版本:");
    results.current.forEach(c => {
      console.log(`  ${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : ''}`);
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
