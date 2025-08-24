import React, { useEffect, useRef } from 'react';
import { Mass } from '../types';
import Chart from 'chart.js/auto';

interface MassDurationHistogramProps {
    data: Mass[];
    theme: string;
}

const MassDurationHistogram: React.FC<MassDurationHistogramProps> = ({ data, theme }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (data.length === 0) {
        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }
        return;
    }

    const massDurations = data.map(mass => {
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
    const barBackgroundColor = theme === 'dark' ? 'rgba(75, 192, 192, 0.8)' : 'rgba(75, 192, 192, 0.6)';

    chartInstance.current = new Chart(chartContext, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Number of Masses',
            data: chartData,
            backgroundColor: barBackgroundColor,
          },
        ],
      },
      options: {
        scales: {
          x: {
            title: {
              display: true,
              text: 'Mass Duration (minutes)',
              color: textColor,
            },
            ticks: {
              color: textColor,
            },
            grid: {
                color: gridColor,
            }
          },
          y: {
            title: {
              display: true,
              text: 'Frequency',
              color: textColor,
            },
            ticks: {
                color: textColor,
            },
            grid: {
                color: gridColor,
            },
            beginAtZero: true,
          },
        },
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        }
      },
    });

  }, [data, theme]);

  return <canvas ref={chartRef} />;
};

export default MassDurationHistogram;
