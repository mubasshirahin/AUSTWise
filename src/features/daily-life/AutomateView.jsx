import { useState } from 'react';
import {
  AlertCircle, Check, Clipboard, FileJson, MessageSquareText, Plus, RotateCcw,
} from 'lucide-react';
import { createGoal, fmtDate } from './lifePlannerStorage';

const INTERVIEW_PROMPT = `Act as my careful, practical life-planning interviewer. Your job is to understand my real life and priorities, help me shape a realistic plan, get my explicit confirmation, then produce JSON that I can import into my Life Planner.

INTERVIEW RULES
1. Use the language I use with you. Be supportive, specific, and non-judgmental. Do not assume facts, priorities, deadlines, budget, ability, or available time.
2. Interview me before planning. Start by asking what prompted me to plan and what time horizon I want. Then cover the areas that matter to me: study/work, money, health and energy, relationships/family, personal growth, daily routines, responsibilities, living situation, and rest/fun. Ask whether each area is relevant before going deep; do not pressure me to disclose sensitive details.
3. Ask clear, concrete questions about my current situation, desired outcomes, reasons, constraints, available time/resources, deadlines, dependencies, likely obstacles, and how I will recognize success. Ask follow-ups for vague, conflicting, missing, or unrealistic answers. Ask a few related questions at a time, keep track of every unanswered relevant question, and do not move on or finalize while any remain unanswered. If I skip a question, ask whether I want to answer it or explicitly mark it unknown/not relevant; only my explicit choice resolves it. Never fill unknowns in yourself, and do not pressure me to disclose sensitive details.
4. Keep interviewing until you have enough clear answers to structure the whole plan. Then summarize my situation, priorities, constraints, and proposed milestones/goals/tasks. Ask me to confirm or correct that summary. If I correct anything, update it and ask for confirmation again. Do not output the final JSON until I explicitly confirm the complete summary and plan.
5. Make a sensible hierarchy: a few meaningful milestones; each milestone has related goals; each goal has actionable tasks; tasks may have small steps. Break large outcomes into realistic stages, sequence dependencies, avoid duplicate or contradictory items, and use my stated capacity. Do not invent dates. Use dates only when I gave or confirmed them; otherwise use null. Keep goal definitions of done measurable when possible. Leave optional details null or use an empty array when unknown.
6. After my final confirmation, return exactly one valid JSON object and nothing else: no Markdown fences, comments, introduction, or trailing explanation. Use double quotes, valid JSON nulls, and this exact structure and field names:

{
  "schemaVersion": 1,
  "planTitle": "My confirmed life plan",
  "milestones": [
    {
      "title": "Milestone title",
      "description": "What completion means, or null",
      "targetDate": "YYYY-MM-DD or null",
      "goals": [
        {
          "title": "Goal title",
          "description": "Clear definition of done, or null",
          "targetDate": "YYYY-MM-DD or null",
          "tasks": [
            {
              "name": "Actionable task",
              "costLabel": "Estimated cost or null",
              "dueDate": "YYYY-MM-DD or null",
              "steps": [
                {
                  "text": "Small action",
                  "dueDate": "YYYY-MM-DD or null",
                  "note": "Helpful detail or null"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Every milestone must contain at least one goal. Use ISO dates only when confirmed. Make the final JSON match the confirmed plan exactly; do not add goals, tasks, assumptions, or personal details I did not approve.`;

function cleanString(value, path, { required = false, max = 300 } = {}) {
  if (value == null && !required) return null;
  if (typeof value !== 'string') throw new Error(`${path} must be text${required ? '' : ' or null'}.`);
  const clean = value.trim();
  if (required && !clean) throw new Error(`${path} is required.`);
  if (clean.length > max) throw new Error(`${path} is too long (maximum ${max} characters).`);
  return clean || null;
}

function cleanDate(value, path) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${path} must use YYYY-MM-DD or null.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${path} is not a real calendar date.`);
  }
  return value;
}

function list(value, path) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${path} must be a list.`);
  return value;
}

function normalizeImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Paste one JSON object.');
  if (raw.schemaVersion !== 1) throw new Error('Unsupported schemaVersion. Use the Automate prompt provided here to generate version 1 JSON.');
  const milestones = list(raw.milestones, 'milestones');
  if (!milestones.length) throw new Error('Add at least one milestone before importing.');
  if (milestones.length > 50) throw new Error('A plan can contain up to 50 milestones at once.');
  let goalCount = 0;
  let taskCount = 0;
  let stepCount = 0;
  const plan = milestones.map((milestone, mi) => {
    const path = `milestones[${mi + 1}]`;
    if (!milestone || typeof milestone !== 'object' || Array.isArray(milestone)) throw new Error(`${path} must be an object.`);
    const goals = list(milestone.goals, `${path}.goals`);
    if (!goals.length) throw new Error(`${path} needs at least one goal.`);
    goalCount += goals.length;
    const normalizedGoals = goals.map((goal, gi) => {
      const goalPath = `${path}.goals[${gi + 1}]`;
      if (!goal || typeof goal !== 'object' || Array.isArray(goal)) throw new Error(`${goalPath} must be an object.`);
      const tasks = list(goal.tasks, `${goalPath}.tasks`);
      taskCount += tasks.length;
      const normalizedTasks = tasks.map((task, ti) => {
        const taskPath = `${goalPath}.tasks[${ti + 1}]`;
        if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error(`${taskPath} must be an object.`);
        const steps = list(task.steps, `${taskPath}.steps`);
        stepCount += steps.length;
        return {
          name: cleanString(task.name, `${taskPath}.name`, { required: true, max: 180 }),
          costLabel: cleanString(task.costLabel, `${taskPath}.costLabel`, { max: 80 }),
          dueDate: cleanDate(task.dueDate, `${taskPath}.dueDate`),
          steps: steps.map((step, si) => {
            const stepPath = `${taskPath}.steps[${si + 1}]`;
            if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`${stepPath} must be an object.`);
            return {
              text: cleanString(step.text, `${stepPath}.text`, { required: true, max: 180 }),
              dueDate: cleanDate(step.dueDate, `${stepPath}.dueDate`),
              note: cleanString(step.note, `${stepPath}.note`, { max: 500 }),
            };
          }),
        };
      });
      return {
        title: cleanString(goal.title, `${goalPath}.title`, { required: true, max: 180 }),
        description: cleanString(goal.description, `${goalPath}.description`, { max: 500 }),
        targetDate: cleanDate(goal.targetDate, `${goalPath}.targetDate`),
        tasks: normalizedTasks,
      };
    });
    return {
      title: cleanString(milestone.title, `${path}.title`, { required: true, max: 180 }),
      description: cleanString(milestone.description, `${path}.description`, { max: 500 }),
      targetDate: cleanDate(milestone.targetDate, `${path}.targetDate`),
      goals: normalizedGoals,
    };
  });
  if (goalCount > 300 || taskCount > 1000 || stepCount > 3000) throw new Error('This plan is too large to import at once. Ask the AI to split it into a smaller plan.');
  return { planTitle: cleanString(raw.planTitle, 'planTitle', { max: 120 }), milestones: plan, goalCount, taskCount, stepCount };
}

function parsePlan(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let raw;
  try { raw = JSON.parse(trimmed); } catch { throw new Error('Could not read this JSON. Paste the complete JSON object without extra text.'); }
  return normalizeImport(raw);
}

