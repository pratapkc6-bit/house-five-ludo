module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, service: 'house-five-ludo', version: '0.4.3', architecture: 'microfrontend', multiplayer: 'house-five-session' });
};
