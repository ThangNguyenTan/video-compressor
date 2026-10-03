# ClientCompress 🎬⚡

> **High-performance, 100% client-side video compressor powered by multi-threaded WebAssembly FFmpeg and Web Workers.**

Compress, trim, resize, and convert multiple gigabytes of video directly inside your web browser with **zero cloud uploads**, **zero tracking**, and **uncompromising privacy**.

---

## ✨ Features

- 🔒 **100% Client-Side Privacy**: Video files never leave your device. All transcoding happens locally in browser memory and WebAssembly.
- ⚡ **Multi-Threaded Wasm Core**: Utilizes `@ffmpeg/ffmpeg` with `SharedArrayBuffer`, web workers, and SIMD instructions for up to 3x faster encoding without locking the UI.
- 📁 **Batch Queue Compression**: Drag and drop multiple videos to queue and process them sequentially with a single click. Download individually or batch download all completed files.
- 💾 **Direct-to-Disk Streaming**: Native File System Access API integration prevents browser heap exhaustion and memory crashes on large video files (up to 2GB+).
- ✂️ **Dual-Handle Frame Trimmer**: Interactive visual timeline scrubber with millisecond precision playback boundary preview.
- 🎯 **Smart Presets & Live Bitrate Estimation**:
  - **Web Fast (H.264)**: Optimized CRF 23 compression with `+faststart` web headers (~60% smaller).
  - **Discord Limit (<25MB)**: Auto-calculates two-pass target video bitrates dynamically based on video duration.
  - **Slack & Email (<10MB)**: Compact sharing preset with automatic audio pass-through option.
  - **High Efficiency (VP9/WebM)**: Next-gen codec for supreme quality-to-filesize ratios (~75% smaller).
- 📊 **Real-Time Telemetry Dashboard**: Live FFmpeg output console, encoding FPS, bitrate, speed multiplier, elapsed time, and ETA calculations.
- 🛡️ **Graceful Fallback**: Automatically checks for COOP (`same-origin`) and COEP (`require-corp`) headers, falling back smoothly to single-threaded execution if isolation is not supported.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 6](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + Custom Glassmorphism System
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Engine**: [FFmpeg.wasm v0.12](https://ffmpegwasm.netlify.app/) (WebAssembly + Web Workers + SharedArrayBuffer)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A modern browser with WebAssembly support (Chrome, Edge, Firefox, or Safari)

### Installation

```bash
# Clone the repository
git clone https://github.com/ThangNguyenTan/video-compressor.git

# Navigate into directory
cd video-compressor

# Install dependencies
npm install
```

### Development Server

Multi-threaded WebAssembly requires cross-origin isolation. The Vite configuration in this repo already includes the required `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` response headers:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
```

The production output will be generated in the `dist/` directory.

> **Note on Deployment**: When deploying to Vercel, Netlify, Cloudflare Pages, or Apache/Nginx, ensure the following HTTP response headers are set:
> ```http
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Embedder-Policy: require-corp
> ```

---

## 🧪 Testing

Run unit tests for FFmpeg log parsers, bitrate formulas, and progress calculators:

```bash
npx vitest run
```

---

## 📄 License

MIT License. Free to use, modify, and distribute for personal or commercial projects.
