import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';

import { useAuth } from '../context/AuthContext';

const { Title, Paragraph } = Typography;

export default function LoginPage() {
  const { login, user, isAdmin, loading: authLoading } = useAuth();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user && isAdmin) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(values) {
    setError('');
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
    } catch (submitError) {
      setError(submitError.message || 'Đăng nhập thất bại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f3f4f6 50%, #ffffff 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: '#16a34a',
              color: '#fff',
              fontWeight: 700,
              fontSize: 24,
              display: 'inline-grid',
              placeItems: 'center',
              marginBottom: 12,
            }}
          >
            F
          </div>
          <Title level={3} style={{ margin: 0 }}>
            FastMark Admin
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Đăng nhập bằng email + mật khẩu (Role = Admin).
          </Paragraph>
        </div>

        {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, type: 'email', message: 'Nhập email hợp lệ' }]}
          >
            <Input placeholder="admin@gmail.com" size="large" />
          </Form.Item>
          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            Đăng nhập
          </Button>
        </Form>
      </Card>
    </div>
  );
}
