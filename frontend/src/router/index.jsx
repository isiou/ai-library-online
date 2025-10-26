import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Spin } from "antd";

// 布局组件
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

// 路由守卫
import ProtectedRoute from "../components/ProtectedRoute";
import AdminRoute from "../components/AdminRoute";

// 懒加载组件
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const Books = lazy(() => import("../pages/Books"));
const BookDetail = lazy(() => import("../pages/BookDetail"));
const BorrowRecords = lazy(() => import("../pages/BorrowRecords"));
const Recommendations = lazy(() => import("../pages/Recommendations"));
const RecommendationDetail = lazy(
  () => import("../pages/Recommendations/Detail")
);
const SmartAssistant = lazy(() => import("../pages/SmartAssistant"));
const AdminUsers = lazy(() => import("../pages/admin/UserManagement"));
const AdminBooks = lazy(() => import("../pages/admin/BookManagement"));
const AdminUserBorrowRecords = lazy(
  () => import("../pages/admin/UserBorrowRecords")
);
const AdminImport = lazy(() => import("../pages/admin/DataImport"));
const AdminStats = lazy(() => import("../pages/admin/Statistics"));
const NotFound = lazy(() => import("../pages/NotFound"));

// 加载组件
const LoadingComponent = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <Spin size="large" />
  </div>
);

// 包装懒加载组件
const withSuspense = (Component) => (props) => (
  <Suspense fallback={<LoadingComponent />}>
    <Component {...props} />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "register",
        element: <Register />,
      },
    ],
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: "dashboard",
        element: withSuspense(Dashboard)(),
      },
      {
        path: "profile",
        element: withSuspense(Profile)(),
      },
      {
        path: "books",
        children: [
          {
            index: true,
            element: withSuspense(Books)(),
          },
          {
            path: ":id",
            element: withSuspense(BookDetail)(),
          },
        ],
      },
      {
        path: "borrow",
        element: withSuspense(BorrowRecords)(),
      },
      {
        path: "recommendations",
        children: [
          {
            index: true,
            element: withSuspense(Recommendations)(),
          },
          {
            path: ":sessionId",
            element: withSuspense(RecommendationDetail)(),
          },
        ],
      },
      {
        path: "smart-assistant",
        element: withSuspense(SmartAssistant)(),
      },
      {
        path: "admin",
        element: <AdminRoute />,
        children: [
          {
            path: "users",
            children: [
              {
                index: true,
                element: withSuspense(AdminUsers)(),
              },
              {
                path: ":userId/borrow-records",
                element: withSuspense(AdminUserBorrowRecords)(),
              },
            ],
          },
          {
            path: "books",
            element: withSuspense(AdminBooks)(),
          },
          {
            path: "import",
            element: withSuspense(AdminImport)(),
          },
          {
            path: "stats",
            element: withSuspense(AdminStats)(),
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <Navigate to="/auth/login" replace />,
  },
  {
    path: "/register",
    element: <Navigate to="/auth/register" replace />,
  },
  {
    path: "*",
    element: withSuspense(NotFound)(),
  },
]);

export default router;
