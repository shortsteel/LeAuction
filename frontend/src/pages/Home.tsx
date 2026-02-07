import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Input, Select, Segmented, Pagination, Empty, Spin, Grid } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { AuctionItemCard } from '../types';
import { CATEGORY_MAP } from '../types';
import { itemsApi } from '../api/items';
import ItemCard from '../components/ItemCard';

const { useBreakpoint } = Grid;

const sortOptions = [
  { label: '最新发布', value: 'newest' },
  { label: '即将结束', value: 'ending_soon' },
  { label: '价格最低', value: 'price_low' },
  { label: '出价最多', value: 'most_bids' },
];

const categoryOptions = [
  { label: '全部', value: '' },
  ...Object.entries(CATEGORY_MAP).map(([value, label]) => ({ label, value })),
];

export default function Home() {
  const screens = useBreakpoint();
  const [items, setItems] = useState<AuctionItemCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await itemsApi.list({ page, per_page: 20, search, category: category || undefined, sort, status: 'active' });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, search, category, sort]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, category, sort]);

  const colSpan = screens.xl ? 6 : screens.lg ? 8 : screens.md ? 8 : screens.sm ? 12 : 24;

  return (
    <div>
      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索拍品..."
          prefix={<SearchOutlined />}
          allowClear
          onSearch={(v) => setSearch(v)}
          style={{ maxWidth: 300, flex: 1, minWidth: 200 }}
        />
        <Select
          value={category}
          onChange={setCategory}
          options={categoryOptions}
          style={{ minWidth: 120 }}
          placeholder="分类"
        />
        <Segmented
          value={sort}
          onChange={(v) => setSort(v as string)}
          options={sortOptions}
          size="middle"
        />
      </div>

      {/* Item Grid */}
      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description="暂无拍品" style={{ marginTop: 80 }} />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.id} span={colSpan}>
                <ItemCard item={item} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Pagination
            current={page}
            total={total}
            pageSize={20}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}
