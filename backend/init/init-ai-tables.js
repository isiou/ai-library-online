const { Pool } = require("pg");
const config = require("../src/config");

async function initAIModels() {
  const pool = new Pool(config.db);

  try {
    console.log("初始化模型列表");

    const defaultModels = [
      {
        name: "qwen3:1.7b",
        type: "ollama",
        endpoint: "http://localhost:11434",
        config: { temperature: 0.7, max_tokens: 4096 },
      },
      {
        name: "gpt-oss:20B",
        type: "ollama",
        endpoint: "http://localhost:11434",
        config: { temperature: 0.7, max_tokens: 4096 },
      },
    ];

    for (const model of defaultModels) {
      try {
        await pool.query(
          `
          INSERT INTO ai_models (model_name, model_type, endpoint_url, model_config, temperature, max_tokens)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (model_name) DO UPDATE SET
            model_type = EXCLUDED.model_type,
            endpoint_url = EXCLUDED.endpoint_url,
            model_config = EXCLUDED.model_config,
            temperature = EXCLUDED.temperature,
            max_tokens = EXCLUDED.max_tokens,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        `,
          [
            model.name,
            model.type,
            model.endpoint,
            JSON.stringify(model.config),
            model.config.temperature,
            model.config.max_tokens,
          ]
        );
        console.log(`添加模型成功: ${model.name}`);
      } catch (err) {
        console.error(`添加模型 ${model.name} 失败: `, err.message);
      }
    }

    const result = await pool.query(
      "SELECT model_name, model_type, is_active FROM ai_models ORDER BY created_at"
    );

    console.log("当前可用模型: ");
    result.rows.forEach((row) => {
      console.log(
        `- ${row.model_name} (${row.model_type}) - ${row.is_active ? "激活" : "未激活"}`
      );
    });
  } catch (error) {
    console.error("模型初始化失败: ", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initAIModels();
