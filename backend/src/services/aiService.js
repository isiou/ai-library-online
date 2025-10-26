const db = require("../db");
const axios = require("axios");

class AIService {
  constructor() {
    this.activeConnections = new Map();
  }

  /**
   * 获取会话历史消息
   * @param {string} sessionId - 会话 ID
   * @param {number} limit - 限制消息数量
   * @returns {Array} 历史消息数组
   */
  async getSessionHistory(sessionId, limit = 20) {
    try {
      const result = await db.query(
        `SELECT role, content, created_at
         FROM chat_messages
         WHERE session_id = $1 AND is_deleted = false
         ORDER BY created_at ASC
         LIMIT $2`,
        [sessionId, limit]
      );

      return result.rows.map((row) => ({
        role: row.role,
        content: row.content,
        timestamp: row.created_at,
      }));
    } catch (error) {
      console.error("获取会话历史失败: ", error);
      return [];
    }
  }

  /**
   * 生成流式响应
   * @param {Object} session - 会话信息
   * @param {string} message - 用户消息
   * @param {string} sessionId - 会话 ID
   * @param {Object} res - Express 响应对象
   */
  async generateStreamResponse(session, message, sessionId, res) {
    try {
      console.log("开始生成流式响应: ", {
        sessionId,
        modelType: session.model_type,
        modelName: session.model_name,
      });

      // 根据模型类型调用不同的服务
      if (session.model_type === "ollama") {
        await this.generateOllamaStreamResponse(
          session,
          message,
          sessionId,
          res
        );
      } else if (session.model_type === "openai") {
        await this.generateOpenAIStreamResponse(
          session,
          message,
          sessionId,
          res
        );
      } else {
        // 默认使用模拟响应
        await this.generateMockStreamResponse(session, message, sessionId, res);
      }
    } catch (error) {
      console.error("生成流式响应失败: ", error);
      this.sendErrorResponse(res, "生成响应失败");
    }
  }

  /**
   * 生成非流式响应
   * @param {Object} session - 会话信息
   * @param {string} message - 用户消息
   * @param {string} sessionId - 会话 ID
   */
  async generateResponse(session, message, sessionId) {
    try {
      console.log("开始生成非流式响应: ", {
        sessionId,
        modelType: session.model_type,
        modelName: session.model_name,
      });

      let aiResponse;

      // 根据模型类型调用不同的服务
      if (session.model_type === "ollama") {
        aiResponse = await this.generateOllamaResponse(
          session,
          message,
          sessionId
        );
      } else if (session.model_type === "openai") {
        aiResponse = await this.generateOpenAIResponse(
          session,
          message,
          sessionId
        );
      } else {
        // 默认使用模拟响应
        aiResponse = await this.generateMockResponse(
          session,
          message,
          sessionId
        );
      }

      return aiResponse;
    } catch (error) {
      console.error("生成非流式响应失败: ", error);
      throw new Error("生成响应失败");
    }
  }

