const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("开始打包 backend 部署包");

// 创建部署包目录
const deployDir = path.join(__dirname, "backend-deploy");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const packageName = `backend-deploy-${timestamp}`;
const packageDir = path.join(deployDir, packageName);

// 确保目录存在
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

if (!fs.existsSync(packageDir)) {
  fs.mkdirSync(packageDir, { recursive: true });
}

// 需要复制的文件和目录
const filesToCopy = [
  "package.json",
  "server.js",
  "ecosystem.config.js",
  "start.sh",
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  ".env",
  ".env.example",
  "healthcheck.js",
  "src/",
  "public/",
  "init/",
  ".gitignore",
];

// 复制文件函数
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach((file) => {
      copyRecursive(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 复制文件
console.log("正在复制文件...");
filesToCopy.forEach((file) => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(packageDir, file);

  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`已复制: ${file}`);
  } else {
    console.log(`跳过不存在的文件: ${file}`);
  }
});

// 创建 logs 目录
const logsDir = path.join(packageDir, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  fs.writeFileSync(path.join(logsDir, ".gitkeep"), "");
}

// 创建 uploads 目录
const uploadsDir = path.join(packageDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  fs.writeFileSync(path.join(uploadsDir, ".gitkeep"), "");
}

console.log(`部署包已创建: ${packageDir}`);
