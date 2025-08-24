import { Mass } from '../types';


export function getHomily(mass: Mass): string {
    if (!mass || !mass.transcript) return 'Transcript not available.';

    const massParts = mass.mass_parts;
    const homilyStartTime = parseFloat(massParts.homily as string);
    if (isNaN(homilyStartTime)) return 'Homily start time not available.';

    const massPartOrder = [
        'homily', 
        'creed', 
        'prayers_of_the_faithful', 
        'eucharistic_prayer', 
    ];

    let homilyEndTime = Infinity;
    for (let i = 1; i < massPartOrder.length; i++) {
        if (massParts[massPartOrder[i]]) {
            const nextPartTime = parseFloat(massParts[massPartOrder[i]] as string);
            if (!isNaN(nextPartTime)) {
                homilyEndTime = nextPartTime;
                break;
            }
        }
    }

    const transcriptLines = mass.transcript.split('\n');
    const homilyLines: string[] = [];

    const timeRegex = /\((\d+\.\d+), (\d+\.\d+)\)/;

    for (const line of transcriptLines) {
        const match = line.match(timeRegex);
        if (match) {
            const lineStartTime = parseFloat(match[1]);
            if (lineStartTime >= homilyStartTime && lineStartTime < homilyEndTime) {
                homilyLines.push(line.replace(timeRegex, '').trim());
            }
        }
    }

    return homilyLines.join(' ');
}