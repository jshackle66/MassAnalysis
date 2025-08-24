import React from 'react';
import './Header.css';

interface HeaderProps {
  theme: string;
  toggleTheme: () => void;
  massType: string;
  setMassType: (massType: string) => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, massType, setMassType }) => {
  return (
    <header className="app-header">
      <h1 className="app-title">Mass Analysis</h1>
      <div className="header-controls">
        <div className="toggle-switch">
          <span>{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
          <label className="theme-switch">
            <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
            <span className="theme-slider round"></span>
          </label>
        </div>
        <div className="mass-type-toggle">
          <label>
            <input type="radio" name="massType" value="sunday" checked={massType === 'sunday'} onChange={() => setMassType('sunday')} />
            Sunday
          </label>
          <label>
            <input type="radio" name="massType" value="daily" checked={massType === 'daily'} onChange={() => setMassType('daily')} />
            Daily
          </label>
        </div>
      </div>
    </header>
  );
};

export default Header;
