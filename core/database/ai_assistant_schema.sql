CREATE TABLE ai_models (
    model_id serial PRIMARY KEY,
    model_name varchar(100) NOT NULL UNIQUE,
    model_type varchar(50) NOT NULL,
    endpoint_url text,
    api_key_encrypted text,
    model_config jsonb DEFAULT '{}',
    is_active boolean DEFAULT TRUE,
    max_tokens integer DEFAULT 4096,
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_sessions (
    session_id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    reader_id varchar(255) NOT NULL REFERENCES readers (reader_id),
    session_title varchar(255) DEFAULT '新对话',
    model_id integer REFERENCES ai_models (model_id),
    session_config jsonb DEFAULT '{}',
    is_active boolean DEFAULT TRUE,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    last_message_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    message_id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    session_id uuid NOT NULL REFERENCES chat_sessions (session_id) ON DELETE CASCADE,
    ROLE VARCHAR(20) NOT NULL CHECK (ROLE IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    content_type varchar(20) DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'json')),
    metadata jsonb DEFAULT '{}',
    parent_message_id uuid REFERENCES chat_messages (message_id),
    is_deleted boolean DEFAULT FALSE,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE message_feedback (
    feedback_id serial PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES chat_messages (message_id) ON DELETE CASCADE,
    reader_id varchar(255) NOT NULL REFERENCES readers (reader_id),
    feedback_type varchar(20) NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'report')),
    feedback_reason varchar(100),
    feedback_comment text,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_usage_stats (
    stat_id serial PRIMARY KEY,
    reader_id varchar(255) NOT NULL REFERENCES readers (reader_id),
    model_id integer REFERENCES ai_models (model_id),
    session_id uuid REFERENCES chat_sessions (session_id),
    usage_date date NOT NULL DEFAULT CURRENT_DATE,
    message_count integer DEFAULT 0,
    token_count integer DEFAULT 0,
    response_time_ms integer,
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_user_preferences (
    preference_id serial PRIMARY KEY,
    reader_id varchar(255) NOT NULL REFERENCES readers (reader_id) UNIQUE,
    preferred_model_id integer REFERENCES ai_models (model_id),
    default_temperature DECIMAL(3, 2) DEFAULT 0.7,
    max_tokens integer DEFAULT 4096,
    auto_title_generation boolean DEFAULT TRUE,
    message_history_limit integer DEFAULT 50,
    preferences jsonb DEFAULT '{}',
    created_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp WITH time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_sessions_reader_id ON chat_sessions (reader_id);

CREATE INDEX idx_chat_sessions_created_at ON chat_sessions (created_at);

CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions (last_message_at);

CREATE INDEX idx_chat_sessions_is_active ON chat_sessions (is_active);

CREATE INDEX idx_chat_messages_session_id ON chat_messages (session_id);

CREATE INDEX idx_chat_messages_created_at ON chat_messages (created_at);

CREATE INDEX idx_chat_messages_role ON chat_messages (ROLE);

CREATE INDEX idx_chat_messages_parent_id ON chat_messages (parent_message_id);

CREATE INDEX idx_message_feedback_message_id ON message_feedback (message_id);

CREATE INDEX idx_message_feedback_reader_id ON message_feedback (reader_id);

CREATE INDEX idx_ai_usage_stats_reader_id ON ai_usage_stats (reader_id);

CREATE INDEX idx_ai_usage_stats_usage_date ON ai_usage_stats (usage_date);

CREATE INDEX idx_ai_usage_stats_model_id ON ai_usage_stats (model_id);

CREATE INDEX idx_ai_models_is_active ON ai_models (is_active);

CREATE INDEX idx_ai_models_model_type ON ai_models (model_type);

CREATE INDEX idx_chat_messages_content_trgm ON chat_messages USING gin (content gin_trgm_ops);

CREATE VIEW chat_session_summary AS
SELECT
    cs.session_id,
    cs.reader_id,
    cs.session_title,
    cs.created_at,
    cs.last_message_at,
    cs.is_active,
    am.model_name,
    COUNT(cm.message_id) AS message_count,
    COUNT(
        CASE WHEN cm.role = 'user' THEN
            1
        END) AS user_message_count,
    COUNT(
        CASE WHEN cm.role = 'assistant' THEN
            1
        END) AS assistant_message_count
FROM
    chat_sessions cs
    LEFT JOIN ai_models am ON cs.model_id = am.model_id
    LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
        AND cm.is_deleted = FALSE
GROUP BY
    cs.session_id,
    cs.reader_id,
    cs.session_title,
    cs.created_at,
    cs.last_message_at,
    cs.is_active,
    am.model_name;

CREATE VIEW user_ai_usage_summary AS
SELECT
    r.reader_id,
    r.department,
    r.reader_type,
    COUNT(DISTINCT cs.session_id) AS total_sessions,
    COUNT(cm.message_id) AS total_messages,
    COUNT(
        CASE WHEN cm.role = 'user' THEN
            1
        END) AS user_messages,
    COUNT(
        CASE WHEN cm.role = 'assistant' THEN
            1
        END) AS assistant_messages,
    MAX(cs.last_message_at) AS last_activity,
    MIN(cs.created_at) AS first_activity
FROM
    readers r
    LEFT JOIN chat_sessions cs ON r.reader_id = cs.reader_id
    LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
        AND cm.is_deleted = FALSE
GROUP BY
    r.reader_id,
    r.department,
    r.reader_type;

CREATE VIEW model_usage_stats AS
SELECT
    am.model_id,
    am.model_name,
    am.model_type,
    COUNT(DISTINCT cs.session_id) AS session_count,
    COUNT(cm.message_id) AS message_count,
    AVG(aus.response_time_ms) AS avg_response_time,
    SUM(aus.token_count) AS total_tokens
FROM
    ai_models am
    LEFT JOIN chat_sessions cs ON am.model_id = cs.model_id
    LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id
        AND cm.role = 'assistant'
        AND cm.is_deleted = FALSE
    LEFT JOIN ai_usage_stats aus ON am.model_id = aus.model_id
WHERE
    am.is_active = TRUE
GROUP BY
    am.model_id,
    am.model_name,
    am.model_type;

INSERT INTO ai_models (model_name, model_type, endpoint_url, model_config, is_active)
    VALUES ('qwen3:1.7B', 'ollama', 'http://localhost:11434', '{"stream": true, "format": "json"}', FALSE);

CREATE OR REPLACE FUNCTION update_updated_at_column ()
    RETURNS TRIGGER
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$
LANGUAGE 'plpgsql';

CREATE TRIGGER update_ai_models_updated_at
    BEFORE UPDATE ON ai_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column ();

CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column ();

CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column ();

CREATE TRIGGER update_ai_user_preferences_updated_at
    BEFORE UPDATE ON ai_user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column ();

CREATE OR REPLACE FUNCTION update_session_last_message_time ()
    RETURNS TRIGGER
    AS $$
BEGIN
    UPDATE
        chat_sessions
    SET
        last_message_at = NEW.created_at
    WHERE
        session_id = NEW.session_id;
    RETURN NEW;
END;
$$
LANGUAGE 'plpgsql';

CREATE TRIGGER update_session_last_message_time_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_message_time ();
    