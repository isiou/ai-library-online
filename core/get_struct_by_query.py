from src.query.library_query import LibraryQuery


def main(reader_id: str, limit: int = 10):
    """
    获取指定读者的最近借阅书籍列表
    """
    try:
        with LibraryQuery() as query:
            # 获取借阅历史
            borrow_history = query.get_reader_borrow_history(reader_id, limit)

            # 转为 call 需要的格式
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


if __name__ == "__main__":
    # 测试用户
    reader_id = "PCSCS19139"
    result = main("PCSCS19139", 5)

    print(f"读者 {reader_id} 的最近借阅书籍: ")
    for i, book in enumerate(result):
        print(f"NO{i}. {book['title']} - {book['author']}")
