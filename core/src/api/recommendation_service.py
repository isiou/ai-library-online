from typing import Dict, Any
from .recommendation_client import get_recommendation_client
from ..query.library_query import LibraryQuery
from . import db
from .models import RecommendationHistory


def get_reader_recent_books(reader_id: str, limit: int = 10) -> list:
    """
    获取指定读者的最近借阅书籍列表
    """
    try:
        with LibraryQuery() as query:
            borrow_history = query.get_reader_borrow_history(reader_id, limit)
            recent_books = []
            for record in borrow_history:
                book_info = {
                    "title": record.get("book_title", ""),
                    "author": record.get("author", ""),
                }
                recent_books.append(book_info)
            return recent_books
    except Exception as e:
        print(f"查询读者借阅历史时出错: {e}")
        return []


def get_book_recommendations(
    reader_id: str, model: str = "ollama", query: str = "", count: int = 5
) -> Dict[str, Any]:
    """
    获取图书推荐的统一接口

    Args:
        reader_id (str): 读者 ID
        model (str): 使用的模型
        query (str): 搜索关键词
        count (int): 推荐数量

    Returns:
        Dict: 包含推荐结果的响应
    """
    # 获取用户的借阅历史记录，支持混合推荐模式
    recent_books = get_reader_recent_books(reader_id, limit=10)

    try:
        client = get_recommendation_client(model)
        # 传递历史记录、关键词和数量参数
        recommendations = client.get_recommendations(recent_books, query, count)

        if recommendations:
            for rec in recommendations:
                history_record = RecommendationHistory(
                    reader_id=reader_id,
                    model_used=model,
                    recommended_book_title=rec.get("title"),
                    recommended_book_author=rec.get("author"),
                    recommendation_reason=rec.get("reason"),
                )
                db.session.add(history_record)
            db.session.commit()

        return {
            "success": True if recommendations else False,
            "reader_id": reader_id,
            "model_used": model,
            "query": query,
            "has_history": len(recent_books) > 0,
            "recommendations_count": len(recommendations),
            "recommendations": recommendations,
        }
    except (ValueError, Exception) as e:
        db.session.rollback()
        return {
            "success": False,
            "reader_id": reader_id,
            "model_used": model,
            "query": query,
            "has_history": len(recent_books) > 0,
            "recommendations_count": 0,
            "recommendations": [],
            "error": str(e),
        }
