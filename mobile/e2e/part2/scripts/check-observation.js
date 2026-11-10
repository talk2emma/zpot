const api = API || 'http://localhost:8000/api/v1';
const list = json(http.get(api + '/availability/observations/?area=7').body);
const o = list.find(x => String(x.id) === String(output.obsId));
output.confirmations = o ? o.confirmations : -1;
