from flask_restx import Namespace, Resource, fields, reqparse
from .services import (
    get_reader_info,
    get_all_books,
    search_books,
    get_reader_full_history,
    get_reader_borrow_history,
    get_recommendation_history,
)
from .recommendation_service import get_book_recommendations
from src.clean.clean_books_csv import main as clean_books_main
from src.clean.clean_readers_csv import main as clean_readers_main
from src.virtual.virtual_borrow_records import main as virtual_borrow_main
from .auth import require_api_key

# 用于数据查询的命名空间
query_ns = Namespace("查询", description="数据查询操作")

# 用于数据处理的命名空间
ops_ns = Namespace("操作", description="数据处理与生成操作")

# 序列化模型
reader_model = query_ns.model(
    "读者",
    {
        "reader_id": fields.String(required=True, description="读者 ID"),
        "gender": fields.String(description="性别"),
        "enroll_year": fields.Integer(description="入学年份"),
        "reader_type": fields.String(description="读者类型"),
        "department": fields.String(description="院系"),
    },
)

book_model = query_ns.model(
    "书籍",
    {
        "book_id": fields.String(required=True, description="书籍 ID"),
        "title": fields.String(description="书名"),
        "author": fields.String(description="作者"),
        "publisher": fields.String(description="出版社"),
        "publication_year": fields.Integer(description="出版年份"),
        "call_no": fields.String(description="索书号"),
        "language": fields.String(description="语言"),
        "doc_type": fields.String(description="文献类型"),
    },
)

borrow_record_model = query_ns.model(
    "借阅记录",
    {
        "borrow_id": fields.String(required=True, description="借阅记录 ID"),
        "borrow_date": fields.Date(description="借阅日期"),
        "due_date": fields.Date(description="应还日期"),
        "return_date": fields.Date(description="归还日期"),
        "status": fields.String(description="借阅状态"),
        "book": fields.Nested(book_model, description="书籍信息"),
    },
)

statistics_model = query_ns.model(
    "统计",
    {
        "total_records": fields.Integer(description="总借阅记录数"),
        "unique_books": fields.Integer(description="借阅过的不同书籍数量"),
        "status_count": fields.Raw(
            description='按状态统计的记录数，例如: {"已归还": 10, "借阅中": 2}'
        ),
    },
)

full_history_model = query_ns.model(
    "完整历史",
    {
        "reader_info": fields.Nested(reader_model, description="读者个人信息"),
        "borrow_records": fields.List(
            fields.Nested(borrow_record_model), description="借阅记录列表"
        ),
        "statistics": fields.Nested(statistics_model, description="借阅统计数据"),
    },
)

pagination_model = query_ns.model(
    "分页",
    {
        "page": fields.Integer(description="当前页码"),
        "limit": fields.Integer(description="每页项数"),
        "total": fields.Integer(description="总项数"),
        "total_pages": fields.Integer(description="总页数"),
    },
)

book_list_model = query_ns.model(
    "书籍列表",
    {
        "books": fields.List(fields.Nested(book_model)),
        "pagination": fields.Nested(pagination_model),
    },
)

# 推荐相关模型
recommendation_model = query_ns.model(
    "推荐",
    {
        "title": fields.String(description="推荐书籍标题"),
        "author": fields.String(description="推荐书籍作者"),
        "introduction": fields.String(description="书籍简介"),
        "reason": fields.String(description="推荐理由"),
    },
)

recommendation_response_model = query_ns.model(
    "推荐响应",
    {
        "success": fields.Boolean(description="推荐是否成功"),
        "reader_id": fields.String(description="读者 ID"),
        "model_used": fields.String(description="调用的模型"),
        "recommendations_count": fields.Integer(description="推荐书籍数量"),
        "recommendations": fields.List(
            fields.Nested(recommendation_model), description="推荐书籍列表"
        ),
    },
)

