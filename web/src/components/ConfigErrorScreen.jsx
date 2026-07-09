export default function ConfigErrorScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="login-card">
        <h1>FastMark Admin</h1>
        <p className="error-text">{message}</p>
        <p>
          Tạo file <code>web/.env</code> từ <code>web/.env.example</code> và khởi động lại{' '}
          <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}
