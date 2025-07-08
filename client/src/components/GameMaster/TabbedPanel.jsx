import React, { useState } from 'react';
import './TabbedPanel.css';

/**
 * TabbedPanel Component
 * A reusable tabbed interface component for the Game Master Dashboard
 * 
 * @param {Object} props - Component props
 * @param {Array} props.tabs - Array of tab objects with { id, label, content }
 * @param {string} props.defaultTab - ID of the default active tab
 * @param {string} props.title - Optional title for the panel
 */
const TabbedPanel = ({ tabs, defaultTab, title }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || (tabs.length > 0 ? tabs[0].id : null));

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className="tabbed-panel">
      {title && <h3 className="tabbed-panel-title">{title}</h3>}
      
      <div className="tabbed-panel-header">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="tabbed-panel-content">
        {activeTabContent}
      </div>
    </div>
  );
};

export default TabbedPanel;
