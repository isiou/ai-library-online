const db = require("../src/db");
const bcrypt = require("bcryptjs");

async function createTestUser() {
  try {
    const readerId = "TESTUSER";
    const password = "TESTUSER";
    const nickname = "TESTUSER";

    // 检查用户是否已存在
    const existingUser = await db.query(
      "SELECT reader_id FROM readers WHERE reader_id = $1",
      [readerId]
    );
    if (existingUser.rows.length > 0) {
      console.log("测试用户已存在");
      await db.end();
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.query("BEGIN");

    await db.query(
      "INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department) VALUES ($1, $2, $3, $4, $5)",
      [readerId, "M", 2024, "测试用户", "测试学院"]
    );

    await db.query(
      "INSERT INTO login_info (reader_id, nickname, salt, password) VALUES ($1, $2, $3, $4)",
      [readerId, nickname, salt, hashedPassword]
    );

    await db.query("COMMIT");

    console.log("测试用户创建成功");

    await db.end();
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("测试用户创建失败: ", error.message);
    await db.end();
  }
}

createTestUser();
