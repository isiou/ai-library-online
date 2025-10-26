from .library_query import LibraryQuery


def get_readers_borrow_records(reader_id: str, limit: int):
    """
    获取指定读者的借阅记录
    """
    try:
        with LibraryQuery() as query:
            result_data = query.get_reader_history_data(reader_id, limit)

        if result_data.get("success"):
            records = result_data.get("data", {}).get("borrow_records", [])
            if not records:
                print(f"未找到读者 {reader_id} 的借阅记录")
                return

            for record in records:
                print(
                    f'"{record.get("book_title", "N/A")}","{record.get("author", "N/A")}"'
                )
        else:
            print(f"错误: 查询失败 -> {result_data.get('message', '未知错误')}")

    except Exception as e:
        print(f"发生未知错误 -> {e}")


if __name__ == "__main__":
    reader_id_to_query = "PCSCS19139"
    limit_of_records = 10

    print(f"正在获取读者 {reader_id_to_query} 的借阅记录...")
    get_readers_borrow_records(reader_id_to_query, limit_of_records)
