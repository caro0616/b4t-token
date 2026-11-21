// Solo para el modo simulado (npm run pruebas:simulada): blockchain local con las reglas "cancun".
module.exports = {
  networks: {
    hardhat: { hardfork: 'cancun', chainId: 31337, throwOnTransactionFailures: false, throwOnCallFailures: true },
  },
};
