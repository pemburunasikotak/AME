import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import ModuleHeader from './layout/ModuleHeader';
import WorkflowStages from './workflow/WorkflowStages';
import ResistanceModule from './modules/ResistanceModule';
import PerformanceModule from './modules/PerformanceModule';
import SelectionModule from './modules/SelectionModule';
import GeometryModule from './modules/GeometryModule';
import PropulsionModule from './modules/PropulsionModule';
import IntegratedModule from './modules/IntegratedModule';
import HistoryPage from './pages/HistoryPage';
import GuidePage from './pages/GuidePage';
import ContactPage from './pages/ContactPage';
import AccountPage from './pages/AccountPage';
import PaymentPage from './pages/PaymentPage';
import calculationService from '../services/calculationService';
import '../styles/arusStudio.css';

const routeTitles = {
  resistance: 'Resistance & Extrapolation',
  performance: 'Propeller Performance',
  selection: 'Propeller Selection',
  geometry: 'Propeller CAD Geometry',
  propulsion: 'Propulsion Interaction',
  integrated: 'Integrated Calculation',
  history: 'History',
  guide: 'Guide Book',
  contact: 'Contact Us',
  account: 'My Account',
  payment: 'Payments & QRIS'
};

const moduleMeta = {
  resistance: {
    title: 'Resistance & Extrapolation',
    description: 'Compare ship resistance predictions across multiple methods and extrapolate model-test data to full scale.'
  },
  performance: {
    title: 'Propeller Performance',
    description: 'Generate KT–KQ–J open-water performance curves and numerical tables across supported propeller series.'
  },
  selection: {
    title: 'Propeller Selection',
    description: 'Find matching propeller dimensions and evaluate open-water efficiency from resistance or engine operating requirements.'
  },
  geometry: {
    title: 'Propeller CAD Geometry',
    description: 'Build and inspect propeller geometry, edit radial stations, and inspect section and offset data.'
  },
  propulsion: {
    title: 'Propulsion Interaction',
    description: 'Estimate wake fraction and thrust deduction factors to relate open-water performance to behind-hull conditions.'
  },
  integrated: {
    title: 'Integrated Calculation',
    description: 'Resistance-based KT propeller optimisation and engine performance evaluation.'
  }
};

export default function StudioShell({ onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentRoute = location.pathname.replace(/^\//, '') || 'resistance';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('arus_sidebar_collapsed') === 'true';
  });
  const [saveStatus, setSaveStatus] = useState('');

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('arus_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleSaveHistory = async () => {
    try {
      await calculationService.saveCalculation({
        title: routeTitles[currentRoute] || 'Module Calculation',
        method: currentRoute,
        snapshot: `Saved calculation snapshot for ${routeTitles[currentRoute]}`
      });
      setSaveStatus('Calculation saved to History');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch {
      setSaveStatus('Storage full or unavailable');
    }
  };

  const isCalcModule = ['resistance', 'performance', 'selection', 'geometry', 'propulsion', 'integrated'].includes(currentRoute);

  return (
    <div className={`shell workspace-shell ${sidebarOpen ? 'nav-open' : ''} ${collapsed ? 'shell-sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onNavigateItem={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <button
          id="nav-scrim"
          className="nav-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main main-column">
        <Topbar
          crumb={routeTitles[currentRoute] || 'Resistance'}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSaveHistory={handleSaveHistory}
          saveDisabled={!isCalcModule}
          saveStatus={saveStatus}
          onLogout={onLogout}
        />

        <main className="content" id="main" style={{ height: 'auto', minHeight: 'auto' }}>
          <Routes>
            {/* Calculation Modules */}
            <Route
              path="/resistance"
              element={
                <CalculationWrapper meta={moduleMeta.resistance}>
                  <ResistanceModule />
                </CalculationWrapper>
              }
            />
            <Route
              path="/performance"
              element={
                <CalculationWrapper meta={moduleMeta.performance}>
                  <PerformanceModule />
                </CalculationWrapper>
              }
            />
            <Route
              path="/selection"
              element={
                <CalculationWrapper meta={moduleMeta.selection}>
                  <SelectionModule />
                </CalculationWrapper>
              }
            />
            <Route
              path="/geometry"
              element={
                <CalculationWrapper meta={moduleMeta.geometry}>
                  <GeometryModule />
                </CalculationWrapper>
              }
            />
            <Route
              path="/propulsion"
              element={
                <CalculationWrapper meta={moduleMeta.propulsion}>
                  <PropulsionModule />
                </CalculationWrapper>
              }
            />
            <Route
              path="/integrated"
              element={
                <CalculationWrapper meta={moduleMeta.integrated}>
                  <IntegratedModule />
                </CalculationWrapper>
              }
            />

            {/* Support Pages */}
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/account" element={<AccountPage onNavigate={(r) => navigate(`/${r}`)} onLogout={onLogout} />} />
            <Route path="/payment" element={<PaymentPage onNavigate={(r) => navigate(`/${r}`)} />} />

            {/* Default fallback */}
            <Route path="*" element={<Navigate to="/resistance" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function CalculationWrapper({ meta, children }) {
  return (
    <section className="calculation-page" id="calculation-page">
      <ModuleHeader
        title={meta?.title}
        description={meta?.description}
      />
      <WorkflowStages currentStage={1} />
      {children}
    </section>
  );
}
