// Ejecuta la matriz A01–A18 en una blockchain local (Hardhat), sin necesidad de POL.
// Se usa cuando no hay POL de prueba en Amoy. La evidencia queda en evidencias/simulada/.
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { ethers } = require('ethers');

const PUERTO = process.env.PUERTO || '8545';
const RPC = `http://127.0.0.1:${PUERTO}`;
// Cuentas de prueba públicas de Hardhat (frase "test test ... junk"): solo existen en la red local.
const FRASE = 'test test test test test test test test test test test junk';
// Cuentas D, I1–I4 de la simulación: claves fijas derivadas de un texto, sin saldo inicial
// (igual que cuentas nuevas en Amoy). Solo sirven en la red local.
const clave = nombre => ethers.id('b4t-simulada-' + nombre);
const nodo = i => ethers.HDNodeWallet.fromPhrase(FRASE, undefined, `m/44'/60'/0'/0/${i}`);

async function esperarNodo(provider) {
  for (let i = 0; i < 60; i++) {
    try { await provider.getBlockNumber(); return; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('La blockchain local no arrancó.');
}

async function main() {
  const bin = path.join(__dirname, 'node_modules', '.bin', 'hardhat');
  const hh = spawn(bin, ['node', '--hostname', '127.0.0.1', '--port', PUERTO], { cwd: __dirname, stdio: 'ignore' });
  const cerrar = () => { try { hh.kill(); } catch {} };
  process.on('exit', cerrar);
  try {
    const provider = new ethers.JsonRpcProvider(RPC, 31337, { staticNetwork: true });
    await esperarNodo(provider);
    console.log('Blockchain local lista (Hardhat, chain ID 31337).');
    // Cuenta 0 de Hardhat hace de "faucet": envía 0.1 POL simulado a D, lo mismo que pediríamos en Amoy.
    const faucet = nodo(0).connect(provider);
    const D = new ethers.Wallet(clave('D'));
    await (await faucet.sendTransaction({ to: D.address, value: ethers.parseEther('0.1') })).wait();
    console.log('Faucet simulado: 0.1 POL enviado a D (' + D.address + ')\n');
    const env = {
      ...process.env, MODO_SIMULADO: '1', RPC_URL: RPC, PROPINA_MIN_GWEI: '30',
      CLAVE_D: clave('D'), CLAVE_I1: clave('I1'), CLAVE_I2: clave('I2'), CLAVE_I3: clave('I3'), CLAVE_I4: clave('I4'),
    };
    execFileSync(process.execPath, [path.join(__dirname, 'ejecutar.js'), '--nuevo'], { env, stdio: 'inherit' });
  } finally { cerrar(); }
}

main().catch(e => { console.error('Se detuvo: ' + (e.message || e)); process.exit(1); });
