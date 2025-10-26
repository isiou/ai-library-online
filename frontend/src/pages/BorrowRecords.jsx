import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Form,
  Modal,
  message,
  Tooltip,
  Popconfirm,
  Alert,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  CalendarOutlined,
  BookOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import useAppStore from "../stores/appStore";
import { borrowAPI } from "../services/api";

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const BorrowRecords = () => {
  const navigate = useNavigate();
  const { setPageTitle } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({});
  const [isMobile, setIsMobile] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    setPageTitle("借阅记录");
    loadRecords();
  }, [setPageTitle, current, pageSize, filters]);

  // 监听移动端断点
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {
        page: current,
        limit: pageSize,
        ...filters,
      };

      const response = await borrowAPI.getRecords(params);
      setRecords(response.data || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      message.error(
        "加载借阅记录失败: " + (error.response?.data?.message || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values) => {
    const newFilters = { ...values };

    // 处理日期范围
    if (values.dateRange && values.dateRange.length === 2) {
      // 后端查询参数为 startDate / endDate
      newFilters.startDate = values.dateRange[0].format("YYYY-MM-DD");
      newFilters.endDate = values.dateRange[1].format("YYYY-MM-DD");
    }
    delete newFilters.dateRange;

    setFilters(newFilters);
    setCurrent(1);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setCurrent(1);
  };

  const handleRenew = async (record) => {
    try {
      await borrowAPI.renew(record.borrow_id);
      message.success("续借成功");
      loadRecords();
    } catch (error) {
      message.error(
        "续借失败: " + (error.response?.data?.message || error.message)
      );
    }
  };

  const handleReturn = async (recordId) => {
    try {
      await borrowAPI.return(recordId);
      message.success("归还成功");
      loadRecords();
    } catch (error) {
      message.error(
        "归还失败: " + (error.response?.data?.message || error.message)
      );
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      borrowed: { color: "blue", text: "借阅中", icon: <BookOutlined /> },
      returned: {
        color: "green",
        text: "已归还",
        icon: <CheckCircleOutlined />,
      },
      overdue: {
        color: "red",
        text: "已逾期",
        icon: <ExclamationCircleOutlined />,
      },
      renewed: {
        color: "orange",
        text: "已续借",
        icon: <ClockCircleOutlined />,
      },
    };
    const config = statusMap[status] || {
      color: "default",
      text: status,
      icon: null,
    };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const isOverdue = (returnDate, status) => {
    return status === "borrowed" && dayjs().isAfter(dayjs(returnDate));
  };

  const canRenew = (record) => {
    return (
      record.status === "borrowed" && !isOverdue(record.due_date, record.status)
    );
  };

  const disabledDate = () => false;

  const columns = [
    {
      title: "图书信息",
      key: "book",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: "bold" }}>{record.title}</div>
          <div style={{ color: "#666", fontSize: 12 }}>
            作者: {record.author}
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>
            索书号: {record.call_no}
          </div>
        </div>
      ),
    },
    {
      title: "借阅日期",
      dataIndex: "borrow_date",
      key: "borrow_date",
      render: (date) => dayjs(date).format("YYYY-MM-DD"),
      sorter: true,
    },
    {
      title: "预期归还",
      dataIndex: "due_date",
      key: "due_date",
      render: (date, record) => (
        <div>
          <div>{dayjs(date).format("YYYY-MM-DD")}</div>
          {isOverdue(date, record.status) && (
            <Tag color="red" size="small">
              逾期 {dayjs().diff(dayjs(date), "day")} 天
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "实际归还",
      dataIndex: "return_date",
      key: "return_date",
      render: (date) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
      filters: [
        { text: "借阅中", value: "borrowed" },
        { text: "已归还", value: "returned" },
        { text: "已逾期", value: "overdue" },
      ],
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/books/${record.book_id}`)}
          >
            查看详情
          </Button>
          {canRenew(record) && (
            <Popconfirm
              title="确认续借?"
              onConfirm={() => handleRenew(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small">
                续借
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 搜索筛选区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout={isMobile ? "vertical" : "inline"}
          onFinish={handleSearch}
          style={{ marginBottom: 16 }}
        >
          <Form.Item name="search" style={{ flex: 1 }}>
            <Search
              placeholder="搜索书名、作者、索书号..."
              allowClear
              style={{ width: isMobile ? "100%" : 250 }}
            />
          </Form.Item>

          <Form.Item name="status" style={{ flex: isMobile ? 1 : undefined }}>
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: isMobile ? "100%" : 120 }}
            >
              <Option value="borrowed">借阅中</Option>
              <Option value="returned">已归还</Option>
              <Option value="overdue">已逾期</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dateRange"
            style={{ flex: isMobile ? 1 : undefined }}
          >
            <RangePicker
              placeholder={["开始日期", "结束日期"]}
              style={{ width: isMobile ? "100%" : 240 }}
            />
          </Form.Item>

          <Form.Item style={{ width: isMobile ? "100%" : "auto" }}>
            <Space wrap style={{ width: isMobile ? "100%" : "auto" }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SearchOutlined />}
                block={isMobile}
              >
                搜索
              </Button>
              <Button onClick={handleReset} block={isMobile}>
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadRecords}
                block={isMobile}
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 统计信息 */}
        <Alert
          message={
            <Space>
              <span>共 {total} 条借阅记录</span>
              <span>|</span>
              <span>
                当前借阅:{" "}
                {
                  records.filter(
                    (r) => r.status === "borrowed" || r.status === "renewed"
                  ).length
                }{" "}
                本
              </span>
              <span>|</span>
              <span>
                逾期图书:{" "}
                {records.filter((r) => isOverdue(r.due_date, r.status)).length}{" "}
                本
              </span>
            </Space>
          }
          type="info"
          showIcon
        />
      </Card>

      {/* 借阅记录表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="borrow_id"
          loading={loading}
          pagination={{
            current,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrent(page);
              setPageSize(size);
            },
          }}
          rowClassName={(record) => {
            if (isOverdue(record.due_date, record.status)) {
              return "overdue-row";
            }
            return "";
          }}
        />
      </Card>

      <style>{`
        .overdue-row {
          background-color: #fff2f0;
        }
      `}</style>
    </div>
  );
};

export default BorrowRecords;
