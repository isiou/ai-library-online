INSERT INTO
    readers (
        reader_id,
        gender,
        enroll_year,
        reader_type,
        department
    )
VALUES
    ('root', 'F', 2024, '系统管理员', '信息技术部') ON CONFLICT (reader_id) DO NOTHING;

INSERT INTO
    login_info (reader_id, nickname, is_admin)
VALUES
    ('root', '系统管理员', TRUE) ON CONFLICT (reader_id) DO
UPDATE
SET
    nickname = EXCLUDED.nickname,
    is_admin = EXCLUDED.is_admin,
    password = EXCLUDED.password,
    salt = EXCLUDED.salt;
    