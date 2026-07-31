import React, { useState, useMemo, useEffect } from 'react';
import { Archive, ArrowLeft, Users, StickyNote, BookOpen, HardDrive, Cpu } from 'lucide-react';
import VaultSelection from './VaultSelection';
import VaultStepProgress from './VaultStepProgress';
import VaultBatchSelector from './VaultBatchSelector';
import MaterialFolders from './MaterialFolders';
import Notebook from './Notebook';

import GliderTabs from '../../components/GliderTabs';
import { loadVaultSelection, saveVaultSelection } from './vaultSelectionStorage';
import './VaultPage.css';
import './VaultBatchSelector.css';
import './Notebook.css';

import '../../components/PageHero.css';

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
  const [activeTab, setActiveTab] = useState(() => {
    const saved = loadVaultSelection();
    return saved?.activeTab || 'materials';
  });
  const [transitioning, setTransitioning] = useState(null);

  const isReady = Boolean(department && yearSem && batch);
  const selectionStep = getSelectionStep(department, yearSem, batch);

  const vaultContext = useMemo(
    () => ({ department, yearSem, batch, course: null, courseName: yearSem || '', courseType: 'Theory' }),
    [department, yearSem, batch],
  );

  useEffect(() => {
    saveVaultSelection({ department, yearSem, activeTab, vaultTab });
  }, [department, yearSem, activeTab, vaultTab]);

  const handleSelectDepartment = (nextDepartment) => {
    setDepartment(nextDepartment);
    setYearSem(null);
    setBatch(null);
  };

  const handleSelectYearSem = (nextYearSem) => {
    setYearSem(nextYearSem);
    setBatch(null);
    setActiveTab('materials');
  };

  const handleSelectBatch = (nextBatch) => {
    setBatch(nextBatch);
    setActiveTab('materials');
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
    { id: 'batch-drive', label: 'Batch Drive', icon: HardDrive, desc: 'Study materials & drive', color: 'blue' },
    { id: 'carbon-vault', label: 'Carbon Vault', icon: Cpu, desc: 'Coming soon', color: 'emerald' },
  ];

  const tabs = [
    { id: 'materials', label: 'Materials', icon: BookOpen },
    { id: 'notebook', label: 'Notebook', icon: StickyNote },
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'notebook':
        return <Notebook vaultContext={vaultContext} batch={batch} />;
      default:
        return <MaterialFolders vaultContext={vaultContext} />;
    }
  };

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
          <div className="vault-inner-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`vault-inner-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {renderActiveTab()}
        </div>
      </div>
    );
  };

  return (
    <div className="vault-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <Archive size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Vault</span>
              </h1>
              <p className="page-hero-subtitle">
                {vaultTab === 'carbon-vault'
                  ? 'Monitor your semester resource emissions'
                  : (isReady
                    ? `${department} — Semester ${yearSem} · ${batch.batchName}`
                    : 'Pick your semester. Unlock lecture notes, papers & more.')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <GliderTabs
        tabs={vaultTabs}
        activeTab={vaultTab}
        onChange={setVaultTab}
        variant="vault"
      />

      <div className="vault-content-area" key={vaultTab}>
        {renderVaultContent()}
      </div>
    </div>
  );
}
