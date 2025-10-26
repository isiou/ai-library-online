from typing import Optional, Any, Dict
from .database_connection import DatabaseConnection


class BaseQuery:
    """
    查询基类
    """

    def __init__(self):
        self.db = DatabaseConnection()

    def __enter__(self):
        self.db.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.db.disconnect()

    def get_reader_info(self, reader_id: str) -> Optional[Dict[str, Any]]:
        """
        根据读者 ID 获取读者信息
        """
        query = "SELECT reader_id, department, reader_type, enroll_year, gender FROM readers WHERE reader_id = %s"
        return self.db.execute_single_query(query, (reader_id,))

    def get_all_books(
        self,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "title",
        sort_order: str = "ASC",
    ) -> Dict[str, Any]:
        """
        检索所有图书的分页列表
        """
        offset = (page - 1) * limit
        valid_sort_fields = [
            "title",
            "author",
            "publication_year",
            "publisher",
            "call_no",
        ]
        sort_by = sort_by.lower() if sort_by.lower() in valid_sort_fields else "title"
        sort_order = (
            sort_order.upper() if sort_order.upper() in ["ASC", "DESC"] else "ASC"
        )

        count_query = "SELECT COUNT(*) as count FROM books"
        total_result = self.db.execute_single_query(count_query)
        total = total_result["count"] if total_result else 0

        query = f"""
            SELECT book_id, title, author, publisher, publication_year, call_no, language, doc_type
            FROM books
            ORDER BY {sort_by} {sort_order}
            LIMIT %s OFFSET %s
        """
        books = self.db.execute_query(query, (limit, offset))

        return {
            "books": books,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit,
            },
        }

    def search_books(
        self,
        search: str = "",
        language: str = "",
        year: int = None,
        publisher: str = "",
        author: str = "",
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        根据多个条件搜索图书
        """
        offset = (page - 1) * limit
        where_conditions = []
        params = []

        if search:
            where_conditions.append(
                "(title ILIKE %s OR author ILIKE %s OR call_no ILIKE %s)"
            )
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        if language:
            where_conditions.append("language = %s")
            params.append(language)
        if year:
            where_conditions.append("publication_year = %s")
            params.append(year)
        if publisher:
            where_conditions.append("publisher ILIKE %s")
            params.append(f"%{publisher}%")
        if author:
            where_conditions.append("author ILIKE %s")
            params.append(f"%{author}%")

        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"

        count_query = f"SELECT COUNT(*) as count FROM books WHERE {where_clause}"
        total_result = self.db.execute_single_query(count_query, tuple(params))
        total = total_result["count"] if total_result else 0

        query = f"""
            SELECT book_id, title, author, publisher, publication_year, call_no, language, doc_type
            FROM books
            WHERE {where_clause}
            ORDER BY title ASC
            LIMIT %s OFFSET %s
        """
        books = self.db.execute_query(query, tuple(params + [limit, offset]))

        return {
            "books": books,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit,
            },
        }
