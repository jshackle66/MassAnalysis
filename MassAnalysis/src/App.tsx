import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import MassDurationHistogram from './components/MassDurationHistogram';
import PriestStats from './components/PriestStats';
import LocationTimeStats from './components/LocationTimeStats';
import MassDetailViewer from './components/MassDetailViewer';
import HomilyStats from './components/HomilyStats';
import HomilyKeywordHistogram from './components/HomilyKeywordHistogram';
import useIntersectionObserver from './hooks/useIntersectionObserver';
import './App.css';
import './components/Header.css';
import './components/PriestStats.css';
import './components/LocationTimeStats.css';
import './components/MassDetailViewer.css';
import './components/HomilyStats.css';
import './components/HomilyKeywordHistogram.css';
import './components/HomilyTranscript.css';
import { Mass } from './types';

const GraphSection: React.FC<{children: React.ReactNode}> = ({ children }) => {
    const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.5 });

    return (
        <div ref={ref} className={`graph-section ${isIntersecting ? 'is-visible' : ''}`}>
            {children}
        </div>
    );
};

function App() {
  const [theme, setTheme] = useState('light');
  const [massType, setMassType] = useState('sunday'); // 'sunday' or 'daily'
  const [massData, setMassData] = useState<Mass[]>([]);
  const [massSortOrder, setMassSortOrder] = useState('asc');
  const [currentMassIndex, setCurrentMassIndex] = useState(0);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/results.json');
        const data = await response.json();
        setMassData(data);
      } catch (error) {
        console.error("Error fetching mass data:", error);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => massData.filter(mass => {
    if (massType === 'sunday') {
      return mass.metadata.is_sunday;
    }
    if (massType === 'daily') {
      return !mass.metadata.is_sunday;
    }
    return true;
  }), [massData, massType]);

  const sortedMasses = useMemo(() => {
    const massesWithDuration = filteredData.map(mass => {
        const start = parseFloat(mass.mass_parts.beginning_of_mass as string);
        const end = parseFloat(mass.mass_parts.end_of_mass as string);
        const duration = (!isNaN(start) && !isNaN(end)) ? end - start : 0;
        return { ...mass, duration };
    });

    if (massSortOrder === 'asc') {
        massesWithDuration.sort((a, b) => (a.duration || 0) - (b.duration || 0));
    } else {
        massesWithDuration.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }
    return massesWithDuration;
  }, [filteredData, massSortOrder]);

  useEffect(() => {
    setCurrentMassIndex(0);
  }, [sortedMasses]);

  const handleNextMass = () => {
      setCurrentMassIndex(prev => (prev + 1) % sortedMasses.length);
  };

  const handlePrevMass = () => {
      setCurrentMassIndex(prev => (prev - 1 + sortedMasses.length) % sortedMasses.length);
  };

  const currentMass = sortedMasses[currentMassIndex];

  const averageDuration = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const totalDuration = filteredData.reduce((acc, mass) => {
      const start = parseFloat(mass.mass_parts.beginning_of_mass as string);
      const end = parseFloat(mass.mass_parts.end_of_mass as string);
      if (!isNaN(start) && !isNaN(end)) {
        return acc + (end - start);
      }
      return acc;
    }, 0);
    return totalDuration / filteredData.length;
  }, [filteredData]);

  const averageMinutes = Math.floor(averageDuration / 60);
  const averageSeconds = Math.round(averageDuration % 60);

  return (
    <div className="app-container">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        massType={massType}
        setMassType={setMassType}
      />
      <main className="main-content-scrolling">
        <GraphSection>
            <h2>Mass Duration Histogram ({massType})</h2>
            {filteredData.length > 0 && (
              <div className="stats-container">
                <h3>Average Mass Duration: {averageMinutes}m {averageSeconds}s</h3>
              </div>
            )}
            <MassDurationHistogram data={filteredData} theme={theme} />
        </GraphSection>
        
        <GraphSection>
            <PriestStats data={filteredData} theme={theme} />
        </GraphSection>

        <GraphSection>
            <LocationTimeStats data={filteredData} theme={theme} />
        </GraphSection>

        <GraphSection>
            <MassDetailViewer 
                mass={currentMass} 
                theme={theme} 
                data={filteredData}
                massSortOrder={massSortOrder}
                setMassSortOrder={setMassSortOrder}
                onNext={handleNextMass}
                onPrev={handlePrevMass}
            />
        </GraphSection>

        <GraphSection>
            <HomilyStats data={filteredData} theme={theme} />
        </GraphSection>

        <GraphSection>
            <HomilyKeywordHistogram data={filteredData} theme={theme} />
        </GraphSection>
      </main>
    </div>
  );
}

export default App;
