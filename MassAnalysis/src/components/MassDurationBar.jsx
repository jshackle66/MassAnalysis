import React from 'react';

const MassDurationBar = ({ massPartsData }) => {
  const totalDuration = Object.values(massPartsData).reduce((sum, duration) => sum + duration, 0);

  const partColors = {
    beginning_of_mass: '#FFADAD',
    gloria: '#FFD6A5',
    first_reading: '#FDFFB6',
    gospel: '#CAFFBF',
    homily: '#9BF6FF',
    prayers_of_the_faithful: '#A0C4FF',
    start_of_eucharistic_prayer: '#BDB2FF',
    distribution_of_communion: '#FFC6FF',
    end_of_mass: '#FFFFFC',
  };

  return (
    <div className="mass-duration-bar-container">
      <h4>Mass Part Durations Visualized</h4>
      <div className="mass-duration-bar">
        {Object.entries(massPartsData).map(([partName, duration]) => {
          const widthPercentage = (duration / totalDuration) * 100;
          return (
            <div
              key={partName}
              className="mass-part-segment"
              style={{
                width: `${widthPercentage}%`,
                backgroundColor: partColors[partName] || '#cccccc',
              }}
              title={`${partName}: ${Math.floor(duration / 60)}m ${(duration % 60).toFixed(0)}s`}
            ></div>
          );
        })}
      </div>
      <div className="mass-duration-legend">
        {Object.entries(partColors).map(([partName, color]) => (
          <div key={partName} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: color }}></span>
            <span className="legend-name">{partName.replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MassDurationBar;
