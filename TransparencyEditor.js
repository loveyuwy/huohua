module.exports = async (widget, ConfigManager, prefix) => {
    // 这里的 widget 参数就是主脚本里的 'this'
    // 这里的 ConfigManager 就是主脚本传过来的配置管理器

    const a = new Alert();
    a.title = "透明背景编辑器";
    a.message = "\n步骤：\n1. 主屏幕长按进入编辑模式\n2. 截取最右侧空白页\n3. 选择该截图";
    a.addAction("开始选择截图");
    a.addCancelAction("取消");
    
    if (await a.presentAlert() === -1) return;
    
    let img;
    try {
        img = await Photos.fromLibrary();
    } catch(e) {
        widget.notify("取消", "未选择图片");
        return;
    }
    if (!img) return;

    // 1. 确定组件尺寸
    let sizeType = "medium";
    // 注意：外部模块无法直接读取全局 config，建议默认 medium 或通过参数传递
    // 这里我们简单判断一下，如果是在 App 内运行则弹窗
    if (!config.runsInWidget) { 
        const sizeAlert = new Alert();
        sizeAlert.title = "组件大小";
        sizeAlert.addAction("中号 (Medium)");
        sizeAlert.addAction("大号 (Large)");
        sizeAlert.addCancelAction("取消");
        const sIdx = await sizeAlert.presentAlert();
        if (sIdx === -1) return;
        sizeType = sIdx === 0 ? "medium" : "large";
    } else {
        sizeType = config.widgetFamily || "medium";
    }

    // 2. 确定位置
    const posAlert = new Alert();
    posAlert.title = "组件位置";
    
    let positions = [];
    if (sizeType === "medium") {
        posAlert.message = "请选择组件所在的行：";
        positions = [
            { name: "第一排 (Top)", key: "top" },
            { name: "第二排 (Middle)", key: "middle" },
            { name: "第三排 (Bottom)", key: "bottom" }
        ];
    } else {
        posAlert.message = "请选择组件所在的区域：";
        positions = [
            { name: "顶部区域 (第1-2排)", key: "top" },
            { name: "底部区域 (第2-3排)", key: "bottom" }
        ];
    }
    
    positions.forEach(p => posAlert.addAction(p.name));
    posAlert.addCancelAction("取消");
    
    const pIdx = await posAlert.presentAlert();
    if (pIdx === -1) return;
    const positionKey = positions[pIdx].key;

    // 3. 执行裁剪
    try {
        const croppedImg = await cropImage(img, sizeType, positionKey);
        if (croppedImg) {
            const filename = `bg_${prefix}.jpg`; 
            const filenameDay = `bg_${prefix}_day.jpg`;
            const filenameNight = `bg_${prefix}_night.jpg`;
            
            const modeAlert = new Alert();
            modeAlert.title = "保存为...";
            modeAlert.addAction("☀️ 白天模式");
            modeAlert.addAction("🌙 夜间模式");
            const mIdx = await modeAlert.presentAlert();
            
            if (mIdx === 0) {
                 ConfigManager.saveImg(filenameDay, croppedImg);
                 ConfigManager.saveImg(filename, croppedImg);
                 widget.notify("✅ 云端制作完成", "已应用最新算法");
            } else {
                 ConfigManager.saveImg(filenameNight, croppedImg);
                 widget.notify("✅ 云端制作完成", "已应用最新算法");
            }
        }
    } catch (e) {
        console.error(e);
        widget.notify("❌ 失败", "裁剪出错: " + e.message);
    }
};

// --- 核心裁剪算法 (V15) ---
async function cropImage(img, size, position) {
    const h = img.size.height;
    const w = img.size.width;
    
    const phones = {
        "2796": { 
            name: "14/15/16 Pro Max",
            top: 460,        
            middle: 1060,    
            bottom: 1660,    
            large_h: 1147,   
            medium_h: 546,   
            left: 100,       
            right: 100,      
            width_fix: 1091,
            offset_fix: 4 
        },
        "2556": { name: "14/15/16 Pro", top: 235, middle: 863, bottom: 1491, large_h: 1066, medium_h: 512, left: 92, right: 92 },
        "2532": { name: "12/13/14", top: 212, middle: 833, bottom: 1454, large_h: 1052, medium_h: 507, left: 78, right: 78 },
        "2778": { name: "12/13/14 Max", top: 228, middle: 909, bottom: 1590, large_h: 1136, medium_h: 555, left: 96, right: 96 },
        "2436": { name: "X/XS/11Pro", top: 212, middle: 833, bottom: 1454, large_h: 1052, medium_h: 507, left: 72, right: 72 }
    };

    let cropY = 0;
    let cropH = 0;
    let cropX = 0;
    let cropW = 0;
    
    const cfg = phones[h.toString()];

    if (cfg) {
        console.log(`Matched Device: ${cfg.name}`);
        cropX = cfg.left;
        if (cfg.width_fix) {
            cropW = cfg.width_fix;
        } else {
            cropW = w - cfg.left - cfg.right;
        }
        
        const offset = cfg.offset_fix || 0;
        
        if (size === "large") {
            cropH = cfg.large_h;
            if (position === "top") cropY = cfg.top;
            else if (position === "bottom") cropY = cfg.middle + offset; 
        } else {
            cropH = cfg.medium_h;
            if (position === "top") cropY = cfg.top;
            else if (position === "middle") cropY = cfg.middle;
            else if (position === "bottom") cropY = cfg.bottom + offset;
        }

    } else {
        const topMargin = h * 0.091;
        const gap = h * 0.045;
        const height = (h * 0.88 - topMargin - (2 * gap)) / 3;
        
        let marginX = w * 0.068; 
        cropX = marginX;
        cropW = w - (2 * marginX);

        if (size === "medium") {
            cropH = height;
            if (position === "top") cropY = topMargin;
            else if (position === "middle") cropY = topMargin + height + gap;
            else if (position === "bottom") cropY = topMargin + (height + gap) * 2;
        } else if (size === "large") {
            cropH = (height * 2) + gap;
            if (position === "top") cropY = topMargin;
            else if (position === "bottom") cropY = topMargin + height + gap;
        }
    }
    
    if (cropY < 0) cropY = 0;
    if (cropY + cropH > h) cropH = h - cropY;

    let draw = new DrawContext();
    draw.size = new Size(cropW, cropH);
    draw.opaque = false;
    draw.drawImageAtPoint(img, new Point(-cropX, -cropY));
    return draw.getImage();
}
