import React, { useState, useEffect, useRef } from 'react';
import { Mass } from '../types';
import Chart from 'chart.js/auto';
import { getHomily } from './getHomily';
import HomilyTranscript from './HomilyTranscript';

interface HomilyKeywordHistogramProps {
    data: Mass[];
    theme: string;
}

const HomilyKeywordHistogram: React.FC<HomilyKeywordHistogramProps> = ({ data, theme }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [keyword, setKeyword] = useState('');
    const [selectedPriest, setSelectedPriest] = useState('');
    const [priests, setPriests] = useState<string[]>([]);
    const [currentHomilyIndex, setCurrentHomilyIndex] = useState(0);

    useEffect(() => {
        const uniquePriests = [...new Set(data.map(mass => mass.metadata.priest))].filter(p => p);
        setPriests(uniquePriests);
        if (uniquePriests.length > 0) {
            setSelectedPriest(uniquePriests[0]);
        }
    }, [data]);


    const handleKeywordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(event.target.value);
    };

    const filteredHomilies = (() => {
        if (!selectedPriest) return [];
        return data
            .filter(mass => mass.metadata.priest === selectedPriest && mass.transcript)
            .filter(mass => (getHomily(mass).match(new RegExp(keyword, 'gi')) || []).length > 0)
    })();

    useEffect(() => {
        setCurrentHomilyIndex(0);
    }, [selectedPriest, keyword]);

    const currentMass = filteredHomilies[currentHomilyIndex];

    const handleNextHomily = () => {
        if (filteredHomilies.length > 0) {
            setCurrentHomilyIndex(prev => (prev + 1) % filteredHomilies.length);
        }
    };

    const handlePrevHomily = () => {
        if (filteredHomilies.length > 0) {
            setCurrentHomilyIndex(prev => (prev - 1 + filteredHomilies.length) % filteredHomilies.length);
        }
    };


    useEffect(() => {
        if (data.length === 0 || !keyword) {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            return;
        }

        const priestKeywordCounts: { [key: string]: number } = {};
        data.forEach(mass => {
            const priest = mass.metadata.priest;
            if (!priest) return;

            if (!priestKeywordCounts[priest]) {
                priestKeywordCounts[priest] = 0;
            }

            const homilyText = getHomily(mass);
            const keywordCount = (homilyText.match(new RegExp(keyword, 'gi')) || []).length;
            priestKeywordCounts[priest] += keywordCount;
        });

        const priestLabels = Object.keys(priestKeywordCounts);
        const keywordFrequencies = priestLabels.map(priest => priestKeywordCounts[priest]);

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        if (!chartRef.current) return;
        const chartContext = chartRef.current.getContext('2d');
        if (!chartContext) return;

        const textColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : '#213547';
        const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const barBackgroundColor = theme === 'dark' ? 'rgba(255, 159, 64, 0.8)' : 'rgba(255, 159, 64, 0.6)';

        chartInstance.current = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: priestLabels,
                datasets: [{
                    label: `Frequency of "${keyword}"`,
                    data: keywordFrequencies,
                    backgroundColor: barBackgroundColor,
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Priest', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { title: { display: true, text: 'Frequency', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

    }, [data, keyword, theme]);

    return (
        <div className="homily-keyword-histogram-container">
            <h3>Keyword Frequency in Homilies</h3>
            <div className="controls">
                <input
                    type="text"
                    value={keyword}
                    onChange={handleKeywordChange}
                    placeholder="Enter keyword"
                />
            </div>
            <div className="display-area">
                <div className="histogram-area">
                    <canvas ref={chartRef} />
                </div>
                <div className="transcript-area">
                    <div className="homily-transcript-section">
                        <h3>
                            Homily Transcripts for
                            <select value={selectedPriest} onChange={e => {
                                setSelectedPriest(e.target.value);
                            }}>
                                {priests.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </h3>
                        {currentMass ? (
                            <div>
                                <div className="controls">
                                    <button onClick={handlePrevHomily}>&larr; Previous</button>
                                    <button onClick={handleNextHomily}>Next &rarr;</button>
                                </div>
                                <HomilyTranscript mass={currentMass} keyword={keyword} />
                            </div>
                        ) : <p>No homilies found for the selected priest and keyword.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomilyKeywordHistogram;