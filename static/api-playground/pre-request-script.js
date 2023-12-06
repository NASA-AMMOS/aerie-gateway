const nowInSeconds = () => Date.now() / 1000;
const tokenExpiry = await altair.storage.get('token_exp') || 0;

if (nowInSeconds() >= Number(tokenExpiry)) {
  // Fetch a new token from the Gateway
  const res = await altair.helpers.request(
    'POST',
    '/auth/login', // AUTH ENDPOINT OF THE DEPLOYMENT
    {
      body: { username: '<YOUR_AERIE_USERNAME>', password: '<YOUR_AERIE_PASSWORD>' }, // CREDENTIALS TO LOG IN AS
      headers: { 'Content-Type': 'application/json' }
    });
  if(res.success) {
    const token = res.token;
    await altair.storage.set('token', token);
    // Set JWT expiry
    const atob = await altair.importModule('atob');
    const body = JSON.parse(atob(token.split('.')[1]));
    await altair.storage.set('token_exp', body.exp);
  } else { altair.log(res); }
}
// Set the token in the environment
const token = await altair.storage.get('token');
altair.helpers.setEnvironment('user', token);
