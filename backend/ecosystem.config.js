module.exports = {
  apps: [
    {
      name: "ai-library-backend",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        SESSION_SECRET: "sk-cgGp6jkEENxwvmn6Yo2d6TX1N6RThU",
        COOKIE_SECURE: "false",
        COOKIE_SAMESITE: "lax",
        ALLOWED_ORIGINS:
          "http://isiou.top,http://www.isiou.top,https://isiou.top,https://www.isiou.top",
      },
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      watch: false,
      ignore_watch: ["node_modules", "logs", "uploads"],
      max_memory_restart: "1G",

      min_uptime: "10s",
      max_restarts: 10,
      autorestart: true,

      merge_logs: true,
      time: true,
    },
  ],
};