export default function AutomateView({ update }) {
  const [copied, setCopied] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(INTERVIEW_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access was blocked. Select the prompt and copy it manually.');
    }
  };

  const reviewJson = () => {
    setError('');
    setStatus('');
    try { setPreview(parsePlan(jsonText)); } catch (cause) { setPreview(null); setError(cause.message); }
  };

  const addPlan = () => {
    if (!preview) return;
    update((current) => {
      let next = current;
      preview.milestones.forEach((milestone) => {
        next = createGoal(next, {
          title: milestone.title,
          types: ['milestone'],
          timingDate: milestone.targetDate,
            timingLabel: milestone.targetDate ? fmtDate(milestone.targetDate) : null,
          definitionOfDone: milestone.description,
        });
        const milestoneId = next.goals[next.goals.length - 1].id;
        milestone.goals.forEach((goal) => {
          next = createGoal(next, {
            milestoneId,
            title: goal.title,
            types: ['goal'],
            timingDate: goal.targetDate,
            timingLabel: goal.targetDate ? fmtDate(goal.targetDate) : null,
            definitionOfDone: goal.description,
            tasks: goal.tasks.map((task) => ({
              ...task,
              dueLabel: task.dueDate ? fmtDate(task.dueDate) : null,
              steps: task.steps.map((step) => ({
                ...step,
                dueLabel: step.dueDate ? fmtDate(step.dueDate) : null,
              })),
            })),
          });
        });
      });
      return next;
    });
    setJsonText('');
    setPreview(null);
    setStatus('Confirmed plan added to your Life Planner. Your existing milestones and goals were kept.');
  };

  return (
    <div className="pb-stack">
      <section className="pb-card pb-auto-intro">
        <span className="pb-auto-icon"><MessageSquareText size={18} /></span>
        <div>
          <h3 className="pb-title">Plan your life with AI</h3>
          <p className="pb-meta">Copy the interview prompt into ChatGPT, Claude, Gemini or DeepSeek, then bring the confirmed JSON plan back here.</p>
        </div>
      </section>

      <div className="pb-grid-2 pb-auto-grid">
        <section className="pb-card pb-auto-step">
          <header className="pb-auto-head">
            <span className="pb-step-num">1</span>
            <div>
              <h3 className="pb-title">Copy the interview prompt</h3>
              <p className="pb-meta">The AI asks questions, summarises your answers and waits for your confirmation.</p>
            </div>
          </header>
          <textarea className="pb-code" value={INTERVIEW_PROMPT} readOnly aria-label="AI life planning interview prompt" />
          <div className="pb-auto-actions">
            <button type="button" className="btn btn-primary btn-sm pb-btn" onClick={copyPrompt}>
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? 'Copied' : 'Copy prompt'}
            </button>
            <span className="pb-meta">Answer its questions and confirm the summary before asking for the JSON.</span>
          </div>
        </section>

        <section className="pb-card pb-auto-step">
          <header className="pb-auto-head">
            <span className="pb-step-num">2</span>
            <div>
              <h3 className="pb-title">Review and import</h3>
              <p className="pb-meta">Paste the AI’s final JSON. We check it and show exactly what will be added.</p>
            </div>
          </header>
          <textarea
            className="pb-code is-editable"
            value={jsonText}
            onChange={(event) => { setJsonText(event.target.value); setPreview(null); setError(''); setStatus(''); }}
            placeholder={'Paste the confirmed JSON here…\n\n{ "schemaVersion": 1, "planTitle": "…", "milestones": [...] }'}
            aria-label="Paste confirmed AI plan JSON"
            spellCheck="false"
          />
          <div className="pb-auto-actions">
            <button type="button" className="pb-btn-soft" onClick={reviewJson} disabled={!jsonText.trim()}>
              <FileJson size={14} /> Review JSON
            </button>
            {preview && (
              <button type="button" className="btn btn-primary btn-sm pb-btn" onClick={addPlan}>
                <Plus size={14} /> Add {preview.milestones.length} milestone{preview.milestones.length === 1 ? '' : 's'}
              </button>
            )}
            {jsonText && !preview && (
              <button type="button" className="pb-btn-ghost" onClick={() => { setJsonText(''); setError(''); setStatus(''); }}>
                <RotateCcw size={13} /> Clear
              </button>
            )}
          </div>
          {error && <p className="pb-note is-alert" role="alert"><AlertCircle size={14} />{error}</p>}
          {status && <p className="pb-note is-ok" role="status"><Check size={14} />{status}</p>}
          {preview && (
            <div className="pb-auto-preview" role="status">
              <strong>Review before adding{preview.planTitle ? `: ${preview.planTitle}` : ''}</strong>
              <p className="pb-meta">{preview.milestones.length} milestones · {preview.goalCount} goals · {preview.taskCount} tasks · {preview.stepCount} steps</p>
              <ul className="pb-auto-tree">
                {preview.milestones.map((milestone, index) => (
                  <li key={`${milestone.title}-${index}`}>
                    <strong>{milestone.title}</strong>
                    <ul>{milestone.goals.map((goal, goalIndex) => (
                      <li key={`${goal.title}-${goalIndex}`}>
                        {goal.title}
                        {goal.tasks.length > 0 && <ul>{goal.tasks.map((task, taskIndex) => <li key={`${task.name}-${taskIndex}`}>{task.name}</li>)}</ul>}
                      </li>
                    ))}</ul>
                  </li>
                ))}
              </ul>
              <span className="pb-meta">Nothing is added until you choose “Add milestones.” Existing planner data stays in place.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
