import { useState, useMemo, useEffect } from 'react';
import { Archive, ArrowLeft, Users, HardDrive, Cpu } from 'lucide-react';
import VaultSelection from './VaultSelection';
import VaultStepProgress from './VaultStepProgress';
import VaultBatchSelector from './VaultBatchSelector';
import MaterialFolders from './MaterialFolders';
import GliderTabs from '../../components/GliderTabs';
import { loadVaultSelection, saveVaultSelection } from './vaultSelectionStorage';
import './VaultPage.css';
import './VaultBatchSelector.css';
import './vault-tokens.css';

function getSelectionStep(department, yearSem, batch) {
  if (!department) return 'dept';
  if (!yearSem) return 'sem';
  if (!batch) return 'batch';
  return 'ready';
}

export default function VaultPage() {
  const [initialSelection] = useState(loadVaultSelection);
  const [department, setDepartment] = useState(initialSelection.department);
  const [yearSem, setYearSem] = useState(initialSelection.yearSem);
  const [batch, setBatch] = useState(null);
  const [vaultTab, setVaultTab] = useState(() => {
    const saved = loadVaultSelection();
    return saved?.vaultTab || 'batch-drive';
  });
  const [transitioning, setTransitioning] = useState(null);

  const isReady = Boolean(department && yearSem && batch);
  const selectionStep = getSelectionStep(department, yearSem, batch);

  const vaultContext = useMemo(
    () => ({ department, yearSem, batch, course: null, courseName: yearSem || '', courseType: 'Theory' }),
    [department, yearSem, batch],
  );

  useEffect(() => {
    saveVaultSelection({ department, yearSem, vaultTab });
  }, [department, yearSem, vaultTab]);

  const handleSelectDepartment = (nextDepartment) => {
    setDepartment(nextDepartment);
    setYearSem(null);
    setBatch(null);
  };

  const handleSelectYearSem = (nextYearSem) => {
    setYearSem(nextYearSem);
    setBatch(null);
  };

  const handleSelectBatch = (nextBatch) => {
    setBatch(nextBatch);
  };

  const handleBackToDepartments = () => {
    setDepartment(null);
    setYearSem(null);
    setBatch(null);
  };

  const handleBackToSemesters = () => {
    setYearSem(null);
    setBatch(null);
  };

  const handleBackToBatches = () => {
    setBatch(null);
  };

  const handleStepNavigation = (stepId) => {
    setTransitioning(stepId);
    setTimeout(() => {
      switch (stepId) {
        case 'dept':
          handleBackToDepartments();
          break;
        case 'sem':
          handleBackToSemesters();
          break;
        case 'batch':
          handleBackToBatches();
          break;
        default:
          break;
      }
      setTransitioning(null);
    }, 350);
  };

  const vaultTabs = [
    { id: 'batch-drive', label: 'Batch Drive', icon: HardDrive, desc: 'Study materials & drive', color: 'amber' },
    { id: 'carbon-vault', label: 'Carbon Vault', icon: Cpu, desc: 'Coming soon', color: 'emerald' },
  ];


  const renderVaultContent = () => {
    if (vaultTab === 'carbon-vault') {
      return (
        <div className="vault-coming-soon">
          <Cpu size={48} strokeWidth={1.5} />
          <h3>Carbon Vault</h3>
          <p>Your carbon footprint tracker for semester resources — coming soon!</p>
        </div>
      );
    }

    if (!isReady) {
      return (
        <div className="vault-selection-box">
          <VaultStepProgress
            currentStep={selectionStep}
            onStepClick={handleStepNavigation}
            transitioning={transitioning !== null}
          />
          <div className={`vault-panel-content ${transitioning ? 'vault-panel-exit' : ''}`}>
            {selectionStep === 'batch' ? (
              <VaultBatchSelector
                department={department}
                yearSem={yearSem}
                onSelectBatch={handleSelectBatch}
              />
            ) : (
              <VaultSelection
                department={department}
                yearSem={yearSem}
                onSelectDepartment={handleSelectDepartment}
                onSelectYearSem={handleSelectYearSem}
                onBackToDepartments={handleBackToDepartments}
                onBackToSemesters={handleBackToSemesters}
              />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="vault-workspace vault-workspace-enter">
        <div className="vault-sem-context-bar">
          <button
            type="button"
            className="vault-back-btn"
            onClick={handleBackToBatches}
            title="Change batch"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="vault-sem-context-info">
            <h2 className="vault-sem-context-title">{department} — Semester {yearSem}</h2>
            <p className="vault-sem-context-sub">
              <Users size={12} /> {batch.batchName} · Lecture notes & study materials
            </p>
          </div>
          <button
            type="button"
            className="vault-change-sem-btn"
            onClick={handleBackToBatches}
          >
            Change Batch
          </button>
        </div>

        <div className="vault-content-area">
          <MaterialFolders vaultContext={vaultContext} />
        </div>
      </div>
    );
  };

  return (
    <div className="vault-page animate-fadeIn">

      {/* ── 1. Hero box (own card) ── */}
      <header className="vl-hero">
        <div className="vl-hero-content">
          <div className="vl-hero-eyebrow">
            <span className="vl-hero-period-icon">
              <Archive size={16} />
            </span>
            <span className="vl-hero-date-label">
              Resource vault
            </span>
          </div>
          <h1 className="vl-hero-title">
            Resource<span className="vl-hero-name"> Vault</span>
          </h1>
          <p className="vl-hero-subtitle">
            {vaultTab === 'carbon-vault'
              ? 'Monitor your semester resource emissions'
              : (isReady
                ? `${department} — Semester ${yearSem} · ${batch.batchName}`
                : 'Pick the semester. Unlock lecture notes, papers & more.')}
          </p>
        </div>
      </header>

      {/* ── 2. Glider tabs bar (own card) ── */}
      <div className="glass-card-static vl-tabs-card">
        <GliderTabs
          tabs={vaultTabs}
          activeTab={vaultTab}
          onChange={setVaultTab}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card) ── */}
      <div className="vl-content-card" key={vaultTab}>
        <div className="vault-content-area">
          {renderVaultContent()}
        </div>
      </div>
    </div>
  );
}
