/**
 * 生日提醒助手 - 清爽无混淆版
 * 完美支持 Loon Plugin 传入的 [数据1,数据2,...,提前天数] 格式及原生数组
 */

const lunarInfo = [
    0x4bd8,0x4ae0,0xa570,0x54d5,0xd260,0xd950,0x16554,0x56a0,0x9ad0,0x55d2,0x4ae0,0xa5b6,0xa4d0,0xd250,0x1d255,0xb540,0xd6a0,0xada2,0x95b0,0x14977,0x4970,0xa4b0,0xb4b5,0x6a50,0x6d40,0x1ab54,0x2b60,0x9570,0x52f2,0x4970,0x6566,0xd4a0,0xea50,0x6e95,0x5ad0,0x2b60,0x186e3,0x92e0,0x1c8d7,0xc950,0xd4a0,0x1d8a6,0xb550,0x56a0,0x1a5b4,0x25d0,0x92d0,0xd2b2,0xa950,0xb557,0x6ca0,0xb550,0x15355,0x4da0,0xa5d0,0x14573,0x52d0,0xa9a8,0xe950,0x6aa0,0xaea6,0xab50,0x4b60,0xaae4,0xa570,0x5260,0xf263,0xd950,0x5b57,0x56a0,0x96d0,0x4dd5,0x4ad0,0xa4d0,0xd4d4,0xd250,0xd558,0xb540,0xb5a0,0x195a6,0x95b0,0x49b0,0xa974,0xa4b0,0xb27a,0x6a50,0x6d40,0xaf46,0xab60,0x9570,0x4af5,0x4970,0x64b0,0x74a3,0xea50,0x6b58,0x55c0,0xab60,0x96d5,0x92e0,0xc960,0xd954,0xd4a0,0xda50,0x7552,0x56a0,0xabb7,0x25d0,0x92d0,0xcab5,0xa950,0xb4a0,0xbaa4,0xad50,0x55d9,0x4ba0,0xa5b0,0x15176,0x52b0,0xa930,0x7954,0x6aa0,0xad50,0x5b52,0x4b60,0xa6e6,0xa4e0,0xd260,0xea65,0xd530,0x5aa0,0x76a3,0x96d0,0x4bd7,0x4ad0,0xa4d0,0x1d0b6,0xd250,0xd520,0xdd45,0xb5a0,0x56d0,0x55b2,0x49b0,0xa577,0xa4b0,0xaa50,0x1b255,0x6d20,0xada0
];

function getLeapMonth(year) { return lunarInfo[year - 1900] & 0xf; }
function getMonthDays(year, month) { return (month > 12 || month < 1) ? 0 : (lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29; }
function getLeapDays(year) { return getLeapMonth(year) ? ((lunarInfo[year - 1900] & 0x10000) ? 30 : 29) : 0; }
function getLunarYearDays(year) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[year - 1900] & i) ? 1 : 0;
    return sum + getLeapDays(year);
}

function solarToLunar(date) {
    let y = date.getFullYear();
    if (y < 1900 || y > 2100) return null;
    let baseDate = new Date(1900, 0, 31);
    let offset = Math.floor((date.getTime() - baseDate.getTime()) / 86400000);
    let tempYear = 1900;
    let daysOfYear = getLunarYearDays(tempYear);
    while (tempYear < 2101 && offset >= daysOfYear) {
        offset -= daysOfYear;
        tempYear++;
        daysOfYear = getLunarYearDays(tempYear);
    }
    let tempMonth = 1;
    let isLeap = false;
    let leapMonth = getLeapMonth(tempYear);
    for (let i = 1; i <= 12; i++) {
        if (leapMonth > 0 && i === leapMonth + 1 && !isLeap) {
            --i;
            isLeap = true;
            let leapDays = getLeapDays(tempYear);
            if (offset < leapDays) { tempMonth = i; break; }
            offset -= leapDays;
        } else {
            let daysOfMonth = getMonthDays(tempYear, i);
            if (offset < daysOfMonth) { tempMonth = i; break; }
            offset -= daysOfMonth;
        }
    }
    return { year: tempYear, month: tempMonth, day: offset + 1 };
}

