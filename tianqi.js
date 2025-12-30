const params = getParams($argument);
const cityId = params.cityId || "101190401";
const apiUrl = `http://t.weather.sojson.com/api/weather/city/${cityId}`;
// 获取静默参数，如果包含 # 则为静默模式
const isSilent = params.silent === "#";

$httpClient.get(apiUrl, (error, response, data) => {
  if (error) {
    console.log(error);
    if (!isSilent) $notification.post("❌ 天气请求失败", "请检查网络连接", error);
    $done();
    return;
  }

  const weatherData = JSON.parse(data);
  if (weatherData.status !== 200) {
    const errorMsg = `请求失败，状态码：${weatherData.status}`;
    console.log(errorMsg);
    if (!isSilent) $notification.post("⚠️ 天气数据异常", "请检查城市ID", errorMsg);
    $done();
    return;
  }

  const cityInfo = weatherData.cityInfo;
  const currentWeather = weatherData.data.forecast[0];
  
  // 天气图标映射
  const weatherIcons = {
    "晴": "☀️", 
    "多云": "⛅", 
    "阴": "☁️", 
    "雨": "🌧️", 
    "雪": "❄️", 
    "雷": "⛈️", 
    "雾": "🌫️", 
    "霾": "😷"
  };
  
  // 获取匹配的天气图标
  const getWeatherIcon = (weather) => {
    for (const [key, icon] of Object.entries(weatherIcons)) {
      if (weather.includes(key)) return icon;
    }
    return "🌈";
  };
  
  // 空气质量图标
  const qualityIcon = weatherData.data.quality === "优" ? "✅" : 
                     weatherData.data.quality === "良" ? "⚠️" : "❌";
  
  const weatherIcon = getWeatherIcon(currentWeather.type);
  
  // 通知内容
  const notifyTitle = `${weatherIcon} ${cityInfo.city}天气预报`;
  const notifyContent = `${weatherIcon} 天气：${currentWeather.type}
🌡️ 温度：${currentWeather.low.replace("低温", "⬇️")} ${currentWeather.high.replace("高温", "⬆️")}
${qualityIcon} 空气：${weatherData.data.quality} | 💧湿度：${weatherData.data.shidu}
💨 ${currentWeather.fx} ${currentWeather.fl}
🌅 ${currentWeather.sunrise} | 🌇 ${currentWeather.sunset}
📌 ${currentWeather.notice}`;

  // 判断静默状态：只有不是静默模式(!isSilent)才发送通知
  if (!isSilent) {
      $notification.post(notifyTitle, "", notifyContent);
  } else {
      console.log("🔕 天气脚本：静默运行中，已拦截通知。");
  }

  const message = `📍城市：${cityInfo.city}\n🕰︎更新时间：${cityInfo.updateTime} \n🌤︎天气：${currentWeather.type}\n🌡︎温度：${currentWeather.low}  ${currentWeather.high}\n💧湿度：${weatherData.data.shidu}\n💨空气质量：${weatherData.data.quality}\n☁️PM2.5：${weatherData.data.pm25}\n☁️PM10：${weatherData.data.pm10}\n🪁风向：${currentWeather.fx}\n🌪️风力：${currentWeather.fl}\n🌅日出时间：${currentWeather.sunrise}\n🌇日落时间：${currentWeather.sunset}\n🏷︎Tips：${currentWeather.notice}`;

  const body = {
    title: "今日天气",
    content: message,
    cityId: params.cityId,
    icon: params.icon,
    "icon-color": params.color
  };
  
  $done(body);
});

function getParams(param) {
  return Object.fromEntries(
    param
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}
