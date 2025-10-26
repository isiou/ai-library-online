import time
from src.api.recommendation_service import get_book_recommendations


# 模型可更改为 ollama 或 gemini
def main(reader_id: str, limit: int = 10, model: str = "ollama"):
    recommendations = get_book_recommendations(reader_id, model, limit)
    return recommendations


if __name__ == "__main__":
    start_time = time.time()

    # 测试用户
    test_reader_id = "PCSCS19139"
    result = main(test_reader_id, 10, "ollama")

    if result and result.get("success"):
        print("推荐书籍: ")
        for i, book in enumerate(result.get("recommendations", [])):
            print(f"NO{i}. {book.get('title', '')} - {book.get('author', '')}")
            print(f"简介: {book.get('introduction', '')}")
            print(f"推荐理由: {book.get('reason', '')}")
            print()
    else:
        print(f"未能生成推荐书籍: {result.get('error', 'Unknown error')}")

    end_time = time.time()

    print(f"\n耗时: {(end_time - start_time) * 1000:.2f}ms")
