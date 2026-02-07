import { useEffect, useState } from 'react';
import { Modal, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

const DISCLAIMER_ACCEPTED_KEY = 'disclaimer_accepted';

export default function DisclaimerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const accepted = sessionStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    if (!accepted) {
      setOpen(true);
    }
  }, []);

  const handleOk = () => {
    sessionStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true');
    setOpen(false);
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
          <span>免责声明</span>
        </span>
      }
      open={open}
      onOk={handleOk}
      okText="我已知晓并同意"
      cancelButtonProps={{ style: { display: 'none' } }}
      closable={false}
      maskClosable={false}
      centered
    >
      <Typography style={{ marginTop: 12 }}>
        <Paragraph>
          欢迎使用 <Text strong>乐拍</Text> 内部拍卖平台！在使用本平台前，请您仔细阅读以下声明：
        </Paragraph>
        <Paragraph>
          <Text strong>1. 诚信交易：</Text>请所有用户本着诚实守信的原则参与拍卖活动。发布的拍品信息应真实准确，竞拍出价应为真实意愿，中拍后请及时完成交易。
        </Paragraph>
        <Paragraph>
          <Text strong>2. 自行协商：</Text>买卖双方的交易细节（包括但不限于物品交付、验收、付款方式等）由双方自行协商解决。
        </Paragraph>
        <Paragraph>
          <Text strong>3. 免责条款：</Text>本平台仅提供信息展示和竞拍撮合服务，不参与任何实际交易过程。
          <Text type="danger"> 对于交易过程中产生的任何纠纷、损失或争议，平台不承担任何法律责任。</Text>
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          继续使用本平台即表示您已阅读并同意以上声明。
        </Paragraph>
      </Typography>
    </Modal>
  );
}
