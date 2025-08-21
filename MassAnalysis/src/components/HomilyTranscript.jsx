import React, { useMemo } from 'react';
import { getHomily } from './getHomily';

const HomilyTranscript = ({ mass, keyword }) => {
    const homilyText = useMemo(() => getHomily(mass), [mass]);

    const highlightedText = useMemo(() => {
        if (!homilyText || !keyword) {
            return <p>{homilyText}</p>;
        }
        const parts = homilyText.split(new RegExp(`(${keyword})`, 'gi'));
        return (
            <p>
                {parts.map((part, i) =>
                    part.toLowerCase() === keyword.toLowerCase() ? (
                        <strong key={i} style={{backgroundColor: 'yellow', color: 'black'}}>{part}</strong>
                    ) : (
                        part
                    )
                )}
            </p>
        );
    }, [homilyText, keyword]);

    return (
        <div className="homily-transcript-container">
            <h2>Homily Transcript</h2>
            <div className="transcript-content">
                {highlightedText ?? <p>Homily transcript not available.</p>}
            </div>
        </div>
    );
};

export default HomilyTranscript;