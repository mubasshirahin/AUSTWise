import { Banknote, CreditCard, Receipt } from 'lucide-react';
import './AustBharaPage.css';
import '../../components/PageHero.css';

export default function AustBharaPage() {
  return (
    <div className="aust-bhara-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Banknote size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Bhara Koto</span>
              </h1>
              <p className="page-hero-subtitle">
                Track your semester fees, tuition, and all AUST-related payments in one place.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="ab-coming-soon">
        <div className="ab-cs-card">
          <Receipt size={32} strokeWidth={1.5} />
          <h2>Fee Tracker — Coming Soon</h2>
          <p>View semester-wise fee breakdowns, track payment deadlines, and get reminders before due dates. All your AUST payment history in one clean dashboard.</p>
          <div className="ab-feature-pills">
            <span><CreditCard size={14} /> Semester Fees</span>
            <span><Banknote size={14} /> Exam Fees</span>
            <span><Receipt size={14} /> Payment History</span>
          </div>
        </div>
      </div>
    </div>
  );
}
