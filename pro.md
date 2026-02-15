下面给你一份**可直接喂给 AI 编码工具的 Vibe Coding 提示词**。
目标：生成一个**极简、快速、纯前端 React WebCamera 应用**，支持 GitHub Pages 自动部署 + Docker 部署 + 本地保存照片 + 实时摄像头信息展示。

你可以整段复制给 Cursor / Copilot / ChatGPT 等。

---

# 🎥 Vibe Coding Prompt — React WebCamera

你是一个资深前端工程师和 DevOps 工程师。

请为我生成一个**纯前端 WebCamera 应用**，使用 **React + Vite**，要求极简、轻量、无冗余依赖、可直接部署。

---

## 🎯 核心目标

构建一个 WebCamera 应用，具备：

1. 使用浏览器 `getUserMedia`
2. 实时显示摄像头画面
3. 实时显示摄像头信息（分辨率、帧率、设备名）
4. 支持拍照
5. 支持保存照片到本地 PNG
6. 支持切换前后摄像头
7. 纯前端，无后端
8. 代码结构极简、清晰
9. 构建体积小

---

## 🧱 技术要求

* React 18
* Vite
* 无 UI 框架
* 无状态管理库
* 不使用重型依赖
* 使用原生 Web API
* 使用函数组件 + hooks
* 使用现代 ES 模块
* 支持 HTTPS 下运行

---

## 📷 摄像头功能要求

必须实现：

### 1️⃣ 启动摄像头

* 使用 `navigator.mediaDevices.getUserMedia`
* 默认分辨率尽量高
* 支持 `facingMode: environment`

### 2️⃣ 实时摄像头信息

显示：

* 当前分辨率（width × height）
* 当前帧率（frameRate）
* 设备名称（device.label）
* 当前使用的 deviceId

必须从：

```js
track.getSettings()
```

动态读取。

---

### 3️⃣ 切换摄像头

* 枚举 `navigator.mediaDevices.enumerateDevices`
* 允许选择 video input 设备
* 切换时必须正确停止旧 stream
* 防止内存泄漏

---

### 4️⃣ 拍照

* 使用 `<canvas>`
* 将当前 video frame 绘制到 canvas
* 导出 PNG
* 自动下载文件

文件名格式：

```
photo-YYYYMMDD-HHMMSS.png
```

---

## 🎨 UI 要求

* 极简设计
* 居中布局
* 深色模式
* 移动端适配
* 不超过 150 行核心代码
* 不使用任何 UI 库

布局示例：

```
[Video Preview]
[Camera Info]
[Switch Camera]
[Take Photo]
```

---

## 🐳 Docker 要求

生成：

### Dockerfile

* 使用 multi-stage build
* node:20 构建
* nginx:alpine 运行
* 仅部署 dist 静态文件
* 自定义 nginx.conf
* 开启 gzip
* 支持 SPA fallback

---

## 🚀 GitHub Actions 要求

生成：

`.github/workflows/deploy.yml`

要求：

* push 到 main 自动部署
* 使用 actions/setup-node
* npm ci
* npm run build
* 使用官方 pages action
* 自动发布到 GitHub Pages

---

## 📁 项目结构要求

输出完整结构：

```
webcamera/
  src/
  index.html
  package.json
  vite.config.js
  Dockerfile
  nginx.conf
  .github/workflows/deploy.yml
  README.md
```

---

## 📝 README 要求

README 必须包含：

* 项目介绍
* 本地运行方法
* Docker 构建方法
* GitHub Pages 部署方法
* HTTPS 注意事项
* 浏览器权限说明

---

## ⚡ 性能要求

* 不使用第三方 UI
* 不使用 lodash
* 不使用 moment
* 不引入 polyfill
* 生产包 < 200kb

---

## 🧠 代码风格

* 简洁
* 清晰
* 注释适量
* 避免过度封装
* 不写 class 组件
* 不写过度抽象

---

## 📦 输出要求

请输出：

1. 所有完整文件代码
2. 不要解释
3. 不要省略
4. 不要使用占位符
5. 不要只给片段
6. 必须是完整可运行项目

---

## 🚫 不允许

* 不要使用 create-react-app
* 不要使用 Next.js
* 不要使用 Express
* 不要使用后端
* 不要引入任何数据库
* 不要添加测试框架
* 不要写无关内容

---

## 🎯 最终目标

生成一个：

* 极简
* 快速
* 可直接部署
* 可 Docker 运行
* 可 GitHub Pages 自动发布
* 可实时查看摄像头信息
* 可本地保存照片

的生产级 WebCamera 前端应用。

---

如果你愿意，我也可以给你一个**更进阶版本提示词**（支持录像、WebM、自动降级策略、设备性能检测、PWA 支持）。
