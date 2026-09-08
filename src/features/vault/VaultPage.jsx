import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, HardDrive, Cpu } from 'lucide-react';
import VaultSelection from './VaultSelection';
import VaultStepProgress from './VaultStepProgress';
import VaultBatchSelector from './VaultBatchSelector';
import MaterialFolders from './MaterialFolders';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
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
  const { isAdmin: _isAdmin } = useAdminMode();
  const [initialSelection] = useState(loadVaultSelection);
  const [department, setDepartment] = useState(initialSelection.department);
  const [yearSem, setYearSem] = useState(initialSelection.yearSem);
  const [batch, setBatch] = useState(null);
  const [searchParams] = useSearchParams();
  const [vaultTab, setVaultTab] = useState(() => {
    const saved = loadVaultSelection();
    return searchParams.get('tab') || saved?.vaultTab || 'batch-drive';
  });

  const handleVaultTabChange = useTabUrlState({
    storageKey: 'aust-vault-active-tab',
    defaultValue: 'batch-drive',
    onChange: setVaultTab,
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
        <div className="vault-coming-soon-wrap">
          <div className="schedule-masthead">
            <div className="schedule-title-block">
              <div className="schedule-icon-tile">
                <Cpu size={22} />
              </div>
              <div>
                <span className="schedule-overline">Resource Vault</span>
                <p className="schedule-title">Carbon Vault</p>
                <span className="schedule-subtitle">Organized notes</span>
              </div>
            </div>
            <div className="schedule-masthead-center" />
            <div className="schedule-actions" />
          </div>
          <div className="vault-coming-soon">
            <Cpu size={48} strokeWidth={1.5} />
            <h3>Carbon Vault</h3>
            <p>Your carbon footprint tracker for semester resources — coming soon!</p>
          </div>
        </div>
      );
    }

    if (!isReady) {
      return (
        <div className="vault-selection-box">
          <div className={`vault-panel-content ${transitioning ? 'vault-panel-exit' : ''}`}>
            {selectionStep === 'batch' ? (
              <VaultBatchSelector
                department={department}
                yearSem={yearSem}
                onSelectBatch={handleSelectBatch}
                progress={
                  <VaultStepProgress
                    currentStep={selectionStep}
                    onStepClick={handleStepNavigation}
                    transitioning={transitioning !== null}
                  />
                }
              />
            ) : (
              <VaultSelection
                  department={department}
                  yearSem={yearSem}
                  onSelectDepartment={handleSelectDepartment}
                  onSelectYearSem={handleSelectYearSem}
                  onBackToDepartments={handleBackToDepartments}
                  onBackToSemesters={handleBackToSemesters}
                  progress={
                    <VaultStepProgress
                      currentStep={selectionStep}
                      onStepClick={handleStepNavigation}
                      transitioning={transitioning !== null}
                    />
                  }
                />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="vault-workspace vault-workspace-enter">
        <div className="vault-content-area">
          <MaterialFolders
            vaultContext={vaultContext}
            progress={
              <VaultStepProgress
                currentStep="ready"
                onStepClick={handleStepNavigation}
                transitioning={transitioning !== null}
              />
            }
          />
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
          onChange={handleVaultTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
      <MastheadAccessControl pageKey={`vault:${vaultTab}`}>
        <div className="vl-content-card" key={vaultTab}>
          <div className="vault-content-area">
            {renderVaultContent()}
          </div>
        </div>
      </MastheadAccessControl>
    </div>
  );
}
