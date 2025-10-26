import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Spin,
  Alert,
  Divider,
  List,
  Avatar,
  Tooltip,
  Progress,
  App as AntdApp,
} from "antd";
import {
  BulbOutlined,
  BookOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import { recommendationAPI, borrowAPI } from "../services/api";

const { TextArea } = Input;
const { Option } = Select;

const Recommendations = () => {
  const navigate = useNavigate();
  const { user, initialized, isAuthenticated } = useAuthStore();
  const { setPageTitle } = useAppStore();
  const { message } = AntdApp.useApp();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [requestModalVisible, setRequestModalVisible] = useState(false);

  const [requestForm] = Form.useForm();

  const loadRecommendationHistory = useCallback(async () => {
    setLoading(true);
    try {
      // 从数据库读取推荐历史记录
      const response = await recommendationAPI.getHistory({ limit: 6 });
      setRecommendations(response.recommendations || []);
    } catch (error) {
      console.error("加载推荐历史失败: ", error);
      message.error("加载推荐历史失败: " + (error?.message || error));
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    setPageTitle("智能推荐");
    loadRecommendationHistory();
  }, [setPageTitle, loadRecommendationHistory]);

  const handleRequestRecommendation = async (values) => {
    setGenerating(true);
    try {
      const response = await recommendationAPI.list({
        query: values.keywords || "",
        limit: values.count || 6,
      });
      const newRecommendations = response.recommendations || [];
      setRecommendations(newRecommendations);
      setRequestModalVisible(false);
      requestForm.resetFields();
      message.success("已生成新的智能推荐");
    } catch (error) {
      message.error("生成推荐失败: " + (error?.message || error));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <BulbOutlined style={{ fontSize: 24, color: "#faad14" }} />
              <div>
                <h3 style={{ margin: 0 }}>AI 智能推荐</h3>
                <p style={{ margin: 0, color: "#666" }}>
                  结合您的阅读历史和兴趣关键词，为您推荐个性化的优质图书
                </p>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => setRequestModalVisible(true)}
                disabled={generating}
              >
                获取新推荐
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 推荐结果 */}
      {recommendations.length > 0 ? (
        <Row gutter={[16, 16]}>
          {recommendations.map((recommendation, index) => (
            <Col
              xs={24}
              sm={12}
              lg={8}
              xl={6}
              key={`${recommendation.title}-${recommendation.author}-${index}`}
            >
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
                    <BookOutlined style={{ fontSize: 48, color: "#ccc" }} />
                  </div>
                }
              >
                <Card.Meta
                  title={
                    <div style={{ height: 44, overflow: "hidden" }}>
                      <span>{recommendation.title}</span>
                    </div>
                  }
                  description={
                    <Space
                      direction="vertical"
                      size="small"
                      style={{ width: "100%" }}
                    >
                      <div style={{ height: 20, overflow: "hidden" }}>
                        作者：{recommendation.author}
                      </div>
                      <div style={{ height: 20, overflow: "hidden" }}>
                        索书号：{" "}
                        {recommendation.call_number || recommendation.call_no}
                      </div>
                      {recommendation.reason && (
                        <div style={{ fontSize: 12, color: "#666" }}>
                          推荐理由：{recommendation.reason}
                        </div>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : !generating ? (
        <Card>
          <Empty
            image={<BulbOutlined style={{ fontSize: 64, color: "#ccc" }} />}
            description={
              <div>
                <p>还没有推荐记录</p>
                <p style={{ color: "#666" }}>
                  点击"获取新推荐"开始您的关键词探索之旅
                </p>
              </div>
            }
          >
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setRequestModalVisible(true)}
            >
              获取推荐
            </Button>
          </Empty>
        </Card>
      ) : null}

      {/* 请求推荐模态框 */}
      <Modal
        title="获取智能推荐"
        open={requestModalVisible}
        onCancel={() => {
          setRequestModalVisible(false);
          requestForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="智能推荐"
          description="输入您感兴趣的关键词后 AI 将结合您的阅读历史和关键词进行书籍推荐。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={requestForm}
          layout="vertical"
          onFinish={handleRequestRecommendation}
        >
          <Form.Item label="关键词" name="keywords" extra="">
            <Input placeholder="输入您感兴趣的关键词，如：科幻、悬疑、传记、编程、心理学等" />
          </Form.Item>

          <Form.Item label="推荐数量" name="count" initialValue={6}>
            <Select>
              <Option value={3}>3本</Option>
              <Option value={6}>6本</Option>
              <Option value={9}>9本</Option>
              <Option value={12}>12本</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setRequestModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={generating}>
                生成推荐
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Recommendations;
