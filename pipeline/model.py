from dataclasses import dataclass
from typing import Dict

@dataclass
class MassMetadata:
    mass_time: str
    mass_location: str
    priest: str
    date: str
    is_sunday: bool

    def to_dict(self):
        return {
            'mass_time': self.mass_time,
            'mass_location': self.mass_location,
            'priest': self.priest,
            'date': self.date,
            'is_sunday': self.is_sunday
        }

# Create dataclass for output
@dataclass
class MassAnalysisResult:
    transcript: str
    mass_parts: Dict[str, str]
    audio_file: str
    metadata: MassMetadata
    
    def to_dict(self):
        return {
            'transcript': self.transcript,
            'mass_parts': self.mass_parts,
            'audio_file': self.audio_file,
            'metadata': self.metadata.to_dict()
        }