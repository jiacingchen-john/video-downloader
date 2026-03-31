# Video Downloader Project

## Overview
Node.js + Express 影片下載後端，提供兩種下載方式，前端為純靜態 HTML。

## Project Structure
```
~/video-downloader/
├── server.js              # 後端主程式（Express, port 3002）
├── package.json
├── ecosystem.config.js    # PM2 設定
├── .gitignore
└── docs/
    ├── index.html         # 前端介面（兩個 tab）
    └── config.js          # API_BASE 設定，預設 http://157.245.200.214:3002
```

## Server Info
- VPS Public IP: `157.245.200.214`
- Backend port: `3002`
- Temp download dir: `/tmp/ytdlp/`

## API Endpoints
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/download/direct` | `{ url, filename }` | 用 Python requests 下載直連 .mp4，串流回傳 |
| POST | `/download/ytdlp` | `{ url }` | 用 yt-dlp 下載任意影片，存至 /tmp/ytdlp 後串流回傳並刪除暫存 |

## Dependencies
- **Runtime**: Node.js, Express, cors
- **System**: Python3 + requests（for /download/direct）, yt-dlp（for /download/ytdlp）
- yt-dlp 安裝位置：`/usr/local/bin/yt-dlp`

## PM2 Management
```bash
pm2 start ecosystem.config.js   # 啟動
pm2 restart video-downloader    # 重啟
pm2 logs video-downloader       # 查看 log
pm2 stop video-downloader       # 停止
```

## Git
- Remote: `git@github.com:jiacingchen-john/video-downloader.git`
- Branch: `main`

## Frontend
- 兩個 tab：「直接下載」（直連 .mp4）、「進階下載（yt-dlp）」
- 引入 `config.js` 管理 API_BASE，修改 API 網址只需改 `docs/config.js`
- 支援串流進度條（直接下載）、blob 下載觸發
