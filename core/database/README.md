# 数据库部署与数据同步文档

本文档用于指导如何将项目数据同步到 PostgreSQL 数据库。

## 先决条件

- 已安装并运行 PostgreSQL 数据库。

- 已安装 `psql` 命令行工具。

- 准备好清洗后的数据文件，它们应位于服务器以下路径：
  - `/root/library_csv/books_cleaned.csv`
  - `/root/library_csv/readers_cleaned.csv`
  - `/root/library_csv/borrow_records.csv`

## 部署步骤

### 创建库与用户

创建数据库与专用用户。

```shell
# 以超级用户登录数据库
psql -U postgres
```

```sql
-- 创建新用户
CREATE USER library_admin WITH PASSWORD "************************";

-- 创建数据库
CREATE DATABASE library_db OWNER library_admin;
```

### 创建数据表

通过 `schema.sql` 文件来创建数据表。此脚本将创建 `books`, `readers`, 和 `borrow_records` 三张表。

```shell
psql -U library_admin -d library_db -f database/schema.sql
```

### 导入数据

将清洗后的数据导入进数据库中。

```shell
# 连接到数据库
psql -U library_admin -d library_db
```

通过 `\copy` 命令在 `psql` 中导入数据。

```shell
\copy books(no, book_id, title, author, publisher, publication_year, call_no, language, doc_type) FROM '/root/library_csv/books_cleaned.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8');

\copy readers(no, reader_id, gender, enroll_year, reader_type, department) FROM '/root/library_csv/readers_cleaned.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8');

\copy borrow_records(borrow_id, reader_id, book_id, borrow_date, due_date, return_date, status) FROM '/root/library_csv/borrow_records.csv' WITH (FORMAT CSV, HEADER, ENCODING 'UTF8');
```

## 验证数据

数据导入成功后可以执行一些简单的 SQL 查询来验证数据是否已正确加载。

```bash
# 连接到数据库
psql -U library_admin -d library_db
```

```shell
# 查询每个表的记录数
SELECT 'books' AS table_name, COUNT(*) FROM books
UNION ALL
SELECT 'readers', COUNT(*) FROM readers
UNION ALL
SELECT 'borrow_records', COUNT(*) FROM borrow_records;

SELECT * FROM books LIMIT 5;
SELECT * FROM readers LIMIT 5;
SELECT * FROM borrow_records LIMIT 5;
```

如果查询返回了正确的记录数和数据样本，则说明数据已成功同步到 PostgreSQL 数据库。
