import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const videoContainerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const isRecordingRef = useRef(false)
  const recordCanvasRef = useRef(null)
  const recordAnimRef = useRef(null)

  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [cameraInfo, setCameraInfo] = useState(null)
  const [scanResults, setScanResults] = useState([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [isStarted, setIsStarted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const recordingTimerRef = useRef(null)

  // 主题: 'auto' | 'light' | 'dark'
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('theme') || 'auto'
  })

  // 根据 themeMode 和系统偏好设定实际主题
  useEffect(() => {
    const applyTheme = () => {
      let resolved = themeMode
      if (themeMode === 'auto') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      document.documentElement.setAttribute('data-theme', resolved)
    }

    applyTheme()
    localStorage.setItem('theme', themeMode)

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (themeMode === 'auto') applyTheme() }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [themeMode])

  const cycleTheme = () => {
    setThemeMode(prev => {
      if (prev === 'auto') return 'light'
      if (prev === 'light') return 'dark'
      return 'auto'
    })
  }

  const themeLabel = themeMode === 'auto' ? 'A' : themeMode === 'light' ? 'L' : 'D'
  const themeTitle = themeMode === 'auto' ? '主题: 跟随系统' : themeMode === 'light' ? '主题: 浅色' : '主题: 深色'

  // 查询摄像头支持的最大分辨率，关闭探测流后重新用最大分辨率打开
  const openWithMaxResolution = async (deviceId) => {
    // 第一步：用基础约束打开，仅用于查询硬件能力
    const basicConstraints = { video: deviceId ? { deviceId: { exact: deviceId } } : true }
    const probeStream = await navigator.mediaDevices.getUserMedia(basicConstraints)
    const track = probeStream.getVideoTracks()[0]
    const probedDeviceId = track.getSettings().deviceId

    let maxWidth = 1920
    let maxHeight = 1080
    let maxFps = 30

    if (track.getCapabilities) {
      const caps = track.getCapabilities()
      if (caps.width?.max) maxWidth = caps.width.max
      if (caps.height?.max) maxHeight = caps.height.max
      if (caps.frameRate?.max) maxFps = Math.min(caps.frameRate.max, 60)
    }

    // 第二步：关闭探测流，释放摄像头
    probeStream.getTracks().forEach(t => t.stop())
    await new Promise(r => setTimeout(r, 200))

    // 第三步：用查到的最大分辨率重新打开
    const finalConstraints = {
      video: {
        deviceId: { exact: probedDeviceId },
        width: { exact: maxWidth },
        height: { exact: maxHeight },
        frameRate: { ideal: maxFps }
      },
      audio: false
    }

    try {
      return await navigator.mediaDevices.getUserMedia(finalConstraints)
    } catch {
      // exact 失败时回退到 ideal
      return await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: probedDeviceId },
          width: { ideal: maxWidth },
          height: { ideal: maxHeight },
          frameRate: { ideal: maxFps }
        },
        audio: false
      })
    }
  }

  // 应用流到 video 并更新信息
  const applyStream = (newStream) => {
    streamRef.current = newStream
    if (videoRef.current) {
      videoRef.current.srcObject = newStream
    }
    const track = newStream.getVideoTracks()[0]
    const settings = track.getSettings()
    const capabilities = track.getCapabilities ? track.getCapabilities() : null
    setCameraInfo({
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      deviceLabel: track.label || '摄像头',
      deviceId: settings.deviceId
      ,capabilities: capabilities
    })
    setError('')
    setIsStarted(true)
  }

  // 当 video 元数据加载后，记录实际像素尺寸（videoWidth/videoHeight）
  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return
    setCameraInfo(prev => ({
      ...prev,
      actualWidth: video.videoWidth,
      actualHeight: video.videoHeight
    }))
  }

  // 扫描一组候选分辨率，记录实际被浏览器/摄像头接受的分辨率
  const scanResolutions = async () => {
    if (!navigator.mediaDevices || scanning) return
    setScanning(true)
    const deviceId = selectedDevice || (cameraInfo && cameraInfo.deviceId)
    const candidates = [
      [1920, 1080],
      [1600, 1200],
      [1552, 1552],
      [1536, 1536],
      [1280, 720],
      [1024, 768],
      [800, 600],
      [640, 480]
    ]
    const results = []
    for (const [w, h] of candidates) {
      try {
        const constraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { exact: w },
            height: { exact: h }
          },
          audio: false
        }
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        const t = s.getVideoTracks()[0]
        const st = t.getSettings()
        results.push({ requested: `${w}x${h}`, actual: `${st.width || '?'}x${st.height || '?'}`, settings: st })
        s.getTracks().forEach(tr => tr.stop())
        await new Promise(r => setTimeout(r, 200))
      } catch (err) {
        results.push({ requested: `${w}x${h}`, error: err.message })
      }
    }
    setScanResults(results)
    setScanning(false)
  }

  // 启动摄像头 - 自动使用最大分辨率
  const startCamera = async (deviceId) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      await new Promise(r => setTimeout(r, 100))

      const newStream = await openWithMaxResolution(deviceId)
      applyStream(newStream)
    } catch (err) {
      setError('无法访问摄像头: ' + err.message)
      setIsStarted(false)
    }
  }

  // 获取摄像头设备列表并启动
  const initCamera = async () => {
    try {
      const firstStream = await openWithMaxResolution(undefined)

      // 拿到权限后枚举设备
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)

      const currentDeviceId = firstStream.getVideoTracks()[0]?.getSettings()?.deviceId
      if (currentDeviceId) {
        setSelectedDevice(currentDeviceId)
      }
      applyStream(firstStream)
    } catch (err) {
      setError('无法获取设备列表: ' + err.message)
    }
  }

  // 切换摄像头
  const switchCamera = async (deviceId) => {
    setSelectedDevice(deviceId)
    await startCamera(deviceId)
  }

  // 全屏切换
  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (err) {
      console.error('全屏切换失败:', err)
    }
  }

  // 拍照（镜像翻转，和预览一致）
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const now = new Date()
    const filename = `photo-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.png`

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  // 格式化录像时长
  const formatTime = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  // 开始录像（通过 canvas 镜像翻转，和预览一致）
  const startRecording = () => {
    if (!streamRef.current || isRecordingRef.current) return
    if (!videoRef.current) return

    recordedChunksRef.current = []

    // 创建镜像 canvas 用于录制
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080
    recordCanvasRef.current = canvas
    const ctx = canvas.getContext('2d')

    // 持续将镜像画面绘制到 canvas
    const drawFrame = () => {
      if (!isRecordingRef.current) return
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()
      recordAnimRef.current = requestAnimationFrame(drawFrame)
    }
    drawFrame()

    // 从 canvas 获取流用于录制
    const canvasStream = canvas.captureStream(30)

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    try {
      const mediaRecorder = new MediaRecorder(canvasStream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) return

        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const now = new Date()
        const filename = `video-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.${ext}`

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        recordedChunksRef.current = []
      }

      mediaRecorder.onerror = (e) => {
        console.error('录像错误:', e)
        stopRecording()
      }

      mediaRecorder.start(500)
      mediaRecorderRef.current = mediaRecorder
      isRecordingRef.current = true
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('无法创建 MediaRecorder:', err)
      setError('录像启动失败: ' + err.message)
    }
  }

  // 停止录像
  const stopRecording = () => {
    // 停止 canvas 绘制循环
    if (recordAnimRef.current) {
      cancelAnimationFrame(recordAnimRef.current)
      recordAnimRef.current = null
    }
    recordCanvasRef.current = null

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      } catch (err) {
        console.error('停止录像出错:', err)
      }
      mediaRecorderRef.current = null
    }
    isRecordingRef.current = false
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setRecordingTime(0)
  }

  // 切换录像
  const toggleRecording = () => {
    if (isRecordingRef.current) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // 用 ref 保存最新的 handler 引用，避免 useEffect 重注册
  const handlersRef = useRef({ takePhoto, toggleFullscreen, toggleRecording })
  handlersRef.current = { takePhoto, toggleFullscreen, toggleRecording }

  // 组件挂载时初始化（只运行一次）
  useEffect(() => {
    initCamera()

    const handleKeyPress = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        handlersRef.current.takePhoto()
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        handlersRef.current.toggleFullscreen()
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        handlersRef.current.toggleRecording()
      }
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('keydown', handleKeyPress)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (recordAnimRef.current) {
        cancelAnimationFrame(recordAnimRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch {}
      }
      document.removeEventListener('keydown', handleKeyPress)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <h1 className="nav-title">R2049 WebCamera</h1>
          <div className="nav-actions">
            {devices.length > 1 && (
              <select
                value={selectedDevice}
                onChange={(e) => switchCamera(e.target.value)}
                className="device-select"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `摄像头 ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button onClick={cycleTheme} className="theme-toggle" title={themeTitle} aria-label="切换主题">
              {themeMode === 'light' && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="M4.93 4.93l1.41 1.41" />
                  <path d="M17.66 17.66l1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="M4.93 19.07l1.41-1.41" />
                  <path d="M17.66 6.34l1.41-1.41" />
                </svg>
              )}
              {themeMode === 'dark' && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {themeMode === 'auto' && (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <circle cx="12" cy="12" r="4" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {error && <div className="error">{error}</div>}

        <div className="video-section">
          <div className="video-container" ref={videoContainerRef}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleLoadedMetadata}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {isStarted && (
              <button
                onClick={toggleFullscreen}
                className="fullscreen-btn"
                title={isFullscreen ? '退出全屏 (F)' : '全屏 (F)'}
                aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
              >
                {isFullscreen
                  ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="4 14 4 20 10 20"/>
                      <polyline points="20 10 20 4 14 4"/>
                      <line x1="14" y1="10" x2="20" y2="4"/>
                      <line x1="4" y1="20" x2="10" y2="14"/>
                    </svg>
                  : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 3 21 3 21 9"/>
                      <polyline points="9 21 3 21 3 15"/>
                      <line x1="21" y1="3" x2="14" y2="10"/>
                      <line x1="3" y1="21" x2="10" y2="14"/>
                    </svg>
                }
              </button>
            )}

            {isRecording && (
              <div className="recording-indicator">
                <span className="rec-dot" />
                <span className="rec-time">{formatTime(recordingTime)}</span>
              </div>
            )}

            {isStarted && (
              <div className="video-controls">
                <button
                  onClick={takePhoto}
                  className="control-btn photo-btn"
                  title="拍照 (Space/Enter)"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
                <button
                  onClick={toggleRecording}
                  className={`control-btn record-btn ${isRecording ? 'recording' : ''}`}
                  title="录像 (R)"
                >
                  {isRecording
                    ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    : <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                  }
                </button>
              </div>
            )}
          </div>

          {cameraInfo && (
            <div className="info-panel">
              <div className="info-row">
                <span className="info-label">分辨率</span>
                <span className="info-value">{cameraInfo.width || 'N/A'} x {cameraInfo.height || 'N/A'}</span>
                {cameraInfo.actualWidth && (
                  <small className="info-sub">实际: {cameraInfo.actualWidth} x {cameraInfo.actualHeight}</small>
                )}
              </div>
              <div className="info-row">
                <span className="info-label">帧率</span>
                <span className="info-value">{cameraInfo.frameRate?.toFixed(0) || 'N/A'} fps</span>
              </div>
              <div className="info-row">
                <span className="info-label">设备</span>
                <span className="info-value">{cameraInfo.deviceLabel}</span>
              </div>
              {cameraInfo.capabilities && (
                <div className="info-row" style={{gridColumn: '1 / -1'}}>
                  <span className="info-label">能力范围</span>
                  <span className="info-value">
                    宽: {cameraInfo.capabilities.width?.min || '-'} → {cameraInfo.capabilities.width?.max || '-'};
                    高: {cameraInfo.capabilities.height?.min || '-'} → {cameraInfo.capabilities.height?.max || '-'};
                    帧率: {cameraInfo.capabilities.frameRate?.min || '-'} → {cameraInfo.capabilities.frameRate?.max || '-'}
                  </span>
                  <div style={{marginTop:8}}>
                    <button className="scan-btn" onClick={scanResolutions} disabled={scanning}>
                      {scanning ? '正在检测…' : '检测可用分辨率'}
                    </button>
                  </div>
                </div>
              )}
              {scanResults.length > 0 && (
                <div className="info-row" style={{gridColumn: '1 / -1'}}>
                  <span className="info-label">扫描结果</span>
                  <div className="info-value" style={{display:'block'}}>
                    {scanResults.map((r, i) => (
                      <div key={i} style={{fontSize: '0.85rem', color: 'var(--text-dimmed)'}}>
                        {r.requested} → {r.error ? `错误: ${r.error}` : r.actual}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-container">
          <span>R2049 WebCamera</span>
          <span className="footer-sep">|</span>
          <a href="https://github.com/liguobao/WebCamera" target="_blank" rel="noopener noreferrer" className="footer-link">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
