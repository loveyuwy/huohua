// 双色球开奖通知脚本 (智能重试版)
// 功能：每周二、四、日 21:30 自动获取开奖结果
// 特点：智能重试 + 动态Cookie + 多数据源验证
// 作者：火华

const OFFICIAL_API = "https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=1";
const BACKUP_API = "https://api.vvhan.com/api/lottery?type=ssq";
const PERSIST_KEY = "last_ssq_notify";
const MAX_RETRY = 3; // 最大重试次数
const RETRY_DELAY = 1500; // 重试延迟(毫秒)

// 全局状态
let retryCount = 0;
let sessionCookie = null;

async function main() {
  try {
    // 检查开奖日
    if (!isLotteryDay()) {
      console.log("今天不是双色球开奖日");
      $done();
      return;
    }

    // 检查是否已通知
    if (isAlreadyNotified()) {
      console.log("本期已通知过");
      $done();
      return;
    }

    // 获取开奖数据
    const lotteryData = await fetchLotteryData();
    
    // 构建通知内容
    const title = "🎱 双色球开奖结果";
    const content = `
🏷️ 期号：${lotteryData.issue}
📅 开奖日期：${lotteryData.date}
✨ 号码：${lotteryData.redBalls} + ${lotteryData.blueBall}
💰 奖池：${lotteryData.poolMoney}
🔢 简码：${lotteryData.simpleCode}
📡 数据源：${lotteryData.source}
    `.trim();

    // 发送通知
    $notification.post(title, "", content);
    $persistentStore.write(new Date().toISOString().split('T')[0], PERSIST_KEY);
    console.log("开奖通知发送成功");

  } catch (error) {
    console.log(`处理失败: ${error.message}`);
    $notification.post("❌ 双色球查询失败", "", `错误: ${error.message}\n请稍后重试`);
  } finally {
    $done();
  }
}

// 检查是否为开奖日
function isLotteryDay() {
  const day = new Date().getDay();
  return day === 0 || day === 2 || day === 4; // 周日、周二、周四
}

// 检查是否已通知
function isAlreadyNotified() {
  const lastNotify = $persistentStore.read(PERSIST_KEY);
  return lastNotify === new Date().toISOString().split('T')[0];
}

// 获取开奖数据
async function fetchLotteryData() {
  try {
    // 优先使用官方API
    const officialData = await fetchWithRetry(OFFICIAL_API, {
      headers: getOfficialHeaders(),
      timeout: 10
    });
    
    if (officialData?.result?.[0]) {
      const item = officialData.result[0];
      return {
        issue: item.code || "未知期号",
        date: item.date,
        redBalls: item.red.split(',').map(n => `🔴 ${n.padStart(2, '0')}`).join(' '),
        blueBall: `🔵 ${item.blue.padStart(2, '0')}`,
        simpleCode: `${item.red.replace(/,/g, ' ')} + ${item.blue}`,
        poolMoney: formatPrizePool(item.poolmoney),
        source: "官方API"
      };
    }
    throw new Error("官方API无有效数据");
  } catch (officialError) {
    console.log(`官方API失败: ${officialError.message}`);
    
    // 回退到备用API
    console.log("尝试备用API...");
    const backupData = await fetchWithRetry(BACKUP_API, {
      headers: getBackupHeaders(),
      timeout: 8
    });
    
    if (backupData?.success && backupData.data) {
      const item = backupData.data;
      return {
        issue: item.issue || "未知期号",
        date: item.date,
        redBalls: item.red.split(',').map(n => `🔴 ${n.padStart(2, '0')}`).join(' '),
        blueBall: `🔵 ${item.blue.padStart(2, '0')}`,
        simpleCode: `${item.red.replace(/,/g, ' ')} + ${item.blue}`,
        poolMoney: formatPrizePool(item.pool),
        source: "备用API"
      };
    }
    throw new Error("所有数据源均失败");
  }
}

// 带重试的请求
function fetchWithRetry(url, options) {
  return new Promise((resolve, reject) => {
    const attemptFetch = async () => {
      try {
        const response = await fetchUrl(url, options);
        
        // 处理可能的HTML响应(反爬页面)
        if (typeof response.body === 'string' && 
            response.body.includes('<html') && 
            !response.body.includes('{')) {
          throw new Error("收到反爬页面");
        }
        
        const data = JSON.parse(response.body);
        
        // 更新Cookie(如果存在)
        if (response.headers?.['Set-Cookie']) {
          sessionCookie = response.headers['Set-Cookie'];
          console.log("更新会话Cookie");
        }
        
        resolve(data);
      } catch (error) {
        retryCount++;
        
        if (retryCount <= MAX_RETRY) {
          console.log(`请求失败，第${retryCount}次重试... (${error.message})`);
          setTimeout(attemptFetch, RETRY_DELAY);
        } else {
          reject(new Error(`请求失败: ${error.message} (${retryCount}次重试)`));
        }
      }
    };
    
    attemptFetch();
  });
}

// 基础HTTP请求
function fetchUrl(url, options) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "zh-CN,zh-Hans;q=0.9",
      ...options.headers
    };
    
    // 添加会话Cookie(如果存在)
    if (sessionCookie) {
      headers["Cookie"] = sessionCookie;
    }
    
    $httpClient.get({
      url: url,
      headers: headers,
      timeout: options.timeout
    }, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve({
          status: response.status || 0,
          body: body,
          headers: response.headers
        });
      }
    });
  });
}

// 官方API请求头
function getOfficialHeaders() {
  return {
    "Referer": "https://www.cwl.gov.cn/",
    "X-Requested-With": "XMLHttpRequest",
    "Accept-Encoding": "gzip, deflate, br"
  };
}

// 备用API请求头
function getBackupHeaders() {
  return {
    "Origin": "https://api.vvhan.com",
    "Referer": "https://api.vvhan.com/"
  };
}

// 格式化奖池金额
function formatPrizePool(pool) {
  const amount = parseFloat(pool.replace(/[^\d.]/g, ''));
  if (isNaN(amount)) return pool;
  
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0
  }).format(amount);
}

// 初始化Cookie
function initCookie() {
  // 尝试从持久化存储读取Cookie
  sessionCookie = $persistentStore.read("ssq_cookie");
  if (sessionCookie) {
    console.log("使用持久化Cookie");
  } else {
    console.log("无持久化Cookie，将创建新会话");
  }
}

// 启动脚本
initCookie();
main();