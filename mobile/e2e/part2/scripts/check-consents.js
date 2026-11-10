// Reads the driver's consent ledger through the real API and checks the prompt choice was recorded against the
// current privacy policy version (published in /config/).
const api = API || 'http://localhost:8000/api/v1';
const tok = json(http.post(api + '/auth/login/', { headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }) }).body).tokens.access;
const version = json(http.get(api + '/config/').body).legal.privacy_version;
let c = null;
for (let i = 0; i < 20; i++) {
  c = json(http.get(api + '/privacy/consents/', { headers: { Authorization: 'Bearer ' + tok } }).body);
  if (c.analytics.granted === true) break;
}
output.analytics = c.analytics.granted;
output.ads = c.personalised_ads.granted;
output.versionOk = c.analytics.document_version === version;
