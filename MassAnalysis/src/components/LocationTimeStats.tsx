import React, { useState, useEffect, useRef } from 'react';
import { Mass } from '../types';
import Chart from 'chart.js/auto';

interface LocationTimeStatsProps {
    data: Mass[];
    theme: string;
}

const LocationTimeAverageDurationChart: React.FC<LocationTimeStatsProps> = ({ data, theme }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (data.length === 0) return;

        const locationTimeData: { [key: string]: { totalDuration: number, count: number } } = {};
        data.forEach(mass => {
            const location = mass.metadata.mass_location;
            const time = mass.metadata.mass_time;
            if (!location || !time) return;
            const key = `${location} ${time}`;
            if (!locationTimeData[key]) {
                locationTimeData[key] = { totalDuration: 0, count: 0 };
            }
            const start = parseFloat(mass.mass_parts.beginning_of_mass as string);
            const end = parseFloat(mass.mass_parts.end_of_mass as string);
            if (!isNaN(start) && !isNaN(end)) {
                locationTimeData[key].totalDuration += (end - start) / 60; // in minutes
                locationTimeData[key].count++;
            }
        });

        const locationTimeLabels = Object.keys(locationTimeData);
        const avgDurations = locationTimeLabels.map(key => locationTimeData[key].totalDuration / locationTimeData[key].count);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;

        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const barBackgroundColor = theme === 'dark' ? 'rgba(54, 162, 235, 0.8)' : 'rgba(54, 162, 235, 0.6)';


        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: locationTimeLabels,
                datasets: [{
                    label: 'Average Mass Duration (minutes)',
                    data: avgDurations,
                    backgroundColor: barBackgroundColor,
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Location & Time', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: 'Avg. Duration (min)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

    }, [data, theme]);

    return <canvas ref={chartRef} />;
};

interface LocationTimeMassHistogramProps {
    data: Mass[];
    selectedLocationTime: string;
    theme: string;
}

const LocationTimeMassHistogram: React.FC<LocationTimeMassHistogramProps> = ({ data, selectedLocationTime, theme }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        const filteredData = data.filter(mass => {
            const key = `${mass.metadata.mass_location} ${mass.metadata.mass_time}`;
            return key === selectedLocationTime;
        });

        if (filteredData.length === 0) {
            if(chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            return;
        };

        const massDurations = filteredData.map(mass => {
            const start = parseFloat(mass.mass_parts.beginning_of_mass as string);
            const end = parseFloat(mass.mass_parts.end_of_mass as string);
            if (!isNaN(start) && !isNaN(end)) {
                return (end - start) / 60; // in minutes
            }
            return null;
        }).filter((duration): duration is number => duration !== null);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;
        
        const numBins = massDurations.length > 0 ? Math.ceil(Math.sqrt(massDurations.length)) : 1;
        const minDuration = massDurations.length > 0 ? Math.min(...massDurations) : 0;
        const maxDuration = massDurations.length > 0 ? Math.max(...massDurations) : 1;
        const binWidth = (maxDuration - minDuration) / numBins;

        const bins: { [key: number]: number } = {};
        if (massDurations.length > 0) {
            for (let i = 0; i < numBins; i++) {
                const binStart = minDuration + i * binWidth;
                bins[binStart] = 0;
            }

            massDurations.forEach(duration => {
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
        const barBackgroundColor = theme === 'dark' ? 'rgba(255, 206, 86, 0.8)' : 'rgba(255, 206, 86, 0.6)';

        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `Mass Durations for ${selectedLocationTime}`,
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

    }, [data, selectedLocationTime, theme]);

    return <canvas ref={chartRef} />;
};


const LocationTimeStats: React.FC<LocationTimeStatsProps> = ({ data, theme }) => {
    const [selectedLocationTime, setSelectedLocationTime] = useState('');
    const [locationTimes, setLocationTimes] = useState<string[]>([]);

    useEffect(() => {
        const uniqueLocationTimes = [...new Set(data.map(mass => `${mass.metadata.mass_location} ${mass.metadata.mass_time}`))]
            .filter(lt => lt.trim() !== 'undefined undefined');
        setLocationTimes(uniqueLocationTimes);
        if (uniqueLocationTimes.length > 0) {
            setSelectedLocationTime(uniqueLocationTimes[0]);
        }
    }, [data]);

    return (
        <div className="location-time-stats-container">
            <div className="chart-container">
                <h3>Average Mass Duration by Location & Time</h3>
                <LocationTimeAverageDurationChart data={data} theme={theme} />
            </div>
            <div className="chart-container">
                <h3>
                    Mass Duration Histogram for
                    <select value={selectedLocationTime} onChange={e => setSelectedLocationTime(e.target.value)}>
                        {locationTimes.map(lt => <option key={lt} value={lt}>{lt}</option>)}
                    </select>
                </h3>
                <LocationTimeMassHistogram data={data} selectedLocationTime={selectedLocationTime} theme={theme} />
            </div>
        </div>
    );
};

export default LocationTimeStats;