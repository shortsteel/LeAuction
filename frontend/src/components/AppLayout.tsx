import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Badge, Avatar, Dropdown, Button, Drawer, Grid, Alert } from 'antd';
import {
  HomeOutlined,
  PlusOutlined,
  ShoppingOutlined,
  TagsOutlined,
  BellOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { notificationsApi } from '../api/notifications';
import DisclaimerModal from './DisclaimerModal';

const DISCLAIMER_BANNER =
  '本平台仅提供信息展示和竞拍撮合服务，请诚信交易。点击查看完整免责声明 →';

const { Header, Content } = Layout;
const { useBreakpoint } = Grid;

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '拍卖大厅' },
  { key: '/publish', icon: <PlusOutlined />, label: '发布拍品' },
  { key: '/my-items', icon: <ShoppingOutlined />, label: '我的拍品' },
  { key: '/my-bids', icon: <TagsOutlined />, label: '我的竞拍' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const fetchUnread = useCallback(() => {
    if (user) {
      notificationsApi.unreadCount().then((res) => setUnreadCount(res.data.count)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000); // Poll every 30s
    return () => clearInterval(timer);
  }, [fetchUnread]);

  const handleMenuClick = (key: string) => {
    navigate(key);
    setDrawerOpen(false);
  };

  const currentKey = '/' + location.pathname.split('/')[1];

  const userMenu = {
    items: [
      { key: 'profile', icon: <ProfileOutlined />, label: '个人资料' },
      { key: 'notifications', icon: <BellOutlined />, label: `通知 ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') {
        logout();
        navigate('/login');
      } else if (key === 'profile') {
        navigate('/profile');
      } else if (key === 'notifications') {
        navigate('/notifications');
      }
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {bannerVisible && (
        <Alert
          message={
            <span
              onClick={() => setDisclaimerOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              {DISCLAIMER_BANNER}
            </span>
          }
          type="warning"
          banner
          closable
          onClose={() => setBannerVisible(false)}
          style={{ textAlign: 'center' }}
        />
      )}
      <DisclaimerModal externalOpen={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} />
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isMobile && (
            <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
          )}
          <div
            style={{ fontSize: 20, fontWeight: 700, color: '#1677ff', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => navigate('/')}
          >
            🔨 乐拍
          </div>
          {!isMobile && (
            <Menu
              mode="horizontal"
              selectedKeys={[currentKey]}
              items={menuItems}
              onClick={({ key }) => handleMenuClick(key)}
              style={{ border: 'none', minWidth: 400 }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge count={unreadCount} size="small">
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: 18 }} />}
              onClick={() => navigate('/notifications')}
            />
          </Badge>
          <Dropdown menu={userMenu} trigger={['click']}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar src={user?.avatar_url || undefined} icon={<UserOutlined />} size="small" />
              {!isMobile && <span>{user?.nickname}</span>}
            </div>
          </Dropdown>
        </div>
      </Header>

      {/* Mobile drawer menu */}
      <Drawer
        title="菜单"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
          style={{ border: 'none' }}
        />
      </Drawer>

      <Content style={{ padding: isMobile ? 12 : 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>
    </Layout>
  );
}
