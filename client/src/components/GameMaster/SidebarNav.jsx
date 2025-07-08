import React from 'react';
import './SidebarNav.css';

/**
 * SidebarNav Component
 * A sidebar navigation component for the Game Master Dashboard
 * 
 * @param {Object} props - Component props
 * @param {Array} props.items - Array of navigation items with { id, label, icon }
 * @param {string} props.activeItem - ID of the active item
 * @param {Function} props.onItemClick - Function to call when an item is clicked
 */
const SidebarNav = ({ items, activeItem, onItemClick }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="sidebar-nav">
      <ul className="sidebar-nav-list">
        {items.map(item => (
          <li 
            key={item.id} 
            className={`sidebar-nav-item ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => onItemClick(item.id)}
          >
            {item.icon && <span className="sidebar-nav-icon">{item.icon}</span>}
            <span className="sidebar-nav-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SidebarNav;
