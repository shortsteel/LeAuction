import { useState } from 'react';
import { Card, Form, Input, Button, Avatar, Upload, Typography, Divider, message, Space } from 'antd';
import { UserOutlined, CameraOutlined } from '@ant-design/icons';
import { useAuth } from '../store/AuthContext';
import { authApi } from '../api/auth';
import { uploadApi } from '../api/upload';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  if (!user) return null;

  const handleUpdateProfile = async (values: { nickname: string }) => {
    setSaving(true);
    try {
      const res = await authApi.updateProfile(values);
      updateUser(res.data.user);
      message.success('资料已更新');
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (options: any) => {
    try {
      const res = await uploadApi.upload(options.file);
      const profileRes = await authApi.updateProfile({ avatar_url: res.data.url });
      updateUser(profileRes.data.user);
      message.success('头像已更新');
    } catch {
      // handled
    }
  };

  const handleChangePassword = async (values: { old_password: string; new_password: string }) => {
    setChangingPwd(true);
    try {
      await authApi.changePassword(values);
      message.success('密码已修改');
      passwordForm.resetFields();
    } catch {
      // handled
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Title level={3}>个人资料</Title>

      <Card>
        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Upload showUploadList={false} customRequest={handleAvatarUpload} accept="image/*">
            <div style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
              <Avatar src={user.avatar_url || undefined} icon={<UserOutlined />} size={80} />
              <div
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  background: '#1677ff', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
              </div>
            </div>
          </Upload>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">{user.email}</Text>
          </div>
          <div>
            <Text type="secondary">注册于 {dayjs(user.created_at).format('YYYY-MM-DD')}</Text>
          </div>
        </div>

        {/* Profile Form */}
        <Form form={profileForm} layout="vertical" initialValues={{ nickname: user.nickname }} onFinish={handleUpdateProfile}>
          <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }, { min: 2, max: 20, message: '昵称需要2-20个字符' }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        {/* Change Password */}
        <Title level={5}>修改密码</Title>
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm_new_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button htmlType="submit" loading={changingPwd}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
