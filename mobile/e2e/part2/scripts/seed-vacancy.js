// Another driver (guest install token) reports a free spot at Rua Andrade Corvo through the real API.
const api = API || 'http://localhost:8000/api/v1';
const r = http.post(api + '/reports/', {
  headers: { 'Content-Type': 'application/json', 'X-Zpot-Client': 'e2e-other-driver-' + Date.now() },
  body: JSON.stringify({ type: 'found', area_id: 7, latitude: 38.7322, longitude: -9.1470, device_latitude: 38.7322, device_longitude: -9.1470 }),
});
const rep = json(r.body);
if (!rep.observation) throw new Error('report not published: ' + r.body);
output.obsId = String(rep.observation.id);
