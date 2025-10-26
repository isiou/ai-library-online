import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Spin, Alert, List, Avatar, Space, Button } from "antd";
import { BookOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import useAppStore from "../../stores/appStore";
import { recommendationAPI } from "../../services/api";

const RecommendationDetail = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    setPageTitle("推荐详情");
    setBreadcrumbs([
      { title: "首页", path: "/dashboard" },
      { title: "AI 推荐", path: "/recommendations" },
      { title: "推荐详情" },
    ]);
    loadDetail();
  }, [sessionId]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await recommendationAPI.getDetail(sessionId);
      setSession(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    return (
      <Alert
        message="未找到推荐会话"
        description="请返回推荐列表重新选择"
        type="warning"
        showIcon
      />
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </Space>

      <Card title={`会话 ${session.session_id}`}>
        <p>状态：{session.status}</p>
        <p>
          创建时间：
          {session.created_at
            ? dayjs(session.created_at).format("YYYY-MM-DD HH:mm")
            : "-"}
        </p>

        <h3>推荐结果</h3>
        <List
          dataSource={session.recommendations || []}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar icon={<BookOutlined />} />}
                title={
                  <a onClick={() => navigate(`/books/${item.book.id}`)}>
                    {item.book.title}
                  </a>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <span>作者：{item.book.author}</span>
                    {item.reason && (
                      <span style={{ color: "#666" }}>理由：{item.reason}</span>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: "暂无推荐" }}
        />
      </Card>
    </div>
  );
};

export default RecommendationDetail;
