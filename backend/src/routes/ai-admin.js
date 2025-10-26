const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireAdmin } = require("../utils/auth");
const OllamaManager = require("../utils/ollamaManager");

const ollamaManager = new OllamaManager();

router.get("/models", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        model_id,
        model_name,
        model_type,
        endpoint_url,
        is_active,
        max_tokens,
        temperature,
        created_at,
        updated_at
      FROM ai_models
      ORDER BY model_type, model_name`
    );

    res.json({ models: result.rows });
  } catch (error) {
    console.error("获取模型列表失败: ", error);
    res.status(500).json({ error: "获取模型列表失败" });
  }
});

router.post("/models", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      model_name,
      model_type,
      endpoint_url,
      max_tokens = 4096,
      temperature = 0.7,
      model_config = {},
    } = req.body;

    if (!model_name || !model_type) {
      return res.status(400).json({ error: "模型名称和类型不能为空" });
    }

    const result = await db.query(
      `INSERT INTO ai_models (model_name, model_type, endpoint_url, max_tokens, temperature, model_config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING model_id, model_name, model_type, is_active, created_at`,
      [
        model_name,
        model_type,
        endpoint_url,
        max_tokens,
        temperature,
        JSON.stringify(model_config),
      ]
    );

    res.status(201).json({
      model: result.rows[0],
      message: "模型添加成功",
    });
  } catch (error) {
    console.error("添加模型失败: ", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "模型名称已存在" });
    } else {
      res.status(500).json({ error: "添加模型失败" });
    }
  }
});

// 更新模型配置
router.patch(
  "/models/:modelId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      const {
        model_name,
        endpoint_url,
        is_active,
        max_tokens,
        temperature,
        model_config,
      } = req.body;

      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (model_name !== undefined) {
        updateFields.push(`model_name = $${paramIndex++}`);
        updateValues.push(model_name);
      }
      if (endpoint_url !== undefined) {
        updateFields.push(`endpoint_url = $${paramIndex++}`);
        updateValues.push(endpoint_url);
      }
      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(is_active);
      }
      if (max_tokens !== undefined) {
        updateFields.push(`max_tokens = $${paramIndex++}`);
        updateValues.push(max_tokens);
      }
      if (temperature !== undefined) {
        updateFields.push(`temperature = $${paramIndex++}`);
        updateValues.push(temperature);
      }
      if (model_config !== undefined) {
        updateFields.push(`model_config = $${paramIndex++}`);
        updateValues.push(JSON.stringify(model_config));
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "没有提供要更新的字段" });
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(modelId);

      const result = await db.query(
        `UPDATE ai_models 
       SET ${updateFields.join(", ")}
       WHERE model_id = $${paramIndex}
       RETURNING model_id, model_name, model_type, is_active, updated_at`,
        updateValues
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "模型不存在" });
      }

      res.json({
        model: result.rows[0],
        message: "模型更新成功",
      });
    } catch (error) {
      console.error("更新模型失败: ", error);
      res.status(500).json({ error: "更新模型失败" });
    }
  }
);

// 删除模型配置
router.delete(
  "/models/:modelId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { modelId } = req.params;

      // 检查是否有会话正在使用此模型
      const sessionCheck = await db.query(
        "SELECT COUNT(*) FROM chat_sessions WHERE model_id = $1 AND is_active = true",
        [modelId]
      );

      if (parseInt(sessionCheck.rows[0].count) > 0) {
        return res.status(400).json({
          error: "无法删除正在使用的模型，请先停用相关会话",
        });
      }

      const result = await db.query(
        "DELETE FROM ai_models WHERE model_id = $1 RETURNING model_name",
        [modelId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "模型不存在" });
      }

      res.json({ message: `模型 ${result.rows[0].model_name} 删除成功` });
    } catch (error) {
      console.error("删除模型失败: ", error);
      res.status(500).json({ error: "删除模型失败" });
    }
  }
);

// Ollama 服务健康检查
router.get("/ollama/health", requireAuth, requireAdmin, async (req, res) => {
  try {
    const healthStatus = await ollamaManager.healthCheck();
    res.json(healthStatus);
  } catch (error) {
    console.error("Ollama 健康检查失败: ", error);
    res.status(500).json({ error: "Ollama 健康检查失败" });
  }
});

// 获取 Ollama 可用模型
router.get("/ollama/models", requireAuth, requireAdmin, async (req, res) => {
  try {
    const serviceStatus = await ollamaManager.checkService();

    if (!serviceStatus.available) {
      return res.status(503).json({
        error: "Ollama 服务不可用",
        details: serviceStatus.error,
      });
    }

    res.json({
      models: serviceStatus.models,
      service_available: true,
    });
  } catch (error) {
    console.error("获取 Ollama 模型失败: ", error);
    res.status(500).json({ error: "获取 Ollama 模型列表失败" });
  }
});

// 拉取 Ollama 模型
router.post("/ollama/pull", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { model_name } = req.body;

    if (!model_name) {
      return res.status(400).json({ error: "Ollama 模型名称不能为空" });
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const result = await ollamaManager.pullModel(model_name, (progress) => {
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          ...progress,
        })}\n\n`
      );
    });

    if (result.success) {
      // 同步到数据库
      await ollamaManager.syncModelsToDatabase();

      res.write(
        `data: ${JSON.stringify({
          type: "complete",
          success: true,
          message: result.message,
        })}\n\n`
      );
    } else {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          success: false,
          message: result.message,
        })}\n\n`
      );
    }

    res.end();
  } catch (error) {
    console.error("拉取 Ollama 模型失败: ", error);

    if (!res.headersSent) {
      res.status(500).json({ error: "拉取 Ollama 模型失败" });
    } else {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          success: false,
          message: error.message,
        })}\n\n`
      );
      res.end();
    }
  }
});

