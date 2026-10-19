import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseQuestionBankParts } from './src/features/question-bank-analyzer/parseQuestionBank';
import PrintReport from './src/features/question-bank-analyzer/PrintReport';
import { downloadReportImagePdf } from './src/features/question-bank-analyzer/qbaPdf';
import sampleMarkdown from './samples/sample_analysis.md?raw';
import './src/features/question-bank-analyzer/QuestionBankAnalyzerPage.css';

const params = new URLSearchParams(location.search);
const copies = Math.max(1, Number(params.get('copies') || 1));

function Harness() {
  const reportRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseQuestionBankParts([sampleMarkdown]), []);
  const data = useMemo(() => {
    const base = parsed.data;
    const topics = [];
    for (let c = 0; c < copies; c += 1) {
      for (const topic of base.topics) {
        topics.push({ ...topic, name: `${topic.name} #${c + 1}` });
      }
    }
    return { ...base, topics };
  }, [parsed]);

  const generate = async () => {
    setBusy(true);
    setStatus('generating');
    try {
      await downloadReportImagePdf(reportRef.current, 'DEMO 101');
      setStatus('done');
    } catch (error) {
      setStatus(`error: ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>QBA PDF harness</h1>
      <p>topics: {(data.topics || []).length}</p>
      <button id="qba-generate" onClick={generate} disabled={busy}>Generate quick PDF</button>
      <p id="qba-status">{status}</p>
      <div className="qba-capture-host" aria-hidden="true">
        <PrintReport data={data} innerRef={reportRef} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
