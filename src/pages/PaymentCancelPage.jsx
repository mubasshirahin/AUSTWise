import { useNavigate } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';

export default function PaymentCancelPage() {
  const navigate = useNavigate();

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block" style={{ textAlign: 'center' }}>
          <h1 style={{ color: '#f59e0b' }}>Payment Cancelled</h1>
          <p className="info-page-subtitle">You have cancelled the payment. No charges were made.</p>
          <button
            className="info-page-back"
            onClick={() => navigate('/')}
            style={{ marginTop: 24 }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