function formatDate(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}-${d}`;
}

const $ = new Env("生日提醒");

!(async () => {
    let rawArg = typeof $argument !== 'undefined' ? $argument : '';
    let advanceDays = 3;
    let birthdayList = [];

    // 解析 Loon 的传参 (自动适配 原生数组 或 字符串 格式)
    if (Array.isArray(rawArg)) {
        // 如果 Loon 直接作为原生数组传入
        let parts = rawArg.map(String).map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
        if (parts.length > 0) {
            let lastItem = parts.pop();
            if (!isNaN(lastItem) && lastItem !== '') {
                advanceDays = parseInt(lastItem);
            } else if (lastItem !== '') {
                parts.push(lastItem);
            }
            parts.forEach(p => {
                if (p) birthdayList.push(...p.split(';').filter(sp => sp.trim() !== ''));
            });
        }
    } else {
        // 如果是字符串传入
        let argStr = String(rawArg).trim();
        if (argStr.indexOf('[') === 0 && argStr.lastIndexOf(']') === argStr.length - 1) {
            let inner = argStr.slice(1, -1);
            let parts = inner.split(',').map(s => s.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
            if (parts.length > 0) {
                let lastItem = parts.pop();
                if (!isNaN(lastItem) && lastItem !== '') {
                    advanceDays = parseInt(lastItem);
                } else if (lastItem !== '') {
                    parts.push(lastItem);
                }
                parts.forEach(p => {
                    if (p) birthdayList.push(...p.split(';').filter(sp => sp.trim() !== ''));
                });
            }
        } else {
            // 普通 URL format info=xxx&advance=3
            let infoMatch = argStr.match(/info=([^&]+)/);
            let advMatch = argStr.match(/advance=([^&]+)/);
            if (advMatch) advanceDays = parseInt(advMatch[1]);
            let dataStr = infoMatch ? infoMatch[1] : argStr;
            if (dataStr) {
                birthdayList = decodeURIComponent(dataStr).split(/;|\n/).filter(p => p.trim() !== '');
            }
        }
    }

    $.log(`🔔 参数配置: [提前 ${advanceDays} 天] | 生日数据: ${birthdayList.length}条`);

    if (birthdayList.length === 0) {
        $.log("⚠️ 未检测到有效的生日数据，请检查插件参数！");
        return $.done();
    }

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let msgs = [];

    $.log(`📅 开始检查 今天 及未来 ${advanceDays} 天的生日...`);

    for (let i = 0; i <= advanceDays; i++) {
        let checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        let solarStr = formatDate(checkDate);
        let lunarObj = null;
        try { lunarObj = solarToLunar(checkDate); } catch (e) {}
        let lunarStr = lunarObj ? `${String(lunarObj.month).padStart(2, '0')}-${String(lunarObj.day).padStart(2, '0')}` : null;

        for (let data of birthdayList) {
            let parts = data.split(/@|,|，/);
            if (parts.length < 3) continue;

            let name = parts[0].trim();
            let type = parts[1].trim(); // 0=公历, 1=农历
            let dateStr = parts[2].trim().replace(/[\/.\\]/g, '-');

            let isMatch = false;
            let dateTypeLabel = "";

            if (type === '0' && dateStr === solarStr) {
                isMatch = true;
                dateTypeLabel = "公历";
            } else if (type === '1' && lunarStr && dateStr === lunarStr) {
                isMatch = true;
                dateTypeLabel = `农历(${lunarStr})`;
            }

            if (isMatch) {
                $.log(`🎉 匹配: ${name} (提前 ${i} 天)`);
                if (i === 0) {
                    msgs.push(`🎂 今天是 ${name} 的生日！\n📅 日期: ${solarStr} ${dateTypeLabel}`);
                } else {
                    msgs.push(`⏳ ${name} 还有 ${i} 天过生日\n📅 日期: ${solarStr} ${dateTypeLabel}`);
                }
            }
        }
    }

    if (msgs.length > 0) {
        let uniqueMsgs = [...new Set(msgs)];
        let title = "生日提醒 🎂";
        let subtitle = "近期寿星名单";
        if (uniqueMsgs.some(m => m.includes("今天是"))) {
            title = "今天有人过生日啦 🎂";
            subtitle = "🎂 生日快乐！";
        }
        $.msg(title, subtitle, uniqueMsgs.join('\n\n'));
    } else {
        $.log("✅ 近期无人生日。");
    }

})().catch(e => {
    $.log("❌ 错误: " + e.message);
}).finally(() => {
    $.done();
});

// 环境适配器
function Env(name) {
    return new class {
        constructor(name) { this.name = name; }
        isQuanX() { return typeof $task !== 'undefined'; }
        isSurge() { return typeof $httpClient !== 'undefined' && typeof $loon === 'undefined'; }
        isLoon() { return typeof $loon !== 'undefined'; }
        msg(title, subtitle, message) {
            if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, message);
            if (this.isQuanX()) $notify(title, subtitle, message);
            console.log('\n' + title + '\n' + subtitle + '\n' + message);
        }
        log(msg) { console.log(msg); }
        done(val = {}) { $done(val); }
    }(name);
}
