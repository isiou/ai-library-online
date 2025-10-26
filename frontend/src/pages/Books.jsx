import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Card,
  Input,
  Button,
  Row,
  Col,
  List,
  Avatar,
  Tag,
  Space,
  Pagination,
  Select,
  Form,
  Drawer,
  Descriptions,
  message,
  Empty,
  Spin,
} from "antd";
import {
  SearchOutlined,
  BookOutlined,
  EyeOutlined,
  FilterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import useAppStore from "../stores/appStore";
import { bookAPI } from "../services/api";

const { Search } = Input;
const { Option } = Select;

const Books = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setPageTitle } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("popularity");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [filters, setFilters] = useState({});
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);

  const [form] = Form.useForm();
  const debounceTimer = useRef(null);

  useEffect(() => {
    setPageTitle("图书查询");
    loadInitialData();

    // 从 URL 参数恢复搜索状态
    const search = searchParams.get("search");
    const page = searchParams.get("page");
    const category = searchParams.get("category");
    const author = searchParams.get("author");

    if (search) setSearchText(search);
    if (page) setCurrent(parseInt(page));
    if (category || author) {
      const urlFilters = {};
      if (category) urlFilters.category = category;
      if (author) urlFilters.author = author;
      setFilters(urlFilters);
      form.setFieldsValue(urlFilters);
    }
  }, [setPageTitle, searchParams]);

  // 防抖处理搜索文本
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchText]);

  useEffect(() => {
    loadBooks();
  }, [current, pageSize, debouncedSearchText, filters, sortBy]);

  const loadInitialData = async () => {
    try {
      // 加载分类和作者列表
      const [categoriesRes, authorsRes] = await Promise.allSettled([
        bookAPI.getCategories(),
        bookAPI.getAuthors(),
      ]);

      if (categoriesRes.status === "fulfilled") {
        setCategories(categoriesRes.value.data || []);
      }
      if (authorsRes.status === "fulfilled") {
        setAuthors(authorsRes.value.data || []);
      }
    } catch (error) {
      console.error("加载初始数据失败: ", error);
    }
  };

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params = {
        page: current,
        limit: pageSize,
        search: debouncedSearchText,
        sortBy: sortBy,
        ...filters,
      };

      const response = await bookAPI.search(params);
      setBooks(response.books || []);
      setTotal(response.total || 0);

      // 更新 URL 参数
      const newSearchParams = new URLSearchParams();
      if (debouncedSearchText)
        newSearchParams.set("search", debouncedSearchText);
      if (current > 1) newSearchParams.set("page", current.toString());
      if (filters.category) newSearchParams.set("category", filters.category);
      if (filters.author) newSearchParams.set("author", filters.author);

      setSearchParams(newSearchParams);
    } catch (error) {
      message.error(
        "加载图书列表失败: " + (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setDebouncedSearchText(value);
    setCurrent(1);
  };

  const handleFilter = (values) => {
    setFilters(values);
    setCurrent(1);
    setFilterVisible(false);
  };

  const handleReset = () => {
    setSearchText("");
    setDebouncedSearchText("");
    setFilters({});
    setCurrent(1);
    form.resetFields();
    setFilterVisible(false);
  };

  const handlePageChange = (page, size) => {
    setCurrent(page);
    if (size !== pageSize) {
      setPageSize(size);
    }
  };

  const handleBookDetail = async (book) => {
    try {
      const response = await bookAPI.getDetail(book.book_id);
      setSelectedBook(response);
      setDetailVisible(true);
    } catch (error) {
      message.error(
        "加载图书详情失败: " + (error.response?.data?.message || error.message)
      );
    }
  };

  const getAvailabilityTag = (available, total) => {
    const ratio = available / total;
    let color = "red";
    let text = "无库存";

    if (available > 0) {
      if (ratio > 0.5) {
        color = "green";
        text = "充足";
      } else if (ratio > 0.2) {
        color = "orange";
        text = "紧张";
      } else {
        color = "red";
        text = "稀缺";
      }
    }

    return <Tag color={color}>{text}</Tag>;
  };

  return (
    <div>
      {/* 搜索和筛选区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={16} md={18}>
            <Search
              placeholder="搜索书名、作者、索书号..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Space style={{ width: "100%" }}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterVisible(true)}
              >
                筛选
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => loadBooks()}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 当前筛选条件显示 */}
        {(searchText || Object.keys(filters).length > 0) && (
          <div style={{ marginTop: 16 }}>
            <Space wrap>
              <span>当前筛选: </span>
              {searchText && (
                <Tag closable onClose={() => handleSearch("")}>
                  搜索: {searchText}
                </Tag>
              )}
              {filters.category && (
                <Tag
                  closable
                  onClose={() =>
                    setFilters({ ...filters, category: undefined })
                  }
                >
                  分类: {filters.category}
                </Tag>
              )}
              {filters.author && (
                <Tag
                  closable
                  onClose={() => setFilters({ ...filters, author: undefined })}
                >
                  作者: {filters.author}
                </Tag>
              )}
              <Button type="link" size="small" onClick={handleReset}>
                清除全部
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* 图书列表 */}
      <Card>
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span>共找到 {total} 本图书</span>
          <Space>
            <span>排序方式: </span>
            <Select
              value={sortBy}
              onChange={(value) => setSortBy(value)}
              style={{ width: 140 }}
            >
              <Option value="popularity">按热门程度</Option>
              <Option value="title">按书名</Option>
              <Option value="publication_year">按出版年份</Option>
            </Select>
            <Select
              value={pageSize}
              onChange={(value) => setPageSize(value)}
              style={{ width: 120 }}
            >
              <Option value={40}>40条/页</Option>
              <Option value={60}>60条/页</Option>
              <Option value={80}>80条/页</Option>
            </Select>
          </Space>
        </div>

        <div style={{ position: "relative" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(255, 255, 255, 0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
              }}
            >
              <Spin size="large" />
            </div>
          )}
          {books.length > 0 ? (
            <List
              grid={{
                gutter: 16,
                xs: 1,
                sm: 2,
                md: 3,
                lg: 4,
                xl: 4,
                xxl: 6,
              }}
              dataSource={books}
              renderItem={(book) => (
                <List.Item>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 200,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        {book.cover_url ? (
                          <img
                            alt={book.title}
                            src={book.cover_url}
                            style={{
                              maxWidth: "100%",
                              maxHeight: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <BookOutlined
                            style={{ fontSize: 48, color: "#ccc" }}
                          />
                        )}
                      </div>
                    }
                    actions={[
                      <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handleBookDetail(book)}
                      >
                        详情
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <div style={{ height: 44, overflow: "hidden" }}>
                          {book.title}
                        </div>
                      }
                      description={
                        <Space
                          direction="vertical"
                          size="small"
                          style={{ width: "100%" }}
                        >
                          <div style={{ height: 20, overflow: "hidden" }}>
                            作者: {book.author}
                          </div>
                          <div>
                            <Tag color="blue">可查询</Tag>
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: 12,
                                color: "#666",
                              }}
                            >
                              {book.doc_type || "未知类型"}
                            </span>
                          </div>
                        </Space>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Empty description="暂无图书数据" />
          )}
        </div>

        {/* 分页 */}
        {total > 0 && (
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Pagination
              current={current}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={["40", "60", "80"]}
              showSizeChanger
              showQuickJumper
              showTotal={(total, range) =>
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
              }
              onChange={handlePageChange}
            />{" "}
          </div>
        )}
      </Card>

      {/* 筛选抽屉 */}
      <Drawer
        title="筛选条件"
        placement="right"
        onClose={() => setFilterVisible(false)}
        open={filterVisible}
        width={320}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFilter}
          initialValues={filters}
        >
          <Form.Item label="分类" name="category">
            <Select placeholder="选择分类" allowClear>
              {categories.map((category) => (
                <Option key={category} value={category}>
                  {category}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="作者" name="author">
            <Select placeholder="选择作者" allowClear showSearch>
              {authors.map((author) => (
                <Option key={author} value={author}>
                  {author}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Button onClick={handleReset}>重置</Button>
              <Button type="primary" htmlType="submit">
                应用筛选
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 图书详情抽屉 */}
      <Drawer
        title="图书详情"
        placement="right"
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        width={480}
      >
        {selectedBook && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              {selectedBook.cover_url ? (
                <img
                  src={selectedBook.cover_url}
                  alt={selectedBook.title}
                  style={{ maxWidth: 200, maxHeight: 300, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 200,
                    height: 300,
                    backgroundColor: "#f5f5f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOutlined style={{ fontSize: 48, color: "#ccc" }} />
                </div>
              )}
            </div>

            <Descriptions column={1} size="small">
              <Descriptions.Item label="书名">
                {selectedBook.title}
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                {selectedBook.author}
              </Descriptions.Item>
              <Descriptions.Item label="书籍编号">
                {selectedBook.book_id}
              </Descriptions.Item>
              <Descriptions.Item label="出版社">
                {selectedBook.publisher}
              </Descriptions.Item>
              <Descriptions.Item label="出版年份">
                {selectedBook.publication_year}
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {selectedBook.doc_type}
              </Descriptions.Item>
              <Descriptions.Item label="语言">
                {selectedBook.language}
              </Descriptions.Item>
              <Descriptions.Item label="索书号">
                {selectedBook.call_no}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color="blue">可查询</Tag>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                onClick={() => navigate(`/books/${selectedBook.book_id}`)}
                disabled
              >
                暂不支持在线借阅
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Books;