  async generateOllamaStreamResponse(session, message, sessionId, res) {
    try {
      const ollamaUrl = session.endpoint_url || "http://localhost:11434";

      // 获取会话历史消息
      const historyMessages = await this.getSessionHistory(sessionId, 10);
      console.log(`获取到 ${historyMessages.length} 条历史消息`);

      let modelConfig = {};
      if (session.model_config) {
        if (typeof session.model_config === "string") {
          try {
            modelConfig = JSON.parse(session.model_config);
          } catch (parseError) {
            console.warn(
              "解析 model_config 失败使用默认配置: ",
              parseError.message
            );
            modelConfig = {};
          }
        } else if (typeof session.model_config === "object") {
          modelConfig = session.model_config;
        }
      }

      const messages = [
        ...historyMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: "user",
          content: message,
        },
      ];

      const requestData = {
        model: session.model_name,
        messages: messages,
        stream: true,
        options: {
          temperature: modelConfig.temperature || 0.7,
          num_predict: modelConfig.max_tokens || 2048,
          ...modelConfig.options,
        },
      };

      console.log("调用 Ollama API: ", {
        url: `${ollamaUrl}/api/chat`,
        model: session.model_name,
        messageCount: messages.length,
      });

      const response = await axios.post(`${ollamaUrl}/api/chat`, requestData, {
        responseType: "stream",
        timeout: 60000,
      });

      let fullContent = "";
      let buffer = "";
      let isCompleted = false;

      response.data.on("data", (chunk) => {
        console.log(
          "收到 Ollama 数据块: ",
          chunk.toString().substring(0, 100) + "..."
        );
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log("解析的 Ollama 数据: ", {
                content: data.message?.content?.substring(0, 50),
                done: data.done,
              });
              if (data.message && data.message.content) {
                fullContent += data.message.content;
                this.sendContentChunk(res, data.message.content);
              }
              if (data.done) {
                console.log("Ollama 响应完成总内容长度: ", fullContent.length);
                if (!isCompleted) {
                  isCompleted = true;
                  this.sendCompletionResponse(
                    res,
                    fullContent,
                    session,
                    sessionId
                  );
                }
                return;
              }
            } catch (parseError) {
              console.warn(
                "解析 Ollama 响应失败: ",
                parseError.message,
                "原始行: ",
                line
              );
            }
          }
        }
      });

      response.data.on("end", () => {
        if (fullContent && !isCompleted) {
          isCompleted = true;
          this.sendCompletionResponse(res, fullContent, session, sessionId);
        } else if (!fullContent && !isCompleted) {
          this.sendErrorResponse(res, "未收到完整响应");
        }
      });

      response.data.on("error", (error) => {
        console.error("Ollama 流式响应错误: ", error);
        this.sendErrorResponse(res, "Ollama 服务错误");
      });
    } catch (error) {
      console.error("Ollama 流式响应失败: ", error);
      if (error.code === "ECONNREFUSED") {
        this.sendErrorResponse(res, "Ollama 服务未启动或无法连接");
      } else {
        this.sendErrorResponse(res, "调用 Ollama 服务失败");
      }
    }
  }

  async generateOpenAIStreamResponse(session, message, sessionId, res) {
    try {
      await this.generateMockStreamResponse(session, message, sessionId, res);
    } catch (error) {
      console.error("OpenAI 流式响应失败: ", error);
      this.sendErrorResponse(res, "OpenAI 服务错误");
    }
  }

  async generateMockStreamResponse(session, message, sessionId, res) {
    try {
      const mockResponse = `这是对您的问题 "${message}" 的模拟回复。我是 ${session.model_name} 模型，正在为您提供帮助。这是一个流式响应的演示，内容会逐步显示。`;

      const words = mockResponse.split("");
      let fullContent = "";

      for (let i = 0; i < words.length; i++) {
        const char = words[i];
        fullContent += char;

        // 发送字符块
        this.sendContentChunk(res, char);

        // 模拟打字效果
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 发送完成响应
      this.sendCompletionResponse(res, fullContent, session, sessionId);
    } catch (error) {
      console.error("模拟流式响应失败: ", error);
      this.sendErrorResponse(res, "模拟响应失败");
    }
  }

  async generateOllamaResponse(session, message, sessionId) {
    try {
      const ollamaUrl = session.endpoint_url || "http://localhost:11434";
      let modelConfig = {};
      if (session.model_config) {
        if (typeof session.model_config === "string") {
          try {
            modelConfig = JSON.parse(session.model_config);
          } catch (parseError) {
            console.warn(
              "解析 model_config 失败使用默认配置:",
              parseError.message
            );
            modelConfig = {};
          }
        } else if (typeof session.model_config === "object") {
          modelConfig = session.model_config;
        }
      }

      const requestData = {
        model: session.model_name,
        prompt: message,
        stream: false,
        options: {
          temperature: modelConfig.temperature || 0.7,
          max_tokens: modelConfig.max_tokens || 2048,
          ...modelConfig.options,
        },
      };

      const response = await axios.post(
        `${ollamaUrl}/api/generate`,
        requestData,
        {
          timeout: 60000,
        }
      );

      const content = response.data.response || "抱歉，未能生成有效回复。";

      const aiMessageResult = await db.query(
        `INSERT INTO chat_messages (session_id, role, content, content_type, metadata)
         VALUES ($1, 'assistant', $2, 'text', $3)
         RETURNING message_id, created_at`,
        [sessionId, content, JSON.stringify({ model_name: session.model_name })]
      );

      return {
        message_id: aiMessageResult.rows[0].message_id,
        role: "assistant",
        content: content,
        created_at: aiMessageResult.rows[0].created_at,
        model_name: session.model_name,
      };
    } catch (error) {
      console.error("Ollama 非流式响应失败: ", error);
      throw new Error("调用 Ollama 服务失败");
    }
  }

  async generateOpenAIResponse(session, message, sessionId) {
    // 未实现功能
    return await this.generateMockResponse(session, message, sessionId);
  }

  // 模拟非流式响应
  async generateMockResponse(session, message, sessionId) {
    try {
      const content = `这是对您的问题 "${message}" 的模拟回复。我是 ${session.model_name} 模型，正在为您提供帮助。`;

      const aiMessageResult = await db.query(
        `INSERT INTO chat_messages (session_id, role, content, content_type, metadata)
         VALUES ($1, 'assistant', $2, 'text', $3)
         RETURNING message_id, created_at`,
        [sessionId, content, JSON.stringify({ model_name: session.model_name })]
      );

      return {
        message_id: aiMessageResult.rows[0].message_id,
        role: "assistant",
        content: content,
        created_at: aiMessageResult.rows[0].created_at,
        model_name: session.model_name,
      };
    } catch (error) {
      console.error("模拟非流式响应失败: ", error);
      throw new Error("生成模拟响应失败");
    }
  }

  sendContentChunk(res, content) {
    try {
      console.log("发送内容块: ", content.substring(0, 50) + "...");
      res.write(
        `data: ${JSON.stringify({
          type: "content",
          content: content,
        })}\n\n`
      );
    } catch (error) {
      console.error("发送内容块失败: ", error);
    }
  }

  async sendCompletionResponse(res, fullContent, session, sessionId) {
    try {
      console.log(
        `[系统消息保存完成] Session: ${sessionId}, Content length: ${fullContent.length}`
      );
      const aiMessageResult = await db.query(
        `INSERT INTO chat_messages (session_id, role, content, content_type, metadata)
         VALUES ($1, 'assistant', $2, 'text', $3)
         RETURNING message_id, created_at`,
        [
          sessionId,
          fullContent,
          JSON.stringify({ model_name: session.model_name }),
        ]
      );

      // 更新会话的最后消息时间
      await db.query(
        "UPDATE chat_sessions SET last_message_at = NOW() WHERE session_id = $1",
        [sessionId]
      );

      console.log("发送完成信号消息 ID: ", aiMessageResult.rows[0].message_id);
      res.write(
        `data: ${JSON.stringify({
          type: "done",
          message_id: aiMessageResult.rows[0].message_id,
          full_content: fullContent,
          created_at: aiMessageResult.rows[0].created_at,
          model_name: session.model_name,
        })}\n\n`
      );
      res.end();
    } catch (error) {
      console.error("发送完成响应失败: ", error);
      this.sendErrorResponse(res, "保存响应失败");
    }
  }

  sendErrorResponse(res, message) {
    if (!res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: message,
        })}\n\n`
      );
      res.end();
    }
  }
}

module.exports = new AIService();
