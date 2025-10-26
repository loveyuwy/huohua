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
    // (无 fallbackUrl, 默认尝试 US/CN/US)
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
    // --- 修改：优先使用香港 API ---
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.ruikq.decar" 
  },
  {
    name: "Quantumult X",
    bundleId: "com.crossutility.quantumult-x",
    icon: "🌀",
    category: "代理工具",
    // --- 修改：优先使用香港 API ---
    fallbackUrl: "https://itunes.apple.com/hk/lookup?bundleId=com.crossutility.quantumult-x"
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

// 增强版请求函数 - 优化超时 (无重试)
async function enhancedFetch(app) {
  const isWeChat = app.bundleId === "com.tencent.xin";
  
  const urls = isWeChat ? [
    // 微信专用列表 (因为 fallbackUrl 也是 HK, 所以第一个和第三个一样, 但没关系)
    "https://itunes.apple.com/hk/lookup?bundleId=com.tencent.xin", // 香港API
    "https://itunes.apple.com/cn/lookup?bundleId=com.tencent.xin", // 中国API
    "https://itunes.apple.com/us/lookup?bundleId=com.tencent.xin"  // 美国API
  ] : [
    // 默认列表
    app.fallbackUrl || `https://itunes.apple.com/lookup?bundleId=${app.bundleId}`, // 优先使用 fallbackUrl (现在是 HK)
    `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`
  ];
  
  let lastError;
  
  for (const [index, url] of urls.entries()) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
      
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
      }
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const version = data.results[0].version;
          console.log(`✅ ${app.icon} ${app.name} 成功获取版本: ${version} (${url})`);
          return { app, version }; // 返回 app 和 version
        } else {
          throw new Error(`API返回空数据 (${url})`);
        }
      } else {
        throw new Error(`HTTP ${response.status} (${url})`);
      }
    } catch (error) {
      lastError = error;
      console.log(`⚠️ ${app.icon} ${app.name} 请求异常: ${error.message}`);
    }
  }
  
  // 如果所有URL都失败了，则抛出最后的错误
  throw new Error(`[${app.name}] 所有API请求失败: ${lastError?.message || '未知错误'}`);
}

(async () => {
  let hasUpdate = false;
  const results = {
    updated: { "代理工具": [], "社交应用": [] },
    failed: [],
    current: []
  };
  
  const startTime = Date.now();
  
  // --- 并行执行所有请求 ---
  const promises = appList.map(app => enhancedFetch(app));
  const outcomes = await Promise.allSettled(promises);
  
  const writePromises = [];

  // --- 处理所有结果 ---
  outcomes.forEach((outcome, index) => {
    const app = appList[index]; // 确保 app 对象按顺序对应
    
    if (outcome.status === 'fulfilled') {
      const { version: latest } = outcome.value;
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $persistentStore.read(key);
      
      if (!savedVersion) {
        writePromises.push($persistentStore.write(latest, key));
        results.current.push({
          app,
          version: latest,
          status: '首次记录'
        });
      } else if (savedVersion !== latest) {
        hasUpdate = true; // 标记有更新
        results.updated[app.category].push({
          app,
          oldVersion: savedVersion,
          newVersion: latest
        });
        writePromises.push($persistentStore.write(latest, key));
      } else {
        results.current.push({
          app,
          version: latest,
          status: '最新版'
        });
      }
    } else { // outcome.status === 'rejected'
      results.failed.push({
        app,
        error: outcome.reason.message
      });
    }
  });

  // 等待所有 $persistentStore.write 操作完成
  await Promise.all(writePromises);
  // --- 结果处理完毕 ---

  // 生成通知内容
  const now = new Date();
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 仅在 hasUpdate 为 true 时才发送通知
  if (hasUpdate) {
    const title = "📱 应用更新检测报告";
    let subtitle = "✨ 发现应用更新";
    
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
    
    // 当前版本 (附加信息)
    if (results.current.length > 0) {
      if (hasContent) body += "\n";
      body += `✅ 其他应用 (最新版):\n`;
      body += results.current.map(c => 
        `${c.app.icon} ${c.app.name}: ${c.version}${c.status === '首次记录' ? ' (首次记录)' : ''}`
      ).join("\n");
      hasContent = true;
    }
    
    // 失败应用 (附加信息)
    if (results.failed.length > 0) {
      if (hasContent) body += "\n";
      body += `❌ 查询失败:\n`;
      body += results.failed.map(f => 
        `${f.app.icon} ${f.app.name}: 查询失败` // 简化失败信息
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
    
    // 添加微信专用提示
    if (results.updated["社交应用"].some(u => u.app.name === "微信")) {
      body += "\n\n💡 微信提示: 国际版更新可能延迟，请确认App Store版本";
    }
    
    body += "\n🔔 每日自动检测 | 上午8点10分";
    
    $notification.post(title, subtitle, body);
  }
  
  
  // 调试日志 (始终打印)
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
    console.log("✅ 检查成功的应用 (最新版):");
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

