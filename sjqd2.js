/**************************************
 * 声荐自动签到（调试增强版）
 * 仅用于排查 Loon Argument 行为
 **************************************/

const $ = new Env("声荐自动签到·调试版");

/* ========= 调试输出 ========= */
console.log("========== 调试开始 ==========");
console.log(`运行环境检测：`);
console.log(`$argument typeof = ${typeof $argument}`);
console.log(`$argument 原始值 =`, $argument);
console.log(`String($argument) = "${String($argument)}"`);

let argStr = "";
try {
  argStr = String($argument).toLowerCase().trim();
} catch (e) {
  console.log("argument 转字符串异常:", e);
}

console.log(`argStr = "${argStr}"`);
console.log(`argStr.length = ${argStr.length}`);
console.log(`是否等于 true : ${argStr === "true"}`);
console.log(`是否等于 false: ${argStr === "false"}`);
console.log(`是否等于 1    : ${argStr === "1"}`);
console.log(`是否包含 {}   : ${argStr.includes("{") || argStr.includes("}")}`);
console.log("========== 调试结束 ==========");

/* ========= 明确判断逻辑 ========= */
let isSilent = false;

if (argStr === "true" || argStr === "1") {
  isSilent = true;
}

console.log(`[最终判定] isSilent = ${isSilent}`);

/* ========= 可视化通知（调试用） ========= */
$.notify(
  "🧪 声荐调试结果",
  `argument = ${argStr || "空"}`,
  `isSilent = ${isSilent}`
);

$.done();

/* ========= Env ========= */
function Env(name) {
  this.name = name;
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") {
      $notification.post(t, s, b);
    } else if (typeof $notify !== "undefined") {
      $notify(t, s, b);
    } else {
      console.log(`${t}\n${s}\n${b}`);
    }
  };
  this.done = (v) => {
    if (typeof $done !== "undefined") {
      $done(v);
    }
  };
}
