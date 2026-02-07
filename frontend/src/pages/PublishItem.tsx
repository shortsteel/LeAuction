import { useState, useEffect } from 'react';
import {
  Form, Input, InputNumber, Select, Upload, Button, Card, Typography,
  Space, message, Modal, Radio, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { UploadFile } from 'antd/es/upload';
import { CATEGORY_MAP, CONDITION_MAP } from '../types';
import { itemsApi } from '../api/items';
import { uploadApi } from '../api/upload';

const { Title } = Typography;
const { TextArea } = Input;

export default function PublishItem() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(id ? Number(id) : null);

  // Load item for editing
  useEffect(() => {
    if (id) {
      itemsApi.get(Number(id)).then((res) => {
        const item = res.data.item;
        form.setFieldsValue({
          title: item.title,
          description: item.description,
          category: item.category,
          condition: item.condition,
          starting_price: item.starting_price,
          reserve_price: item.reserve_price,
          increment: item.increment,
          buyout_price: item.buyout_price,
        });
        if (item.images.length > 0) {
          setFileList(
            item.images.map((img, idx) => ({
              uid: String(img.id || idx),
              name: `image-${idx}`,
              status: 'done' as const,
              url: img.image_url,
            }))
          );
        }
      });
    }
  }, [id, form]);

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      const res = await uploadApi.upload(file);
      onSuccess(res.data);
      // Update the file's url
      setFileList((prev) =>
        prev.map((f) =>
          f.uid === file.uid ? { ...f, url: res.data.url, status: 'done' as const } : f
        )
      );
    } catch (err) {
      onError(err);
    }
  };

  const getImageUrls = (): string[] => {
    return fileList
      .filter((f) => f.status === 'done')
      .map((f) => f.url || (f.response as any)?.url)
      .filter(Boolean) as string[];
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      const imageUrls = getImageUrls();
      const data = { ...values, image_urls: imageUrls };

      setSubmitting(true);
      if (draftId) {
        await itemsApi.update(draftId, data);
        message.success('草稿已保存');
      } else {
        const res = await itemsApi.create(data);
        setDraftId(res.data.item.id);
        message.success('草稿已创建');
      }
    } catch {
      // validation or API error
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (duration: { duration_days?: number; duration_hours?: number }) => {
    try {
      const values = await form.validateFields();
      const imageUrls = getImageUrls();

      setSubmitting(true);
      const data = { ...values, image_urls: imageUrls };

      let itemId = draftId;
      if (itemId) {
        await itemsApi.update(itemId, data);
      } else {
        const res = await itemsApi.create(data);
        itemId = res.data.item.id;
      }

      await itemsApi.publish(itemId!, duration);
      message.success('发布成功！');
      navigate(`/items/${itemId}`);
    } catch {
      // handled
    } finally {
      setSubmitting(false);
      setPublishModalOpen(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Title level={3}>{isEdit ? '编辑拍品' : '发布拍品'}</Title>

      <Card>
        <Form form={form} layout="vertical" initialValues={{ category: 'other', condition: 'new', increment: 1 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }, { min: 2, max: 50, message: '标题需要2-50个字符' }]}>
            <Input placeholder="请输入拍品标题" maxLength={50} showCount />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea placeholder="请描述物品详情、使用情况等" maxLength={2000} showCount rows={4} />
          </Form.Item>

          <Form.Item label="图片（最多5张，选填）">
            <Upload
              listType="picture-card"
              fileList={fileList}
              customRequest={handleUpload}
              onChange={({ fileList: newList }) => setFileList(newList)}
              onRemove={(file) => {
                setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
              }}
              accept="image/*"
              maxCount={5}
            >
              {fileList.length < 5 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Space style={{ width: '100%' }} size="middle" wrap>
            <Form.Item name="category" label="分类" style={{ minWidth: 150 }}>
              <Select
                options={Object.entries(CATEGORY_MAP).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Form.Item>

            <Form.Item name="condition" label="成色" style={{ minWidth: 150 }}>
              <Select
                options={Object.entries(CONDITION_MAP).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="middle" wrap>
            <Form.Item name="starting_price" label="起拍价（元）" rules={[{ required: true, message: '请输入起拍价' }]}>
              <InputNumber min={0.01} step={1} precision={2} style={{ width: 160 }} placeholder="0.01" />
            </Form.Item>

            <Form.Item name="increment" label="加价幅度（元）" rules={[{ required: true, message: '请输入加价幅度' }]}>
              <InputNumber min={0.01} step={1} precision={2} style={{ width: 160 }} placeholder="1.00" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="middle" wrap>
            <Form.Item name="reserve_price" label="保留价（元，选填）" tooltip="最低成交价，不公开显示，不填则默认起拍价">
              <InputNumber min={0.01} step={1} precision={2} style={{ width: 160 }} placeholder="不设置" />
            </Form.Item>

            <Form.Item name="buyout_price" label="一口价（元，选填）" tooltip="设置后竞拍者可直接以此价格购买">
              <InputNumber min={0.01} step={1} precision={2} style={{ width: 160 }} placeholder="不设置" />
            </Form.Item>
          </Space>
        </Form>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button icon={<DeleteOutlined />} onClick={() => navigate(-1)}>
            取消
          </Button>
          <Button onClick={handleSaveDraft} loading={submitting}>
            保存草稿
          </Button>
          <Button type="primary" onClick={() => setPublishModalOpen(true)}>
            发布上架
          </Button>
        </div>
      </Card>

      {/* Duration Selection Modal */}
      <Modal
        title="选择拍卖时长"
        open={publishModalOpen}
        onCancel={() => setPublishModalOpen(false)}
        footer={null}
      >
        <DurationPicker onConfirm={handlePublish} loading={submitting} />
      </Modal>
    </div>
  );
}

function DurationPicker({ onConfirm, loading }: { onConfirm: (duration: { duration_days?: number; duration_hours?: number }) => void; loading: boolean }) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [days, setDays] = useState(3);
  const [customHours, setCustomHours] = useState<number | null>(null);

  const handleConfirm = () => {
    if (mode === 'custom') {
      if (!customHours || customHours < 1 || customHours > 168) {
        return;
      }
      onConfirm({ duration_hours: customHours });
    } else {
      onConfirm({ duration_days: days });
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
        <Radio value="preset">预设时长</Radio>
        <Radio value="custom">自定义时长</Radio>
      </Radio.Group>

      {mode === 'preset' ? (
        <Radio.Group value={days} onChange={(e) => setDays(e.target.value)} optionType="button" buttonStyle="solid">
          <Radio.Button value={1}>1 天</Radio.Button>
          <Radio.Button value={3}>3 天</Radio.Button>
          <Radio.Button value={5}>5 天</Radio.Button>
          <Radio.Button value={7}>7 天</Radio.Button>
        </Radio.Group>
      ) : (
        <div>
          <Space align="center">
            <InputNumber
              min={1}
              max={168}
              value={customHours}
              onChange={(v) => setCustomHours(v)}
              placeholder="输入小时数"
              style={{ width: 140 }}
              addonAfter="小时"
            />
          </Space>
          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
            最少 1 小时，最多 168 小时（7 天）
            {customHours && customHours >= 24 && (
              <span>，约 {(customHours / 24).toFixed(1)} 天</span>
            )}
          </div>
        </div>
      )}

      <Divider style={{ margin: '8px 0' }} />

      <Button
        type="primary"
        block
        onClick={handleConfirm}
        loading={loading}
        disabled={mode === 'custom' && (!customHours || customHours < 1 || customHours > 168)}
      >
        确认发布
      </Button>
    </Space>
  );
}
