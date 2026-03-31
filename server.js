const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3002;
const YTDLP_TMP = '/tmp/ytdlp';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

// Ensure tmp dir exists
if (!fs.existsSync(YTDLP_TMP)) {
  fs.mkdirSync(YTDLP_TMP, { recursive: true });
}

// POST /download/direct
// Body: { url, filename }
// Uses Python requests to download a direct .mp4 URL and streams it back
app.post('/download/direct', (req, res) => {
  const { url, filename } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const safeFilename = filename || 'video.mp4';

  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Type', 'video/mp4');

  const script = `
import sys
import requests

url = sys.argv[1]
response = requests.get(url, stream=True, timeout=60)
response.raise_for_status()

content_type = response.headers.get('Content-Type', '')
content_length = response.headers.get('Content-Length', '')

if content_length:
    sys.stderr.write('CONTENT_LENGTH:' + content_length + '\\n')
    sys.stderr.flush()

for chunk in response.iter_content(chunk_size=65536):
    if chunk:
        sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()
`;

  const py = spawn('python3', ['-c', script, url]);

  py.stderr.on('data', (data) => {
    const msg = data.toString();
    const match = msg.match(/CONTENT_LENGTH:(\d+)/);
    if (match) {
      res.setHeader('Content-Length', match[1]);
    }
  });

  py.stdout.pipe(res);

  py.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Python error: ' + err.message });
    }
  });

  py.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).json({ error: 'Download failed with code ' + code });
    }
  });
});

// POST /download/ytdlp
// Body: { url }
// Uses yt-dlp to download the video to /tmp/ytdlp, then streams it back
app.post('/download/ytdlp', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const tmpFile = path.join(YTDLP_TMP, `video_${Date.now()}.%(ext)s`);

  // First pass: get filename
  const infoProc = spawn('yt-dlp', ['--get-filename', '-o', tmpFile, url]);
  let outFilename = '';

  infoProc.stdout.on('data', (d) => { outFilename += d.toString().trim(); });

  infoProc.on('close', () => {
    // Now download
    const dlProc = spawn('yt-dlp', [
      '--no-playlist',
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mp4',
      '-o', tmpFile,
      url
    ]);

    let stderrBuf = '';
    dlProc.stderr.on('data', (d) => { stderrBuf += d.toString(); });

    dlProc.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'yt-dlp error: ' + err.message });
    });

    dlProc.on('close', (code) => {
      if (code !== 0) {
        const detail = stderrBuf.split('\n').filter(l => l.includes('ERROR')).join(' ') || stderrBuf.slice(-300);
        if (!res.headersSent) res.status(500).json({ error: 'yt-dlp 失敗：' + detail });
        return;
      }

      // Find the actual downloaded file (extension may vary)
      const base = path.basename(outFilename || tmpFile).replace(/\.%\(ext\)s$/, '');
      let actualFile = null;

      try {
        const files = fs.readdirSync(YTDLP_TMP);
        // Match by timestamp prefix
        const ts = path.basename(tmpFile).match(/video_(\d+)/)?.[1];
        if (ts) {
          actualFile = files.find(f => f.startsWith(`video_${ts}`));
          if (actualFile) actualFile = path.join(YTDLP_TMP, actualFile);
        }
      } catch (_) {}

      if (!actualFile || !fs.existsSync(actualFile)) {
        return res.status(500).json({ error: 'Downloaded file not found' });
      }

      const ext = path.extname(actualFile).slice(1) || 'mp4';
      const dlName = path.basename(actualFile);

      res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
      res.setHeader('Content-Type', ext === 'mp4' ? 'video/mp4' : 'application/octet-stream');

      const stat = fs.statSync(actualFile);
      res.setHeader('Content-Length', stat.size);

      const stream = fs.createReadStream(actualFile);
      stream.pipe(res);

      stream.on('close', () => {
        fs.unlink(actualFile, () => {});
      });
    });
  });

  infoProc.on('error', (err) => {
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp error: ' + err.message });
  });
});

app.listen(PORT, () => {
  console.log(`Video downloader running on port ${PORT}`);
});
