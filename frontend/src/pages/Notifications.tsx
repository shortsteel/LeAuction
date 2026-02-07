import { useState, useEffect } from 'react';
import { List, Badge, Button, Typography, Empty, Spin, Card, Space, message } from 'antd';
import {
  BellOutlined, DollarOutlined, TrophyOutlined,
  CloseCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import type { Notification } from '../types';
import { notificationsApi } from '../api/notifications';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

const typeIconMap: Record<string, React.ReactNode> = {
  outbid: <DollarOutlined style={{ color: '#fa8c16' }} />,
  ending_soon: <BellOutlined style={{ color: '#1677ff' }} />,
  auction_won: <TrophyOutlined style={{ color: '#52c41a' }} />,
  auction_sold: <TrophyOutlined style={{ color: '#52c41a' }} />,
  auction_unsold: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  reserve_not_met: <CloseCircleOutlined style={{ color: '#fa8c16' }} />,
  transaction_confirmed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    notificationsApi
      .list(page)
      .then((res) => {
        setNotifications(res.data.notifications);
        setTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const handleMarkRead = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
      } catch {
        // handled
      }
    }
    if (n.related_item_id) {
      navigate(`/items/${n.related_item_id}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      message.success('全部标为已读');
    } catch {
      // handled
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>通知</Typography.Title>
        <Button size="small" onClick={handleMarkAllRead}>全部已读</Button>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Spin spinning={loading}>
          <List
            dataSource={notifications}
            locale={{ emptyText: <Empty description="暂无通知" /> }}
            pagination={total > 20 ? { current: page, total, pageSize: 20, onChange: setPage } : false}
            renderItem={(n) => (
              <List.Item
                onClick={() => handleMarkRead(n)}
                style={{
                  cursor: n.related_item_id ? 'pointer' : 'default',
                  background: n.is_read ? undefined : '#f0f5ff',
                  padding: '12px 16px',
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={!n.is_read}>
                      <span style={{ fontSize: 20 }}>{typeIconMap[n.type] || <BellOutlined />}</span>
                    </Badge>
                  }
                  title={
                    <Space>
                      <Text strong={!n.is_read}>{n.title}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(n.created_at).fromNow()}</Text>
                    </Space>
                  }
                  description={n.content}
                />
              </List.Item>
            )}
          />
        </Spin>
      </Card>
    </div>
  );
}
