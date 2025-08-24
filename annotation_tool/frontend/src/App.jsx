
import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
    const [masses, setMasses] = useState([]);
    const [priests, setPriests] = useState([]);
    const [selectedMass, setSelectedMass] = useState(null);
    const [newPriestName, setNewPriestName] = useState('');
    const [selectedPriest, setSelectedPriest] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMasses();
        fetchPriests();
    }, []);

    const fetchMasses = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/masses`);
            setMasses(response.data);
        } catch (err) {
            setError('Failed to fetch masses. Is the backend server running?');
            console.error(err);
        }
        setIsLoading(false);
    };

    const fetchPriests = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/priests`);
            setPriests(response.data);
        } catch (err) {
            setError('Failed to fetch priests.');
            console.error(err);
        }
    };

    const handleSelectMass = (mass) => {
        setSelectedMass(mass);
        setSelectedPriest('');
        setNewPriestName('');
    };

    const handleAnnotationSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMass) return;

        const priestToSubmit = newPriestName.trim() || selectedPriest;
        if (!priestToSubmit) {
            alert('Please select a priest or enter a new name.');
            return;
        }

        try {
            // Use the raw path for the API call
            await axios.post(`${API_BASE_URL}/api/masses/${selectedMass.path}/annotate`, {
                priest: priestToSubmit
            });
            // Refresh data
            fetchMasses();
            fetchPriests();
            // Reset view
            setSelectedMass(null);
        } catch (err) {
            setError('Failed to submit annotation.');
            console.error(err);
        }
    };

    const renderMassList = () => (
        <div className="list-group">
            {masses.map(mass => (
                <button
                    key={mass.id} // Use the URL-safe id for the key
                    type="button"
                    className={`list-group-item list-group-item-action ${mass.priest === 'Unknown' ? 'list-group-item-danger' : ''}`}
                    onClick={() => handleSelectMass(mass)}
                >
                    <div className="d-flex w-100 justify-content-between">
                        {/* Display the readable path */}
                        <h5 className="mb-1">{mass.path}</h5> 
                        <small>{mass.date}</small>
                    </div>
                    <p className="mb-1">Priest: <strong>{mass.priest}</strong></p>
                </button>
            ))}
        </div>
    );

    const renderAnnotationView = () => {
        if (!selectedMass) return null;

        // Use the raw path to construct the audio URL
        const audioUrl = `${API_BASE_URL}/api/audio/${selectedMass.path}`;

        return (
            <div className="card">
                <div className="card-header">
                    <h3>Annotate Mass: {selectedMass.path}</h3>
                    <button className="btn-close" onClick={() => setSelectedMass(null)}></button>
                </div>
                <div className="card-body">
                    <p>Current Priest: <strong>{selectedMass.priest}</strong></p>
                    <h5>Listen to Homily</h5>
                    <audio controls src={audioUrl} className="w-100 mb-3">
                        Your browser does not support the audio element.
                    </audio>
                    
                    <form onSubmit={handleAnnotationSubmit}>
                        <h5>Update Priest</h5>
                        <div className="mb-3">
                            <label htmlFor="priestSelect" className="form-label">Select from existing</label>
                            <select 
                                id="priestSelect" 
                                className="form-select"
                                value={selectedPriest}
                                onChange={(e) => {
                                    setSelectedPriest(e.target.value);
                                    setNewPriestName('');
                                }}
                                disabled={!!newPriestName}
                            >
                                <option value="">-- Choose Priest --</option>
                                {priests.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div className="text-center my-2">OR</div>

                        <div className="mb-3">
                            <label htmlFor="newPriestInput" className="form-label">Add a new priest</label>
                            <input 
                                type="text" 
                                id="newPriestInput"
                                className="form-control"
                                value={newPriestName}
                                onChange={(e) => {
                                    setNewPriestName(e.target.value);
                                    setSelectedPriest('');
                                }}
                                disabled={!!selectedPriest}
                            />
                        </div>
                        
                        <button type="submit" className="btn btn-primary">Save Annotation</button>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div className="container mt-4">
            <header className="text-center mb-4">
                <h1>Mass Annotation Tool</h1>
                <p>Select a Mass to listen to the homily and assign a priest.</p>
            </header>

            {error && <div className="alert alert-danger">{error}</div>}
            {isLoading && <p>Loading masses...</p>}

            <div className="row">
                <div className="col-md-5">
                    <h2>Masses to Annotate</h2>
                    {renderMassList()}
                </div>
                <div className="col-md-7">
                    {renderAnnotationView()}
                </div>
            </div>
        </div>
    );
}

export default App;
