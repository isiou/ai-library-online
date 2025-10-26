import json
from typing import Dict, Any, List
from .base_query import BaseQuery


class LibraryQuery(BaseQuery):
    """
    处理特定的图书馆查询包括借阅历史、统计信息并提供结构化的数据输出
    """

    def get_reader_borrow_history(self, reader_id: str, limit: int = 10) -> List[Dict]:
        """
        获取读者的借阅历史，包含书籍和读者的详细信息
        """
        query = """
            SELECT 
                br.borrow_id, br.reader_id, br.book_id, br.borrow_date, br.due_date,
                br.return_date, br.status,
                b.title as book_title, b.call_no, b.author, b.publisher, b.publication_year as publish_year,
                r.department as reader_department, r.reader_type as reader_type, r.enroll_year
            FROM borrow_records br
            JOIN books b ON br.book_id = b.book_id
            JOIN readers r ON br.reader_id = r.reader_id
            WHERE br.reader_id = %s
            ORDER BY br.borrow_date DESC
            LIMIT %s
        """
        return self.db.execute_query(query, (reader_id, limit))

    def get_reader_statistics(self, reader_id: str) -> Dict[str, Any]:
        """
        获取指定读者的借阅统计信息
        """
        stats_query = """
            SELECT 
                COUNT(*) as total_records, 
                COUNT(DISTINCT book_id) as unique_books
            FROM borrow_records 
            WHERE reader_id = %s
        """
        stats = self.db.execute_single_query(stats_query, (reader_id,)) or {}

        status_query = """
            SELECT status, COUNT(*) as count
            FROM borrow_records 
            WHERE reader_id = %s 
            GROUP BY status
        """
        status_result = self.db.execute_query(status_query, (reader_id,))
        status_count = {row["status"]: row["count"] for row in status_result}

        return {
            "total_records": int(stats.get("total_records", 0)),
            "unique_books": int(stats.get("unique_books", 0)),
            "status_count": status_count,
        }

    def get_reader_history_data(
        self, reader_id: str, limit: int = 10
    ) -> Dict[str, Any]:
        """
        获取完整的读者历史记录，包括个人信息、借阅记录和统计数据，并以字典形式返回
        """
        reader_info = self.get_reader_info(reader_id)
        if not reader_info:
            return {
                "success": False,
                "message": f"未找到读者 {reader_id}。",
                "data": None,
            }

        records = self.get_reader_borrow_history(reader_id, limit)
        statistics = self.get_reader_statistics(reader_id)

        return {
            "success": True,
            "message": "查询成功",
            "data": {
                "reader_info": reader_info,
                "borrow_records": records,
                "statistics": statistics,
            },
        }

    def get_reader_history_json(self, reader_id: str, limit: int = 10) -> str:
        """
        获取完整的读者历史记录，并以 JSON 字符串形式返回
        """
        data = self.get_reader_history_data(reader_id, limit)
        return json.dumps(data, ensure_ascii=False, default=str, indent=2)


class CachedLibraryQuery(LibraryQuery):
    """
    LibraryQuery 的缓存版本，用于加速重复查询
    """

    def __init__(self, cache_size: int = 100):
        super().__init__()
        self.cache_size = cache_size
        self._cache: Dict[str, Any] = {}
        self._access_order: list = []

    def _get_cache_key(self, reader_id: str, limit: int) -> str:
        return f"{reader_id}:{limit}"

    def _clean_cache(self):
        while len(self._cache) > self.cache_size:
            oldest_key = self._access_order.pop(0)
            if oldest_key in self._cache:
                del self._cache[oldest_key]

    def get_reader_history_data(
        self, reader_id: str, limit: int = 10
    ) -> Dict[str, Any]:
        """
        重写基类方法，在查询数据库前先检查缓存
        """
        cache_key = self._get_cache_key(reader_id, limit)
        if cache_key in self._cache:
            self._access_order.remove(cache_key)
            self._access_order.append(cache_key)
            return self._cache[cache_key]

        # 如果缓存未命中则调用父类方法
        result = super().get_reader_history_data(reader_id, limit)
        if result.get("success"):
            self._cache[cache_key] = result
            self._access_order.append(cache_key)
            self._clean_cache()
        return result
