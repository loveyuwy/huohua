// 专门用于被外部调用的透明背景制作模块
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
    a.message = `您的截图高度为 ${height}，脚本中未找到匹配的 iPhone 尺寸数据。请检查截图是否原图，或尝试其他图片。`;
    a.addAction("好的");
    await a.presentAlert();
    return;
  }

  // 4. 选择位置
  const pAlert = new Alert();
  pAlert.title = "选择组件位置";
  pAlert.message = "请选择你要放置组件的位置";
  
  // 
  // 定义通用位置
  const positions = [
    { name: "Top Left (左上)", val: "top-left" },
    { name: "Top Right (右上)", val: "top-right" },
    { name: "Middle Left (左中)", val: "middle-left" },
    { name: "Middle Right (右中)", val: "middle-right" },
    { name: "Bottom Left (左下)", val: "bottom-left" },
    { name: "Bottom Right (右下)", val: "bottom-right" }
  ];
  
  // 简单模式：大号/中号通常只需要 上/中/下
  const simplePositions = [
    { name: "顶部 (Top)", val: "top" },
    { name: "中间 (Middle)", val: "middle" },
    { name: "底部 (Bottom)", val: "bottom" }
  ];

  simplePositions.forEach(p => pAlert.addAction(p.name));
  positions.forEach(p => pAlert.addAction(p.name)); // 添加更精细的选项以防万一
  pAlert.addCancelAction("取消");

  const posIndex = await pAlert.presentSheet();
  if (posIndex === -1) return;
  
  // 合并数组以获取选中的值
  const allPos = [...simplePositions, ...positions];
  const choice = allPos[posIndex].val;

  // 5. 裁剪计算
  // 默认按中号组件宽度裁剪（因为大号宽度通常等于中号，高度不同但这里做通用处理）
  // 注意：这个脚本主要目的是生成背景，通常生成 中号/大号 通用的图即可
  
  // 如果用户选了 Top/Middle/Bottom，我们默认生成“中号/大号”宽度的图
  // 如果需要支持小号，需要更复杂的交互，这里为了通用性，默认生成 宽版 裁剪
  
  let crop = { x:0, y:0, w:0, h:0 };
  
  // 获取基础参数
  let w_small = phone.small;
  let w_medium = phone.medium;
  let w_large = phone.large; // 也就是高度
  
  // 间距计算
  let left = phone.left;
  let right = phone.right;
  let top = phone.top;
  let middle = phone.middle;
  let bottom = phone.bottom;

  // 逻辑：
  // Top = 左上起始，宽度为 Medium 宽，高度为 Large 高 (为了最大兼容)
  // 实际为了兼容性，我们通常裁剪出该区域的图片。
  
  // 这里我们简化逻辑，根据用户选择裁剪出对应的区域
  
  // 确定 Y 轴
  if (choice.includes("top")) crop.y = top;
  else if (choice.includes("middle")) crop.y = middle;
  else if (choice.includes("bottom")) crop.y = bottom;
  
  // 确定 X 轴 (默认靠左，如果是明确的 Right 则靠右)
  if (choice.includes("right")) crop.x = right;
  else crop.x = left;
  
  // 确定宽高
  // 如果是 Top/Middle/Bottom (不带左右)，通常是大组件或中组件，宽度取 Medium
  if (!choice.includes("-")) {
      crop.w = w_medium;
      crop.h = w_medium; // 这里取方形还是？通常中组件高度是 Small 的高
      // 为了让生成的图能适配中号和大号，我们通常保存高度为 Large 的高度（如果位置允许）
      // 但最安全的是生成 中号 尺寸
      crop.h = phone.small; // 中号高度 = 小号高度
      
      // 如果是大号，高度需要更多。
      // 为了简单，我们生成一个“中号”尺寸的背景，因为你的脚本主要是中号
      // 如果是大号组件，下面的逻辑可能需要微调
  } else {
      // 如果选了 左上/右上 这种，通常是小组件
      crop.w = w_small;
      crop.h = w_small;
  }
  
  // 修正：为了配合你的 Caishow 脚本（主要是中/大号），我们强制生成“中号/大号通用宽度”
  if (choice === 'top' || choice === 'middle' || choice === 'bottom') {
      crop.w = phone.medium; 
      // 高度方面，大号组件需要更高。
      // 如果你的组件是大号，这里需要裁更多。
      // 这里的策略是：裁剪出该区域“尽可能大”的背景
      crop.h = phone.large; // 尝试裁剪大号高度
  }

  // 6. 执行裁剪
  const draw = new DrawContext();
  draw.size = new Size(crop.w, crop.h);
  draw.drawImageAtPoint(image, new Point(-crop.x, -crop.y));
  const finalImage = draw.getImage();

  // 7. 保存文件
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
