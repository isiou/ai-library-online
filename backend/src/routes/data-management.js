const express = require("express");
const DataCleaningService = require("../services/dataCleaningService");
const VirtualDataService = require("../services/virtualDataService");
const router = express.Router();

// 初始化服务
const dataCleaningService = new DataCleaningService();
const virtualDataService = new VirtualDataService();

// 管理员认证中间件
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!req.session.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// POST /api/data-management/clean/books - 清洗图书数据
router.post("/clean/books", requireAdmin, async (req, res) => {
  try {
    console.log("开始清洗图书数据...");
    const result = await dataCleaningService.cleanBooksCSV();

    res.json({
      success: true,
      message: "图书数据清洗完成",
      data: result,
    });
  } catch (error) {
    console.error("清洗图书数据失败:", error);
    res.status(500).json({
      success: false,
      message: "清洗图书数据失败",
      error: error.message,
    });
  }
});

// POST /api/data-management/clean/readers - 清洗读者数据
router.post("/clean/readers", requireAdmin, async (req, res) => {
  try {
    console.log("开始清洗读者数据...");
    const result = await dataCleaningService.cleanReadersCSV();

    res.json({
      success: true,
      message: "读者数据清洗完成",
      data: result,
    });
  } catch (error) {
    console.error("清洗读者数据失败:", error);
    res.status(500).json({
      success: false,
      message: "清洗读者数据失败",
      error: error.message,
    });
  }
});

// POST /api/data-management/clean/full - 完整数据清洗流程
router.post("/clean/full", requireAdmin, async (req, res) => {
  try {
    console.log("开始完整数据清洗流程...");
    const result = await dataCleaningService.runFullCleaningProcess();

    res.json({
      success: true,
      message: "完整数据清洗流程完成",
      data: result,
    });
  } catch (error) {
    console.error("完整数据清洗流程失败:", error);
    res.status(500).json({
      success: false,
      message: "完整数据清洗流程失败",
      error: error.message,
    });
  }
});

// POST /api/data-management/import/books - 导入图书数据到数据库
router.post("/import/books", requireAdmin, async (req, res) => {
  try {
    console.log("开始导入图书数据到数据库...");
    const result = await dataCleaningService.importBooksToDB();

    res.json({
      success: true,
      message: "图书数据导入完成",
      data: result,
    });
  } catch (error) {
    console.error("导入图书数据失败:", error);
    res.status(500).json({
      success: false,
      message: "导入图书数据失败",
      error: error.message,
    });
  }
});

// POST /api/data-management/import/readers - 导入读者数据到数据库
router.post("/import/readers", requireAdmin, async (req, res) => {
  try {
    console.log("开始导入读者数据到数据库...");
    const result = await dataCleaningService.importReadersToDB();

    res.json({
      success: true,
      message: "读者数据导入完成",
      data: result,
    });
  } catch (error) {
    console.error("导入读者数据失败:", error);
    res.status(500).json({
      success: false,
      message: "导入读者数据失败",
      error: error.message,
    });
  }
});

// POST /api/data-management/virtual/borrow-records - 生成虚拟借阅记录
router.post("/virtual/borrow-records", requireAdmin, async (req, res) => {
  try {
    console.log("开始生成虚拟借阅记录...");
    const result = await virtualDataService.runFullVirtualDataGeneration();

    res.json({
      success: true,
      message: "虚拟借阅记录生成完成",
      data: result,
    });
  } catch (error) {
    console.error("生成虚拟借阅记录失败:", error);
    res.status(500).json({
      success: false,
      message: "生成虚拟借阅记录失败",
      error: error.message,
    });
  }
});

// GET /api/data-management/status - 获取数据管理状态
router.get("/status", requireAdmin, async (req, res) => {
  try {
    const db = require("../db");

    // 获取数据库中的数据统计
    const booksCount = await db.query("SELECT COUNT(*) as count FROM books");
    const readersCount = await db.query(
      "SELECT COUNT(*) as count FROM readers"
    );
    const borrowRecordsCount = await db.query(
      "SELECT COUNT(*) as count FROM borrow_records"
    );
    const recommendationCount = await db.query(
      "SELECT COUNT(*) as count FROM recommendation_history"
    );

    const status = {
      database: {
        books: parseInt(booksCount.rows[0].count),
        readers: parseInt(readersCount.rows[0].count),
        borrow_records: parseInt(borrowRecordsCount.rows[0].count),
        recommendations: parseInt(recommendationCount.rows[0].count),
      },
      services: {
        data_cleaning: "ready",
        virtual_data: "ready",
      },
      message: "数据管理服务状态正常",
    };

    res.json(status);
  } catch (error) {
    console.error("获取数据管理状态失败:", error);
    res.status(500).json({
      message: "获取数据管理状态失败",
      error: error.message,
    });
  }
});

module.exports = router;