recommendation_history_model = query_ns.model(
    "推荐历史",
    {
        "recommendation_id": fields.Integer(description="推荐记录 ID"),
        "reader_id": fields.String(description="读者 ID"),
        "model_used": fields.String(description="使用的模型"),
        "recommended_book_title": fields.String(description="推荐书籍标题"),
        "recommended_book_author": fields.String(description="推荐书籍作者"),
        "recommendation_reason": fields.String(description="推荐理由"),
        "created_at": fields.DateTime(description="推荐时间"),
    },
)


# 解析器
book_list_parser = reqparse.RequestParser()
book_list_parser.add_argument("page", type=int, default=1, help="页码")
book_list_parser.add_argument("limit", type=int, default=20, help="每页项数")
book_list_parser.add_argument("sort_by", type=str, default="title", help="排序字段")
book_list_parser.add_argument(
    "sort_order", type=str, default="asc", help="排序顺序 asc/desc"
)

book_search_parser = reqparse.RequestParser()
book_search_parser.add_argument(
    "search", type=str, default="", help="用于书名、作者、索书号的通用搜索词"
)
book_search_parser.add_argument("language", type=str, help="按语言筛选")
book_search_parser.add_argument("year", type=int, help="按出版年份筛选")
book_search_parser.add_argument("publisher", type=str, help="按出版社筛选")
book_search_parser.add_argument("author", type=str, help="按作者筛选")
book_search_parser.add_argument("page", type=int, default=1, help="页码")
book_search_parser.add_argument("limit", type=int, default=20, help="每页项数")

history_parser = reqparse.RequestParser()
history_parser.add_argument("limit", type=int, default=10, help="要返回的记录数量")

recommendation_parser = reqparse.RequestParser()
recommendation_parser.add_argument(
    "model", type=str, default="ollama", help="模型选择 ollama/gemini"
)
recommendation_parser.add_argument("limit", type=int, default=10, help="推荐数量")
recommendation_parser.add_argument("query", type=str, default="", help="推荐关键词")


# 路由
@query_ns.route("/readers/<string:reader_id>")
@query_ns.param("reader_id", "读者标识符")
class ReaderResource(Resource):
    @query_ns.doc("get_reader")
    @query_ns.marshal_with(reader_model)
    @query_ns.response(404, "未找到读者")
    def get(self, reader_id):
        """
        根据读者标识符获取读者信息
        """
        reader = get_reader_info(reader_id)
        if not reader:
            query_ns.abort(404, f"未找到 ID 为 '{reader_id}' 的读者")
        return reader


@query_ns.route("/readers/<string:reader_id>/history")
@query_ns.param("reader_id", "读者标识符")
class ReaderHistoryResource(Resource):
    @query_ns.doc("get_reader_borrow_history")
    @query_ns.expect(history_parser)
    @query_ns.marshal_list_with(borrow_record_model)
    @query_ns.response(404, "未找到读者")
    def get(self, reader_id):
        """
        获取指定读者的近期借阅历史记录
        """
        args = history_parser.parse_args()

        reader = get_reader_info(reader_id)
        if not reader:
            query_ns.abort(404, f"未找到 ID 为 '{reader_id}' 的读者")

        records = get_reader_borrow_history(reader_id, limit=args["limit"])
        return records


@query_ns.route("/readers/<string:reader_id>/full-history")
@query_ns.param("reader_id", "读者标识符")
class ReaderFullHistoryResource(Resource):
    @query_ns.doc("get_reader_full_history")
    @query_ns.expect(history_parser)
    @query_ns.marshal_with(full_history_model)
    @query_ns.response(404, "未找到读者")
    def get(self, reader_id):
        """
        获取读者的完整历史记录，包括个人信息、借阅记录和统计数据
        """
        args = history_parser.parse_args()
        history_data = get_reader_full_history(reader_id, limit=args["limit"])
        if not history_data:
            query_ns.abort(404, f"未找到 ID 为 '{reader_id}' 的读者")
        return history_data


