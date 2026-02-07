import { Card, Tag, Typography, Space } from 'antd';
import { FireOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AuctionItemCard } from '../types';
import { CATEGORY_MAP, STATUS_MAP, STATUS_COLOR } from '../types';
import CountDown from './CountDown';

const { Text, Title } = Typography;

interface ItemCardProps {
  item: AuctionItemCard;
  extra?: React.ReactNode;
}

export default function ItemCard({ item, extra }: ItemCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      hoverable
      onClick={() => navigate(`/items/${item.id}`)}
      cover={
        <div style={{ height: 200, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {item.image_url ? (
            <img
              alt={item.title}
              src={item.image_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Text type="secondary">暂无图片</Text>
          )}
        </div>
      }
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Title level={5} ellipsis style={{ marginBottom: 4 }}>
        {item.title}
      </Title>

      <Space size={4} style={{ marginBottom: 8 }}>
        <Tag color="blue">{CATEGORY_MAP[item.category] || item.category}</Tag>
        {item.status !== 'active' && (
          <Tag color={STATUS_COLOR[item.status]}>{STATUS_MAP[item.status]}</Tag>
        )}
        {item.has_reserve && item.status === 'active' && (
          <Tag color={item.reserve_met ? 'green' : 'orange'}>
            {item.reserve_met ? '已达保留价' : '未达保留价'}
          </Tag>
        )}
      </Space>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text strong style={{ fontSize: 18, color: '#f5222d' }}>
          ¥{item.current_price.toFixed(2)}
        </Text>
        <Space size={4}>
          <FireOutlined style={{ color: '#fa8c16' }} />
          <Text type="secondary">{item.bid_count} 次出价</Text>
        </Space>
      </div>

      {item.buyout_price && item.status === 'active' && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          一口价: ¥{item.buyout_price.toFixed(2)}
        </Text>
      )}

      {item.end_time && item.status === 'active' && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>剩余: </Text>
          <CountDown endTime={item.end_time} />
        </div>
      )}

      {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
    </Card>
  );
}
