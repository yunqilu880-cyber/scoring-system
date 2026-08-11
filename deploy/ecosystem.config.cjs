module.exports = {
  apps: [
    {
      name: 'scoring-system',
      script: 'server/index.js',
      cwd: '/var/www/scoring-system',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        DATA_DIR: '/var/www/scoring-system/data',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'change-this-admin-password',
        COOKIE_SECURE: 'false',
      },
    },
  ],
}
