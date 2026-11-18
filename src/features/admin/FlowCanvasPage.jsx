import { Maximize2 } from 'lucide-react';
import './FlowCanvasPage.css';

// Admin-only view of the AUSTWise flow canvas: every screen with user-flow and
// data-flow arrows. The canvas itself is a static page in public/prototype.
export default function FlowCanvasPage() {
  return (
    <div className="flow-canvas-page">
      <div className="flow-canvas-head">
        <h1>Flow Canvas</h1>
        <a className="flow-canvas-open" href="/prototype/canvas.html" target="_blank" rel="noreferrer">
          <Maximize2 size={15} /> Open full screen
        </a>
      </div>
      <iframe className="flow-canvas-frame" src="/prototype/canvas.html" title="AUSTWise flow canvas" />
    </div>
  );
}
