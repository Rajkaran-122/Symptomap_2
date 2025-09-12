import React, { useEffect, useState } from 'react';

interface Clinic {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const ClinicsPanel: React.FC<{ onClose: () => void }>= ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('No geolocation'));
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        const pos = await getPosition();
        const { latitude, longitude } = pos.coords;
        // Overpass: find hospitals, clinics, doctors around ~5km radius
        const radius = 5000;
        const query = `[
          out:json];
          (
            node["amenity"~"hospital|clinic|doctors"](around:${radius},${latitude},${longitude});
          );
          out center 30;`;
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
        const data = await res.json();
        const result: Clinic[] = (data.elements || []).slice(0, 30).map((el: any) => ({
          id: String(el.id),
          name: el.tags?.name || 'Unnamed facility',
          lat: el.lat,
          lon: el.lon,
        }));
        setClinics(result);
      } catch (e: any) {
        setError(e?.message || 'Failed to load clinics');
      } finally {
        setLoading(false);
      }
    };
    fetchClinics();
  }, []);

  return (
    <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-card border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card/80">
        <div className="text-sm font-semibold">Nearby Clinics & Hospitals</div>
        <button className="text-xs underline" onClick={onClose}>Close</button>
      </div>
      <div className="max-h-80 overflow-y-auto p-3 text-sm">
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && clinics.length === 0 && <div>No facilities found nearby.</div>}
        <ul className="space-y-2">
          {clinics.map(c => (
            <li key={c.id} className="border rounded p-2">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</div>
              <div className="mt-1">
                <a className="text-xs underline" href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`} target="_blank" rel="noreferrer">Open in Maps</a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ClinicsPanel;
