import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Descriptions,
  Tag,
  Space,
  message,
  Modal,
  Form,
  DatePicker,
  Spin,
  Alert,
  Divider,
  List,
  Avatar,
  Rate,
} from "antd";
import {
  BookOutlined,
  ArrowLeftOutlined,
  HeartOutlined,
  HeartFilled,
  ShareAltOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import { bookAPI, borrowAPI } from "../services/api";

const BookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setPageTitle, setBreadcrumbs } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [book, setBook] = useState(null);
  const [borrowModalVisible, setBorrowModalVisible] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [relatedBooks, setRelatedBooks] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadBookDetail();
    }
  }, [id]);

  useEffect(() => {
    if (book) {
      setPageTitle(book.title);
      setBreadcrumbs([
        { title: "首页", path: "/dashboard" },
        { title: "图书查询", path: "/books" },
        { title: book.title },
      ]);
    }
  }, [book, setPageTitle, setBreadcrumbs]);

  const loadBookDetail = async () => {
    setLoading(true);
    try {
      const [bookRes, relatedRes, reviewsRes] = await Promise.allSettled([
        bookAPI.getDetail(id),
        bookAPI.getRelated(id),
        bookAPI.getReviews(id),
      ]);

      if (bookRes.status === "fulfilled") {
        setBook(bookRes.value.data);
      } else {
        message.error("图书不存在或已被删除");
        navigate("/books");
        return;
      }

      if (relatedRes.status === "fulfilled") {
        setRelatedBooks(relatedRes.value.data || []);
      }

      if (reviewsRes.status === "fulfilled") {
        setReviews(reviewsRes.value.data || []);
      }

      // 检查是否已收藏
      try {
        const favoriteRes = await bookAPI.checkFavorite(id);
        setIsFavorite(favoriteRes.data.isFavorite);
      } catch (error) {
        console.error("检查收藏状态失败: ", error);
      }
    } catch (error) {
      message.error(
        "加载图书详情失败: " + (error.response?.data?.message || error.message)
      );
      navigate("/books");
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async () => {
    setBorrowLoading(true);
    try {
      await borrowAPI.borrow({ bookId: id });
      message.success("借阅成功，请到图书馆取书");
      loadBookDetail();
    } catch (error) {
      message.error(
        "借阅失败: " + (error.response?.data?.message || error.message)
      );
    } finally {
      setBorrowLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      if (isFavorite) {
        await bookAPI.removeFavorite(id);
        setIsFavorite(false);
        message.success("已取消收藏");
      } else {
        await bookAPI.addFavorite(id);
        setIsFavorite(true);
        message.success("已添加到收藏");
      }
    } catch (error) {
      message.error(
        "操作失败: " + (error.response?.data?.message || error.message)
      );
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: book.title,
        text: `推荐一本好书: ${book.title} - ${book.author}`,
        url: url,
      });
    } else {
      // 复制到剪贴板
      navigator.clipboard.writeText(url).then(() => {
        message.success("链接已复制到剪贴板");
      });
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

  const disabledDate = (current) => {
    return (
      current &&
      (current < dayjs().endOf("day") || current > dayjs().add(30, "day"))
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!book) {
    return (
      <Alert
        message="图书不存在"
        description="您访问的图书可能已被删除或不存在"
        type="error"
        showIcon
        action={
          <Button onClick={() => navigate("/books")}>返回图书列表</Button>
        }
      />
    );
  }

  return (
    <div>
      {/* 返回按钮 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/books")}
        style={{ marginBottom: 16 }}
      >
        返回图书列表
      </Button>

      <Row gutter={[24, 24]}>
        {/* 图书基本信息 */}
        <Col xs={24} lg={16}>
          <Card>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: "center" }}>
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 400,
                        objectFit: "cover",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 400,
                        backgroundColor: "#f5f5f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                      }}
                    >
                      <BookOutlined style={{ fontSize: 64, color: "#ccc" }} />
                    </div>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={16}>
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24 }}>{book.title}</h1>
                    <p style={{ fontSize: 16, color: "#666", margin: "8px 0" }}>
                      {book.author}
                    </p>
                    {book.rating && (
                      <div>
                        <Rate disabled defaultValue={book.rating} />
                        <span style={{ marginLeft: 8 }}>
                          {book.rating} ({book.review_count || 0} 评价)
                        </span>
                      </div>
                    )}
                  </div>

                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="ISBN">
                      {book.isbn}
                    </Descriptions.Item>
                    <Descriptions.Item label="出版社">
                      {book.publisher}
                    </Descriptions.Item>
                    <Descriptions.Item label="出版日期">
                      {book.publish_date}
                    </Descriptions.Item>
                    <Descriptions.Item label="分类">
                      {book.category}
                    </Descriptions.Item>
                    <Descriptions.Item label="位置">
                      {book.location}
                    </Descriptions.Item>
                    <Descriptions.Item label="库存状态">
                      {getAvailabilityTag(
                        book.available_count,
                        book.total_count
                      )}
                      <span style={{ marginLeft: 8 }}>
                        可借: {book.available_count} / 总数: {book.total_count}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>

                  <Space wrap>
                    <Button
                      type="primary"
                      size="large"
                      loading={borrowLoading}
                      disabled={
                        !book.available_count || book.available_count === 0
                      }
                      onClick={handleBorrow}
                    >
                      借阅
                    </Button>
                    <Button
                      icon={isFavorite ? <HeartFilled /> : <HeartOutlined />}
                      onClick={handleFavorite}
                      style={{ color: isFavorite ? "#ff4d4f" : undefined }}
                    >
                      {isFavorite ? "已收藏" : "收藏"}
                    </Button>
                    <Button icon={<ShareAltOutlined />} onClick={handleShare}>
                      分享
                    </Button>
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 图书简介 */}
          {book.description && (
            <Card title="图书简介" style={{ marginTop: 24 }}>
              <div style={{ lineHeight: 1.8, fontSize: 14 }}>
                {book.description}
              </div>
            </Card>
          )}

          {/* 读者评价 */}
          {reviews.length > 0 && (
            <Card title="读者评价" style={{ marginTop: 24 }}>
              <List
                dataSource={reviews}
                renderItem={(review) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar>{review.user_name?.[0]}</Avatar>}
                      title={
                        <Space>
                          <span>{review.user_name}</span>
                          <Rate
                            disabled
                            defaultValue={review.rating}
                            size="small"
                          />
                        </Space>
                      }
                      description={
                        <div>
                          <div>{review.content}</div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#999",
                              marginTop: 4,
                            }}
                          >
                            {review.created_at}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>

        {/* 相关推荐 */}
        <Col xs={24} lg={8}>
          <Card title="相关推荐">
            <List
              dataSource={relatedBooks}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      item.cover_url ? (
                        <Avatar src={item.cover_url} shape="square" size={48} />
                      ) : (
                        <Avatar
                          icon={<BookOutlined />}
                          shape="square"
                          size={48}
                        />
                      )
                    }
                    title={
                      <a onClick={() => navigate(`/books/${item.id}`)}>
                        {item.title}
                      </a>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>{item.author}</span>
                        {getAvailabilityTag(
                          item.available_count,
                          item.total_count
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "暂无相关推荐" }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BookDetail;
