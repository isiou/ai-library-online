const api = {
  login: (data) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  logout: () =>
    fetch("/api/auth/logout", { method: "POST" }).then((r) => r.json()),
  session: () => fetch("/api/auth/session").then((r) => r.json()),
  borrows: (params) =>
    fetch(`/api/borrows?${new URLSearchParams(params)}`).then((r) => r.json()),
  accountGet: () => fetch("/api/account").then((r) => r.json()),
  accountUpdate: (data) =>
    fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  passwordUpdate: (data) =>
    fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
  recs: (params) =>
    fetch(`/api/recommendations?${new URLSearchParams(params)}`).then((r) =>
      r.json()
    ),
  adminUpdateBorrow: (id, data) =>
    fetch(`/api/admin/borrows/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};

const setOut = (id, data) => {
  document.getElementById(id).textContent = JSON.stringify(data, null, 2);
};

// 登录
document.getElementById("loginBtn").onclick = async () => {
  const readerId = document.getElementById("readerId").value;
  const password = document.getElementById("password").value;
  const res = await api.login({ readerId, password });
  setOut("authOutput", res);
};
document.getElementById("sessionBtn").onclick = async () =>
  setOut("authOutput", await api.session());
document.getElementById("logoutBtn").onclick = async () =>
  setOut("authOutput", await api.logout());

// 记录
document.getElementById("borrowsBtn").onclick = async () => {
  const params = {
    page: document.getElementById("page").value,
    limit: document.getElementById("limit").value,
    search: document.getElementById("search").value,
    status: document.getElementById("status").value,
    startDate: document.getElementById("startDate").value,
    endDate: document.getElementById("endDate").value,
  };
  setOut("borrowsOutput", await api.borrows(params));
};

// 账户
document.getElementById("accountGetBtn").onclick = async () =>
  setOut("accountOutput", await api.accountGet());
document.getElementById("accountUpdateBtn").onclick = async () => {
  const nickname = document.getElementById("nickname").value;
  const gender = document.getElementById("gender").value;
  setOut("accountOutput", await api.accountUpdate({ nickname, gender }));
};
document.getElementById("passwordUpdateBtn").onclick = async () => {
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  setOut(
    "accountOutput",
    await api.passwordUpdate({ currentPassword, newPassword })
  );
};

// 推荐
document.getElementById("recBtn").onclick = async () => {
  const model = document.getElementById("model").value;
  const limit = document.getElementById("recLimit").value;
  const query = document.getElementById("recQuery").value;
  const timeoutMs = document.getElementById("recTimeout").value;
  setOut("recOutput", await api.recs({ model, limit, query, timeoutMs }));
};

// 管理员
document.getElementById("adminUpdateBtn").onclick = async () => {
  const id = document.getElementById("borrowId").value;
  const status = document.getElementById("adminStatus").value;
  const return_date = document.getElementById("returnDate").value;
  setOut(
    "adminOutput",
    await api.adminUpdateBorrow(id, { status, return_date })
  );
};
