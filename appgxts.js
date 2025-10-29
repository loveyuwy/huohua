// 名称: 增强版代理工具 & 微信更新检测
// 描述: 应用更新检测脚本


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
    // 增加更多地区选项
    regions: ["us", "cn", "hk", "sg", "jp", "kr", "tw"]
  },
  {
    name: "Quantumult X",
    bundleId: "com.crossutility.quantumult-x",
    icon: "🌀",
    category: "代理工具",
    fallbackUrl: "https://itunes.apple.com/us/lookup?bundleId=com.crossutility.quantumult-x"
  },
  // 微信
  {
    name: "微信",
    bundleId: "com.tencent.xin",
    icon: "💬",
    category: "社交应用",
    fallbackUrl: "https://itunes.apple.com/cn/lookup?bundleId=com.tencent.xin"
  }
];

// 生成地区URL列表
function generateRegionUrls(app) {
  if (app.regions) {
    return app.regions.map(region => 
      `https://itunes.apple.com/${region}/lookup?bundleId=${app.bundleId}`
    );
  }
  
  const urls = [
    app.fallbackUrl || `https://itunes.apple.com/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/us/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/cn/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/hk/lookup?bundleId=${app.bundleId}`,
    `https://itunes.apple.com/sg/lookup?bundleId=${app.bundleId}`
  ];
  
  // 去重
  return [...new Set(urls.filter(url => url))];
}

// 增强版请求函数
async function enhancedFetch(app) {
  const urls = generateRegionUrls(app);
  let lastError;
  let successCount = 0;
  let failCount = 0;

  console.log(`🔍 ${app.icon} ${app.name} 开始检测，尝试 ${urls.length} 个地区API`);
  
  for (const [index, url] of urls.entries()) {
    try {
      // 增加延迟避免请求过于密集
      if (index > 0) {
        const delay = 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(url);
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const version = data.results[0].version;
          const region = new URL(url).hostname.split('.')[1]; // 提取地区
          console.log(`✅ ${app.icon} ${app.name} 成功获取版本: ${version} (${region})`);
          return { 
            app, 
            version,
            region 
          };
        } else {
          failCount++;
          throw new Error(`API返回空数据`);
        }
      } else if (response.status === 400) {
        // 400错误通常表示bundleId在该地区不存在
        failCount++;
        throw new Error(`bundleId在该地区不可用`);
      } else {
        failCount++;
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      lastError = error;
      successCount++;
      
      // 只在调试时显示每个请求的详细错误
      if (urls.length <= 3) { // 如果URL数量不多，显示详细日志
        console.log(`⚠️ ${app.icon} ${app.name} 请求异常: ${error.message}`);
      }
    }
  }
  
  // 总结性错误日志
  console.log(`❌ ${app.icon} ${app.name} 所有地区API均失败 (成功: ${successCount}, 失败: ${failCount})`);
  throw new Error(`所有地区API请求均失败`);
}


const $persistentStore = {
  read: (key) => $prefs.valueForKey(key),
  write: (value, key) => $prefs.setValueForKey(value, key)
};

const $notification = {
  post: (title, subtitle, body) => $notify(title, subtitle, body)
};

// 主函数
(async () => {
  let hasUpdate = false;
  const results = {
    updated: { "代理工具": [], "社交应用": [] },
    failed: [],
    current: []
  };
  
  const startTime = Date.now();
  
  console.log("🔄 开始应用更新检测...");
  console.log(`📱 检测应用数量: ${appList.length}`);
  
  // 顺序执行检测
  for (const app of appList) {
    try {
      const result = await enhancedFetch(app);
      const { version: latest } = result;
      const key = `app_ver_${app.bundleId}`;
      const savedVersion = $persistentStore.read(key);
      
      if (!savedVersion) {
        $persistentStore.write(latest, key);
        results.current.push({
          app,
          version: latest,
          status: '首次记录'
        });
        console.log(`📝 ${app.icon} ${app.name} 首次记录版本: ${latest}`);
      } else if (savedVersion !== latest) {
        hasUpdate = true;
        results.updated[app.category].push({
          app,
          oldVersion: savedVersion,
          newVersion: latest
        });
        $persistentStore.write(latest, key);
        console.log(`🆕 ${app.icon} ${app.name} 发现更新: ${savedVersion} → ${latest}`);
      } else {
        results.current.push({
          app,
          version: latest,
          status: '最新版'
        });
        console.log(`✅ ${app.icon} ${app.name} 已是最新版: ${latest}`);
      }
    } catch (error) {
      results.failed.push({
        app,
        error: error.message
      });
    }
    
    // 应用间延迟
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  // 生成通知内容
  const now = new Date();
  const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 仅在发现更新或所有应用都失败时发送通知
  if (hasUpdate || results.failed.length === appList.length) {
    const title = hasUpdate ? "📱 发现应用更新" : "⚠️ 应用检测异常";
    let subtitle = hasUpdate ? "✨ 有应用可更新" : "部分应用检测失败";
    
    let body = "";
    
    if (hasUpdate) {
      body += "🆕 发现更新:\n";
      for (const category of ["代理工具", "社交应用"]) {
        const updates = results.updated[category];
        if (updates.length > 0) {
          body += updates.map(u => 
            `${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`
          ).join("\n") + "\n";
        }
      }
      body += "\n";
    }
    
    // 成功检测的应用
    if (results.current.length > 0) {
      body += `✅ 最新版应用:\n`;
      body += results.current.map(c => 
        `${c.app.icon} ${c.app.name}: ${c.version}`
      ).join("\n");
      body += "\n\n";
    }
    
    // 失败的应用
    if (results.failed.length > 0) {
      body += `❌ 检测失败:\n`;
      body += results.failed.map(f => 
        `${f.app.icon} ${f.app.name}`
      ).join("\n");
      body += "\n\n";
    }
    
    // 统计信息
    body += `⏱️ 检测耗时: ${executionTime}秒\n`;
    body += `📅 ${now.toLocaleString("zh-CN", { 
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })}`;
    
    $notification.post(title, subtitle, body);
  } else if (results.failed.length > 0) {
    // 有失败但不发送通知，只在日志中显示
    console.log(`ℹ️  ${results.failed.length} 个应用检测失败，但无更新，不发送通知`);
  }
  
  // 总结日志
  console.log("=".repeat(50));
  console.log(`应用更新检测完成 (${executionTime}s)`);
  console.log(`📊 统计: ${results.current.length}成功 ${results.failed.length}失败`);
  
  if (hasUpdate) {
    console.log("✨ 发现以下更新:");
    for (const category of ["代理工具", "社交应用"]) {
      results.updated[category].forEach(u => {
        console.log(`  ${u.app.icon} ${u.app.name}: ${u.oldVersion} → ${u.newVersion}`);
      });
    }
  } else {
    console.log("✅ 所有可检测应用均为最新版本");
  }
  
  if (results.failed.length > 0) {
    console.log("❌ 检测失败的应用:");
    results.failed.forEach(f => {
      console.log(`  ${f.app.icon} ${f.app.name}: ${f.error}`);
    });
    
    // 为 Loon 提供特殊建议
    const loonApp = results.failed.find(f => f.app.name === "Loon");
    if (loonApp) {
      console.log("💡 Loon 检测建议: 该应用可能在某些地区不可用，可尝试手动检查或使用其他网络环境");
    }
  }
  
  console.log("=".repeat(50));
  $done();
})();
