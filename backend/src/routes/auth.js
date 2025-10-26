const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();

// 登录路由
router.post("/login", async (req, res) => {
  try {
    const { readerId, password } = req.body;

    if (!readerId || !password) {
      return res.status(400).json({ message: "缺少主键与密码" });
    }

    // 查询用户信息
    const userQuery = `
      SELECT r.reader_id, r.gender, r.enroll_year, r.reader_type, r.department,
             l.salt, l.password, l.is_admin, l.nickname
      FROM readers r
      LEFT JOIN login_info l ON r.reader_id = l.reader_id
      WHERE r.reader_id = $1
    `;

    const { rows } = await db.query(userQuery, [readerId]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "账号或密码错误，请重新输入" });
    }

    const user = rows[0];

    // 检查密码
    let isValidPassword = false;

    if (user.salt && user.password) {
      // 如果有盐值则使用 bcrypt 验证
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // 如果没有盐值则直接比较
      isValidPassword = password === readerId;
    }

    if (!isValidPassword) {
      return res.status(401).json({ message: "账号或密码错误，请重新输入" });
    }

    // 更新登录时间
    await db.query(
      "UPDATE login_info SET login_time = CURRENT_TIMESTAMP WHERE reader_id = $1",
      [readerId]
    );

    // 设置 session
    req.session.user = {
      readerId: user.reader_id,
      gender: user.gender,
      enrollYear: user.enroll_year,
      readerType: user.reader_type,
      department: user.department,
      isAdmin: user.is_admin || false,
      nickname: user.nickname || user.reader_id,
    };

    // 强制保存 session
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ message: "Session 保存失败" });
      }

      res.json({
        message: "登录成功",
        user: req.session.user,
        sessionId: req.sessionID,
      });
    });
  } catch (error) {
    console.error("登陆失败: ", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 注册路由
router.post("/register", async (req, res) => {
  try {
    const {
      readerId,
      password,
      nickname,
      gender,
      enrollYear,
      readerType,
      department,
    } = req.body;

    if (!readerId || !password) {
      return res.status(400).json({ message: "缺少主键与密码" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.query("BEGIN");

    await db.query(
      "INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department) VALUES ($1, $2, $3, $4, $5)",
      [readerId, gender, enrollYear, readerType, department]
    );

    await db.query(
      "INSERT INTO login_info (reader_id, nickname, salt, password) VALUES ($1, $2, $3, $4)",
      [readerId, nickname || readerId, salt, hashedPassword]
    );

    await db.query("COMMIT");

    res.status(201).json({ message: "用户注册成功" });
  } catch (error) {
    await db.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "用户已存在" });
    }
    console.error("注册失败: ", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 登出路由
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ message: "无法登出" });
    }
    res.json({ message: "登出成功" });
  });
});

// 会话检查路由
router.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({
      message: "未认证",
      sessionId: req.sessionID,
      hasSession: !!req.session,
      sessionData: req.session,
    });
  }
});

module.exports = router;
