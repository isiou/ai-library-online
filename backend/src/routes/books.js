const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const { format, parse } = require("fast-csv");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "需要认证" });
  }
  next();
};

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.session.user.readerId;
    const result = await db.query(
      "SELECT is_admin FROM login_info WHERE reader_id = $1",
      [userId]
    );
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ message: "需要管理员权限" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "服务器内部错误" });
  }
};

router.get("/search", async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    author,
    sortBy = "popularity",
  } = req.query;
  const offset = (page - 1) * limit;

  let params = [];
  let whereClauses = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    whereClauses.push(
      `(b.title ILIKE $${paramCount} OR b.author ILIKE $${paramCount} OR b.publisher ILIKE $${paramCount})`
    );
    params.push(`%${search}%`);
  }

  if (category) {
    paramCount++;
    whereClauses.push(`b.doc_type = $${paramCount}`);
    params.push(category);
  }

  if (author) {
    paramCount++;
    whereClauses.push(`b.author ILIKE $${paramCount}`);
    params.push(`%${author}%`);
  }

  const fromClause = `FROM books b LEFT JOIN borrow_records br ON b.book_id = br.book_id`;
  const whereClause =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // 获取总数
  const countQuery = `SELECT COUNT(DISTINCT b.book_id) ${fromClause} ${whereClause}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count);

  // 排序逻辑
  let orderByClause = "ORDER BY COUNT(br.borrow_id) DESC, b.title ASC";
  if (sortBy === "title") {
    orderByClause = "ORDER BY b.title ASC";
  } else if (sortBy === "publication_year") {
    orderByClause = "ORDER BY b.publication_year DESC, b.title ASC";
  }

  // 添加分页和排序
  const dataQuery = `
    SELECT b.*, COUNT(br.borrow_id) as borrow_count
    ${fromClause}
    ${whereClause}
    GROUP BY b.book_id
    ${orderByClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  params.push(parseInt(limit), offset);

  const { rows } = await db.query(dataQuery, params);

  res.json({
    books: rows,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit),
  });
});

