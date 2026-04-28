# 对话标尺 | Chat Ruler

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

在AI长对话页面右侧显示「轮次导航」侧边栏，像浏览文档大纲一样快速跳转和定位任意对话轮次。

适配 **Kimi、Gemini、DeepSeek、豆包、元宝、ChatGPT** 六大平台。

---

## 功能特性

- **轮次自动识别**：将多轮对话自动划分为「提问-回复」轮次
- **侧边栏导航**：右侧可折叠面板，显示每轮对话的用户输入摘要
- **瞬跳定位**：点击任意轮次，页面瞬跳并高亮目标消息（无滚动动效）
- **位置跟随**：滚动页面时，侧边栏自动高亮当前所在轮次
- **AI标题提取**：自动解析AI回复中的 Markdown 一级/二级标题，支持子级跳转
- **实时同步**：新消息到达时自动刷新目录（MutationObserver）
- **Mini抽屉**：折叠为迷你导航条，hover 抽屉展开，坐标对齐不跳动
- **点击外部收起**：完整导航展开时，点击页面区域自动收起
- **暗色/亮色自适应**：自动检测平台主题，切换暗色模式
- **跨平台适配**：模块化平台适配器，支持6大主流AI网站
- **零隐私风险**：纯本地处理，无网络请求，不上传任何对话内容

---

## 安装方法

### 方式一：Chrome Web Store（推荐）

待上架...

### 方式二：开发者模式（本地加载）

1. 下载本仓库或 [Releases](https://github.com/yourname/chat-ruler/releases) 页面获取最新版本
2. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
3. 开启右上角「开发者模式」（Developer mode）
4. 点击「加载已解压的扩展程序」（Load unpacked）
5. 选择本项目的根目录
6. 进入任意支持的AI对话页面，右侧即会出现导航侧边栏

---

## 使用说明

| 操作 | 说明 |
|------|------|
| 点击轮次项 | 瞬跳到对应对话位置并高亮 |
| 点击 `#` 标题 | 跳转到该轮次内的具体标题位置 |
| 拖拽面板左边缘 | 调整侧边栏宽度（200px ~ 500px） |
| `Alt + Shift + O` | 显示/隐藏侧边栏 |
| `Alt + Shift + R` | 手动刷新目录 |
| 点击折叠箭头 | 展开/收起该轮次的标题列表 |
| 点击导航栏外部 | 收起完整导航（Mini 模式下生效） |

---

## 支持平台

| 平台 | 域名 | 状态 |
|------|------|------|
| **Kimi** | `kimi.moonshot.cn` / `kimi.com` | ✅ 已适配 |
| **Gemini** | `gemini.google.com` | ✅ 已适配 |
| **DeepSeek** | `chat.deepseek.com` | ✅ 已适配 |
| **豆包** | `doubao.com` | ✅ 已适配 |
| **元宝** | `yuanbao.tencent.com` | ✅ 已适配 |
| **ChatGPT** | `chatgpt.com` / `chat.openai.com` | ✅ 已适配 |

---

## 跨平台兼容

本插件**完全兼容 macOS、Windows 及 Linux**，原因：

- Chrome 扩展程序本身是**跨平台架构**，同一套代码在所有操作系统上运行
- 快捷键 `Alt + Shift + O` / `Alt + Shift + R`：
  - **Windows**：按 `Alt + Shift + O`
  - **macOS**：按 `Option + Shift + O`（JavaScript 中的 `e.altKey` 会自动识别 Option 键）
- 所有交互均使用标准 Web API，无平台差异

---

## 技术规格

- **Manifest V3** 规范
- **体积**：~ 60 KB（含图标）
- **依赖**：零第三方依赖，纯原生 JavaScript
- **权限**：仅 `activeTab`、`storage`，最小权限原则
- **隐私**：所有对话解析与渲染均在本地完成，无任何外联请求

---

## 项目结构

```
chat-ruler/
├── manifest.json      # 扩展配置（Manifest V3）
├── content.js         # 内容脚本：核心解析与交互逻辑
├── content.css        # 侧边栏样式与动画
├── icons/
│   ├── icon16.png     # 工具栏图标
│   ├── icon48.png
│   └── icon128.png
├── PRD.md             # 产品需求文档
├── README.md          # 本文件
└── LICENSE            # MIT 许可证
```

---

## 自定义与扩展

### 添加新平台支持

在 `content.js` 的 `DETECTORS` 对象中新增平台检测方法，并在 `manifest.json` 的 `matches` 中添加域名即可。

示例结构：
```javascript
newplatform() {
  const msgs = [];
  const items = document.querySelectorAll('[data-message-author-role]');
  items.forEach(el => {
    const role = el.getAttribute('data-message-author-role');
    const text = (el.textContent || '').trim();
    if (text) msgs.push({ el, role, text });
  });
  return msgs;
}
```

---

## 版本记录

### v1.3.0 (2026-04-28)
- 品牌更名：「对话标尺 / Chat Ruler」
- 新增 ChatGPT 平台适配
- Mini 导航改为抽屉式展开，hover 时坐标对齐不跳动
- 新增「点击导航栏外部区域自动收起」功能
- 暗色/亮色模式自适应优化
- 全部字号统一为 14px
- 数字序号框统一为 32×32px 正方形

### v1.2.x (2026-04-28)
- 重写 mini-bar 视觉系统（抽屉交互、正方形序号、统一颜色）
- 瞬跳替代平滑滚动
- 点击高亮内容块 + 小标题跳转
- Gemini 昼夜模式修复

### v1.1.x (2026-04-27)
- 豆包、DeepSeek、元宝、Kimi 平台适配修复
- 跳转四层滚动策略
- 路由变化自动重建

### v1.0.0 (2026-04-27)
- 首次发布
- 支持 Kimi、Gemini、DeepSeek、豆包、元宝
- 轮次导航、标题提取、位置跟随、自动同步

---

## License

MIT License © 2026
