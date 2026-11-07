import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, HardDrive, Cpu, Link2, KeyRound, NotebookPen } from 'lucide-react';
import VaultSelection from './VaultSelection';
import VaultStepProgress from './VaultStepProgress';
import VaultBatchSelector from './VaultBatchSelector';
import BatchDriveManager from './BatchDriveManager';
import BatchDriveLockPanel from './BatchDriveLockPanel';
import BatchDriveCodeGenerate from './BatchDriveCodeGenerate';
import MaterialFolders from './MaterialFolders';
import GliderTabs from '../../components/GliderTabs';
import MastheadAccessControl from '../../components/MastheadAccessControl';
import FeatureAccessGate from '../admin/FeatureAccessGate';
import SidebarPageAccessPanel, { SidebarPageAccessHeader } from '../admin/SidebarPageAccessPanel';
import useTabUrlState from '../../hooks/useTabUrlState';
import useAdminMode from '../../hooks/useAdminMode';
import { useBatchDriveLock } from '../../hooks/useBatchDriveLock';
import { useAuth } from '../../context/AuthContext';
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
  const { isAdmin } = useAdminMode();
  const { user } = useAuth();
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

  // Only CR/SR of a batch may manage the shared semester Drive links.
  const canManageDrive = Boolean(
    user && (
      user.role === 'cr' || user.role === 'sr'
      || user.hasRole?.('cr') || user.hasRole?.('sr')
    ),
  );
  const activeTab = vaultTab === 'drive-links' && !canManageDrive ? 'batch-drive' : vaultTab;

  // Batch Drive lock — semester 1–4 + all CR/SR need a code from an
  // own-department 3.1+ student. Drive Links (CR/SR editor) is separate
  // and stays open, but eligible 3.1+ users also get the generator there.
  const lock = useBatchDriveLock({
    enabled: activeTab === 'batch-drive' || activeTab === 'drive-links' || activeTab === 'code-generate',
  });
  const isBatchDriveLocked = Boolean(activeTab === 'batch-drive' && lock.status?.locked);

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
    { id: 'notebook', label: 'Notebook', icon: NotebookPen, desc: 'Coming soon', color: 'amber', accessKey: 'feature:vault:notebook' },
    { id: 'batch-drive', label: 'Batch Drive', icon: HardDrive, desc: 'Study materials & drive', color: 'amber', accessKey: 'feature:vault:batch-drive' },
    ...(canManageDrive
      ? [{ id: 'drive-links', label: 'Drive Links', icon: Link2, desc: 'CR/SR semester links', color: 'amber', accessKey: 'feature:vault:drive-links' }]
      : []),
    { id: 'carbon-vault', label: 'Carbon Vault', icon: Cpu, desc: 'Coming soon', color: 'emerald', accessKey: 'feature:vault:carbon-vault' },
    { id: 'code-generate', label: 'Code Generate', icon: KeyRound, desc: 'Semester 3.1+ share code', color: 'amber', accessKey: 'feature:vault:code-generate' },
  ];


  const lockPanel = (
    <BatchDriveLockPanel
      status={lock.status}
      loading={lock.loading}
      onGenerate={lock.generateCode}
      onToggle={lock.toggleShare}
      onRedeem={lock.redeemCode}
      onRefresh={lock.refresh}
    />
  );

  const renderVaultContent = () => {
    if (activeTab === 'drive-links') {
      return (
        <>
          {lock.status?.canShare ? (
            <BatchDriveLockPanel
              status={lock.status}
              loading={lock.loading}
              onGenerate={lock.generateCode}
              onToggle={lock.toggleShare}
              onRedeem={lock.redeemCode}
              onRefresh={lock.refresh}
              showLockForm={false}
            />
          ) : null}
          <BatchDriveManager />
        </>
      );
    }

    if (activeTab === 'carbon-vault') {
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

    if (activeTab === 'notebook') {
      return (
        <div className="vault-coming-soon-wrap">
          <div className="schedule-masthead">
            <div className="schedule-title-block">
              <div className="schedule-icon-tile">
                <NotebookPen size={22} />
              </div>
              <div>
                <span className="schedule-overline">Resource Vault</span>
                <p className="schedule-title">Notebook</p>
                <span className="schedule-subtitle">Handwritten notes</span>
              </div>
            </div>
            <div className="schedule-masthead-center" />
            <div className="schedule-actions" />
          </div>
          <div className="vault-coming-soon">
            <NotebookPen size={48} strokeWidth={1.5} />
            <h3>Coming Soon</h3>
            <p>A real pen-and-paper notebook — with Apple Pencil pressure, shapes, and paper templates. Coming soon!</p>
          </div>
        </div>
      );
    }

    if (activeTab === 'code-generate') {
      return (
        <BatchDriveCodeGenerate
          status={lock.status}
          loading={lock.loading}
          onGenerate={lock.generateCode}
          onToggle={lock.toggleShare}
          onRedeem={lock.redeemCode}
          onRefresh={lock.refresh}
        />
      );
    }

    if (isBatchDriveLocked) {
      return lockPanel;
    }

    if (!isReady) {
      return (
        <div className="vault-selection-box">
          <div className={`vault-panel-content ${transitioning ? 'vault-panel-exit' : ''}`}>
            {lock.status?.canShare ? lockPanel : null}
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
          {lock.status?.canShare ? lockPanel : null}
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
      {isAdmin ? <SidebarPageAccessHeader pageKey="/vault" /> : <header className="vl-hero">
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
            {activeTab === 'notebook'
              ? 'Handwritten notes with pen and paper — coming soon'
              : activeTab === 'carbon-vault'
              ? 'Monitor your semester resource emissions'
              : activeTab === 'code-generate'
                ? 'Semester 3.1 and above — generate single-use codes for your juniors'
              : activeTab === 'drive-links'
                ? 'CR / SR — keep every semester Drive link up to date'
                : (isReady
                  ? `${department} — Semester ${yearSem} · ${batch.batchName}`
                  : 'Pick the semester. Unlock lecture notes, papers & more.')}
          </p>
        </div>
      </header>}

      {/* ── 2. Glider tabs bar (own card) ── */}
      {isAdmin && <SidebarPageAccessPanel pageKey="/vault" part="parent" />}
      <div className="glass-card-static vl-tabs-card">
        <GliderTabs
          tabs={vaultTabs}
          activeTab={activeTab}
          onChange={handleVaultTabChange}
          variant="dashboard"
          compact
        />
      </div>

      {/* ── 3. Main content box (own card, gated by per-tab featureHidden) ── */}
      {isAdmin ? <SidebarPageAccessPanel pageKey="/vault" featureKey={`feature:vault:${activeTab}`} part="child" /> : <MastheadAccessControl>
        <div className="vl-content-card" key={activeTab}>
          <div className="vault-content-area">
            <FeatureAccessGate featureKey={`feature:vault:${activeTab}`}>
              {renderVaultContent()}
            </FeatureAccessGate>
          </div>
        </div>
      </MastheadAccessControl>}
    </div>
  );
}