// 获取热门书籍列表
router.get("/popular/list", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    // 限制最大返回数量
    const limitNum = Math.min(parseInt(limit) || 10, 100);

    // 基于借阅记录统计热门书籍
    const query = `
            SELECT b.*, 
                   borrow_count.borrow_count
            FROM books b
            INNER JOIN (
                SELECT book_id, COUNT(*) as borrow_count
                FROM borrow_records
                GROUP BY book_id
            ) borrow_count ON b.book_id = borrow_count.book_id
            ORDER BY borrow_count.borrow_count DESC, b.title ASC
            LIMIT $1
        `;

    const { rows } = await db.query(query, [limitNum]);
    res.json({ data: rows });
  } catch (err) {
    console.error("获取热门书籍失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取书籍分类统计
router.get("/categories/stats", async (req, res) => {
  try {
    const query = `
            SELECT doc_type as category, COUNT(*) as count
            FROM books
            GROUP BY doc_type
            ORDER BY count DESC
        `;

    const { rows } = await db.query(query);
    res.json({ data: rows });
  } catch (err) {
    console.error("获取分类统计失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取所有唯一的书籍分类
router.get("/categories", async (req, res) => {
  try {
    const query = `
            SELECT DISTINCT doc_type as category
            FROM books
            WHERE doc_type IS NOT NULL AND doc_type != ''
            ORDER BY doc_type ASC
        `;

    const { rows } = await db.query(query);
    res.json({ data: rows.map((row) => row.category) });
  } catch (err) {
    console.error("获取书籍分类失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取作者列表
router.get("/authors", async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    let query =
      "SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != ''";
    let params = [];

    if (search) {
      query += " AND author ILIKE $1";
      params.push(`%${search}%`);
    }

    query += " ORDER BY author LIMIT $" + (params.length + 1);
    params.push(parseInt(limit));

    const { rows } = await db.query(query, params);
    res.json({ data: rows.map((row) => row.author) });
  } catch (err) {
    console.error("获取作者列表失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取相关书籍
router.get("/:id/related", async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const bookId = req.params.id;

    // 先获取当前书籍信息
    const bookResult = await db.query(
      "SELECT author, doc_type FROM books WHERE book_id = $1",
      [bookId]
    );
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ message: "未找到书籍" });
    }

    const { author, doc_type } = bookResult.rows[0];

    // 查找相同作者或相同类型的书籍
    const query = `
            SELECT * FROM books 
            WHERE book_id != $1 
            AND (author = $2 OR doc_type = $3)
            ORDER BY 
                CASE WHEN author = $2 THEN 1 ELSE 2 END,
                title
            LIMIT $4
        `;

    const { rows } = await db.query(query, [
      bookId,
      author,
      doc_type,
      parseInt(limit),
    ]);
    res.json({ data: rows });
  } catch (err) {
    console.error("获取相关书籍失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 管理员获取所有图书 - 必须放在 /:id 路由之前
router.get("/all", requireAuth, requireAdmin, async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    category,
    author,
    doc_type,
  } = req.query;
  const offset = (page - 1) * limit;

  let query = "SELECT * FROM books WHERE 1=1";
  let params = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` AND (title ILIKE $${paramCount} OR author ILIKE $${paramCount} OR publisher ILIKE $${paramCount} OR book_id ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  if (category) {
    paramCount++;
    query += ` AND doc_type = $${paramCount}`;
    params.push(category);
  }

  if (author) {
    paramCount++;
    query += ` AND author ILIKE $${paramCount}`;
    params.push(`%${author}%`);
  }

  if (doc_type) {
    paramCount++;
    query += ` AND doc_type = $${paramCount}`;
    params.push(doc_type);
  }

  // 获取总数
  const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count);

  // 添加分页和排序
  query += ` ORDER BY title LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(parseInt(limit), offset);

  const { rows } = await db.query(query, params);

  res.json({
    data: rows,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    },
  });
});

// 获取书籍评论
// 暂未实现
router.get("/:id/reviews", async (req, res) => {
  try {
    // 预留接口
    res.json({ data: [] });
  } catch (err) {
    console.error("获取书籍评论失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM books WHERE book_id = $1", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "未找到书籍" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/:id/favorite", requireAuth, async (req, res) => {
  try {
    await db.query(
      "INSERT INTO favorites (reader_id, book_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.session.user.readerId, req.params.id]
    );
    res.status(201).json({ message: "书籍已收藏" });
  } catch (err) {
    console.error("收藏书籍失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.delete("/:id/favorite", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM favorites WHERE reader_id = $1 AND book_id = $2",
      [req.session.user.readerId, req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "未找到收藏记录" });
    }
    res.json({ message: "已取消收藏" });
  } catch (err) {
    console.error("取消收藏失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.get("/:id/favorite", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM favorites WHERE reader_id = $1 AND book_id = $2",
      [req.session.user.readerId, req.params.id]
    );
    res.json({ isFavorite: rows.length > 0 });
  } catch (err) {
    console.error("检查收藏状态失败: ", err);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const {
    book_id,
    title,
    author,
    publisher,
    publication_year,
    call_no,
    language,
    doc_type,
  } = req.body;
  try {
    await db.query(
      "INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        book_id,
        title,
        author,
        publisher,
        publication_year,
        call_no,
        language,
        doc_type,
      ]
    );
    res.status(201).json({ message: "书籍已创建" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const {
    title,
    author,
    publisher,
    publication_year,
    call_no,
    language,
    doc_type,
  } = req.body;
  try {
    await db.query(
      "UPDATE books SET title=$1, author=$2, publisher=$3, publication_year=$4, call_no=$5, language=$6, doc_type=$7 WHERE book_id=$8",
      [
        title,
        author,
        publisher,
        publication_year,
        call_no,
        language,
        doc_type,
        req.params.id,
      ]
    );
    res.json({ message: "书籍已更新" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM books WHERE book_id = $1", [req.params.id]);
    res.json({ message: "书籍已删除" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/batch", requireAuth, requireAdmin, async (req, res) => {
  const { ids } = req.body;
  try {
    await db.query("DELETE FROM books WHERE book_id = ANY($1::varchar[])", [
      ids,
    ]);
    res.json({ message: "书籍已删除" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {});

router.get("/export", requireAuth, requireAdmin, async (req, res) => {
  res.header("Content-Type", "text/csv");
  res.attachment("books.csv");
  const csvStream = format({ headers: true });
  csvStream.pipe(res);

  const { rows } = await db.query("SELECT * FROM books");
  rows.forEach((row) => csvStream.write(row));
  csvStream.end();
});

router.post(
  "/import",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("未上传文件");
    }

    const books = [];
    fs.createReadStream(req.file.path)
      .pipe(parse({ headers: true }))
      .on("error", (error) => console.error(error))
      .on("data", (row) => books.push(row))
      .on("end", async () => {
        fs.unlinkSync(req.file.path);
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          for (const book of books) {
            const {
              book_id,
              title,
              author,
              publisher,
              publication_year,
              call_no,
              language,
              doc_type,
            } = book;
            await client.query(
              "INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (book_id) DO UPDATE SET title = $2, author = $3, publisher = $4, publication_year = $5, call_no = $6, language = $7, doc_type = $8",
              [
                book_id,
                title,
                author,
                publisher,
                publication_year,
                call_no,
                language,
                doc_type,
              ]
            );
          }
          await client.query("COMMIT");
          res.status(201).json({ message: `共 ${books.length} 本书导入成功` });
        } catch (error) {
          await client.query("ROLLBACK");
          res
            .status(500)
            .json({ message: "导入书籍时出错: ", error: error.message });
        } finally {
          client.release();
        }
      });
  }
);

module.exports = router;
