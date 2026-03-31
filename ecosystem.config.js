module.exports = {
  apps: [
    {
      name: 'video-downloader',
      script: 'server.js',
      cwd: '/root/video-downloader',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
