import time
import unittest
from src.query.library_query import LibraryQuery, CachedLibraryQuery


class TestLibraryQuery(unittest.TestCase):
    """
    LibraryQuery 和 CachedLibraryQuery 的测试套件
    """

    reader_id_to_test = "PCSCS19139"
    limit_to_test = 20

    def test_base_query_performance(self):
        """
        测试标准数据库查询的性能
        """
        print(f"\n测试基础查询")
        start_time = time.time()
        try:
            with LibraryQuery() as query:
                result = query.get_reader_history_data(
                    self.reader_id_to_test, self.limit_to_test
                )
                self.assertTrue(result.get("success"), "查询应该成功")
                self.assertIn(
                    "reader_info", result.get("data", {}), "结果应包含读者信息"
                )
        except Exception as e:
            self.fail(f"基础查询异常: {e}")
        end_time = time.time()
        print(f"查询耗时: {(end_time - start_time) * 1000:.2f}ms")

    def test_cached_query_performance(self):
        """
        测试带缓存的数据库查询的性能和正确性
        """
        print(f"\n测试缓存查询")
        try:
            with CachedLibraryQuery() as cached_query:
                # 调用数据库
                start_time = time.time()
                result1 = cached_query.get_reader_history_data(
                    self.reader_id_to_test, self.limit_to_test
                )
                end_time = time.time()
                print(f"无缓存查询耗时: {(end_time - start_time) * 1000:.2f}ms")
                self.assertTrue(result1.get("success"), "第一次查询应该成功")

                # 缓存命中耗时
                start_time = time.time()
                result2 = cached_query.get_reader_history_data(
                    self.reader_id_to_test, self.limit_to_test
                )
                end_time = time.time()
                print(f"缓存命中查询耗时: {(end_time - start_time) * 1000:.2f}ms")
                self.assertTrue(result2.get("success"), "第二次查询应该成功")

                # 验证缓存结果与第一次查询结果相同
                self.assertEqual(result1, result2, "两次查询结果应相同")
        except Exception as e:
            self.fail(f"缓存查询异常: {e}")


if __name__ == "__main__":
    unittest.main()
