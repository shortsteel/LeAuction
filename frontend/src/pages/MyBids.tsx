import { useState, useEffect } from 'react';
import { Row, Col, Empty, Spin, Tag, Grid } from 'antd';
import type { AuctionItemCard } from '../types';
import { itemsApi } from '../api/items';
import ItemCard from '../components/ItemCard';

const { useBreakpoint } = Grid;

export default function MyBids() {
  const screens = useBreakpoint();
  const [items, setItems] = useState<AuctionItemCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsApi
      .myBids()
      .then((res) => setItems(res.data.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const colSpan = screens.xl ? 6 : screens.lg ? 8 : screens.md ? 8 : screens.sm ? 12 : 24;

  return (
    <div>
      <Spin spinning={loading}>
        {items.length === 0 && !loading ? (
          <Empty description="暂无竞拍记录" />
        ) : (
          <Row gutter={[16, 16]}>
            {items.map((item) => (
              <Col key={item.id} span={colSpan}>
                <ItemCard
                  item={item}
                  extra={
                    <div>
                      <Tag>我的最高出价: ¥{item.my_max_bid?.toFixed(2)}</Tag>
                      {item.is_winner && <Tag color="green">已中拍</Tag>}
                      {item.is_leading && !item.is_winner && <Tag color="blue">当前领先</Tag>}
                      {!item.is_leading && !item.is_winner && item.status === 'active' && (
                        <Tag color="orange">已被超越</Tag>
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
