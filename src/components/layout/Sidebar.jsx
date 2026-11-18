import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import iconsData from '../../data/arusIcons.json';

export default function Sidebar({ collapsed, onToggleCollapse, onNavigateItem }) {
  const renderIcon = (name) => {
    const raw = iconsData[name];
    if (!raw) return null;
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  };

  const engineeringModules = [
    { route: 'resistance', title: 'Resistance & Extrapolation', icon: 'resistance' },
    { route: 'performance', title: 'Propeller Performance', icon: 'overview' },
    { route: 'selection', title: 'Propeller Selection', icon: 'propeller' },
    { route: 'geometry', title: 'Propeller CAD Geometry', icon: 'geometry' },
    { route: 'propulsion', title: 'Propulsion Interaction', icon: 'wake' },
    {
      route: 'integrated',
      title: 'Integrated Calculation',
      customIcon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M3 7h5l4 5 4-5h5M3 17h5l4-5 4 5h5" />
          <circle cx="3" cy="7" r="1" />
          <circle cx="3" cy="17" r="1" />
        </svg>
      )
    }
  ];

  const supportLinks = [
    { route: 'history', title: 'History', icon: 'history' },
    { route: 'guide', title: 'Guide Book', icon: 'guide' },
    { route: 'contact', title: 'Contact Us', icon: 'contact' }
  ];

  const accountLinks = [
    { route: 'account', title: 'My Account', icon: 'account' },
    { route: 'payment', title: 'Payments / QRIS', icon: 'payment' }
  ];

  return (
    <aside
      className={`sidebar app-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      id="module-nav"
      aria-label="ARUS navigation"
    >
      <div className="sidebar-heading">
        <Link
          className="brand"
          to="/resistance"
          onClick={onNavigateItem}
          title="ARUS Marine Engineering"
        >
          <div className="brand-logo">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path
                d="M3 19c5-2 7-9 13-9 5 0 7 6 13 5M3 26c5-2 7-9 13-9 5 0 7 6 13 5"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          {!collapsed && (
            <div className="brand-text">
              <div className="brand-name">ARUS</div>
              <div className="brand-tag">MARINE ENGINEERING</div>
            </div>
          )}
        </Link>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          className="sidebar-toggle-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar (perkecil sidebar)'}
          aria-label="Toggle sidebar collapse"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              /* Expand icon: >> */
              <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
            ) : (
              /* Collapse icon: << */
              <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
            )}
          </svg>
        </button>
      </div>

      {!collapsed && <div className="nav-caption">Engineering workflow</div>}
      <nav id="module-links">
        {engineeringModules.map((item) => (
          <NavLink
            key={item.route}
            to={`/${item.route}`}
            onClick={onNavigateItem}
            className={({ isActive }) => `module-link nav-item ${isActive ? 'active' : ''}`}
            title={item.title}
          >
            {item.customIcon ? item.customIcon : renderIcon(item.icon)}
            {!collapsed && <span className="nav-label">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && <div className="nav-subgroup">PROJECT &amp; SUPPORT</div>}
      <nav id="support-links">
        {supportLinks.map((item) => (
          <NavLink
            key={item.route}
            to={`/${item.route}`}
            onClick={onNavigateItem}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={item.title}
          >
            {renderIcon(item.icon)}
            {!collapsed && <span className="nav-label">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && <div className="nav-subgroup">ACCOUNT &amp; BILLING</div>}
      <nav id="account-links">
        {accountLinks.map((item) => (
          <NavLink
            key={item.route}
            to={`/${item.route}`}
            onClick={onNavigateItem}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={item.title}
          >
            {renderIcon(item.icon)}
            {!collapsed && <span className="nav-label">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="sidebar-bottom">
          <div className="sb-label">Calculation workspace</div>
          <div className="sb-title">Available offline</div>
          <div className="sb-text">Your calculation tools run on this device.</div>
          <div className="sb-status">
            <span className="status-dot"></span> Ready to calculate
          </div>
        </div>
      )}
    </aside>
  );
}
