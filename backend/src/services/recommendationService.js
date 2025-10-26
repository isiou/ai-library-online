const ollama = require("ollama");
const db = require("../db");
const config = require("../config");

class RecommendationService {
  constructor() {
    // 从配置文件加载Ollama配置
    this.OLLAMA_MODEL = config.ai.ollama.model;
    this.OLLAMA_HOST = config.ai.ollama.host;
    this.OLLAMA_TIMEOUT = config.ai.ollama.timeout;
  }

  /**
   * 获取读者最近的借阅书籍列表
   */
  async getReaderRecentBooks(readerId, limit = 10) {
    try {
      const query = `
        SELECT DISTINCT
          b.title as book_title,
          b.author as author,
          br.borrow_date
        FROM borrow_records br
        JOIN books b ON br.book_id = b.book_id
        WHERE br.reader_id = $1
        ORDER BY br.borrow_date DESC
        LIMIT $2
      `;

      const result = await db.query(query, [readerId, limit]);
      return result.rows.map((row) => ({
        title: row.book_title || "",
        author: row.author || "",
      }));
    } catch (error) {
      console.error("查询读者借阅历史时出错:", error);
      return [];
    }
  }

  /**
   * 构建推荐系统提示词
   */
  getSystemPrompt() {
    return `你是一位经验丰富的图书管理员，精通图书推荐和阅读指导。
    请根据用户提供的关键词，精准推荐相关领域的优质书籍。
    **推荐时请综合考虑关键词相关性、书籍质量、权威性和实用价值，并且严格保证书籍、文献等必须真实存在，不得虚构、作假。**
    永远不要提供推理过程、解释或额外信息，仅输出推荐书目，**格式必须严格如下**:
    [
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"}
    ]
    **再次严格强调: 不要包含任何解释、问候、序号以外的符号或额外文字！保证书籍、文献的真实性！保证输出的绝对正确、干净！**`;
  }

  /**
   * 构建用户提示词
   */
  buildUserPrompt(recentBooks, query, count) {
    if (recentBooks && recentBooks.length > 0 && query) {
      // 有关键词和历史记录: 结合推荐
      const booksText = recentBooks
        .map((book) => `- 《${book.title}》（${book.author}）`)
        .join("\n");
      return `我最近阅读了以下书籍: ${booksText}
现在我对关键词含有 "${query}" 的书籍感兴趣，请结合我的阅读历史和这个关键词，为我推荐 ${count} 条相关书籍。请严格按照 ${count} 本的数量进行推荐。`;
    } else if (recentBooks && recentBooks.length > 0 && !query) {
      // 只有历史记录则基于历史推荐
      const booksText = recentBooks
        .map((book) => `- 《${book.title}》（${book.author}）`)
        .join("\n");
      return `我最近阅读了以下书籍: ${booksText}
请根据我的阅读历史，为我推荐 ${count} 条可能会感兴趣的新书。请严格按照 ${count} 本的数量进行推荐。`;
    } else if (!recentBooks || (recentBooks.length === 0 && query)) {
      // 只有关键词则纯关键词推荐
      return `我对关键词 "${query}" 感兴趣，请为我推荐 ${count} 条相关的优质书籍。请严格按照 ${count} 本的数量进行推荐。`;
    } else {
      // 什么都没有则通用推荐
      return `请为我推荐 ${count} 条优质的书籍。请严格按照 ${count} 本的数量进行推荐。`;
    }
  }

  /**
   * 解析推荐结果
   */
  parseRecommendations(text) {
    try {
      const startIndex = text.indexOf("[");
      const endIndex = text.lastIndexOf("]");
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = text.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonStr);
      }
      return [];
    } catch (error) {
      console.error("解析推荐结果失败:", error);
      return [];
    }
  }

  /**
   * 使用Ollama获取推荐
   */
  async getOllamaRecommendations(recentBooks, query, count, retries = 2) {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(recentBooks, query, count);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`尝试调用Ollama API (第${attempt + 1}次)`);

        // 使用fetch调用Ollama API
        const response = await fetch(`${this.OLLAMA_HOST}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.OLLAMA_MODEL,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Ollama API error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        const recommendationText = data.message.content;
        console.log("Ollama响应:", recommendationText);

        return this.parseRecommendations(recommendationText);
      } catch (error) {
        console.error(
          `Ollama API调用失败 (尝试 ${attempt + 1}):`,
          error.message
        );
        if (attempt === retries - 1) {
          throw error;
        }
      }
    }
    return [];
  }

  /**
   * 保存推荐历史到数据库
   */
  async saveRecommendationHistory(readerId, modelUsed, recommendations) {
    try {
      for (const rec of recommendations) {
        const query = `
          INSERT INTO recommendation_history
          (reader_id, model_used, recommended_book_title, recommended_book_author, recommendation_reason)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await db.query(query, [
          readerId,
          modelUsed,
          rec.title || "",
          rec.author || "",
          rec.reason || "",
        ]);
      }
      console.log(`成功保存 ${recommendations.length} 条推荐记录到数据库`);
    } catch (error) {
      console.error("保存推荐历史失败:", error);
      throw error;
    }
  }

  /**
   * 获取图书推荐的统一接口
   */
  async getBookRecommendations(
    readerId,
    model = "ollama",
    query = "",
    count = 5
  ) {
    try {
      // 获取用户的借阅历史记录
      const recentBooks = await this.getReaderRecentBooks(readerId, 10);

      console.log(`用户 ${readerId} 的最近借阅书籍:`, recentBooks);

      let recommendations = [];
      let modelUsed = model;

      try {
        if (model.toLowerCase() === "ollama") {
          recommendations = await this.getOllamaRecommendations(
            recentBooks,
            query,
            count
          );
        } else {
          throw new Error(`不支持的模型: ${model}`);
        }

        // 如果推荐成功，保存到数据库
        if (recommendations && recommendations.length > 0) {
          await this.saveRecommendationHistory(
            readerId,
            modelUsed,
            recommendations
          );
        }

        return {
          success: recommendations && recommendations.length > 0,
          reader_id: readerId,
          model_used: modelUsed,
          query: query,
          has_history: recentBooks.length > 0,
          recommendations_count: recommendations.length,
          recommendations: recommendations,
        };
      } catch (aiError) {
        console.error("AI推荐服务出错:", aiError);
        return {
          success: false,
          reader_id: readerId,
          model_used: modelUsed,
          query: query,
          has_history: recentBooks.length > 0,
          recommendations_count: 0,
          recommendations: [],
          error: aiError.message,
        };
      }
    } catch (error) {
      console.error("获取推荐时出错:", error);
      return {
        success: false,
        reader_id: readerId,
        model_used: model,
        query: query,
        has_history: false,
        recommendations_count: 0,
        recommendations: [],
        error: error.message,
      };
    }
  }

  /**
   * 检查Ollama服务是否可用
   */
  async checkOllamaHealth() {
    try {
      // 使用fetch检查Ollama服务
      const response = await fetch(`${this.OLLAMA_HOST}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        return { available: true, models: data.models || [] };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      return { available: false, error: error.message };
    }
  }
}

module.exports = RecommendationService;
