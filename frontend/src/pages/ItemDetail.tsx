import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card, Row, Col, Typography, Tag, Image, Button, InputNumber, Divider,
  List, Avatar, Space, Descriptions, Alert, Spin, Grid, message, Modal, Input,
} from 'antd';
import {
  UserOutlined, ClockCircleOutlined, DollarOutlined, FireOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, SyncOutlined, ShareAltOutlined,
  MessageOutlined, SendOutlined, PictureOutlined, EyeOutlined, HeartOutlined, HeartFilled,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { AuctionItemDetail, Bid as BidType, Transaction, Comment as CommentType } from '../types';
import { CATEGORY_MAP, CONDITION_MAP, STATUS_MAP, STATUS_COLOR } from '../types';
import { itemsApi } from '../api/items';
import { bidsApi } from '../api/bids';
import { transactionsApi } from '../api/transactions';
import { commentsApi } from '../api/comments';
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
  const [comments, setComments] = useState<CommentType[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [liking, setLiking] = useState(false);

  const isSeller = user && item && user.id === item.seller_id;
  const isWinner = user && item && user.id === item.winner_id;

  // Track whether initial view has been recorded to avoid duplicates
  const viewRecorded = useRef(false);

  const fetchItem = useCallback(async (recordView = false) => {
    if (!id) return;
    try {
      const [itemRes, bidsRes] = await Promise.all([
        itemsApi.get(Number(id), recordView),
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

  // Initial load: record view only once
  useEffect(() => {
    if (!viewRecorded.current) {
      viewRecorded.current = true;
      fetchItem(true);
    } else {
      fetchItem(false);
    }
  }, [fetchItem]);

  // Poll for updates when item is active
  const isActive = item?.status === 'active';
  useEffect(() => {
    if (!id || !isActive) return;

    const poll = async () => {
      try {
        const [itemRes, bidsRes, commentsRes] = await Promise.all([
          itemsApi.get(Number(id)),
          bidsApi.list(Number(id)),
          commentsApi.list(Number(id)),
        ]);
        const newItem = itemRes.data.item;
        setItem(newItem);
        setBids(bidsRes.data.bids);
        setComments(commentsRes.data.comments);
        setCommentsTotal(commentsRes.data.total);
        setLastRefreshTime(dayjs().format('HH:mm:ss'));
      } catch {
        // silent
      }
    };

    const timer = setInterval(poll, 5001);
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

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      const res = await commentsApi.list(Number(id));
      setComments(res.data.comments);
      setCommentsTotal(res.data.total);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = async () => {
    if (!commentContent.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await commentsApi.create(Number(id), commentContent.trim());
      setComments((prev) => [res.data.comment, ...prev]);
      setCommentsTotal((prev) => prev + 1);
      setCommentContent('');
      message.success('留言成功');
    } catch {
      // handled by interceptor
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    const url = window.location.href;

    // 价格显示：去掉不必要的小数
    const fmtPrice = (v: number) => Number.isInteger(v) ? `${v}` : v.toFixed(2);

    // 根据状态构造不同的分享文案
    const lines: string[] = [];

    // 第一行：标题 + 成色
    lines.push(`🔨【${item.title}】${CONDITION_MAP[item.condition]}`);

    // 描述（超过50字截断）
    if (item.description) {
      const desc = item.description.length > 50
        ? item.description.slice(0, 50) + '...'
        : item.description;
      lines.push(`📝 ${desc}`);
    }

    if (['ended_won', 'completed'].includes(item.status)) {
      // 已成交/已完成
      lines.push(`💰 成交价 ¥${fmtPrice(item.current_price)} · ${item.bid_count}人出价`);
      lines.push(`✅ ${STATUS_MAP[item.status]}`);
    } else if (item.status === 'active') {
      // 进行中
      lines.push(`💰 当前价 ¥${fmtPrice(item.current_price)} · ${item.bid_count}人出价`);
      if (item.buyout_price) {
        lines.push(`⚡ 一口价 ¥${fmtPrice(item.buyout_price)}`);
      }
      if (item.end_time) {
        lines.push(`⏰ ${dayjs(item.end_time).format('M月D日 HH:mm')} 截拍`);
      }
    } else {
      // 其他状态（流拍、取消等）
      lines.push(`💰 ¥${fmtPrice(item.current_price)} · ${STATUS_MAP[item.status]}`);
    }

    lines.push(`👉 ${url}`);

    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制，快去分享吧');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleToggleLike = async () => {
    if (!item) return;
    if (!user) {
      message.info('请先登录后再点赞');
      navigate('/login');
      return;
    }
    setLiking(true);
    // Optimistic update
    const prevLiked = item.is_liked;
    const prevCount = item.like_count;
    setItem({
      ...item,
      is_liked: !prevLiked,
      like_count: prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1,
    });
    try {
      const res = await itemsApi.toggleLike(item.id);
      setItem((prev) => prev ? { ...prev, is_liked: res.data.is_liked, like_count: res.data.like_count } : prev);
    } catch {
      // Revert on error
      setItem((prev) => prev ? { ...prev, is_liked: prevLiked, like_count: prevCount } : prev);
    } finally {
      setLiking(false);
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
              <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
                <PictureOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
                <Text type="secondary" style={{ marginTop: 8 }}>暂无图片</Text>
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
                <Space size={0} style={{ flexShrink: 0 }}>
                  <Button
                    type="text"
                    icon={item.is_liked ? <HeartFilled style={{ color: '#eb2f96' }} /> : <HeartOutlined />}
                    onClick={handleToggleLike}
                    loading={liking}
                    style={{ fontSize: 16 }}
                  >
                    {item.like_count || 0}
                  </Button>
                  <Button
                    type="text"
                    icon={<ShareAltOutlined />}
                    onClick={handleShare}
                    style={{ fontSize: 16 }}
                  >
                    分享
                  </Button>
                </Space>
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
                <Descriptions.Item label={<><EyeOutlined /> 浏览量</>}>{item.view_count || 0}</Descriptions.Item>
                <Descriptions.Item label={<><HeartOutlined /> 点赞</>}>{item.like_count || 0}</Descriptions.Item>
                {item.end_time && (
                  <Descriptions.Item label={<><ClockCircleOutlined /> {item.status === 'active' ? '剩余时间' : '结束时间'}</>}>
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

      {/* Liked Users */}
      {item.liked_users && item.liked_users.length > 0 && (
        <Card
          style={{ marginTop: 24 }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <HeartFilled style={{ color: '#eb2f96', fontSize: 16 }} />
            <Text>
              {item.liked_users.map((u, idx) => (
                <span key={u.id}>
                  <Text strong>{u.nickname}</Text>
                  {idx < item.liked_users!.length - 1 && '、'}
                </span>
              ))}
              {' '}点赞了该宝贝
            </Text>
          </div>
        </Card>
      )}

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

      {/* Comments Section */}
      <Card
        title={<><MessageOutlined style={{ marginRight: 8 }} />留言 ({commentsTotal})</>}
        extra={lastRefreshTime && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <SyncOutlined style={{ marginRight: 4 }} />
            最后刷新 {lastRefreshTime}
          </Text>
        )}
        style={{ marginTop: 24 }}
      >
        {/* Comment Input */}
        {user && item.status !== 'draft' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Avatar src={user.avatar_url || undefined} icon={<UserOutlined />} />
            <Input.TextArea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="写下你的留言..."
              maxLength={500}
              showCount
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmitComment}
              loading={submittingComment}
              disabled={!commentContent.trim()}
              style={{ alignSelf: 'flex-end' }}
            >
              发送
            </Button>
          </div>
        ) : !user ? (
          <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: 16 }}>
            <Button type="link" onClick={() => navigate('/login')}>登录后留言</Button>
          </div>
        ) : null}

        {/* Comment List */}
        <List
          dataSource={comments}
          locale={{ emptyText: '暂无留言，来说点什么吧' }}
          renderItem={(comment) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={comment.user?.avatar_url || undefined} icon={<UserOutlined />} />}
                title={
                  <Space>
                    <span>{comment.user?.nickname}</span>
                    {item.seller_id === comment.user_id && (
                      <Tag color="orange" style={{ fontSize: 11 }}>卖家</Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 4 }}>
                      {comment.content}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(comment.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Divider />
    </div>
  );
}
