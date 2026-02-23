# 小红书 (RedNote) 自动化能力调研报告

结合我们之前的实际测试以及网上的最新调研信息，以下是小红书自动化和内容获取的几种可行方案：

## 实际测试总结 (基于 macOS Native API 的原生方法)

我们在 macOS 上实际测试了通过 `rednote-reader` 和 `computer-use` 这两个基于无障碍 (Accessibility) API 的 Skill。

*   **方法 1: 屏幕截图与坐标点击 (`computer-use screenshot` + `click`)**
    *   可以通过截取屏幕并通过视觉模型确定 UI 元素（如搜索栏）的具体坐标来进行点击和输入。
    *   **缺点:** 受限于屏幕分辨率和窗口尺寸的变化，坐标计算容易产生偏差（例如在我们尝试搜索 "crewly" 时遇到了点击未命中的情况）。
*   **方法 2: UI 树读取 (`computer-use read-ui`)**
    *   通过 macOS 的 Accessibility API 获取应用的完整 UI 树（AXWindow, AXGroup, AXButton 等），能够获取到非常精准的控件位置。
    *   **优点:** 坐标准确度极高，无视分辨率缩放。
*   **方法 3: macOS 快捷操作 (AppleScript)**
    *   可以使用 AppleScript 获取 `discover`（小红书进程名）的窗口 bounds，并激活应用。非常稳定。
*   **方法 4: 原生内容读取 (`rednote-reader feed/nav/search`)**
    *   直接通过 Accessibility 接口读取小红书客户端加载的笔记列表（包含标题、作者、点赞数等）以及顶部的导航结构（Home, Explore, Video 等）。
    *   **优点:** 不需要复杂的逆向工程，对账号安全无影响，速度极快。
*   **方法 5: 模拟输入 (`computer-use type`)**
    *   结合 UI 坐标，可以发送键盘敲击指令完成搜索词输入并触发搜索。

---

## 补充调研信息 (网络开源方案)

### 方法 6: RedNote MCP Server（最推荐）

专门为小红书设计的 MCP Server，可以直接连接到 AI agent！

*   **项目地址:** [https://github.com/iFurySt/RedNote-MCP](https://github.com/iFurySt/RedNote-MCP)
*   **安装方式:** `npm install -g rednote-mcp`
*   **功能特点:**
    *   关键词搜索笔记
    *   获取笔记详情（标题、内容、图片、标签等）
    *   获取评论
    *   自动登录管理（cookie 持久化）
    *   并行处理
*   **为什么最推荐:** 因为我们的 agent 系统已经支持 MCP，可以直接作为 MCP server 连接到 Luna 或其他 agent，实现零改动接入！
*   *注: 还有一个支持发布内容的版本：[https://github.com/TimeCyber/mcp-xiaohongshu](https://github.com/TimeCyber/mcp-xiaohongshu)*

### 方法 7: MediaCrawler (30K+ stars)

*   **项目地址:** [https://github.com/NanmiCoder/MediaCrawler](https://github.com/NanmiCoder/MediaCrawler)
*   **技术方案:** 基于 Playwright 浏览器自动化
*   **功能特点:** 关键词搜索、指定帖子 ID 获取、评论采集（含嵌套）、创作者主页、登录状态缓存、IP 代理池。支持多平台。
*   **输出格式:** CSV, JSON, Excel, SQLite, MySQL

### 方法 8: Spider_XHS

*   **项目地址:** [https://github.com/cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS)
*   **技术方案:** API 集成（通过 cookie 认证）
*   **特色功能:** 可以获取无水印图片和视频！同时支持获取帖子文字、元数据、用户信息、评论和互动数据。

### 方法 9: Apify 云端方案

*   **链接:** [https://apify.com/buglesslogic/easy-rednote-xiaohongshu-scraper](https://apify.com/buglesslogic/easy-rednote-xiaohongshu-scraper)
*   **特色:** 云端 API 调用，搜索笔记、用户帖子采集、评论采集、用户资料采集。免去了本地部署和维护 IP 代理的麻烦。

---

## 最终推荐方案

*   **最佳选择: RedNote MCP Server (方法 6)** — 我们系统已支持 MCP，能够以最低成本、零代码改动直接接入，获得稳定可靠的读写能力。
*   **辅助选择: Spider_XHS (方法 8)** — 当我们需要下载无水印视频或高清图片时，可以使用此工具配合 Gemini Files API 进行深度的多模态内容分析。
