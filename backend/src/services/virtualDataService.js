const fs = require("fs").promises;
const path = require("path");
const db = require("../db");

class VirtualDataService {
  constructor() {
    // 配置参数
    this.config = {
      // 生成人数
      NUM_READERS_TO_GENERATE: 3000,
      // 每位读者借阅次数范围
      MIN_BORROWS_PER_READER: 10,
      MAX_BORROWS_PER_READER: 30,
      // 借阅周期
      BORROW_PERIOD_DAYS: 60,
      // 逾期和未还概率
      OVERDUE_PROBABILITY: 0.05,
      UNRETURNED_PROBABILITY: 0.02,
      // 借阅日期范围
      START_DATE: new Date("2000-09-01"),
      END_DATE: new Date("2025-06-30"),
      // 权重配置
      PREFERRED_BOOK_WEIGHT: 3.0,
      POPULARITY_WEIGHT: 0.7,
      DEPARTMENT_PREFERENCE_WEIGHT: 0.3,
      POPULARITY_ALPHA: 1.5,
    };

    // 索书号前缀与院系偏好映射
    this.DEPARTMENT_BOOK_PREFERENCE = {
      国际商务学院: ["F", "C"],
      人文与传播学院: ["I", "H", "G2", "K"],
      法学院: ["D", "DF"],
      管理学院: ["C", "F"],
      设计与创意学院: ["J", "TB"],
      环境科学与工程学院: ["X", "Q", "S"],
      信息科学与技术学院: ["TP", "TN", "O"],
      机电工程与自动化学院: ["T", "O", "N"],
      建筑学院: ["TU", "J"],
      厦大双创学院: ["F", "C", "TP"],
      日本语言与文化学院: ["H", "K", "I"],
      音乐系: ["J6"],
      土木工程学院: ["TU", "U"],
      厦大国际学院: ["H", "F"],
      电子科学与技术学院: ["TN", "O4", "TP"],
      信息学院: ["TP", "TN", "O"],
      英语语言文化学院: ["H", "I"],
      社会与人类学院: ["C", "K"],
      会计与金融学院: ["F"],
      "英语语言文化学院/国际商务学院": ["H", "F"],
      海洋与海岸带发展研究院: ["P", "X"],
      南海研究院: ["D", "K", "P"],
      中国语言文学系: ["H", "I"],
      电影学院: ["J", "I"],
      历史与文化遗产学院: ["K", "G"],
      哲学系: ["B"],
      "国际中文教育学院/国际商务学院": ["H", "F"],
    };

    this.dataDir = path.join(__dirname, "../../../data");
    this.virtualDir = path.join(this.dataDir, "virtual");
    this.csvDir = path.join(this.virtualDir, "csv");
  }

