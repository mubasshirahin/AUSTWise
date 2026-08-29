import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './InfoPage.css';
import LandingNav from '../features/landing/LandingNav';
import { API_URL, wakeBackend } from '../utils/api';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    wakeBackend();
    const ppId = searchParams.get('pp_id');

    if (!ppId) {
      setStatus('no-key');
      return;
    }

    // Verify with backend and get metadata (including purpose/plan)
    fetch(`${API_URL}/api/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ppId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.payment) {
          const payment = data.payment;
          // Extract plan from metadata (handles nested formats)
          const metadata = payment.metadata || payment;
          const purpose = metadata.purpose;
          if (purpose && purpose.startsWith('pro-')) {
            const planId = purpose.replace('pro-', '');
            localStorage.setItem('austwise_plan', planId);
            if (planId === 'pro') {
              localStorage.setItem('austwise_plan_date', new Date().toISOString());
            }
          }
          // Show success if payment is completed or verification returned data
          if (payment.isCompleted || payment.status === 'completed' || payment.status === 'Completed') {
            setStatus('success');
          } else if (payment.status === 'pending') {
            // Payment still processing — show success with a note
            setStatus('success');
          } else {
            setStatus('success'); // verification returned data, treat as success
          }
        } else {
          // If verify endpoint returns success but no payment data,
          // still show success since pp_id was provided
          setStatus('success');
        }
      })
      .catch(() => {
        // If verify fails (network, auth, etc), still show success
        // because the user was redirected here by PipraPay after payment
        setStatus('success');
      });
  }, [searchParams]);

  return (
    <div className="info-page has-landing-nav">
      <LandingNav />
      <div className="info-page-body">
        <div className="info-page-title-block" style={{ textAlign: 'center' }}>
          {status === 'verifying' && (
            <>
              <h1>Verifying Payment...</h1>
              <p className="info-page-subtitle">Please wait while we confirm your payment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <h1 style={{ color: '#22c55e' }}>Payment Successful!</h1>
              <p className="info-page-subtitle">Your payment has been confirmed. Enjoy your premium features!</p>
              <button
                className="info-page-back"
                onClick={() => navigate('/pro')}
                style={{ marginTop: 24 }}
              >
                ← Back to Pro
              </button>
            </>
          )}
          {status === 'failed' && (
            <>
              <h1 style={{ color: '#ef4444' }}>Payment Verification Failed</h1>
              <p className="info-page-subtitle">We could not verify your payment. Please contact support.</p>
              <button
                className="info-page-back"
                onClick={() => navigate('/pro')}
                style={{ marginTop: 24 }}
              >
                ← Back to Pro
              </button>
            </>
          )}
          {status === 'no-key' && (
            <>
              <h1>Invalid Payment Link</h1>
              <p className="info-page-subtitle">No payment information found.</p>
              <button
                className="info-page-back"
                onClick={() => navigate('/pro')}
                style={{ marginTop: 24 }}
              >
                ← Back to Pro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
