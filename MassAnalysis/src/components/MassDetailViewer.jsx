import React, { useMemo } from 'react';
import Chart from 'chart.js/auto';
import HomilyTranscript from './HomilyTranscript';
import './HomilyTranscript.css';

const massPartOrder = [
    'beginning_of_mass', 
    'gloria', 
    'first_reading', 
    'gospel', 
    'homily', 
    'creed', 
    'prayers_of_the_faithful', 
    'eucharistic_prayer', 
    'distribution_of_communion', 
    'end_of_mass'
];

const MassPartChart = ({ mass, theme, partAverages }) => {
    const chartRef = React.useRef(null);
    const chartInstance = React.useRef(null);

    React.useEffect(() => {
        if (!mass) return;

        const massParts = mass.mass_parts;
        const partDurations = [];

        for (let i = 0; i < massPartOrder.length - 1; i++) {
            const partName = massPartOrder[i];
            
            let nextPartName = null;
            for (let j = i + 1; j < massPartOrder.length; j++) {
                if (massParts[massPartOrder[j]]) {
                    nextPartName = massPartOrder[j];
                    break;
                }
            }

            if (massParts[partName] && nextPartName) {
                const startTime = parseFloat(massParts[partName]);
                const endTime = parseFloat(massParts[nextPartName]);

                if(!isNaN(startTime) && !isNaN(endTime)) {
                    partDurations.push({ name: partName, duration: (endTime - startTime) / 60 });
                }
            }
        }

        const labels = partDurations.map(p => p.name.replace(/_/g, ' '));
        const currentMassData = partDurations.map(p => p.duration);
        const averageMassData = partDurations.map(p => partAverages[p.name] || 0);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const chartContext = chartRef.current.getContext('2d');
        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const currentMassColor = theme === 'dark' ? 'rgba(255, 159, 64, 0.8)' : 'rgba(255, 159, 64, 0.6)';
        const averageMassColor = theme === 'dark' ? 'rgba(54, 162, 235, 0.8)' : 'rgba(54, 162, 235, 0.6)';

        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Current Mass (minutes)',
                    data: currentMassData,
                    backgroundColor: currentMassColor,
                },
                {
                    label: 'Average (minutes)',
                    data: averageMassData,
                    backgroundColor: averageMassColor,
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { title: { display: true, text: 'Duration (min)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

    }, [mass, theme, partAverages]);

    return <canvas ref={chartRef} />;
};

const MassDetailViewer = ({ mass, theme, data, massSortOrder, setMassSortOrder, onNext, onPrev }) => {

    const partAverages = useMemo(() => {
        const averages = {};
        const counts = {};
        
        data.forEach(mass => {
            const massParts = mass.mass_parts;
            for (let i = 0; i < massPartOrder.length - 1; i++) {
                const partName = massPartOrder[i];
                
                let nextPartName = null;
                for (let j = i + 1; j < massPartOrder.length; j++) {
                    if (massParts[massPartOrder[j]]) {
                        nextPartName = massPartOrder[j];
                        break;
                    }
                }

                if (massParts[partName] && nextPartName) {
                    const startTime = parseFloat(massParts[partName]);
                    const endTime = parseFloat(massParts[nextPartName]);

                    if(!isNaN(startTime) && !isNaN(endTime)) {
                        const duration = (endTime - startTime) / 60;
                        averages[partName] = (averages[partName] || 0) + duration;
                        counts[partName] = (counts[partName] || 0) + 1;
                    }
                }
            }
        });

        for (const partName in averages) {
            averages[partName] /= counts[partName];
        }
        return averages;

    }, [data]);

    return (
        <div className="mass-detail-viewer">
            <div className="mass-detail-chart">
                <h3>Mass Part Durations</h3>
                {mass && <MassPartChart mass={mass} theme={theme} partAverages={partAverages} />}
            </div>
            <div className="mass-detail-metadata">
                <h3>Mass Information</h3>
                <div className="controls">
                     <button onClick={() => setMassSortOrder(massSortOrder === 'asc' ? 'desc' : 'asc')}>
                        Order Masses By: {massSortOrder === 'asc' ? 'Shortest to Longest' : 'Longest to Shortest'}
                    </button>
                    <button onClick={onPrev}>&larr; Previous</button>
                    <button onClick={onNext}>Next &rarr;</button>
                </div>
                {mass && (
                    <div>
                        <p><strong>Priest:</strong> {mass.metadata.priest}</p>
                        <p><strong>Location:</strong> {mass.metadata.mass_location}</p>
                        <p><strong>Time:</strong> {mass.metadata.mass_time}</p>
                        <p><strong>Total Duration:</strong> {Math.floor(mass.duration / 60)}m {Math.round(mass.duration % 60)}s</p>
                    </div>
                )}
                {mass && <HomilyTranscript mass={mass} />}
            </div>
        </div>
    );
};

export default MassDetailViewer;
