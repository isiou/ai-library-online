const express = require("express");
const db = require("../db");
const {
  normalizeRecommendation,
  buildFallbackQuery,
} = require("../lib/recommendations");
const RecommendationService = require("../services/recommendationService");
const router = express.Router();

// 初始化推荐服务
const recommendationService = new RecommendationService();

// 认证中间件
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// GET /api/recommendations - 获取智能推荐
router.get("/", requireAuth, async (req, res) => {
  try {
    const { model = "ollama", limit = 10, query = "" } = req.query;
    const config = require("../config");
    const limitNum = Math.max(
      1,
      Math.min(
        config.recommendation.maxLimit,
        parseInt(limit) || config.recommendation.defaultLimit
      )
    );
    const userId = req.session.user.readerId;

    let recommendations = [];
    let message = "Backend 后端服务返回成功";

    try {
      // 使用新的推荐服务
      const result = await recommendationService.getBookRecommendations(
        userId,
        model,
        query,
        limitNum
      );

      if (result.success && result.recommendations) {
        recommendations = result.recommendations.map(normalizeRecommendation);
        message = `推荐系统使用 ${result.model_used || model} 模型返回 ${recommendations.length} 条推荐`;
      } else {
        console.log("推荐服务返回失败:", result.error);
        throw new Error(result.error || "推荐服务出错");
      }
    } catch (recommendationError) {
      console.log(
        "AI推荐服务不可用，使用数据库回退方案:",
        recommendationError.message
      );

      try {
        // 使用数据库回退方案
        const userBorrowsQuery = `SELECT DISTINCT b.doc_type, b.author FROM borrow_records br JOIN books b ON br.book_id = b.book_id WHERE br.reader_id = $1 LIMIT 5`;
        const userBorrows = await db.query(userBorrowsQuery, [userId]);

        const { sql, params } = buildFallbackQuery(
          userBorrows.rows,
          query,
          limitNum
        );
        const fallbackResult = await db.query(sql, params);

        recommendations = fallbackResult.rows.map((book) => ({
          ...normalizeRecommendation(book),
          category: book.doc_type,
        }));

        message = "AI推荐服务暂时不可用，使用数据库推荐";
      } catch (dbError) {
        console.error("数据库响应失败: ", dbError);
        return res.status(503).json({
          message: "数据库服务暂时不可用",
          recommendations: [],
        });
      }
    }

    res.json({ recommendations, message, total: recommendations.length });
  } catch (error) {
    console.error("推荐服务出错: ", error);
    res.status(500).json({ message: "推荐服务出错", recommendations: [] });
  }
});

// GET /api/recommendations/history - 获取推荐历史记录
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    // 限制最大返回数量
    const limitNum = Math.min(parseInt(limit) || 10, 100);
    const userId = req.session.user.readerId;

    const query = `
      SELECT 
        recommended_book_title as title,
        recommended_book_author as author,
        recommendation_reason as reason,
        model_used,
        created_at
      FROM recommendation_history 
      WHERE reader_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    const { rows } = await db.query(query, [userId, limitNum]);

    // 转换为标准格式
    const recommendations = rows.map((row) => ({
      title: row.title || "",
      author: row.author || "",
      call_number: "",
      reason: row.reason || "",
      model_used: row.model_used,
      created_at: row.created_at,
    }));

    res.json({
      recommendations,
      message: "Backend 后端服务返回推荐历史记录成功",
      total: recommendations.length,
    });
  } catch (err) {
    console.error("Backend 后端服务获取推荐历史记录失败：", err);
    res.status(500).json({ message: "Backend 后端服务获取推荐历史记录失败" });
  }
});

// GET /api/recommendations/health - 检查AI推荐服务健康状态
router.get("/health", async (req, res) => {
  try {
    const healthStatus = await recommendationService.checkOllamaHealth();

    if (healthStatus.available) {
      res.json({
        status: "healthy",
        ollama_available: true,
        models: healthStatus.models.map((m) => m.name),
        message: "AI推荐服务运行正常",
      });
    } else {
      res.json({
        status: "degraded",
        ollama_available: false,
        error: healthStatus.error,
        message: "AI推荐服务不可用，将使用数据库回退方案",
      });
    }
  } catch (error) {
    res.status(500).json({
      status: "unhealthy",
      ollama_available: false,
      error: error.message,
      message: "推荐服务健康检查失败",
    });
  }
});

module.exports = router;
