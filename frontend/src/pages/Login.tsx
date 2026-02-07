import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { authApi } from '../api/auth';
import DisclaimerModal from '../components/DisclaimerModal';

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      const res = await authApi.login(values);
      login(res.data.token, res.data.user);
      message.success('登录成功');
      navigate('/');
    } catch {
      // Error handled by interceptor
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', padding: 16 }}>
      <DisclaimerModal />
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 4 }}>🔨 乐拍</Title>
          <Text type="secondary">发现好物，乐在竞拍</Text>
git        </div>

        <Form form={form} onFinish={onFinish} size="large">
          <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}>
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text>还没有账号？</Text>
          <Link to="/register">立即注册</Link>
        </div>
      </Card>
    </div>
  );
}
