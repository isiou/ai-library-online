const express = require("express");
const db = require("../db");
const {
  STATUS,
  toCanonical,
  compatibleDbValues,
  toZh,
} = require("../utils/status");

const router = express.Router();

// 认证中间件
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "需要认证" });
  }
  next();
};

// 获取用户借阅记录
router.get("/", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      startDate = "",
      endDate = "",
    } = req.query;

    // 验证和处理分页参数
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    let whereConditions = ["br.reader_id = $1"];
    let queryParams = [readerId];
    let paramIndex = 2;

    // 搜索条件
    // 书名、作者、索书号
    if (search.trim()) {
      whereConditions.push(`(
        b.title ILIKE $${paramIndex} OR 
        b.author ILIKE $${paramIndex} OR 
        b.call_no ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // 状态筛选
    if (status.trim()) {
      const canonical = toCanonical(status.trim());
      if (canonical) {
        const values = compatibleDbValues(canonical);
        if (values.length) {
          whereConditions.push(`br.status = ANY($${paramIndex})`);
          queryParams.push(values);
          paramIndex++;
        }
      }
    }

    // 日期范围筛选
    if (startDate.trim()) {
      whereConditions.push(`br.borrow_date >= $${paramIndex}`);
      queryParams.push(startDate.trim());
      paramIndex++;
    }

    if (endDate.trim()) {
      whereConditions.push(`br.borrow_date <= $${paramIndex}`);
      queryParams.push(endDate.trim());
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const dataQuery = `
      SELECT 
        br.borrow_id,
        br.reader_id,
        br.book_id,
        b.title,
        b.author,
        b.call_no,
        br.borrow_date,
        br.due_date,
        br.return_date,
        br.status
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
      ORDER BY br.borrow_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);
    const dataResult = await db.query(dataQuery, queryParams);

    const normalizedRows = dataResult.rows.map((row) => ({
      ...row,
      status: toCanonical(row.status) || row.status,
    }));

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: normalizedRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("记录获取出错: ", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 用户借书
router.post("/", requireAuth, async (req, res) => {
  const { bookId } = req.body;
  const { readerId } = req.session.user;

  if (!bookId) {
    return res.status(400).json({ message: "缺少书籍 ID" });
  }

  try {
    await db.query("BEGIN");

    // 检查书籍是否可借
    const bookCheck = await db.query(
      "SELECT COUNT(*) as count FROM borrow_records WHERE book_id = $1 AND return_date IS NULL",
      [bookId]
    );

    const book = await db.query("SELECT * from books where book_id = $1", [
      bookId,
    ]);

    if (book.rows.length === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ message: "未找到书籍" });
    }

    // 书籍借阅状态检查
    if (parseInt(bookCheck.rows[0].count) > 0) {
      await db.query("ROLLBACK");
      return res.status(409).json({ message: "书籍当前不可用" });
    }

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(borrowDate.getDate() + 30);

    const newBorrow = await db.query(
      "INSERT INTO borrow_records (reader_id, book_id, borrow_date, due_date, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [readerId, bookId, borrowDate, dueDate, "借阅中"]
    );

    await db.query("COMMIT");
    res.status(201).json(newBorrow.rows[0]);
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("借书出错: ", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 用户续借
router.post("/:id/renew", requireAuth, async (req, res) => {
  const { id: borrowId } = req.params;
  const { readerId } = req.session.user;

  try {
    const { rows } = await db.query(
      "SELECT * FROM borrow_records WHERE borrow_id = $1 AND reader_id = $2",
      [borrowId, readerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "未找到借阅记录或无权访问" });
    }

    const borrow = rows[0];

    if (toCanonical(borrow.status) !== STATUS.BORROWED) {
      return res.status(400).json({ message: "只有当前借阅的书籍才能续借" });
    }

    // 检查是否已逾期
    if (new Date(borrow.due_date) < new Date()) {
      return res.status(400).json({ message: "不能续借已逾期的书籍" });
    }

    const newDueDate = new Date(borrow.due_date);
    newDueDate.setDate(newDueDate.getDate() + 30);

    const updatedBorrow = await db.query(
      "UPDATE borrow_records SET due_date = $1 WHERE borrow_id = $2 RETURNING *",
      [newDueDate, borrowId]
    );

    res.json(updatedBorrow.rows[0]);
  } catch (error) {
    console.error("续借出错: ", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;
