const fs = require("fs").promises;
const path = require("path");
const csv = require("fast-csv");
const db = require("../db");

class DataCleaningService {
  constructor() {
    // 数据文件路径配置
    this.dataDir = path.join(__dirname, "../../../data");
    this.originalDir = path.join(this.dataDir, "original");
    this.cleanedDir = path.join(this.dataDir, "cleaned");
    this.csvDir = path.join(this.cleanedDir, "csv");
    this.statsDir = path.join(this.cleanedDir, "stats");
  }

  /**
   * 确保目录存在
   */
  async ensureDirectories() {
    const dirs = [
      this.dataDir,
      this.originalDir,
      this.cleanedDir,
      this.csvDir,
      this.statsDir,
    ];
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * 清洗图书数据CSV文件
   */
  async cleanBooksCSV() {
    const inputPath = path.join(this.originalDir, "books.csv");
    const outputPath = path.join(this.csvDir, "books_cleaned.csv");
    const statsPath = path.join(this.statsDir, "books_stats.json");

    try {
      await fs.access(inputPath);
    } catch {
      throw new Error(`找不到输入文件: ${inputPath}`);
    }

    return new Promise((resolve, reject) => {
      const results = [];
      let totalOriginal = 0;
      let totalCleaned = 0;
      const stats = {
        total_books: 0,
        language_distribution: {},
        doctype_distribution: {},
        top_publishers: {},
        year_distribution: {},
      };

      const stream = fs.createReadStream(inputPath, { encoding: "utf8" });

      const csvStream = csv
        .parseStream({ headers: true, ignoreEmpty: true })
        .on("data", (row) => {
          totalOriginal++;

          // 清洗数据
          const cleaned = this.cleanBookRow(row);
          if (cleaned) {
            results.push(cleaned);
            totalCleaned++;

            // 统计信息
            this.updateBookStats(stats, cleaned);
          }
        })
        .on("end", async () => {
          try {
            // 写入清洗后的CSV
            const writeStream = fs.createWriteStream(outputPath);
            const writeCsv = csv.format({ headers: true });

            writeStream.pipe(writeCsv);
            for (const row of results) {
              writeCsv.write(row);
            }
            writeCsv.end();

            // 保存统计信息
            stats.total_books = totalCleaned;
            await fs.writeFile(
              statsPath,
              JSON.stringify(stats, null, 2),
              "utf8"
            );

            console.log(
              `图书数据清洗完成: 原始记录 ${totalOriginal}, 清洗后记录 ${totalCleaned}`
            );
            resolve({
              total_original: totalOriginal,
              total_cleaned: totalCleaned,
              stats,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on("error", reject);

      stream.pipe(csvStream);
    });
  }

  /**
   * 清洗单行图书数据
   */
  cleanBookRow(row) {
    // 检查必填字段
    const requiredFields = ["TITLE", "AUTHOR", "YEAR", "PUBLISHER"];
    for (const field of requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        return null;
      }
    }

    // 清洗数据
    const cleaned = {
      ...row,
      TITLE: row.TITLE.toString().trim(),
      AUTHOR: row.AUTHOR.toString().trim(),
      YEAR: parseInt(row.YEAR),
      PUBLISHER: row.PUBLISHER.toString().trim().replace(/,\s*$/, ""),
      LANGUAGE: row.LANGUAGE ? row.LANGUAGE.toString().trim() : "中文",
      DOCTYPE: row.DOCTYPE ? row.DOCTYPE.toString().trim() : "图书",
      CALLNO: row.CALLNO ? row.CALLNO.toString().trim() : "",
    };

    // 验证年份
    if (
      isNaN(cleaned.YEAR) ||
      cleaned.YEAR < 1000 ||
      cleaned.YEAR > new Date().getFullYear()
    ) {
      return null;
    }

    return cleaned;
  }

  /**
   * 更新图书统计信息
   */
  updateBookStats(stats, row) {
    // 语言分布
    const lang = row.LANGUAGE || "未知";
    stats.language_distribution[lang] =
      (stats.language_distribution[lang] || 0) + 1;

    // 文档类型分布
    const docType = row.DOCTYPE || "未知";
    stats.doctype_distribution[docType] =
      (stats.doctype_distribution[docType] || 0) + 1;

    // 出版社统计
    const publisher = row.PUBLISHER || "未知";
    stats.top_publishers[publisher] =
      (stats.top_publishers[publisher] || 0) + 1;

    // 年份分布
    const year = row.YEAR;
    stats.year_distribution[year] = (stats.year_distribution[year] || 0) + 1;
  }

  /**
   * 清洗读者数据CSV文件
   */
  async cleanReadersCSV() {
    const inputPath = path.join(this.originalDir, "readers.csv");
    const outputPath = path.join(this.csvDir, "readers_cleaned.csv");
    const statsPath = path.join(this.statsDir, "readers_stats.json");

    try {
      await fs.access(inputPath);
    } catch {
      throw new Error(`找不到输入文件: ${inputPath}`);
    }

    return new Promise((resolve, reject) => {
      const results = [];
      let totalOriginal = 0;
      let totalCleaned = 0;
      const stats = {
        total_readers: 0,
        gender_distribution: {},
        department_distribution: {},
        reader_type_distribution: {},
        enroll_year_distribution: {},
      };

      const stream = fs.createReadStream(inputPath, { encoding: "utf8" });

      const csvStream = csv
        .parseStream({ headers: true, ignoreEmpty: true })
        .on("data", (row) => {
          totalOriginal++;

          const cleaned = this.cleanReaderRow(row);
          if (cleaned) {
            results.push(cleaned);
            totalCleaned++;

            this.updateReaderStats(stats, cleaned);
          }
        })
        .on("end", async () => {
          try {
            const writeStream = fs.createWriteStream(outputPath);
            const writeCsv = csv.format({ headers: true });

            writeStream.pipe(writeCsv);
            for (const row of results) {
              writeCsv.write(row);
            }
            writeCsv.end();

            stats.total_readers = totalCleaned;
            await fs.writeFile(
              statsPath,
              JSON.stringify(stats, null, 2),
              "utf8"
            );

            console.log(
              `读者数据清洗完成: 原始记录 ${totalOriginal}, 清洗后记录 ${totalCleaned}`
            );
            resolve({
              total_original: totalOriginal,
              total_cleaned: totalCleaned,
              stats,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on("error", reject);

      stream.pipe(csvStream);
    });
  }

  /**
   * 清洗单行读者数据
   */
  cleanReaderRow(row) {
    // 检查必填字段
    const requiredFields = ["ID", "DEPARTMENT"];
    for (const field of requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        return null;
      }
    }

    return {
      ID: row.ID.toString().trim(),
      GENDER: row.GENDER ? row.GENDER.toString().trim() : "未知",
      ENROLLYEAR: row.ENROLLYEAR
        ? parseInt(row.ENROLLYEAR)
        : new Date().getFullYear(),
      DEPARTMENT: row.DEPARTMENT.toString().trim(),
      READER_TYPE: row.READER_TYPE
        ? row.READER_TYPE.toString().trim()
        : "本科生",
    };
  }

  /**
   * 更新读者统计信息
   */
  updateReaderStats(stats, row) {
    // 性别分布
    const gender = row.GENDER || "未知";
    stats.gender_distribution[gender] =
      (stats.gender_distribution[gender] || 0) + 1;

    // 院系分布
    const dept = row.DEPARTMENT || "未知";
    stats.department_distribution[dept] =
      (stats.department_distribution[dept] || 0) + 1;

    // 读者类型分布
    const readerType = row.READER_TYPE || "未知";
    stats.reader_type_distribution[readerType] =
      (stats.reader_type_distribution[readerType] || 0) + 1;

    // 入学年份分布
    const enrollYear = row.ENROLLYEAR || "未知";
    stats.enroll_year_distribution[enrollYear] =
      (stats.enroll_year_distribution[enrollYear] || 0) + 1;
  }

  /**
   * 将清洗后的数据导入数据库
   */
  async importCleanedDataToDB() {
    try {
      // 导入图书数据
      const booksResult = await this.importBooksToDB();

      // 导入读者数据
      const readersResult = await this.importReadersToDB();

      return {
        books: booksResult,
        readers: readersResult,
      };
    } catch (error) {
      console.error("导入数据到数据库失败:", error);
      throw error;
    }
  }

  /**
   * 导入图书数据到数据库
   */
  async importBooksToDB() {
    const booksPath = path.join(this.csvDir, "books_cleaned.csv");

    return new Promise((resolve, reject) => {
      let importedCount = 0;
      let skippedCount = 0;

      const stream = fs.createReadStream(booksPath, { encoding: "utf8" });

      const csvStream = csv
        .parseStream({ headers: true })
        .on("data", async (row) => {
          try {
            // 检查图书是否已存在
            const existingQuery =
              "SELECT book_id FROM books WHERE book_id = $1";
            const existing = await db.query(existingQuery, [row.ID]);

            if (existing.rows.length === 0) {
              const insertQuery = `
                INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (book_id) DO NOTHING
              `;

              await db.query(insertQuery, [
                row.ID,
                row.TITLE,
                row.AUTHOR,
                row.PUBLISHER,
                row.YEAR,
                row.CALLNO,
                row.LANGUAGE,
                row.DOCTYPE,
              ]);

              importedCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            console.error("导入图书记录失败:", error);
          }
        })
        .on("end", () => {
          console.log(
            `图书数据导入完成: 新增 ${importedCount}, 跳过 ${skippedCount}`
          );
          resolve({ imported: importedCount, skipped: skippedCount });
        })
        .on("error", reject);

      stream.pipe(csvStream);
    });
  }

  /**
   * 导入读者数据到数据库
   */
  async importReadersToDB() {
    const readersPath = path.join(this.csvDir, "readers_cleaned.csv");

    return new Promise((resolve, reject) => {
      let importedCount = 0;
      let skippedCount = 0;

      const stream = fs.createReadStream(readersPath, { encoding: "utf8" });

      const csvStream = csv
        .parseStream({ headers: true })
        .on("data", async (row) => {
          try {
            // 检查读者是否已存在
            const existingQuery =
              "SELECT reader_id FROM readers WHERE reader_id = $1";
            const existing = await db.query(existingQuery, [row.ID]);

            if (existing.rows.length === 0) {
              const insertQuery = `
                INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (reader_id) DO NOTHING
              `;

              await db.query(insertQuery, [
                row.ID,
                row.GENDER,
                row.ENROLLYEAR,
                row.READER_TYPE,
                row.DEPARTMENT,
              ]);

              importedCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            console.error("导入读者记录失败:", error);
          }
        })
        .on("end", () => {
          console.log(
            `读者数据导入完成: 新增 ${importedCount}, 跳过 ${skippedCount}`
          );
          resolve({ imported: importedCount, skipped: skippedCount });
        })
        .on("error", reject);

      stream.pipe(csvStream);
    });
  }

  /**
   * 执行完整的数据清洗和导入流程
   */
  async runFullCleaningProcess() {
    try {
      await this.ensureDirectories();

      console.log("开始数据清洗流程...");

      // 清洗图书数据
      console.log("正在清洗图书数据...");
      const booksResult = await this.cleanBooksCSV();

      // 清洗读者数据
      console.log("正在清洗读者数据...");
      const readersResult = await this.cleanReadersCSV();

      // 导入数据库
      console.log("正在导入数据库...");
      const importResult = await this.importCleanedDataToDB();

      console.log("数据清洗和导入流程完成！");

      return {
        cleaning: {
          books: booksResult,
          readers: readersResult,
        },
        import: importResult,
        message: "数据清洗和导入流程成功完成",
      };
    } catch (error) {
      console.error("数据清洗流程失败:", error);
      throw error;
    }
  }
}

module.exports = DataCleaningService;
