import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Typography, Tag, Image, Button, InputNumber, Divider,
  List, Avatar, Space, Descriptions, Alert, Spin, Grid, message, Modal,
} from 'antd';
import {
  UserOutlined, ClockCircleOutlined, DollarOutlined, FireOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined, ShareAltOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { AuctionItemDetail, Bid as BidType, Transaction } from '../types';
import { CATEGORY_MAP, CONDITION_MAP, STATUS_MAP, STATUS_COLOR } from '../types';
import { itemsApi } from '../api/items';
import { bidsApi } from '../api/bids';
import { transactionsApi } from '../api/transactions';
import { useAuth } from '../store/AuthContext';
import CountDown from '../components/CountDown';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const screens = useBreakpoint();

  const [item, setItem] = useState<AuctionItemDetail | null>(null);
  const [bids, setBids] = useState<BidType[]>([]);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('');
  const bidAmountRef = useRef<number | null>(null);

  const isSeller = user && item && user.id === item.seller_id;
  const isWinner = user && item && user.id === item.winner_id;

  const fetchItem = useCallback(async () => {
    if (!id) return;
    try {
      const [itemRes, bidsRes] = await Promise.all([
        itemsApi.get(Number(id)),
        bidsApi.list(Number(id)),
      ]);
      setItem(itemRes.data.item);
      setBids(bidsRes.data.bids);

      // Fetch transaction if ended with winner (only when logged in)
      if (user && ['ended_won', 'completed'].includes(itemRes.data.item.status)) {
        try {
          const txnRes = await transactionsApi.getByItem(Number(id));
          setTransaction(txnRes.data.transaction);
        } catch {
          // May not have access
        }
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Keep bidAmount ref in sync with state for polling access
  useEffect(() => {
    bidAmountRef.current = bidAmount;
  }, [bidAmount]);

  // Poll for updates when item is active
  const isActive = item?.status === 'active';
  useEffect(() => {
    if (!id || !isActive) return;

    const poll = async () => {
      try {
        const [itemRes, bidsRes] = await Promise.all([
          itemsApi.get(Number(id)),
          bidsApi.list(Number(id)),
        ]);
        const newItem = itemRes.data.item;
        setItem(newItem);
        setBids(bidsRes.data.bids);
        setLastRefreshTime(dayjs().format('HH:mm:ss'));

        // Auto-fill bid amount if empty or below new minimum
        if (newItem.status === 'active') {
          const newMinBid = newItem.bid_count === 0
            ? newItem.starting_price
            : newItem.current_price + newItem.increment;
          const currentBid = bidAmountRef.current;
          if (currentBid === null || currentBid < newMinBid) {
            setBidAmount(newMinBid);
          }
        }
      } catch {
        // silent
      }
    };

    const timer = setInterval(poll, 10000);
    return () => clearInterval(timer);
  }, [id, isActive]);

  const handleBid = async () => {
    if (!bidAmount || !item) return;
    setBidding(true);
    try {
      const res = await bidsApi.place(item.id, bidAmount);
      setItem(res.data.item);
      setBids((prev) => [res.data.bid, ...prev]);
      setBidAmount(null);
      message.success('出价成功！');
    } catch {
      // handled
    } finally {
      setBidding(false);
    }
  };

  const handleBuyout = () => {
    if (!item?.buyout_price) return;
    Modal.confirm({
      title: '确认一口价购买',
      content: `确定以 ¥${item.buyout_price.toFixed(2)} 一口价购买「${item.title}」？`,
      okText: '确认购买',
      cancelText: '取消',
      onOk: async () => {
        setBidding(true);
        try {
          const res = await bidsApi.place(item.id, item.buyout_price!);
          setItem(res.data.item);
          setBids((prev) => [res.data.bid, ...prev]);
          message.success('购买成功！');
          fetchItem();
        } catch {
          // handled
        } finally {
          setBidding(false);
        }
      },
    });
  };

  const handleConfirmTransaction = async () => {
    if (!transaction) return;
    try {
      const res = await transactionsApi.confirm(transaction.id);
      setTransaction(res.data.transaction);
      message.success('确认成功');
      fetchItem();
    } catch {
      // handled
    }
  };

  const handleShare = async () => {
    if (!item) return;
    const url = window.location.href;
    const lines = [
      `【${item.title}】`,
      `${STATUS_MAP[item.status]} | ${CATEGORY_MAP[item.category]} | ${CONDITION_MAP[item.condition]}`,
      `当前价: ¥${item.current_price.toFixed(2)}`,
      item.buyout_price ? `一口价: ¥${item.buyout_price.toFixed(2)}` : '',
      `出价次数: ${item.bid_count} 次`,
      '',
      url,
    ].filter((line) => line !== '');
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      message.success('拍品信息已复制到剪贴板，快去分享吧');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 80 }}><Spin size="large" /></div>;
  }

  if (!item) {
    return <div style={{ textAlign: 'center', marginTop: 80 }}><Text>拍品不存在</Text></div>;
  }

  const minBid = item.bid_count === 0 ? item.starting_price : item.current_price + item.increment;

  return (
    <div>
      <Row gutter={[24, 24]}>
        {/* Left: Images */}
        <Col xs={24} md={12}>
          <Card styles={{ body: { padding: 0 } }}>
            {item.images.length > 0 ? (
              <Image.PreviewGroup>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Image
                    src={item.images[0].image_url}
                    alt={item.title}
                    style={{ width: '100%', maxHeight: 400, objectFit: 'contain' }}
                  />
                  {item.images.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, padding: '0 8px 8px', overflowX: 'auto' }}>
                      {item.images.map((img) => (
                        <Image
                          key={img.id}
                          src={img.image_url}
                          alt=""
                          width={80}
                          height={80}
                          style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Image.PreviewGroup>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">暂无图片</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Info + Bidding */}
        <Col xs={24} md={12}>
          <Card>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Tag color={STATUS_COLOR[item.status]}>{STATUS_MAP[item.status]}</Tag>
                <Tag color="blue">{CATEGORY_MAP[item.category]}</Tag>
                <Tag>{CONDITION_MAP[item.condition]}</Tag>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>{item.title}</Title>
                <Button
                  type="text"
                  icon={<ShareAltOutlined />}
                  onClick={handleShare}
                  style={{ flexShrink: 0, fontSize: 16 }}
                >
                  分享
                </Button>
              </div>

              {/* Price Section */}
              <Card size="small" style={{ background: '#fafafa' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text type="secondary">当前价</Text>
                    <Title level={3} style={{ margin: 0, color: '#f5222d' }}>
                      ¥{item.current_price.toFixed(2)}
                    </Title>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">起拍价</Text>
                    <div>¥{item.starting_price.toFixed(2)}</div>
                    {item.buyout_price && (
                      <>
                        <Text type="secondary">一口价</Text>
                        <div style={{ color: '#fa8c16', fontWeight: 600 }}>¥{item.buyout_price.toFixed(2)}</div>
                      </>
                    )}
                  </Col>
                </Row>
              </Card>

              {/* Reserve price status */}
              {item.has_reserve && item.status === 'active' && (
                <Alert
                  type={item.reserve_met ? 'success' : 'warning'}
                  icon={item.reserve_met ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
                  message={item.reserve_met ? '已达到保留价，可正常成交' : '尚未达到保留价，继续加价'}
                  showIcon
                />
              )}
              {/* Seller can see reserve price */}
              {isSeller && item.reserve_price != null && (
                <Alert type="info" message={`保留价: ¥${item.reserve_price.toFixed(2)}（仅你可见）`} showIcon />
              )}

              {/* Stats */}
              <Descriptions column={screens.md ? 2 : 1} size="small">
                <Descriptions.Item label={<><FireOutlined /> 出价次数</>}>{item.bid_count} 次</Descriptions.Item>
                <Descriptions.Item label={<><DollarOutlined /> 加价幅度</>}>¥{item.increment.toFixed(2)}</Descriptions.Item>
                {item.end_time && (
                  <Descriptions.Item label={<><ClockCircleOutlined /> 剩余时间</>}>
                    {item.status === 'active' ? <CountDown endTime={item.end_time} onEnd={fetchItem} /> : dayjs(item.end_time).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={<><UserOutlined /> 卖家</>}>
                  <Space>
                    <Avatar src={item.seller?.avatar_url || undefined} icon={<UserOutlined />} size="small" />
                    {item.seller?.nickname}
                  </Space>
                </Descriptions.Item>
              </Descriptions>

              {/* Bid Actions */}
              {item.status === 'active' && !isSeller && user && (
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <InputNumber
                        value={bidAmount}
                        onChange={(v) => setBidAmount(v)}
                        min={minBid}
                        step={item.increment}
                        placeholder={`最低 ¥${minBid.toFixed(2)}`}
                        prefix="¥"
                        style={{ flex: 1 }}
                        size="large"
                      />
                      <Button type="primary" size="large" onClick={handleBid} loading={bidding} disabled={!bidAmount}>
                        出价
                      </Button>
                    </div>
                    {item.buyout_price && (
                      <Button type="default" block size="large" onClick={handleBuyout} loading={bidding} style={{ color: '#fa8c16', borderColor: '#fa8c16' }}>
                        一口价 ¥{item.buyout_price.toFixed(2)}
                      </Button>
                    )}
                  </Space>
                </Card>
              )}

              {!user && item.status === 'active' && (
                <Button type="primary" block size="large" onClick={() => navigate('/login')}>
                  登录后出价
                </Button>
              )}

              {/* Transaction Section */}
              {transaction && (isSeller || isWinner) && (
                <Card size="small" title="交易信息" style={{ borderColor: '#1677ff' }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="成交价">¥{transaction.final_price.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="卖家确认">
                      <Tag color={transaction.seller_confirmed ? 'green' : 'default'}>
                        {transaction.seller_confirmed ? '已确认' : '待确认'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="买家确认">
                      <Tag color={transaction.buyer_confirmed ? 'green' : 'default'}>
                        {transaction.buyer_confirmed ? '已确认' : '待确认'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                  {((isSeller && !transaction.seller_confirmed) || (isWinner && !transaction.buyer_confirmed)) && (
                    <Button type="primary" block style={{ marginTop: 8 }} onClick={handleConfirmTransaction}>
                      确认交易完成
                    </Button>
                  )}
                </Card>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Description */}
      <Card title="物品描述" style={{ marginTop: 24 }}>
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {item.description || '暂无描述'}
        </Paragraph>
      </Card>

      {/* Bid History */}
      <Card
        title={`出价记录 (${bids.length})`}
        extra={lastRefreshTime && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <SyncOutlined style={{ marginRight: 4 }} />
            最后刷新 {lastRefreshTime}
          </Text>
        )}
        style={{ marginTop: 24 }}
      >
        <List
          dataSource={bids}
          locale={{ emptyText: '暂无出价' }}
          renderItem={(bid) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={bid.bidder?.avatar_url || undefined} icon={<UserOutlined />} />}
                title={
                  <Space>
                    <span>{bid.bidder?.nickname}</span>
                    <Text strong style={{ color: '#f5222d' }}>¥{bid.amount.toFixed(2)}</Text>
                    {bids[0]?.id === bid.id && <Tag color="red">最高</Tag>}
                  </Space>
                }
                description={dayjs(bid.created_at).format('YYYY-MM-DD HH:mm:ss')}
              />
            </List.Item>
          )}
        />
      </Card>

      <Divider />
    </div>
  );
}
