import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict
from .config import Config


class DatabaseConnection:
    """
    统一数据库连接类
    """

    def __init__(self, config: Config = None):
        self.config = config or Config()
        self.conn = None
        if self.config.DB_TYPE != "postgresql":
            raise ValueError("仅适用于 PostgreSQL 数据库")

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

    def connect(self):
        """
        建立数据库连接
        """
        if self.conn is None:
            try:
                self.conn = psycopg2.connect(
                    host=self.config.DB_HOST,
                    port=self.config.DB_PORT,
                    database=self.config.DB_NAME,
                    user=self.config.DB_USER,
                    password=self.config.DB_PASSWORD,
                    cursor_factory=psycopg2.extras.RealDictCursor,
                )
            except psycopg2.Error as e:
                print(f"数据库连接失败: {e}")
                raise

    def disconnect(self):
        """
        关闭数据库连接
        """
        if self.conn:
            self.conn.close()
            self.conn = None

    def _execute(self, query: str, params: tuple = (), fetch: str = None):
        """
        用于执行查询的私有辅助方法
        """
        if self.conn is None:
            print("错误: 数据库未连接")
            return None
        try:
            with self.conn.cursor() as cursor:
                cursor.execute(query, params)
                if fetch == "one":
                    return cursor.fetchone()
                if fetch == "all":
                    return cursor.fetchall()
                self.conn.commit()
                return cursor.rowcount
        except psycopg2.Error as e:
            print(f"查询执行失败: {e}")
            self.conn.rollback()
            return None

    def execute_query(self, query: str, params: tuple = ()) -> Optional[List[Dict]]:
        """
        执行查询并以字典列表形式返回所有结果
        """
        results = self._execute(query, params, fetch="all")
        return results if results else []

    def execute_single_query(self, query: str, params: tuple = ()) -> Optional[Dict]:
        """
        执行查询并以单个字典形式返回结果
        """
        result = self._execute(query, params, fetch="one")
        return result if result else None

    def execute_insert(self, query: str, params: tuple = ()) -> bool:
        """
        执行插入操作若成功则返回 True
        """
        return self._execute(query, params) is not None

    def execute_batch_insert(self, query: str, params_list: List[tuple]) -> bool:
        """
        执行批量插入操作
        """
        if self.conn is None:
            print("错误: 数据库未连接")
            return False
        try:
            with self.conn.cursor() as cursor:
                psycopg2.extras.execute_batch(cursor, query, params_list)
                self.conn.commit()
                return True
        except psycopg2.Error as e:
            print(f"批量插入失败: {e}")
            self.conn.rollback()
            return False

    def test_connection(self) -> bool:
        """
        测试数据库连接
        """
        return self.execute_single_query("SELECT 1 as test") is not None
