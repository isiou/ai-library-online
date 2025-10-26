const { Pool, types } = require("pg");
const config = require("./config");

// PostgreSQL 类型转换
// 1114 -> TIMESTAMP WITHOUT TIME ZONE
// 1184 -> TIMESTAMP WITH TIME ZONE
// 1082 -> DATE
types.setTypeParser(1114, (str) => new Date(str));
types.setTypeParser(1184, (str) => new Date(str));
types.setTypeParser(1082, (str) => new Date(str));

const pool = new Pool(config.db);

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
};
