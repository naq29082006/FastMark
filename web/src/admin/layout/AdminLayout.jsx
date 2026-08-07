import { useMemo } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Avatar, Badge, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { BellOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';

import { buildAdminMenuItems, resolveMenuKey, resolvePageTitle } from '../config/menu';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const selectedKey = resolveMenuKey(location.pathname);
  const pageTitle = resolvePageTitle(location.pathname);
  const menuItems = useMemo(() => buildAdminMenuItems(), []);

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
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="admin-sidebar-menu"
        />
      </Sider>
      <Layout>
        <Header className="admin-topbar">
          <Text strong className="admin-topbar-title">
            {pageTitle}
          </Text>
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
