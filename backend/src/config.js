module.exports = {
  db: {
    user: "************************",
    host: "isiou.top",
    database: "********",
    password: "********",
    port: 5432,
  },
  session: {
    secret: "************************",
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: false,
      sameSite: false,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    },
    name: "test.sid",
  },
  // Ollama AI服务配置
  ai: {
    ollama: {
      host: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "qwen3:1.7b",
      timeout: parseInt(process.env.OLLAMA_TIMEOUT) || 60000,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
    },
  },
  // 推荐服务配置
  recommendation: {
    maxLimit: 50,
    defaultLimit: 10,
    fallbackEnabled: true,
  },
};
