import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { Avatar, Badge, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { BellOutlined, DownOutlined, LogoutOutlined, RightOutlined, UserOutlined } from '@ant-design/icons';

import AdminTopbarTrail from '../components/AdminTopbarTrail';
import { AdminTopbarProvider, useAdminTopbar } from '../context/AdminTopbarContext';
import { buildAdminMenuItems, navigateMenuKey, resolveMenuKey, resolveOpenMenuKeys, resolvePageTitle } from '../config/menu';
import { getAdminPendingCounts } from '../../api/dashboardApi';
import { ADMIN_PENDING_COUNTS_EVENT } from '../utils/pendingCountsRefresh';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function AdminLayoutShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout, getIdToken } = useAuth();
  const { trail } = useAdminTopbar();
  const [openKeys, setOpenKeys] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({
    sellerVerifications: 0,
    reports: 0,
    withdrawCount: 0,
    bannerPendingReview: 0,
    disputeAdminQueue: 0,
  });

  const loadPendingCounts = useCallback(async () => {
    try {
      const token = await getIdToken();
      const counts = await getAdminPendingCounts(token);
      if (counts) {
        setPendingCounts(counts);
      }
    } catch {
      // Sidebar badges are optional; ignore transient errors.
    }
  }, [getIdToken]);

  useEffect(() => {
    loadPendingCounts();
    const intervalId = setInterval(loadPendingCounts, 120_000);
    const onRefresh = () => loadPendingCounts();
    window.addEventListener(ADMIN_PENDING_COUNTS_EVENT, onRefresh);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener(ADMIN_PENDING_COUNTS_EVENT, onRefresh);
    };
  }, [loadPendingCounts]);

  useEffect(() => {
    loadPendingCounts();
  }, [location.pathname, loadPendingCounts]);

  const selectedKey = resolveMenuKey(location.pathname, searchParams);
  const pageTitle = resolvePageTitle(location.pathname, searchParams);
  const menuItems = useMemo(() => buildAdminMenuItems(pendingCounts), [pendingCounts]);

  useEffect(() => {
    const active = resolveOpenMenuKeys(location.pathname, searchParams);
    if (!active.length) {
      return;
    }
    setOpenKeys((prev) => [...new Set([...prev, ...active])]);
  }, [location.pathname, searchParams]);

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Đăng xuất',
        onClick: () => logout(),
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={248}
        theme="dark"
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          scrollbarWidth: 'thin',
        }}
        className="admin-sidebar-v3"
      >
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">F</div>
          <div>
            <Text strong className="admin-sidebar-title">
              FastMark
            </Text>
            <Text className="admin-sidebar-subtitle">Admin Center</Text>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          expandIcon={({ isOpen }) =>
            isOpen ? (
              <DownOutlined className="admin-sidebar-submenu-arrow" />
            ) : (
              <RightOutlined className="admin-sidebar-submenu-arrow" />
            )
          }
          items={menuItems}
          onClick={({ key }) => {
            if (String(key).startsWith('/')) {
              navigateMenuKey(navigate, key);
            }
          }}
          className="admin-sidebar-menu"
        />
      </Sider>
      <Layout>
        <Header className="admin-topbar">
          {trail?.length ? (
            <AdminTopbarTrail items={trail} />
          ) : (
            <Text strong className="admin-topbar-title">
              {pageTitle}
            </Text>
          )}
          <Space size="large" wrap>
            <Badge count={0} size="small">
              <BellOutlined
                className="admin-topbar-bell"
                onClick={() => navigate('/notifications')}
              />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} src={user?.photoURL || undefined} />
                <Text>{user?.displayName || user?.email || 'Admin'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 20, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default function AdminLayout() {
  return (
    <AdminTopbarProvider>
      <AdminLayoutShell />
    </AdminTopbarProvider>
  );
}