  /**
   * 确保目录存在
   */
  async ensureDirectories() {
    const dirs = [this.dataDir, this.virtualDir, this.csvDir];
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * 提取索书号前缀
   */
  getCallNoPrefix(callNo) {
    if (!callNo) return "";
    const callNoStr = callNo.toString().trim();
    let prefix = "";
    for (let i = 0; i < callNoStr.length; i++) {
      const char = callNoStr[i];
      if (/[A-Za-z]/.test(char)) {
        prefix += char;
      } else if (/\d/.test(char) && i < 3) {
        prefix += char;
      } else {
        break;
      }
    }
    return prefix;
  }

  /**
   * 根据院系偏好计算每本书的权重
   */
  calculateBookWeights(books, department) {
    const preferredPrefixes = this.DEPARTMENT_BOOK_PREFERENCE[department] || [];

    return books.map((book) => {
      const bookPrefix = this.getCallNoPrefix(book.call_no);
      let deptWeight = 1;

      for (const pref of preferredPrefixes) {
        if (bookPrefix.startsWith(pref)) {
          deptWeight = this.config.PREFERRED_BOOK_WEIGHT;
          break;
        }
      }

      return { ...book, deptWeight };
    });
  }

  /**
   * 生成借阅日期
   */
  generateBorrowDate(enrollYear) {
    try {
      const readerStart = new Date(enrollYear, 8, 1); // 9月1日
      const actualStart =
        readerStart > this.config.START_DATE
          ? readerStart
          : this.config.START_DATE;

      if (actualStart > this.config.END_DATE) {
        return null;
      }

      const daysDiff = Math.floor(
        (this.config.END_DATE - actualStart) / (1000 * 60 * 60 * 24)
      );
      const randomDays = Math.floor(Math.random() * daysDiff);
      return new Date(actualStart.getTime() + randomDays * 24 * 60 * 60 * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * 生成幂律分布权重 (Zipf分布)
   */
  generateZipfWeights(count, alpha) {
    const weights = [];
    for (let i = 1; i <= count; i++) {
      weights.push(1 / Math.pow(i, alpha));
    }
    return weights;
  }

  /**
   * 归一化权重数组
   */
  normalizeWeights(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => w / sum);
  }

  /**
   * 根据权重随机选择元素
   */
  weightedRandomChoice(items, weights) {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (let i = 0; i < items.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return i;
      }
    }

    return items.length - 1;
  }

  /**
   * 生成借阅记录
   */
  async generateBorrowRecords() {
    try {
      // 从数据库获取读者和图书数据
      const readersResult = await db.query(
        `
        SELECT reader_id, department, enroll_year
        FROM readers
        WHERE reader_id IS NOT NULL
        LIMIT $1
      `,
        [this.config.NUM_READERS_TO_GENERATE]
      );

      const booksResult = await db.query(`
        SELECT book_id, title, author, call_no
        FROM books
        WHERE book_id IS NOT NULL
      `);

      const readers = readersResult.rows;
      const books = booksResult.rows;

      console.log(`读者总数: ${readers.length}, 图书总数: ${books.length}`);

      if (readers.length === 0 || books.length === 0) {
        throw new Error("读者或图书数据为空，无法生成借阅记录");
      }

      // 预计算书籍热度权重
      const popularityWeights = this.generateZipfWeights(
        books.length,
        this.config.POPULARITY_ALPHA
      );
      const normalizedPopularityWeights =
        this.normalizeWeights(popularityWeights);

      const borrowRecords = [];
      let recordId = 1;

      // 为每位读者生成借阅记录
      for (const reader of readers) {
        const department = reader.department || "未知院系";

        // 计算院系偏好权重
        const booksWithDeptWeights = this.calculateBookWeights(
          books,
          department
        );

        // 计算综合权重 = 热度权重 * 0.7 + 院系权重 * 0.3
        const combinedWeights = booksWithDeptWeights.map((book) => {
          const popularityWeight =
            normalizedPopularityWeights[books.indexOf(book)];
          const deptWeight =
            book.deptWeight / this.config.PREFERRED_BOOK_WEIGHT;
          return (
            popularityWeight * this.config.POPULARITY_WEIGHT +
            deptWeight * this.config.DEPARTMENT_PREFERENCE_WEIGHT
          );
        });

        const normalizedCombinedWeights =
          this.normalizeWeights(combinedWeights);

        const numBorrows =
          Math.floor(
            Math.random() *
              (this.config.MAX_BORROWS_PER_READER -
                this.config.MIN_BORROWS_PER_READER +
                1)
          ) + this.config.MIN_BORROWS_PER_READER;

        for (let i = 0; i < numBorrows; i++) {
          // 根据权重随机选择书籍
          const bookIndex = this.weightedRandomChoice(
            books,
            normalizedCombinedWeights
          );
          const selectedBook = books[bookIndex];

          const borrowDate = this.generateBorrowDate(reader.enroll_year);
          if (!borrowDate) continue;

          const dueDate = new Date(
            borrowDate.getTime() +
              this.config.BORROW_PERIOD_DAYS * 24 * 60 * 60 * 1000
          );
          const rand = Math.random();

          let returnDate, status;
          if (rand < this.config.UNRETURNED_PROBABILITY) {
            returnDate = null;
            status = "借阅中";
          } else {
            if (Math.random() < this.config.OVERDUE_PROBABILITY) {
              const overdueDays = Math.floor(Math.random() * 60) + 1;
              returnDate = new Date(
                dueDate.getTime() + overdueDays * 24 * 60 * 60 * 1000
              );
              status = "逾期归还";
            } else {
              const daysBeforeDue = Math.floor(
                Math.random() * this.config.BORROW_PERIOD_DAYS
              );
              returnDate = new Date(
                borrowDate.getTime() + daysBeforeDue * 24 * 60 * 60 * 1000
              );
              status = "已归还";
            }
          }

          const record = {
            borrow_id: `BR${String(recordId).padStart(8, "0")}`,
            reader_id: reader.reader_id,
            book_id: selectedBook.book_id,
            borrow_date: borrowDate.toISOString().split("T")[0],
            due_date: dueDate.toISOString().split("T")[0],
            return_date: returnDate
              ? returnDate.toISOString().split("T")[0]
              : null,
            status: status,
          };

          borrowRecords.push(record);
          recordId++;
        }

        // 显示进度
        const currentIndex = readers.indexOf(reader);
        if (currentIndex % 100 === 0) {
          console.log(
            `\r已处理 ${currentIndex + 1}/${readers.length} 位读者...`
          );
        }
      }

      console.log(`\n生成借阅记录总数: ${borrowRecords.length}`);

      // 保存到文件
      await this.saveBorrowRecordsToFile(borrowRecords);

      // 导入到数据库
      const importResult = await this.importBorrowRecordsToDB(borrowRecords);

      return {
        total_records: borrowRecords.length,
        file_saved: true,
        imported_to_db: importResult.imported,
        skipped: importResult.skipped,
        message: "虚拟借阅记录生成和导入完成",
      };
    } catch (error) {
      console.error("生成虚拟借阅记录失败:", error);
      throw error;
    }
  }

  /**
   * 保存借阅记录到文件
   */
  async saveBorrowRecordsToFile(records) {
    await this.ensureDirectories();

    const csvPath = path.join(this.csvDir, "borrow_records.csv");
    const csv = require("fast-csv");
    const writeStream = require("fs").createWriteStream(csvPath);
    const csvWriter = csv.format({ headers: true });

    csvWriter.pipe(writeStream);

    for (const record of records) {
      csvWriter.write(record);
    }

    csvWriter.end();

    console.log(`借阅记录已保存到: ${csvPath}`);
  }

  /**
   * 导入借阅记录到数据库
   */
  async importBorrowRecordsToDB(records) {
    let importedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      try {
        // 检查记录是否已存在
        const existingQuery =
          "SELECT borrow_id FROM borrow_records WHERE borrow_id = $1";
        const existing = await db.query(existingQuery, [record.borrow_id]);

        if (existing.rows.length === 0) {
          const insertQuery = `
            INSERT INTO borrow_records
            (borrow_id, reader_id, book_id, borrow_date, due_date, return_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (borrow_id) DO NOTHING
          `;

          await db.query(insertQuery, [
            record.borrow_id,
            record.reader_id,
            record.book_id,
            record.borrow_date,
            record.due_date,
            record.return_date,
            record.status,
          ]);

          importedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error("导入借阅记录失败:", error);
      }
    }

    console.log(
      `借阅记录导入完成: 新增 ${importedCount}, 跳过 ${skippedCount}`
    );

    return { imported: importedCount, skipped: skippedCount };
  }

  /**
   * 生成完整的虚拟数据流程
   */
  async runFullVirtualDataGeneration() {
    try {
      await this.ensureDirectories();

      console.log("开始生成虚拟借阅记录...");
      const result = await this.generateBorrowRecords();

      console.log("虚拟数据生成完成！");
      return result;
    } catch (error) {
      console.error("虚拟数据生成失败:", error);
      throw error;
    }
  }
}

module.exports = VirtualDataService;
