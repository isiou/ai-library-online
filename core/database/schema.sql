-- 图书库表
CREATE TABLE books (
    NO BIGINT,
    book_id varchar(255) PRIMARY KEY,
    title text,
    author text,
    publisher text,
    publication_year integer,
    call_no varchar(255),
    LANGUAGE VARCHAR
(50),
    doc_type varchar(50)
);

-- 读者表
CREATE TABLE readers (
    NO BIGINT,
    reader_id varchar(255) PRIMARY KEY,
    gender varchar(10),
    enroll_year integer,
    reader_type varchar(50),
    department text
);

-- 借阅记录表
CREATE TABLE borrow_records (
    borrow_id varchar(255) PRIMARY KEY,
    reader_id varchar(255) REFERENCES readers (reader_id),
    book_id varchar(255) REFERENCES books (book_id),
    borrow_date date,
    due_date date,
    return_date date,
    status varchar(50)
);

-- 登录信息表
CREATE TABLE login_info (
    reader_id varchar(255) PRIMARY KEY REFERENCES readers (reader_id),
    nickname varchar(255) DEFAULT reader_id,
    salt varchar(255),
    PASSWORD VARCHAR(255) DEFAULT reader_id,
    is_admin boolean DEFAULT FALSE,
    login_time timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

-- 推荐历史记录表
CREATE TABLE recommendation_history (
    recommendation_id serial PRIMARY KEY,
    reader_id varchar(255) REFERENCES readers (reader_id),
    model_used varchar(50),
    recommended_book_title text,
    recommended_book_author text,
    recommendation_reason text,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

-- 推荐反馈表
CREATE TABLE recommendation_feedback (
    feedback_id serial PRIMARY KEY,
    reader_id varchar(255) REFERENCES readers (reader_id),
    book_id varchar(255) REFERENCES books (book_id),
    feedback varchar(10) CHECK (feedback IN ('like', 'dislike')),
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

-- 收藏表
CREATE TABLE favorites (
    favorite_id serial PRIMARY KEY,
    reader_id varchar(255) REFERENCES readers (reader_id),
    book_id varchar(255) REFERENCES books (book_id),
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (reader_id, book_id)
);

-- 评论表
CREATE TABLE reviews (
    review_id serial PRIMARY KEY,
    book_id varchar(255) REFERENCES books (book_id),
    reader_id varchar(255) REFERENCES readers (reader_id),
    rating int CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

-- books 表索引
CREATE INDEX idx_books_title ON books (title);

CREATE INDEX idx_books_author ON books (author);

CREATE INDEX idx_books_publisher ON books (publisher);

CREATE INDEX idx_books_call_no ON books (call_no);

CREATE INDEX idx_books_language ON books (
LANGUAGE);

CREATE INDEX idx_books_doc_type ON books (doc_type);

CREATE INDEX idx_books_publication_year ON books (publication_year);

CREATE INDEX idx_books_author_title ON books (author, title);

-- readers 表索引
CREATE INDEX idx_readers_department ON readers (department);

CREATE INDEX idx_readers_reader_type ON readers (reader_type);

CREATE INDEX idx_readers_gender ON readers (gender);

CREATE INDEX idx_readers_enroll_year ON readers (enroll_year);

CREATE INDEX idx_readers_type_department ON readers (reader_type, department);

-- borrow_records 表索引
CREATE INDEX idx_borrow_records_reader_id ON borrow_records (reader_id);

CREATE INDEX idx_borrow_records_book_id ON borrow_records (book_id);

CREATE INDEX idx_borrow_records_borrow_date ON borrow_records (borrow_date);

CREATE INDEX idx_borrow_records_return_date ON borrow_records (return_date);

CREATE INDEX idx_borrow_records_due_date ON borrow_records (due_date);

CREATE INDEX idx_borrow_records_status ON borrow_records (status);

CREATE INDEX idx_borrow_records_reader_date ON borrow_records (reader_id, borrow_date);

CREATE INDEX idx_borrow_records_book_date ON borrow_records (book_id, borrow_date);

CREATE INDEX idx_borrow_records_status_date ON borrow_records (status, borrow_date);

-- login_info 表索引
CREATE INDEX idx_login_info_login_time ON login_info (login_time);

CREATE INDEX idx_login_info_nickname ON login_info (nickname);

-- recommendation_history 表索引
CREATE INDEX idx_recommendation_history_reader_id ON recommendation_history (reader_id);

CREATE INDEX idx_recommendation_history_created_at ON recommendation_history (created_at);

CREATE INDEX idx_recommendation_history_model ON recommendation_history (model_used);

-- recommendation_feedback 表索引
CREATE INDEX idx_recommendation_feedback_reader_id ON recommendation_feedback (reader_id);

CREATE INDEX idx_recommendation_feedback_book_id ON recommendation_feedback (book_id);

-- favorites 表索引
CREATE INDEX idx_favorites_reader_id ON favorites (reader_id);

CREATE INDEX idx_favorites_book_id ON favorites (book_id);

-- reviews 表索引
CREATE INDEX idx_reviews_book_id ON reviews (book_id);

CREATE INDEX idx_reviews_reader_id ON reviews (reader_id);

-- 额外的复合索引优化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_borrow_stats ON borrow_records (reader_id, status, borrow_date);

CREATE INDEX idx_books_title_trgm ON books USING gin (title gin_trgm_ops);

CREATE INDEX idx_books_author_trgm ON books USING gin (author gin_trgm_ops);

CREATE INDEX idx_books_publisher_trgm ON books USING gin (publisher gin_trgm_ops);

-- 通用视图
CREATE VIEW user_reading_history AS
SELECT
    br.reader_id,
    b.book_id,
    b.title,
    b.author,
    b.publisher,
    b.publication_year,
    br.borrow_date,
    br.due_date,
    br.return_date,
    br.status,
    CASE WHEN br.return_date IS NULL
        AND br.due_date < CURRENT_DATE THEN
        '已逾期'
    ELSE
        br.status
    END AS effective_status
FROM
    borrow_records br
    JOIN books b ON br.book_id = b.book_id;

-- 读者借阅统计视图
CREATE VIEW reader_borrow_stats AS
SELECT
    r.reader_id,
    r.gender,
    r.enroll_year,
    r.reader_type,
    r.department,
    COUNT(br.borrow_id) AS total_borrows,
    COUNT(
        CASE WHEN br.return_date IS NULL
            AND br.due_date < CURRENT_DATE THEN
            1
        END) AS overdue_count,
    COUNT(
        CASE WHEN br.return_date IS NOT NULL THEN
            1
        END) AS returned_count,
    COUNT(
        CASE WHEN br.return_date IS NULL THEN
            1
        END) AS current_borrows
FROM
    readers r
    LEFT JOIN borrow_records br ON r.reader_id = br.reader_id
GROUP BY
    r.reader_id,
    r.gender,
    r.enroll_year,
    r.reader_type,
    r.department;

-- 图书借阅统计视图
CREATE VIEW book_borrow_stats AS
SELECT
    b.book_id,
    b.title,
    b.author,
    b.publisher,
    b.publication_year,
    b.call_no,
    b.language,
    b.doc_type,
    COUNT(br.borrow_id) AS total_borrows,
    COUNT(
        CASE WHEN br.return_date IS NULL THEN
            1
        END) AS current_borrows,
    COUNT(
        CASE WHEN br.return_date IS NULL
            AND br.due_date < CURRENT_DATE THEN
            1
        END) AS overdue_count,
    MAX(br.borrow_date) AS last_borrow_date,
    MAX(
        CASE WHEN br.return_date IS NOT NULL THEN
            br.return_date
        END) AS last_return_date
FROM
    books b
    LEFT JOIN borrow_records br ON b.book_id = br.book_id
GROUP BY
    b.book_id,
    b.title,
    b.author,
    b.publisher,
    b.publication_year,
    b.call_no,
    b.language,
    b.doc_type;

-- 逾期记录视图
CREATE VIEW overdue_records AS
SELECT
    br.borrow_id,
    br.reader_id,
    br.book_id,
    b.title,
    b.author,
    r.department,
    r.reader_type,
    br.borrow_date,
    br.due_date,
    CURRENT_DATE - br.due_date AS overdue_days
FROM
    borrow_records br
    JOIN books b ON br.book_id = b.book_id
    JOIN readers r ON br.reader_id = r.reader_id
WHERE
    br.return_date IS NULL
    AND br.due_date < CURRENT_DATE;

-- 热门图书视图
CREATE VIEW popular_books AS
SELECT
    b.book_id,
    b.title,
    b.author,
    b.publisher,
    b.doc_type,
    COUNT(br.borrow_id) AS borrow_count,
    AVG(
        CASE WHEN br.return_date IS NOT NULL THEN
            br.return_date - br.borrow_date
        ELSE
            NULL
        END) AS avg_borrow_days
FROM
    books b
    JOIN borrow_records br ON b.book_id = br.book_id
GROUP BY
    b.book_id,
    b.title,
    b.author,
    b.publisher,
    b.doc_type
ORDER BY
    borrow_count DESC;

-- 当前借阅视图
CREATE VIEW current_borrows AS
SELECT
    br.borrow_id,
    br.reader_id,
    r.department,
    r.reader_type,
    br.book_id,
    b.title,
    b.author,
    b.call_no,
    br.borrow_date,
    br.due_date,
    CURRENT_DATE - br.due_date AS days_to_due,
    CASE WHEN br.due_date < CURRENT_DATE THEN
        '已逾期'
    WHEN br.due_date = CURRENT_DATE THEN
        '今日到期'
    ELSE
        '正常借阅'
    END AS status_detail
FROM
    borrow_records br
    JOIN books b ON br.book_id = b.book_id
    JOIN readers r ON br.reader_id = r.reader_id
WHERE
    br.return_date IS NULL;

-- 借阅趋势视图
CREATE VIEW monthly_borrow_trends AS
SELECT
    DATE_TRUNC('month', borrow_date) AS borrow_month,
    COUNT(*) AS monthly_borrows,
    COUNT(
        CASE WHEN status = '已归还' THEN
            1
        END) AS monthly_returns,
    COUNT(
        CASE WHEN return_date IS NULL
            AND due_date < CURRENT_DATE THEN
            1
        END) AS monthly_overdues
FROM
    borrow_records
GROUP BY
    DATE_TRUNC('month', borrow_date)
ORDER BY
    borrow_month DESC;

-- 学院借阅统计视图
CREATE VIEW department_borrow_stats AS
SELECT
    r.department,
    r.reader_type,
    COUNT(br.borrow_id) AS total_borrows,
    COUNT(
        CASE WHEN br.return_date IS NULL
            AND br.due_date < CURRENT_DATE THEN
            1
        END) AS overdue_count,
    COUNT(
        CASE WHEN br.return_date IS NULL THEN
            1
        END) AS current_borrows,
    AVG(
        CASE WHEN br.return_date IS NOT NULL THEN
            br.return_date - br.borrow_date
        ELSE
            NULL
        END) AS avg_borrow_duration
FROM
    readers r
    LEFT JOIN borrow_records br ON r.reader_id = br.reader_id
GROUP BY
    r.department,
    r.reader_type;

-- 图书类型统计视图
CREATE VIEW book_type_stats AS
SELECT
    doc_type,
    LANGUAGE,
    COUNT(*) AS total_books,
    COUNT(borrowed.book_id) AS borrowed_count,
    COUNT(*) - COUNT(borrowed.book_id) AS available_count
FROM
    books b
    LEFT JOIN ( SELECT DISTINCT
            book_id
        FROM
            borrow_records
        WHERE
            return_date IS NULL) borrowed ON b.book_id = borrowed.book_id
GROUP BY
    doc_type,
    LANGUAGE;

-- 读者活跃度视图
CREATE VIEW reader_activity AS
SELECT
    r.reader_id,
    r.department,
    r.reader_type,
    r.enroll_year,
    COUNT(br.borrow_id) AS total_borrows,
    MAX(br.borrow_date) AS last_borrow_date,
    MIN(br.borrow_date) AS first_borrow_date,
    COUNT(
        CASE WHEN br.borrow_date >= CURRENT_DATE - INTERVAL '30 days' THEN
            1
        END) AS recent_30days_borrows,
    COUNT(
        CASE WHEN br.borrow_date >= CURRENT_DATE - INTERVAL '90 days' THEN
            1
        END) AS recent_90days_borrows
FROM
    readers r
    LEFT JOIN borrow_records br ON r.reader_id = br.reader_id
GROUP BY
    r.reader_id,
    r.department,
    r.reader_type,
    r.enroll_year;
    