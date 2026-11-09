// Reads the verification link from the local Mailpit inbox (dev only; the API sends real email to Mailpit).
const base = MAILPIT || 'http://localhost:8025';
const list = json(http.get(base + '/api/v1/search?query=' + encodeURIComponent('to:' + EMAIL)).body);
if (!list.messages || !list.messages.length) throw new Error('no verification email for ' + EMAIL);
const msg = json(http.get(base + '/api/v1/message/' + list.messages[0].ID).body);
const m = /token=([A-Za-z0-9:_\-.]+)/.exec(msg.Text || msg.HTML);
if (!m) throw new Error('no token in email');
output.token = m[1];
