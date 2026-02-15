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

  // 启动摄像头 - 使用最高分辨率和帧率
  const startCamera = async (deviceId) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          frameRate: { ideal: 60 },
          facingMode: deviceId ? undefined : 'environment'
        },
        audio: false
      }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = newStream

      if (videoRef.current) {
        videoRef.current.srcObject = newStream
      }

      const track = newStream.getVideoTracks()[0]
      const settings = track.getSettings()

      setCameraInfo({
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        deviceLabel: track.label || '摄像头',
        deviceId: settings.deviceId
      })

      setError('')
      setIsStarted(true)
    } catch (err) {
      setError('无法访问摄像头: ' + err.message)
      setIsStarted(false)
    }
  }

  // 获取摄像头设备列表并启动
  const initCamera = async () => {
    try {
      // 先请求权限，拿到流后立即关闭，避免占用摄像头导致后续无法切换高分辨率
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true })
      permissionStream.getTracks().forEach(track => track.stop())

      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = deviceList.filter(device => device.kind === 'videoinput')
      setDevices(videoDevices)

      if (videoDevices.length > 0) {
        const defaultDevice = videoDevices[0].deviceId
        setSelectedDevice(defaultDevice)
        await startCamera(defaultDevice)
      }
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
            <button onClick={cycleTheme} className="theme-toggle" title={themeTitle}>
              {themeLabel}
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
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {isStarted && (
              <button
                onClick={toggleFullscreen}
                className="fullscreen-btn"
                title="全屏 (F)"
              >
                {isFullscreen ? 'X' : '[ ]'}
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
                <span className="info-value">{cameraInfo.width} x {cameraInfo.height}</span>
              </div>
              <div className="info-row">
                <span className="info-label">帧率</span>
                <span className="info-value">{cameraInfo.frameRate?.toFixed(0) || 'N/A'} fps</span>
              </div>
              <div className="info-row">
                <span className="info-label">设备</span>
                <span className="info-value">{cameraInfo.deviceLabel}</span>
              </div>
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
