module.exports = {
  uiPort: process.env.PORT || 1880,
  httpAdminRoot: false,
  flowFile: 'flows.json',
  httpRequestTimeout: 70000,
  credentialSecret: process.env.NODE_RED_CREDENTIAL_SECRET || false,
  logging: { console: { level: 'info', metrics: false, audit: false } },
};
