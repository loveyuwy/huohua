// 专门用于被外部调用的透明背景制作模块 (只针对中号/大号)
// 包含了最新的 iPhone 机型数据

async function main(baseDir) {
  const fm = FileManager.local();
  
  // 1. 提示截图
  const alert = new Alert();
  alert.title = "制作透明背景";
  alert.message = "请确保你已经获取了主屏幕的【空白页截图】。\n(长按桌面进入编辑模式 -> 滑动到最右侧空白页 -> 截图)";
  alert.addAction("选择截图");
  alert.addCancelAction("取消");
  
  if (await alert.presentAlert() === -1) return;

  // 2. 选择图片
  const image = await Photos.fromLibrary();
  if (!image) return;

  // 3. 识别机型
  const height = image.size.height;
  const phone = phoneSizes()[height];
  
  if (!phone) {
    const a = new Alert();
    a.title = "机型不匹配";
    a.message = `您的截图高度为 ${height}，脚本中未找到匹配的 iPhone 尺寸数据。请检查截图是否原图。`;
    a.addAction("好的");
    await a.presentAlert();
    return;
  }

  // 4. 选择位置 (中号/大号通常只分 上/中/下)
  // 
  const pAlert = new Alert();
  pAlert.title = "第一步：选择位置";
  pAlert.message = "请选择组件在屏幕垂直方向的位置";
  
  const positions = [
    { name: "顶部 (Top)", val: "top" },
    { name: "中间 (Middle)", val: "middle" },
    { name: "底部 (Bottom)", val: "bottom" }
  ];

  positions.forEach(p => pAlert.addAction(p.name));
  pAlert.addCancelAction("取消");

  const posIndex = await pAlert.presentSheet();
  if (posIndex === -1) return;
  const posChoice = positions[posIndex].val;

  // 5. 选择尺寸 (明确区分中号和大号)
  const sAlert = new Alert();
  sAlert.title = "第二步：选择尺寸";
  sAlert.message = "请选择组件的大小";
  
  const sizes = [
    { name: "中号 (Medium)", val: "medium" },
    { name: "大号 (Large)", val: "large" }
  ];
  
  sizes.forEach(s => sAlert.addAction(s.name));
  sAlert.addCancelAction("取消");
  
  const sizeIndex = await sAlert.presentSheet();
  if (sizeIndex === -1) return;
  const sizeChoice = sizes[sizeIndex].val;

  // 6. 裁剪计算
  let crop = { x: 0, y: 0, w: 0, h: 0 };
  
  // X轴：中号和大号都是横向占满（除去边距），所以 X 固定为 left
  crop.x = phone.left;
  
  // Y轴：根据选择的位置确定
  if (posChoice === "top") crop.y = phone.top;
  else if (posChoice === "middle") crop.y = phone.middle;
  else if (posChoice === "bottom") crop.y = phone.bottom;
  
  // 宽高：根据选择的尺寸确定
  if (sizeChoice === "medium") {
      // 中号：宽度=medium定义值，高度=small定义值 (通常中号高度等于小号高度)
      crop.w = phone.medium;
      crop.h = phone.small; 
  } else {
      // 大号：宽度=medium定义值 (通常大号宽度等于中号宽度)，高度=large定义值
      // 为了保险，大号宽度我们取 phone.medium 和 phone.large 中较大的那个，或者直接用库里的定义
      crop.w = phone.medium; // 大部分机型大号宽度等于中号
      crop.h = phone.large;  // 大号高度
  }

  // 7. 执行裁剪
  const draw = new DrawContext();
  draw.size = new Size(crop.w, crop.h);
  draw.drawImageAtPoint(image, new Point(-crop.x, -crop.y));
  const finalImage = draw.getImage();

  // 8. 保存文件
  // Caishow 脚本会读取 baseDir 下以 Script.name() 命名的文件
  const savePath = fm.joinPath(baseDir, Script.name());
  fm.writeImage(savePath, finalImage);
  
  return savePath;
}

// 机型尺寸数据
function phoneSizes() {
  return {
    // 16 Pro Max
    2868: { small: 510, medium: 1092, large: 1146, left: 114, right: 696, top: 276, middle: 912, bottom: 1548 },
    // 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max
    2796: { small: 510, medium: 1092, large: 1146, left: 99, right: 681, top: 252, middle: 888, bottom: 1524 },
    // 16 Pro
    2622: { small: 486, medium: 1032, large: 1098, left: 87, right: 633, top: 261, middle: 873, bottom: 1485 },
    // 16, 15, 15 Pro, 14 Pro
    2556: { small: 474, medium: 1017, large: 1062, left: 82, right: 622, top: 240, middle: 828, bottom: 1416 },
    // 14 Plus, 13 Pro Max, 12 Pro Max
    2778: { small: 510, medium: 1092, large: 1146, left: 96, right: 678, top: 246, middle: 882, bottom: 1518 },
    // 13, 13 Pro, 12, 12 Pro
    2532: { small: 474, medium: 1014, large: 1062, left: 78, right: 618, top: 231, middle: 819, bottom: 1407 },
    // 11 Pro Max, XS Max
    2688: { small: 507, medium: 1080, large: 1137, left: 81, right: 654, top: 228, middle: 858, bottom: 1488 },
    // 11, XR
    1792: { small: 338, medium: 720, large: 758, left: 54, right: 436, top: 160, middle: 578, bottom: 996 },
    // 13 mini, 12 mini, 11 Pro, XS, X
    2436: { small: 465, medium: 987, large: 1035, left: 69, right: 591, top: 213, middle: 783, bottom: 1353 },
    // SE2, 8, 7, 6s
    1334: { small: 296, medium: 642, large: 648, left: 54, right: 400, top: 60, middle: 412, bottom: 764 },
    // SE1
    1136: { small: 282, medium: 584, large: 622, left: 30, right: 332, top: 59, middle: 399, bottom: 399 }
  }
}

module.exports = { main }
