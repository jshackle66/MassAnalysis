import React from 'react';
import { Mass } from '../types';
import Chart from 'chart.js/auto';

const massSections = [
    { name: 'Introductory Rites', startKey: 'beginning_of_mass', endKey: 'first_reading' },
    { name: 'Liturgy of the Word', startKey: 'first_reading', endKey: 'homily' },
    { name: 'Homily', startKey: 'homily', endKey: 'creed', fallbackEndKey: 'prayers_of_the_faithful' },
    { name: 'Creed & Prayers', startKey: 'creed', fallbackStartKey: 'prayers_of_the_faithful', endKey: 'eucharistic_prayer' },
    { name: 'Liturgy of the Eucharist', startKey: 'eucharistic_prayer', endKey: 'distribution_of_communion' },
    { name: 'Communion & Concluding Rites', startKey: 'distribution_of_communion', endKey: 'end_of_mass' }
];

const getPartTime = (massParts: { [key: string]: number | string }, key: string): number | null => {
    if (massParts[key]) {
        const time = parseFloat(massParts[key] as string);
        if (!isNaN(time)) return time;
    }
    return null;
};

interface PriestMassBreakdownChartProps {
    data: Mass[];
    theme: string;
}

const PriestMassBreakdownChart: React.FC<PriestMassBreakdownChartProps> = ({ data, theme }) => {
    const chartRef = React.useRef<HTMLCanvasElement>(null);
    const chartInstance = React.useRef<Chart | null>(null);

    React.useEffect(() => {
        if (data.length === 0) return;

        const priestData: { [priest: string]: { [section: string]: { totalDuration: number, count: number } } } = {};

        data.forEach(mass => {
            const priest = mass.metadata.priest;
            if (!priest) return;

            if (!priestData[priest]) {
                priestData[priest] = {};
                massSections.forEach(s => {
                    priestData[priest][s.name] = { totalDuration: 0, count: 0 };
                });
            }

            const massParts = mass.mass_parts;

            massSections.forEach(section => {
                let startKey = section.startKey;
                let endKey = section.endKey;

                if (section.fallbackStartKey && !massParts[startKey]) {
                    startKey = section.fallbackStartKey;
                }
                if (section.fallbackEndKey && !massParts[endKey]) {
                    endKey = section.fallbackEndKey;
                }

                const startTime = getPartTime(massParts, startKey);
                const endTime = getPartTime(massParts, endKey);

                if (startTime !== null && endTime !== null) {
                    const duration = (endTime - startTime) / 60;
                    if (duration >= 0) {
                        priestData[priest][section.name].totalDuration += duration;
                        priestData[priest][section.name].count++;
                    }
                }
            });
        });

        const priests = Object.keys(priestData);
        const sectionNames = massSections.map(s => s.name);
        
        const priestColors = [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
            'rgba(255, 159, 64, 0.7)'
        ];

        const datasets = priests.map((priest, index) => {
            return {
                label: priest,
                data: sectionNames.map(sectionName => {
                    const stats = priestData[priest][sectionName];
                    return stats.count > 0 ? stats.totalDuration / stats.count : 0;
                }),
                backgroundColor: priestColors[index % priestColors.length],
            };
        });

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;

        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: sectionNames,
                datasets: datasets,
            },
            options: {
                scales: {
                    x: { 
                        title: { display: true, text: 'Mass Section', color: textColor }, 
                        ticks: { color: textColor, autoSkip: false, maxRotation: 45, minRotation: 45 }, 
                        grid: { color: gridColor } 
                    },
                    y: { 
                        title: { display: true, text: 'Average Duration (min)', color: textColor }, 
                        ticks: { color: textColor }, 
                        grid: { color: gridColor } 
                    }
                },
                plugins: { 
                    legend: { labels: { color: textColor } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + ' min';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });

    }, [data, theme]);

    return <canvas ref={chartRef} />;
};


interface MassDetailViewerProps {
    mass?: Mass;
    theme: string;
    data: Mass[];
    massSortOrder?: string;
    setMassSortOrder?: (order: string) => void;
    onNext?: () => void;
    onPrev?: () => void;
}

const MassDetailViewer: React.FC<MassDetailViewerProps> = ({ theme, data }) => {

    return (
        <div className="mass-detail-viewer">
            <div className="mass-detail-chart" style={{width: "100%"}}>
                <h3>Priest Average Mass Breakdown by Section</h3>
                <PriestMassBreakdownChart data={data} theme={theme} />
            </div>
        </div>
    );
};

export default MassDetailViewer;
