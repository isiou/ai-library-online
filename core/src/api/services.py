from .models import Reader, Book, BorrowRecord, RecommendationHistory
from . import db
from sqlalchemy import or_, func


def get_reader_info(reader_id: str):
    """
    使用 SQLAlchemy ORM 检索读者信息
    """
    return db.session.get(Reader, reader_id)


def get_all_books(
    page: int = 1, limit: int = 20, sort_by: str = "title", sort_order: str = "asc"
):
    """
    使用 SQLAlchemy ORM 检索所有图书的分页列表
    """
    sort_column = getattr(Book, sort_by, Book.title)
    order = sort_column.desc() if sort_order.lower() == "desc" else sort_column.asc()

    pagination = Book.query.order_by(order).paginate(
        page=page, per_page=limit, error_out=False
    )

    return {
        "books": pagination.items,
        "pagination": {
            "page": pagination.page,
            "limit": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        },
    }


def search_books(
    search: str = "",
    language: str = "",
    year: int = None,
    publisher: str = "",
    author: str = "",
    page: int = 1,
    limit: int = 20,
):
    """
    使用 SQLAlchemy ORM 根据多个条件搜索图书
    """
    query = Book.query

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_term),
                Book.author.ilike(search_term),
                Book.call_no.ilike(search_term),
            )
        )
    if language:
        query = query.filter(Book.language == language)
    if year:
        query = query.filter(Book.publication_year == year)
    if publisher:
        query = query.filter(Book.publisher.ilike(f"%{publisher}%"))
    if author:
        query = query.filter(Book.author.ilike(f"%{author}%"))

    pagination = query.order_by(Book.title.asc()).paginate(
        page=page, per_page=limit, error_out=False
    )

    return {
        "books": pagination.items,
        "pagination": {
            "page": pagination.page,
            "limit": pagination.per_page,
            "total": pagination.total,
            "total_pages": pagination.pages,
        },
    }


def get_reader_borrow_history(reader_id: str, limit: int = 10):
    """
    检索指定读者的借阅历史
    """
    records = (
        BorrowRecord.query.filter_by(reader_id=reader_id)
        .options(db.joinedload(BorrowRecord.book))
        .order_by(BorrowRecord.borrow_date.desc())
        .limit(limit)
        .all()
    )
    return records


def get_reader_statistics(reader_id: str):
    """
    检索指定读者的借阅统计信息
    """
    total_records = (
        db.session.query(func.count(BorrowRecord.borrow_id))
        .filter_by(reader_id=reader_id)
        .scalar()
    )
    unique_books = (
        db.session.query(func.count(db.distinct(BorrowRecord.book_id)))
        .filter_by(reader_id=reader_id)
        .scalar()
    )

    status_counts = (
        db.session.query(BorrowRecord.status, func.count(BorrowRecord.status))
        .filter_by(reader_id=reader_id)
        .group_by(BorrowRecord.status)
        .all()
    )

    status_dict = {status: count for status, count in status_counts}

    return {
        "total_records": total_records or 0,
        "unique_books": unique_books or 0,
        "status_count": status_dict,
    }


def get_reader_full_history(reader_id: str, limit: int = 10):
    """
    检索读者的完整历史记录，包括个人信息、借阅记录和统计数据
    """
    reader_info = get_reader_info(reader_id)
    if not reader_info:
        return None

    borrow_records = get_reader_borrow_history(reader_id, limit)
    statistics = get_reader_statistics(reader_id)

    return {
        "reader_info": reader_info,
        "borrow_records": borrow_records,
        "statistics": statistics,
    }


def get_recommendation_history(reader_id: str, limit: int = 10):
    """
    检索指定读者的推荐历史
    """
    records = (
        RecommendationHistory.query.filter_by(reader_id=reader_id)
        .order_by(RecommendationHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return records
