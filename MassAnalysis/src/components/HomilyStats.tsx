import React, { useState, useEffect, useRef } from 'react';
import { Mass } from '../types';
import Chart from 'chart.js/auto';

interface HomilyStatsProps {
    data: Mass[];
    theme: string;
}

const massPartOrder = [
    'homily', 
    'creed', 
    'prayers_of_the_faithful', 
    'eucharistic_prayer', 
];

const getHomilyDuration = (mass: Mass): number | null => {
    const massParts = mass.mass_parts;
    const homilyStart = parseFloat(massParts.homily as string);
    if(isNaN(homilyStart)) return null;

    let nextPartName: string | null = null;
    for (let i = 1; i < massPartOrder.length; i++) {
        if (massParts[massPartOrder[i]]) {
            nextPartName = massPartOrder[i];
            break;
        }
    }

    if (nextPartName) {
        const nextPartStart = parseFloat(massParts[nextPartName] as string);
        if(!isNaN(nextPartStart)) {
            return (nextPartStart - homilyStart) / 60; // in minutes
        }
    }
    return null;
}

const PriestAverageHomilyChart: React.FC<HomilyStatsProps> = ({ data, theme }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (data.length === 0) return;

        const priestData: { [key: string]: { totalDuration: number, count: number } } = {};
        data.forEach(mass => {
            const priest = mass.metadata.priest;
            if (!priest) return;
            if (!priestData[priest]) {
                priestData[priest] = { totalDuration: 0, count: 0 };
            }
            const duration = getHomilyDuration(mass);
            if (duration !== null) {
                priestData[priest].totalDuration += duration;
                priestData[priest].count++;
            }
        });

        const priestLabels = Object.keys(priestData);
        const avgDurations = priestLabels.map(priest => priestData[priest].count > 0 ? priestData[priest].totalDuration / priestData[priest].count : 0);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;

        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const barBackgroundColor = theme === 'dark' ? 'rgba(75, 192, 192, 0.8)' : 'rgba(75, 192, 192, 0.6)';


        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: priestLabels,
                datasets: [{
                    label: 'Average Homily Duration (minutes)',
                    data: avgDurations,
                    backgroundColor: barBackgroundColor,
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Priest', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: 'Avg. Duration (min)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

    }, [data, theme]);

    return <canvas ref={chartRef} />;
};

interface PriestHomilyHistogramProps {
    data: Mass[];
    priest: string;
    theme: string;
}

const PriestHomilyHistogram: React.FC<PriestHomilyHistogramProps> = ({ data, priest, theme }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        const filteredData = data.filter(mass => mass.metadata.priest === priest);
        if (filteredData.length === 0) {
            if(chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            return;
        };

        const homilyDurations = filteredData.map(getHomilyDuration).filter((d): d is number => d !== null);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;
        
        const numBins = homilyDurations.length > 0 ? Math.ceil(Math.sqrt(homilyDurations.length)) : 1;
        const minDuration = homilyDurations.length > 0 ? Math.min(...homilyDurations) : 0;
        const maxDuration = homilyDurations.length > 0 ? Math.max(...homilyDurations) : 1;
        const binWidth = (maxDuration - minDuration) / numBins;

        const bins: { [key: number]: number } = {};
        if (homilyDurations.length > 0) {
            for (let i = 0; i < numBins; i++) {
                const binStart = minDuration + i * binWidth;
                bins[binStart] = 0;
            }

            homilyDurations.forEach(duration => {
                const binIndex = Math.floor((duration - minDuration) / binWidth);
                const binStart = minDuration + binIndex * binWidth;
                if(bins[binStart] !== undefined) {
                    bins[binStart]++;
                }
            });
        }

        const labels = Object.keys(bins).map(binStart => {
            const start = parseFloat(binStart).toFixed(1);
            const end = (parseFloat(binStart) + binWidth).toFixed(1);
            return `${start} - ${end}`;
        });
        const chartData = Object.values(bins);

        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const barBackgroundColor = theme === 'dark' ? 'rgba(255, 99, 132, 0.8)' : 'rgba(255, 99, 132, 0.6)';

        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `Homily Durations for ${priest}`,
                    data: chartData,
                    backgroundColor: barBackgroundColor,
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Duration (min)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: 'Frequency', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

    }, [data, priest, theme]);

    return <canvas ref={chartRef} />;
};


const HomilyStats: React.FC<HomilyStatsProps> = ({ data, theme }) => {
    const [selectedPriest, setSelectedPriest] = useState('');
    const [priests, setPriests] = useState<string[]>([]);

    useEffect(() => {
        const uniquePriests = [...new Set(data.map(mass => mass.metadata.priest))].filter(p => p);
        setPriests(uniquePriests);
        if (uniquePriests.length > 0) {
            setSelectedPriest(uniquePriests[0]);
        }
    }, [data]);

    return (
        <div className="homily-stats-container">
            <div className="chart-container">
                <h3>Average Homily Duration by Priest</h3>
                <PriestAverageHomilyChart data={data} theme={theme} />
            </div>
            <div className="chart-container">
                <h3>
                    Homily Duration Histogram for
                    <select value={selectedPriest} onChange={e => setSelectedPriest(e.target.value)}>
                        {priests.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </h3>
                <PriestHomilyHistogram data={data} priest={selectedPriest} theme={theme} />
            </div>
        </div>
    );
};

export default HomilyStats;