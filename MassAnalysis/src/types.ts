export interface Mass {
    transcript: string;
    mass_parts: {
        [key: string]: number | string;
    };
    metadata: {
        priest: string;
        mass_location: string;
        mass_time: string;
        date: string;
        is_sunday: boolean;
    };
    duration?: number;
}