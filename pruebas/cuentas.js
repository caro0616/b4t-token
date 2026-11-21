// Paso 1: crea las 5 cuentas de prueba (D, I1, I2, I3, I4).
// Las llaves privadas quedan SOLO en pruebas/.env (ignorado por Git).
// Las direcciones públicas se guardan en evidencias/amoy/cuentas.csv.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { ARCHIVO_ENV, DIR_EVID, CUENTAS, AMOY, escribirCSV } = require('./lib');

if (fs.existsSync(ARCHIVO_ENV) && !process.argv.includes('--nuevas')) {
  console.log('Ya existen cuentas en pruebas/.env. No las reemplazo para no perder el POL que tengan.');
  console.log('Si de verdad quieres cuentas nuevas: npm run cuentas -- --nuevas\n');
} else {
  let txt = '# Llaves privadas de las cuentas de PRUEBA en Amoy. NUNCA subir este archivo.\n';
  for (const n of CUENTAS) txt += `CLAVE_${n}=${ethers.Wallet.createRandom().privateKey}\n`;
  txt += 'RPC_URL=' + AMOY.rpc + '\n';
  fs.writeFileSync(ARCHIVO_ENV, txt, { mode: 0o600 });
  console.log('Cuentas creadas y guardadas en pruebas/.env\n');
}

const env = Object.fromEntries(fs.readFileSync(ARCHIVO_ENV, 'utf8').split('\n').map(l => l.split('=')).filter(p => p.length === 2));
const filas = CUENTAS.map(n => ({ Cuenta: n, 'Direccion publica': new ethers.Wallet(env['CLAVE_' + n]).address }));
escribirCSV(path.join(DIR_EVID, 'cuentas.csv'), filas, ['Cuenta', 'Direccion publica']);
for (const f of filas) console.log(`${f.Cuenta.padEnd(3)} ${f['Direccion publica']}`);
console.log('\nSiguiente paso: pide POL de Amoy en el faucet para la cuenta D:');
console.log('  ' + filas[0]['Direccion publica']);
console.log('  https://faucet.quicknode.com/polygon/amoy');
console.log('Luego corre: npm run pruebas');
