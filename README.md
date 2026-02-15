# R2049 WebCamera

一个极简、快速、纯前端的 React WebCamera 应用，支持实时摄像头预览、拍照保存、录像、摄像头切换和信息展示。

开源地址: https://github.com/liguobao/WebCamera

## 特性

- 实时摄像头预览
- 拍照并保存为 PNG
- 录像并保存为 WebM/MP4
- 支持多摄像头切换
- 默认使用相机最高分辨率和帧率
- 实时显示摄像头信息 (分辨率、帧率、设备名称)
- 浅色/深色主题，支持自动切换和手动切换
- 移动端适配
- 纯前端，无需后端
- 极小体积 (< 200KB)

## 技术栈

- React 18
- Vite
- 原生 Web API (getUserMedia, MediaRecorder)
- 无任何 UI 框架依赖

## 前置要求

- Node.js 20+
- 现代浏览器 (支持 getUserMedia API)
- **HTTPS 环境** (浏览器安全策略要求，localhost 除外)

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173`

### 生产构建

```bash
# 构建项目
npm run build

# 预览构建结果
npm run preview
```

## Docker 部署

### 构建镜像

```bash
docker build -t webcamera .
```

### 运行容器

```bash
docker run -d -p 8080:80 webcamera
```

访问 `http://localhost:8080`

## GitHub Pages 部署

### 1. 启用 GitHub Pages

在你的 GitHub 仓库中：

1. 进入 **Settings** -> **Pages**
2. Source 选择 **GitHub Actions**

### 2. 配置 base 路径

修改 `vite.config.js` 中的 `base` 为你的仓库名：

```js
export default defineConfig({
  base: '/your-repo-name/',
  // ...
})
```

### 3. 推送代码

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

GitHub Actions 将自动构建并部署到 GitHub Pages。

## HTTPS 注意事项

由于浏览器安全策略，访问摄像头需要 HTTPS 环境：

- `localhost` 和 `127.0.0.1` 可以直接使用 HTTP
- GitHub Pages 自动提供 HTTPS
- 其他域名必须配置 HTTPS 证书

本地测试时可以使用：
```bash
npm run dev  # Vite 默认使用 localhost
```

## 浏览器权限

首次访问时，浏览器会请求摄像头权限：

1. 点击 **允许** 授予摄像头访问权限
2. 如果误点拒绝，需要在浏览器设置中重新启用

### Chrome/Edge
地址栏左侧 -> 网站设置 -> 摄像头 -> 允许

### Firefox
地址栏左侧 -> 连接安全 -> 权限 -> 使用摄像头 -> 允许

### Safari
Safari -> 偏好设置 -> 网站 -> 摄像头 -> 允许

## 项目结构

```
webcamera/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions 配置
├── src/
│   ├── App.jsx               # 主应用组件
│   ├── App.css               # 样式文件
│   └── main.jsx              # 入口文件
├── index.html                # HTML 模板
├── package.json              # 项目依赖
├── vite.config.js            # Vite 配置
├── Dockerfile                # Docker 配置
├── nginx.conf                # Nginx 配置
└── README.md                 # 项目文档
```

## 功能说明

### 启动摄像头

应用自动请求摄像头权限并启动，默认使用最高可用分辨率和帧率。

### 查看摄像头信息

实时显示：
- 当前分辨率 (宽 x 高)
- 帧率 (FPS)
- 设备名称

### 切换摄像头

如果设备有多个摄像头 (如前置/后置)，可通过下拉菜单切换。

### 拍照保存

点击拍照按钮，照片将自动下载为 PNG 格式：
- 文件名格式：`photo-YYYYMMDD-HHMMSS.png`
- 示例：`photo-20260212-143052.png`

### 录像

点击录像按钮开始录制，再次点击停止并自动下载：
- 文件名格式：`video-YYYYMMDD-HHMMSS.webm`
- 录制时左上角显示录制时长

### 快捷键

- `Space` / `Enter` - 拍照
- `R` - 开始/停止录像
- `F` - 全屏切换

## 开发说明

### 核心 API

```js
// 获取摄像头
navigator.mediaDevices.getUserMedia({ video: true })

// 获取设备列表
navigator.mediaDevices.enumerateDevices()

// 获取摄像头信息
track.getSettings()

// 录像
new MediaRecorder(stream)
```

### 内存管理

应用正确处理了 MediaStream 的生命周期：
- 切换摄像头时停止旧的 stream
- 组件卸载时释放资源
- 防止内存泄漏

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request!

## 联系

如有问题，请在 GitHub 上创建 Issue。
