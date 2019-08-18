module.exports = {
  norpc: true,
  copyPackages: [
    '@aragon/os',
    '@aragon/apps-shared-migrations',
    '@aragon/apps-shared-minime',
    '@aragon/test-helpers',
    '@aragon/apps-agent',
    '@aragon/apps-token-manager',
    '@aragon/apps-vault',
    '@ablack/fundraising-bancor-formula',
    '@ablack/fundraising-shared-interfaces',
    '@ablack/fundraising-batched-bancor-market-maker',
    '@ablack/fundraising-module-pool',
    '@ablack/fundraising-tap',
  ],
  skipFiles: [
    'test',
    '@aragon/os',
    '@aragon/apps-shared-migrations',
    '@aragon/apps-shared-minime',
    '@aragon/test-helpers',
    '@aragon/apps-agent',
    '@aragon/apps-token-manager',
    '@aragon/apps-vault',
    '@ablack/fundraising-bancor-formula',
    '@ablack/fundraising-shared-interfaces',
    '@ablack/fundraising-batched-bancor-market-maker',
    '@ablack/fundraising-module-pool',
    '@ablack/fundraising-tap',
  ],
}
