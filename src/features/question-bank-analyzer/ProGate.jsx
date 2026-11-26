import { Link } from 'react-router-dom';
import {
  CalendarRange,
  Crown,
  Eye,
  FileCheck2,
  Image as ImageIcon,
  LineChart,
  Printer,
  ScrollText,
} from 'lucide-react';

const FEATURES = [
  { icon: FileCheck2, title: 'No question left out', text: 'Every printed question is counted against your papers; anything the AI skipped is named and brought back.' },
  { icon: ImageIcon, title: 'Original pictures', text: 'Diagrams, circuits and tables are cut straight out of your PDFs — exactly as printed.' },
  { icon: LineChart, title: 'Topic trends', text: 'Which topic came in which year, what is rising, and what is due this time.' },
  { icon: ScrollText, title: 'Predicted paper', text: 'Give the syllabus and mark plan — get the most likely paper, with the reason for every question.' },
  { icon: CalendarRange, title: 'Topic & semester views', text: 'Ranked topics, raw papers year by year, solved/pending checklist synced to your account.' },
  { icon: Printer, title: 'PDF + saved courses', text: 'Print the full report or the predicted paper, and keep every course saved.' },
];

/**
 * Shown instead of Step 3 and the report to students without a paid plan.
 * Copying the master prompt stays free, so anyone can see how it works.
 */
export default function ProGate({ onSample }) {
  return (
    <section className="qbi-gate glass-card-static" aria-labelledby="qbi-gate-title">
      <div className="qbi-gate-head">
        <span className="qbi-gate-badge"><Crown size={13} aria-hidden="true" /> Pro</span>
        <h2 id="qbi-gate-title">Turn your AI’s answer into a full exam plan</h2>
        <p>
          The prompt above is free to copy. Uploading the answer, the analysis and the predicted paper are part of
          AUSTWise Pro — from ৳50 a month.
        </p>
      </div>
      <ul className="qbi-gate-grid">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <span className="qbi-gate-icon"><Icon size={16} aria-hidden="true" /></span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="qbi-gate-actions">
        <Link to="/see-plans" className="btn btn-primary">
          <Crown size={15} aria-hidden="true" /> See plans
        </Link>
        <button type="button" className="btn btn-secondary" onClick={onSample}>
          <Eye size={15} aria-hidden="true" /> Explore a sample report
        </button>
      </div>
    </section>
  );
}
