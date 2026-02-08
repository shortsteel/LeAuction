import { useState } from 'react';
import { Card, Tag, Typography, Space, Avatar, message } from 'antd';
import { FireOutlined, UserOutlined, ClockCircleOutlined, PictureOutlined, EyeOutlined, HeartOutlined, HeartFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AuctionItemCard } from '../types';
import { CATEGORY_MAP, CONDITION_MAP, STATUS_MAP, STATUS_COLOR } from '../types';
import { itemsApi } from '../api/items';
import { useAuth } from '../store/AuthContext';
import CountDown from './CountDown';

const { Text, Title } = Typography;

interface ItemCardProps {
  item: AuctionItemCard;
  extra?: React.ReactNode;
}

export default function ItemCard({ item, extra }: ItemCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(item.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(item.like_count || 0);
  const [liking, setLiking] = useState(false);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      message.info('请先登录后再点赞');
      navigate('/login');
      return;
    }
    if (liking) return;
    setLiking(true);
    // Optimistic update
    const prevLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);
    try {
      const res = await itemsApi.toggleLike(item.id);
      setIsLiked(res.data.is_liked);
      setLikeCount(res.data.like_count);
    } catch {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  };

  return (
    <Card
      hoverable
      onClick={() => navigate(`/items/${item.id}`)}
      cover={
        <div style={{ height: 200, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {item.image_url ? (
            <img
              alt={item.title}
              src={item.image_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <PictureOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>暂无图片</Text>
            </div>
          )}
          {/* 状态角标 */}
          {item.status !== 'active' && (
            <Tag
              color={STATUS_COLOR[item.status]}
              style={{ position: 'absolute', top: 8, right: 8, margin: 0 }}
            >
              {STATUS_MAP[item.status]}
            </Tag>
          )}
        </div>
      }
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Title level={5} ellipsis style={{ marginBottom: 4 }}>
        {item.title}
      </Title>

      <Space size={4} style={{ marginBottom: 8 }} wrap>
        <Tag color="blue">{CATEGORY_MAP[item.category] || item.category}</Tag>
        {item.condition && (
          <Tag>{CONDITION_MAP[item.condition] || item.condition}</Tag>
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
          <Text type="secondary">{item.bid_count}</Text>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <Space size={4}>
          <EyeOutlined style={{ color: '#999' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{item.view_count || 0}</Text>
        </Space>
        <Space
          size={4}
          style={{ cursor: 'pointer' }}
          onClick={handleToggleLike}
        >
          {isLiked
            ? <HeartFilled style={{ color: '#eb2f96' }} />
            : <HeartOutlined style={{ color: '#eb2f96' }} />
          }
          <Text type="secondary" style={{ fontSize: 12 }}>{likeCount}</Text>
        </Space>
      </div>

      {item.starting_price !== item.current_price && (
        <Text type="secondary" style={{ fontSize: 12, textDecoration: 'line-through' }}>
          起拍价: ¥{item.starting_price.toFixed(2)}
        </Text>
      )}

      {item.buyout_price && item.status === 'active' && (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            一口价: ¥{item.buyout_price.toFixed(2)}
          </Text>
        </div>
      )}

      {item.end_time && item.status === 'active' && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ClockCircleOutlined style={{ fontSize: 12, color: '#999' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>剩余: </Text>
          <CountDown endTime={item.end_time} />
        </div>
      )}

      {/* 发布人信息 */}
      {item.seller && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Avatar src={item.seller.avatar_url || undefined} icon={<UserOutlined />} size={20} />
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
            {item.seller.nickname}
          </Text>
        </div>
      )}

      {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
    </Card>
  );
}
