import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Segmented, Empty, Spin, Button, Tag, Popconfirm, message, Grid } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { AuctionItemCard } from '../types';
import { STATUS_MAP } from '../types';
import { itemsApi } from '../api/items';
import ItemCard from '../components/ItemCard';

const { useBreakpoint } = Grid;

const statusFilters = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已成交', value: 'ended_won' },
  { label: '已流拍', value: 'ended_unsold' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
];

export default function MyItems() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const [items, setItems] = useState<AuctionItemCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itemsApi.myItems(status || undefined);
      setItems(res.data.items);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCancel = async (itemId: number) => {
    try {
      await itemsApi.cancel(itemId);
      message.success('已取消');
      fetchItems();
    } catch {
      // handled
    }
  };

  const handleDelete = async (itemId: number) => {
    try {
      await itemsApi.delete(itemId);
      message.success('已删除');
      fetchItems();
    } catch {
      // handled
    }
  };

  const colSpan = screens.xl ? 6 : screens.lg ? 8 : screens.md ? 8 : screens.sm ? 12 : 24;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Segmented value={status} onChange={(v) => setStatus(v as string)} options={statusFilters} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/publish')}>
          发布拍品
        </Button>
      </div>

      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description="暂无拍品" />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.id} span={colSpan}>
                <ItemCard
                  item={item}
                  extra={
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {item.status === 'draft' && (
                        <>
                          <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); navigate(`/publish/${item.id}`); }}>
                            编辑
                          </Button>
                          <Popconfirm title="确认删除？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id); }} onCancel={(e) => e?.stopPropagation()}>
                            <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                              删除
                            </Button>
                          </Popconfirm>
                        </>
                      )}
                      {item.status === 'active' && item.bid_count === 0 && (
                        <Popconfirm title="确认取消？" onConfirm={(e) => { e?.stopPropagation(); handleCancel(item.id); }} onCancel={(e) => e?.stopPropagation()}>
                          <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                            取消
                          </Button>
                        </Popconfirm>
                      )}
                      {item.status === 'ended_unsold' && (
                        <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); navigate(`/publish/${item.id}`); }}>
                          重新上架
                        </Button>
                      )}
                    </div>
                  }
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
}
