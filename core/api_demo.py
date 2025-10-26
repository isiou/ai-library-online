import json
import time
from src.query.library_query import LibraryQuery, CachedLibraryQuery


def pretty_print(data):
    """
    以格式化的 JSON 形式打印数据
    """
    if isinstance(data, str):
        print(data)
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def run_demonstration(reader_id):
    """
    接口示例
    """

    # 基础查询接口
    with LibraryQuery() as query:
        # 获取读者信息
        print("\n调用 get_reader_info 获取读者信息")
        reader_info = query.get_reader_info(reader_id)
        pretty_print(reader_info)

        # 获取所有图书分页
        print("\n调用 get_all_books 获取所有图书分页")
        all_books = query.get_all_books(page=1, limit=20)
        pretty_print(all_books)

        # 使用关键词搜索图书
        print("\n调用 search_books 搜索图书")
        searched_books = query.search_books(search="计算机", limit=20)
        pretty_print(searched_books)

    # 核心业务接口
    with LibraryQuery() as query:
        # 获取读者借阅历史
        print("\n调用 get_reader_borrow_history 获取读者借阅历史")
        history = query.get_reader_borrow_history(reader_id, limit=10)
        pretty_print(history)

        # 获取读者统计信息
        print("\n调用 get_reader_statistics 获取读者统计信息")
        stats = query.get_reader_statistics(reader_id)
        pretty_print(stats)

        # 获取完整的字典结构化数据
        print("\n调用 get_reader_history_data 获取完整的字典结构化数据")
        data_dict = query.get_reader_history_data(reader_id, limit=5)
        pretty_print(data_dict)

        # 获取完整的 JSON 结构化数据
        print("\n调用 get_reader_history_json 获取完整的 JSON 结构化数据")
        data_json = query.get_reader_history_json(reader_id, limit=5)
        pretty_print(data_json)

    # 缓存插叙接口
    with CachedLibraryQuery() as cached_query:
        print("\n无缓存查询")
        start_time = time.time()
        cached_query.get_reader_history_data(reader_id, limit=10)
        end_time = time.time()
        print(f"耗时: {(end_time - start_time) * 1000:.2f}ms")

        print("\n命中缓存查询")
        start_time = time.time()
        cached_query.get_reader_history_data(reader_id, limit=10)
        end_time = time.time()
        print(f"耗时: {(end_time - start_time) * 1000:.2f}ms")

    print()


def test_main():
    try:
        # 示例
        reader_id = "PCSCS19139"

        # run_demonstration(reader_id)

        with LibraryQuery() as query:
            data_json = query.get_reader_history_json(reader_id, limit=5)
            pretty_print(data_json)

    except Exception as e:
        print(f"\n脚本运行时发生错误: {e}")


if __name__ == "__main__":
    test_main()