@query_ns.route("/readers/<string:reader_id>/recommendations")
@query_ns.param("reader_id", "读者标识符")
class ReaderRecommendationsResource(Resource):
    @query_ns.doc("get_reader_recommendations")
    @query_ns.expect(recommendation_parser)
    @query_ns.marshal_with(recommendation_response_model)
    @query_ns.response(404, "未找到读者")
    @query_ns.response(500, "推荐服务出错")
    def get(self, reader_id):
        """
        基于关键词获取书籍推荐
        """
        args = recommendation_parser.parse_args()
        try:
            result = get_book_recommendations(
                reader_id=reader_id,
                model=args["model"],
                query=args["query"],
                count=args["limit"],
            )
            if not result["success"]:
                return {"message": "无法生成推荐，请检查关键词是否有效"}, 404
            return result
        except Exception as e:
            return {"message": f"推荐服务出错: {str(e)}"}, 500


@query_ns.route("/readers/<string:reader_id>/recommendation-history")
@query_ns.param("reader_id", "读者标识符")
class ReaderRecommendationHistoryResource(Resource):
    @query_ns.doc("get_recommendation_history")
    @query_ns.expect(history_parser)
    @query_ns.marshal_list_with(recommendation_history_model)
    @query_ns.response(404, "未找到读者")
    def get(self, reader_id):
        """
        获取指定读者的推荐历史记录
        """
        args = history_parser.parse_args()

        reader = get_reader_info(reader_id)
        if not reader:
            query_ns.abort(404, f"未找到 ID 为 '{reader_id}' 的读者")

        records = get_recommendation_history(reader_id, limit=args["limit"])
        return records


@query_ns.route("/books")
class BookListResource(Resource):
    @query_ns.doc("list_books")
    @query_ns.expect(book_list_parser)
    @query_ns.marshal_with(book_list_model)
    def get(self):
        """
        分页列出所有书籍
        """
        args = book_list_parser.parse_args()
        return get_all_books(
            page=args["page"],
            limit=args["limit"],
            sort_by=args["sort_by"],
            sort_order=args["sort_order"],
        )


@query_ns.route("/books/search")
class BookSearchResource(Resource):
    @query_ns.doc("search_books")
    @query_ns.expect(book_search_parser)
    @query_ns.marshal_with(book_list_model)
    def get(self):
        """
        根据多个条件搜索书籍
        """
        args = book_search_parser.parse_args()
        return search_books(**args)


# 数据处理
@ops_ns.route("/cleaning/books")
class CleanBooks(Resource):
    @ops_ns.doc("clean_books", security="apikey")
    @ops_ns.response(200, "成功清理书籍数据")
    @ops_ns.response(401, "未经授权")
    @ops_ns.response(500, "清理书籍数据时出错")
    @require_api_key
    def post(self):
        """
        触发书籍数据集的清理流程
        """
        try:
            clean_books_main()
            return {"message": "成功触发书籍数据清理"}, 200
        except Exception as e:
            return {"message": f"清理书籍数据时发生错误: {str(e)}"}, 500


@ops_ns.route("/cleaning/readers")
class CleanReaders(Resource):
    @ops_ns.doc("clean_readers", security="apikey")
    @ops_ns.response(200, "成功清理读者数据")
    @ops_ns.response(401, "未经授权")
    @ops_ns.response(500, "清理读者数据时出错")
    @require_api_key
    def post(self):
        """
        触发读者数据集的清理流程
        """
        try:
            clean_readers_main()
            return {"message": "成功触发读者数据清理"}, 200
        except Exception as e:
            return {"message": f"清理读者数据时发生错误: {str(e)}"}, 500


@ops_ns.route("/virtual/borrow-records")
class GenerateBorrowRecords(Resource):
    @ops_ns.doc("generate_borrow_records", security="apikey")
    @ops_ns.response(200, "成功生成虚拟借阅记录")
    @ops_ns.response(401, "未经授权")
    @ops_ns.response(500, "生成虚拟借阅记录时出错")
    @require_api_key
    def post(self):
        """
        触发虚拟借阅记录的生成流程
        """
        try:
            virtual_borrow_main()
            return {"message": "成功触发虚拟借阅记录的生成"}, 200
        except Exception as e:
            return {"message": f"生成虚拟借阅记录时发生错误: {str(e)}"}, 500
