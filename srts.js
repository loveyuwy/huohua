/**
 * 生日提醒助手 - 深度兼容版
 * 1. 专门适配 Loon 10+1 参数位格式
 * 2. 自动修正各类日期横杠符号 (-, −, —, ﹣)
 * 3. 完美支持农历/公历
 */

const lunarInfo = [
    0x4bd8,0x4ae0,0xa570,0x54d5,0xd260,0xd950,0x16554,0x56a0,0x9ad0,0x55d2,0x4ae0,0xa5b6,0xa4d0,0xd250,0x1d255,0xb540,0xd6a0,0xada2,0x95b0,0x14977,0x4970,0xa4b0,0xb4b5,0x6a50,0x6d40,0x1ab54,0x2b60,0x9570,0x52f2,0x4970,0x6566,0xd4a0,0xea50,0x6e95,0x5ad0,0x2b60,0x186e3,0x92e0,0x1c8d7,0xc950,0xd4a0,0x1d8a6,0xb550,0x56a0,0x1a5b4,0x25d0,0x92d0,0xd2b2,0xa950,0xb557,0x6ca0,0xb550,0x15355,0x4da0,0xa5d0,0x14573,0x52d0,0xa9a8,0xe950,0x6aa0,0xaea6,0xab50,0x4b60,0xaae4,0xa570,0x5260,0xf263,0xd950,0x5b57,0x56a0,0x96d0,0x4dd5,0x4ad0,0xa4d0,0xd4d4,0xd250,0xd558,0xb540,0xb5a0,0x195a6,0x95b0,0x49b0,0xa974,0xa4b0,0xb27a,0x6a50,0x6d40,0xaf46,0xab60,0x9570,0x4af5,0x4970,0x64b0,0x74a3,0xea50,0x6b58,0x55c0,0xab60,0x96d5,0x92e0,0xc960,0xd954,0xd4a0,0xda50,0x7552,0x56a0,0xabb7,0x25d0,0x92d0,0xcab5,0xa950,0xb4a0,0xbaa4,0xad50,0x55d9,0x4ba0,0xa5b0,0x15176,0x52b0,0xa930,0x7954,0x6aa0,0xad50,0x5b52,0x4b60,0xa6e6,0xa4e0,0xd260,0xea65,0xd530,0x5aa0,0x76a3,0x96d0,0x4bd7,0x4ad0,0xa4d0,0x1d0b6,0xd250,0xd520,0xdd45,0xb5a0,0x56d0,0x55b2,0x49b0,0xa577,0xa4b0,0xaa50,0x1b255,0x6d20,0xada0
];

function getLeapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
function getMonthDays(y, m) { return (m > 12 || m < 1) ? 0 : (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function getLeapDays(y) { return getLeapMonth(y) ? ((lunarInfo[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function getLunarYearDays(y) {
    let sum = 348;
    for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    return sum + getLeapDays(y);
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
        if (leapMonth > 0 && i === (leapMonth + 1) && !isLeap) {
            --i; isLeap = true;
            let leapDays = getLeapDays(tempYear);
            if (offset < leapDays) { tempMonth = i; break; }
            offset -= leapDays;
        } else {
            let daysOfMonth = getMonthDays(tempYear, i);
            if (offset < daysOfMonth) { tempMonth = i; break; }
            offset -= daysOfMonth;
        }
    }
    return { month: tempMonth, day: offset + 1 };
}

function formatDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const $ = new Env("生日提醒助手");

!(async () => {
    let rawArg = typeof $argument !== 'undefined' ? $argument : '';
    let advanceDays = 3;
    let birthdayList = [];

    // --- 精准解析 Loon 的 10+1 参数位 ---
    if (Array.isArray(rawArg)) {
        // 最后一个位置 (索引10) 是提前天数
        if (rawArg.length >= 11) {
            let daysVal = String(rawArg[10]).trim().replace(/"/g, '');
            if (daysVal && !isNaN(daysVal)) advanceDays = parseInt(daysVal);
            
            // 前 10 个位置是生日数据
            for (let i = 0; i < 10; i++) {
                let p = String(rawArg[i]).trim().replace(/^["']|["']$/g, '');
                if (p && p !== '""' && p !== "''") {
                    birthdayList.push(...p.split(';').filter(s => s.trim()));
                }
            }
        } else {
            // 参数不足11位时的后备方案
            let last = rawArg.pop();
            if (!isNaN(last)) advanceDays = parseInt(last);
            rawArg.forEach(p => {
                let s = String(p).trim().replace(/^["']|["']$/g, '');
                if (s && s !== '""') birthdayList.push(...s.split(';').filter(i => i.trim()));
            });
        }
    }

    $.log(`🔔 参数配置: [提前 ${advanceDays} 天] | 生日数据: ${birthdayList.length}条`);

    if (birthdayList.length === 0) {
        $.log("⚠️ 未检测到有效生日数据，请检查插件配置。");
        return $.done();
    }

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let results = [];

    // --- 检查循环 ---
    for (let i = 0; i <= advanceDays; i++) {
        let checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        
        let solarStr = formatDate(checkDate);
        let lunarObj = solarToLunar(checkDate);
        let lunarStr = lunarObj ? `${String(lunarObj.month).padStart(2, '0')}-${String(lunarObj.day).padStart(2, '0')}` : null;

        for (let item of birthdayList) {
            let parts = item.split(/@|,|，/);
            if (parts.length < 3) continue;

            let name = parts[0].trim();
            let type = parts[1].trim(); // 0=公, 1=农
            // 核心修复：替换各种形式的横杠、点、斜杠为标准减号
            let targetDate = parts[2].trim().replace(/[−—﹣－.／\\]/g, '-').padStart(5, '0');

            let isMatch = false;
            let label = "";

            if (type === '0' && targetDate === solarStr) {
                isMatch = true;
                label = "公历";
            } else if (type === '1' && lunarStr && targetDate === lunarStr) {
                isMatch = true;
                label = `农历(${lunarStr})`;
            }

            if (isMatch) {
                $.log(`🎉 匹配成功: ${name} (第 ${i} 天)`);
                let dayLabel = (i === 0) ? `今天` : `还有 ${i} 天`;
                results.push(`${i === 0 ? '🎂' : '⏳'} ${name} ${dayLabel}生日\n📅 日期: ${solarStr} ${label}`);
            }
        }
    }

    if (results.length > 0) {
        let unique = [...new Set(results)];
        $.msg("生日提醒助手 🎂", "发现近期寿星", unique.join('\n\n'));
    } else {
        $.log("✅ 近期无人生日。");
    }
})().catch(e => {
    $.log("❌ 脚本运行错误: " + e.message);
}).finally(() => {
    $.done();
});

function Env(n) {
    return new class {
        constructor(n) { this.name = n; }
        msg(t, s, m) {
            if (typeof $loon !== 'undefined') $notification.post(t, s, m);
            console.log(`\n${t}\n${s}\n${m}`);
        }
        log(m) { console.log(m); }
        done() { $done({}); }
    }(n);
}