// 删除 Ollama 模型
router.delete(
  "/ollama/models/:modelName",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { modelName } = req.params;

      const result = await ollamaManager.deleteModel(modelName);

      if (result.success) {
        // 同步到数据库
        await ollamaManager.syncModelsToDatabase();
      }

      res.json(result);
    } catch (error) {
      console.error("删除 Ollama 模型失败: ", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// 测试 Ollama 模型响应
router.post(
  "/models/:modelId/test",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { modelId } = req.params;
      const { test_message = "Hello, this is a test message." } = req.body;

      const modelResult = await db.query(
        "SELECT * FROM ai_models WHERE model_id = $1",
        [modelId]
      );

      if (modelResult.rows.length === 0) {
        return res.status(404).json({ error: "模型不存在" });
      }

      const model = modelResult.rows[0];

      if (model.model_type === "ollama") {
        const testResult = await ollamaManager.testModel(
          model.model_name,
          test_message
        );
        res.json(testResult);
      } else {
        res.status(400).json({ error: "暂不支持此类型模型的测试" });
      }
    } catch (error) {
      console.error("测试模型失败: ", error);
      res.status(500).json({ error: "测试模型失败" });
    }
  }
);

// 同步 Ollama 模型到数据库
router.post("/ollama/sync", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await ollamaManager.syncModelsToDatabase();
    res.json(result);
  } catch (error) {
    console.error("同步模型失败: ", error);
    res.status(500).json({ error: error.message });
  }
});

// 获取使用统计
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = "";
    const params = [];

    if (start_date && end_date) {
      dateFilter = "WHERE usage_date BETWEEN $1 AND $2";
      params.push(start_date, end_date);
    }

    const stats = await db.query(
      `SELECT 
        DATE(usage_date) as date,
        COUNT(DISTINCT reader_id) as active_users,
        SUM(message_count) as total_messages,
        SUM(token_count) as total_tokens,
        AVG(response_time_ms) as avg_response_time
      FROM ai_usage_stats
      ${dateFilter}
      GROUP BY DATE(usage_date)
      ORDER BY date DESC
      LIMIT 30`,
      params
    );

    const modelStats = await db.query(
      `SELECT 
        am.model_name,
        am.model_type,
        COUNT(DISTINCT aus.reader_id) as users,
        SUM(aus.message_count) as messages,
        SUM(aus.token_count) as tokens,
        AVG(aus.response_time_ms) as avg_response_time
      FROM ai_models am
      LEFT JOIN ai_usage_stats aus ON am.model_id = aus.model_id
      ${dateFilter ? "WHERE aus.usage_date BETWEEN $1 AND $2" : ""}
      GROUP BY am.model_id, am.model_name, am.model_type
      ORDER BY messages DESC`,
      params
    );

    res.json({
      daily_stats: stats.rows,
      model_stats: modelStats.rows,
    });
  } catch (error) {
    console.error("获取统计数据失败: ", error);
    res.status(500).json({ error: "获取统计数据失败" });
  }
});

module.exports = router;
