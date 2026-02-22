# 开发一个 Desktop Automation Skill（computer-use）。

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

这个 skill 需要实现以下功能：
1. **截图** — 使用 macOS 的 screencapture 命令截取屏幕
2. **移动鼠标** — 移动鼠标到指定坐标
3. **点击鼠标** — 在指定坐标点击（左键/右键/双击）
4. **键盘输入** — 可选，模拟键盘输入文字

技术方案：
- 截图：`screencapture -x /tmp/screenshot.png`
- 鼠标控制：可以用 `cliclick`（需 brew install）或 `osascript` AppleScript
- Skill 结构参考：`config/skills/agent/nano-banana-image/` 的格式（execute.sh + skill.json + instructions.md）
- Skill 路径：`config/skills/agent/computer-use/`

参数设计建议：
- `--action screenshot|move|click|type`
- `--x` 和 `--y` 坐标
- `--button left|right|double`
- `--text` 键盘输入文本
- `--output` 截图保存路径

请：
1. 先查看现有的 skill 结构了解规范
2. 创建 computer-use skill（execute.sh, skill.json, instructions.md）
3. 测试基本功能（截图、鼠标移动、点击）
4. 完成后用 report-status 通知我

bash config/skills/agent/report-status/execute.sh '{"sessionName":"innovation-team-joe-7bee98d3","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T06:19:07.812Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: innovation-team-joe-7bee98d3
- **Assigned at**: 2026-02-20T06:19:07.812Z
- **Status**: In Progress

## Task Description

开发一个 Desktop Automation Skill（computer-use）。

项目路径: /Users/yellowsunhy/Desktop/projects/crewly

这个 skill 需要实现以下功能：
1. **截图** — 使用 macOS 的 screencapture 命令截取屏幕
2. **移动鼠标** — 移动鼠标到指定坐标
3. **点击鼠标** — 在指定坐标点击（左键/右键/双击）
4. **键盘输入** — 可选，模拟键盘输入文字

技术方案：
- 截图：`screencapture -x /tmp/screenshot.png`
- 鼠标控制：可以用 `cliclick`（需 brew install）或 `osascript` AppleScript
- Skill 结构参考：`config/skills/agent/nano-banana-image/` 的格式（execute.sh + skill.json + instructions.md）
- Skill 路径：`config/skills/agent/computer-use/`

参数设计建议：
- `--action screenshot|move|click|type`
- `--x` 和 `--y` 坐标
- `--button left|right|double`
- `--text` 键盘输入文本
- `--output` 截图保存路径

请：
1. 先查看现有的 skill 结构了解规范
2. 创建 computer-use skill（execute.sh, skill.json, instructions.md）
3. 测试基本功能（截图、鼠标移动、点击）
4. 完成后用 report-status 通知我

bash config/skills/agent/report-status/execute.sh '{"sessionName":"innovation-team-joe-7bee98d3","status":"done","summary":"..."}'
