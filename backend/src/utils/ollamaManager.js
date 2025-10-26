const axios = require("axios");
const db = require("../db");

class OllamaManager {
  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  // 检查 Ollama 服务是否可用
  async checkService() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return {
        available: true,
        models: response.data.models || [],
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  // 获取可用模型列表
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`获取模型列表失败: ${error.message}`);
    }
  }

  // 拉取模型
  async pullModel(modelName, onProgress = null) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        { name: modelName },
        {
          responseType: "stream",
          timeout: 300000,
        }
      );

      return new Promise((resolve, reject) => {
        let lastStatus = "";

        response.data.on("data", (chunk) => {
          const lines = chunk.toString().split("\n");

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);

                if (data.status) {
                  lastStatus = data.status;
                  if (onProgress) {
                    onProgress({
                      status: data.status,
                      completed: data.completed || 0,
                      total: data.total || 0,
                    });
                  }
                }

                if (data.status === "success") {
                  resolve({ success: true, message: "模型拉取成功" });
                }
              } catch (parseError) {
                console.warn(`解析模型拉取进度时出错: ${parseError.message}`);
              }
            }
          }
        });

        response.data.on("error", (error) => {
          reject(new Error(`模型拉取失败: ${error.message}`));
        });

        response.data.on("end", () => {
          if (lastStatus === "success") {
            resolve({ success: true, message: "模型拉取成功" });
          } else {
            resolve({ success: false, message: "模型拉取可能未完成" });
          }
        });
      });
    } catch (error) {
      throw new Error(`拉取模型失败: ${error.message}`);
    }
  }

  // 删除模型
  async deleteModel(modelName) {
    try {
      await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName },
      });
      return { success: true, message: "模型删除成功" };
    } catch (error) {
      throw new Error(`删除模型失败: ${error.message}`);
    }
  }

  // 同步模型到数据库
  async syncModelsToDatabase() {
    try {
      const models = await this.getAvailableModels();
      const syncResults = [];

      for (const model of models) {
        try {
          // 检查模型是否已存在
          const existingModel = await db.query(
            "SELECT model_id FROM ai_models WHERE model_name = $1 AND model_type = 'ollama'",
            [model.name]
          );

          if (existingModel.rows.length === 0) {
            // 插入新模型
            const result = await db.query(
              `INSERT INTO ai_models (model_name, model_type, endpoint_url, model_config, is_active)
               VALUES ($1, 'ollama', $2, $3, true)
               RETURNING model_id`,
              [
                model.name,
                this.baseUrl,
                JSON.stringify({
                  size: model.size,
                  modified_at: model.modified_at,
                  digest: model.digest,
                }),
              ]
            );

            syncResults.push({
              model: model.name,
              action: "added",
              model_id: result.rows[0].model_id,
            });
          } else {
            syncResults.push({
              model: model.name,
              action: "exists",
              model_id: existingModel.rows[0].model_id,
            });
          }
        } catch (modelError) {
          syncResults.push({
            model: model.name,
            action: "error",
            error: modelError.message,
          });
        }
      }

      return {
        success: true,
        results: syncResults,
        total: models.length,
      };
    } catch (error) {
      throw new Error(`同步模型失败: ${error.message}`);
    }
  }

  // 测试模型响应
  async testModel(modelName, testMessage = "Hello, how are you?") {
    try {
      const startTime = Date.now();

      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: modelName,
          prompt: testMessage,
          stream: false,
        },
        {
          timeout: 30000,
        }
      );

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        response: response.data.response,
        responseTime,
        model: modelName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        model: modelName,
      };
    }
  }

  // 获取模型信息
  async getModelInfo(modelName) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/show`, {
        name: modelName,
      });

      return {
        success: true,
        info: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 健康检查
  async healthCheck() {
    try {
      const serviceCheck = await this.checkService();

      if (!serviceCheck.available) {
        return {
          status: "unhealthy",
          message: "Ollama 服务不可用",
          error: serviceCheck.error,
        };
      }

      const models = serviceCheck.models;
      const modelTests = [];

      // 测试模型
      for (let i = 0; i < Math.min(3, models.length); i++) {
        const model = models[i];
        const testResult = await this.testModel(model.name, "测试");
        modelTests.push({
          model: model.name,
          working: testResult.success,
          responseTime: testResult.responseTime,
          error: testResult.error,
        });
      }

      const workingModels = modelTests.filter((test) => test.working).length;
      const totalModels = models.length;

      return {
        status: workingModels > 0 ? "healthy" : "degraded",
        message: `${workingModels}/${totalModels} 模型正常工作`,
        details: {
          service: "available",
          totalModels,
          workingModels,
          modelTests,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: "健康检查失败",
        error: error.message,
      };
    }
  }
}

module.exports = OllamaManager;
