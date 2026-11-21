// Paso 2: compila, despliega en Amoy y ejecuta los casos A01 a A17.
// Escribe la evidencia en evidencias/amoy/.
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { MODO_SIMULADO, SUFIJO, DIR_EVID, AMOY, COMPILADOR, CUENTAS, leerEnv, escribirCSV, compilar } = require('./lib');

const U = n => ethers.parseUnits(String(n), 18);      // B4T -> unidades mínimas
const F = v => ethers.formatUnits(v, 18);             // unidades mínimas -> B4T
const COLUMNAS = ['ID', 'Fecha y hora', 'Cuenta que firma', 'Funcion', 'Parametros (B4T)', 'Parametros (unidades)', 'Hash', 'Estado', 'Gas usado', 'Costo (POL)', 'Esperado', 'Obtenido', 'Aprobado', 'Captura', 'Enlace Polygonscan'];
const ARCH_DESPLIEGUE = path.join(DIR_EVID, 'despliegue.json');

const filas = [];
const saldosFotos = [];
let explorador = AMOY.explorador;
let local = false;

function ahora() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
}
function enlace(hash) { return hash && !local ? `${explorador}/tx/${hash}` : ''; }
function guardarParcial() {
  if (!filas.length) return;
  escribirCSV(path.join(DIR_EVID, `matriz_${SUFIJO}.csv`), filas, COLUMNAS);
}
function registrar(f) {
  const fila = { 'Fecha y hora': ahora(), ...f, 'Enlace Polygonscan': enlace(f.Hash) };
  filas.push(fila);
  guardarParcial();
  const marca = fila.Aprobado === 'Sí' ? 'OK ' : (fila.Aprobado === 'No' ? 'XX ' : '.. ');
  console.log(`${marca}${fila.ID.padEnd(7)} ${fila.Funcion.padEnd(14)} ${fila.Estado || ''} ${fila.Hash ? fila.Hash.slice(0, 12) + '…' : ''}`);
  if (fila.Aprobado === 'No') console.log(`   Esperado: ${fila.Esperado}\n   Obtenido: ${fila.Obtenido}`);
}

async function main() {
  const env = leerEnv();
  if (!env.CLAVE_D) throw new Error('Primero crea las cuentas: npm run cuentas');
  const provider = new ethers.JsonRpcProvider(env.RPC_URL || AMOY.rpc);
  provider.pollingInterval = 2000;
  const { chainId } = await provider.getNetwork();
  local = MODO_SIMULADO && chainId === 31337n;
  if (chainId !== AMOY.chainId && !local) {
    throw new Error(`La red conectada tiene chain ID ${chainId}. Este programa SOLO corre en Amoy (80002). No se envió nada.`);
  }
  if (fs.existsSync(ARCH_DESPLIEGUE) && !process.argv.includes('--nuevo')) {
    throw new Error('Ya hay un despliegue registrado en evidencias/amoy/despliegue.json.\nSi quieres repetir TODO con un contrato nuevo: npm run pruebas -- --nuevo');
  }
  const W = {};
  for (const n of CUENTAS) W[n] = new ethers.Wallet(env['CLAVE_' + n], provider);
  const A = Object.fromEntries(CUENTAS.map(n => [n, W[n].address]));
  // NonceManager lleva la cuenta de los nonces localmente, para que dos transacciones seguidas
  // de la misma cuenta nunca usen el mismo número (pasa en redes rápidas por la caché del proveedor).
  const N = Object.fromEntries(CUENTAS.map(n => [n, new ethers.NonceManager(W[n])]));
  console.log(`Red: ${local ? 'red local simulada (Hardhat)' : 'Polygon Amoy'} (chain ID ${chainId})\n`);

  // ---- Gas: Amoy exige una propina mínima; usamos al menos PROPINA_MIN_GWEI (30 por defecto)
  async function gas() {
    const bloque = await provider.getBlock('latest');
    const fd = await provider.getFeeData();
    const minimo = ethers.parseUnits(env.PROPINA_MIN_GWEI || (local ? '1' : '30'), 'gwei');
    const propina = (fd.maxPriorityFeePerGas || 0n) > minimo ? fd.maxPriorityFeePerGas : minimo;
    return { maxPriorityFeePerGas: propina, maxFeePerGas: (bloque.baseFeePerGas || 0n) * 2n + propina };
  }

  // ---- A01: compilación
  console.log('Compilando contracts/B4T.sol …');
  const comp = compilar();
  registrar({
    ID: 'A01', 'Cuenta que firma': '-', Funcion: 'compilación', Estado: 'Consulta',
    Esperado: `Compila sin errores (solc ${COMPILADOR.version}, optimización ${COMPILADOR.optimizer.runs} runs, EVM ${COMPILADOR.evmVersion})`,
    Obtenido: `Compilado con ${comp.versionSolc}: 0 errores, ${comp.advertencias.length} advertencias`,
    Aprobado: 'Sí', Captura: 'A01_compilacion.png y A01_analisis.png (Remix)',
  });

  // ---- Presupuesto de POL y fondeo de I1..I4
  const saldoD = await provider.getBalance(A.D);
  if (saldoD === 0n) throw new Error(`La cuenta D no tiene POL. Pide POL de Amoy en el faucet para ${A.D}`);
  const g = await gas();
  const precio = g.maxFeePerGas - g.maxPriorityFeePerGas / 2n;           // precio efectivo aproximado con margen
  const factory = new ethers.ContractFactory(comp.abi, comp.bytecode, N.D);
  const gasDespliegue = await provider.estimateGas({ ...(await factory.getDeployTransaction()), from: A.D });
  const txPorCuenta = { I1: 9n, I2: 5n, I3: 4n, I4: 5n };              // transacciones que firma cada cuenta
  const faltaI = {};
  for (const n of CUENTAS.slice(1)) {
    const meta = txPorCuenta[n] * 65000n * precio + 120000n * g.maxFeePerGas;
    const b = await provider.getBalance(A[n]);
    faltaI[n] = b < meta ? meta - b : 0n;
  }
  const totalFondeo = Object.values(faltaI).reduce((a, b) => a + b, 0n);
  const necesitaD = (gasDespliegue * 12n / 10n + 4n * 65000n + 4n * 21000n) * precio + gasDespliegue * 13n / 10n * (g.maxFeePerGas - precio) + totalFondeo;
  console.log(`POL en D: ${ethers.formatEther(saldoD)} · necesario aprox.: ${ethers.formatEther(necesitaD)}`);
  if (saldoD < necesitaD) {
    throw new Error(`A la cuenta D le falta POL. Tiene ${ethers.formatEther(saldoD)} y necesita al menos ${ethers.formatEther(necesitaD)}.\nPide más en el faucet para ${A.D} (o pide a un compañero que le envíe POL de Amoy) y vuelve a correr npm run pruebas.`);
  }
  const fondeo = [];
  for (const n of CUENTAS.slice(1)) {
    if (faltaI[n] === 0n) continue;
    const tx = await N.D.sendTransaction({ to: A[n], value: faltaI[n], ...(await gas()) });
    await tx.wait();
    fondeo.push({ Cuenta: n, POL: ethers.formatEther(faltaI[n]), Hash: tx.hash, Enlace: enlace(tx.hash) });
    console.log(`.. Fondeo ${n}: ${ethers.formatEther(faltaI[n])} POL`);
  }
  if (fondeo.length) escribirCSV(path.join(DIR_EVID, 'fondeo_pol.csv'), fondeo, ['Cuenta', 'POL', 'Hash', 'Enlace']);

  // ---- A02: despliegue y emisión
  const S = U(1000000);
  const c = await factory.deploy(await gas());
  const txDesp = c.deploymentTransaction();
  const recDesp = await txDesp.wait();
  const dirC = await c.getAddress();
  const iface = c.interface;
  const C = n => c.connect(N[n]);
  const eventos = (rec, nombre) => rec.logs.filter(l => l.address.toLowerCase() === dirC.toLowerCase())
    .map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(e => e && e.name === nombre);

  const esperado = { D: 0n, I1: 0n, I2: 0n, I3: 0n, I4: 0n };
  esperado.D = S;
  const saldos = async () => Object.fromEntries(await Promise.all(CUENTAS.map(async n => [n, await c.balanceOf(A[n])])));
  const cuadra = async () => { const s = await saldos(); return { ok: CUENTAS.every(n => s[n] === esperado[n]), s }; };
  const resumenSaldos = s => CUENTAS.map(n => `${n}=${F(s[n])}`).join(' · ');
  const foto = async momento => {
    const s = await saldos();
    const suma = CUENTAS.reduce((a, n) => a + s[n], 0n);
    saldosFotos.push({ Momento: momento, ...Object.fromEntries(CUENTAS.map(n => [n, F(s[n])])), Suma: F(suma) });
    escribirCSV(path.join(DIR_EVID, `saldos_${SUFIJO}.csv`), saldosFotos, ['Momento', ...CUENTAS, 'Suma']);
  };

  {
    const ts = await c.totalSupply(), bD = await c.balanceOf(A.D);
    const ev = eventos(recDesp, 'Transfer')[0];
    const okEv = ev && ev.args[0] === ethers.ZeroAddress && ev.args[1] === A.D && ev.args[2] === S;
    registrar({
      ID: 'A02', 'Cuenta que firma': 'D', Funcion: 'deploy', 'Parametros (B4T)': 'sin parámetros', 'Parametros (unidades)': '',
      Hash: txDesp.hash, Estado: recDesp.status === 1 ? 'Éxito' : 'Falló', 'Gas usado': recDesp.gasUsed, 'Costo (POL)': ethers.formatEther(recDesp.fee),
      Esperado: `Contrato desplegado; totalSupply y saldo de D = ${S}; evento Transfer desde 0x0 hacia D`,
      Obtenido: `Contrato ${dirC}; totalSupply=${ts}; saldo D=${bD}; evento Transfer ${okEv ? 'correcto' : 'NO encontrado'}`,
      Aprobado: recDesp.status === 1 && ts === S && bD === S && okEv ? 'Sí' : 'No', Captura: 'A02_despliegue.png',
    });
  }
  fs.writeFileSync(path.join(DIR_EVID, 'despliegue.json'), JSON.stringify({
    red: local ? 'Red local simulada (Hardhat, fork cancun)' : 'Polygon Amoy', chainId: String(chainId), contrato: dirC,
    hashDespliegue: txDesp.hash, bloque: recDesp.blockNumber, desplegadoPor: A.D, fecha: ahora(),
    compilador: COMPILADOR.version, optimizacion: COMPILADOR.optimizer, evm: COMPILADOR.evmVersion,
    enlace: local ? '' : `${explorador}/address/${dirC}`,
  }, null, 2) + '\n');
  fs.mkdirSync(path.join(DIR_EVID, 'verificacion'), { recursive: true });
  fs.writeFileSync(path.join(DIR_EVID, 'verificacion', 'standard_input.json'), JSON.stringify(comp.entradaEstandar, null, 2) + '\n');
  console.log(`   Contrato: ${dirC}`);

  // ---- A03: metadatos
  {
    const [nm, sy, de] = [await c.name(), await c.symbol(), await c.decimals()];
    registrar({
      ID: 'A03', 'Cuenta que firma': '-', Funcion: 'name/symbol/decimals', Estado: 'Consulta',
      Esperado: '"Block4 Token", "B4T", 18', Obtenido: `"${nm}", "${sy}", ${de}`,
      Aprobado: nm === 'Block4 Token' && sy === 'B4T' && de === 18n ? 'Sí' : 'No', Captura: 'A03_metadatos.png',
    });
  }

  // ---- Ayudante para transferencias exitosas
  async function transferir(id, de, a, monto, extra = {}) {
    const v = typeof monto === 'bigint' ? monto : U(monto);
    const destino = a === 'CERO' ? ethers.ZeroAddress : A[a];
    const tx = await C(de).transfer(destino, v, await gas());
    const rec = await tx.wait();
    if (a !== de) { esperado[de] -= v; esperado[a] += v; }
    const { ok, s } = await cuadra();
    const ev = eventos(rec, 'Transfer')[0];
    const okEv = ev && ev.args[0] === A[de] && ev.args[1] === destino && ev.args[2] === v;
    registrar({
      ID: id, 'Cuenta que firma': de, Funcion: 'transfer', 'Parametros (B4T)': `${a} · ${F(v)} B4T`, 'Parametros (unidades)': String(v),
      Hash: tx.hash, Estado: rec.status === 1 ? 'Éxito' : 'Falló', 'Gas usado': rec.gasUsed, 'Costo (POL)': ethers.formatEther(rec.fee),
      Esperado: extra.esperado || `${de} baja y ${a} sube exactamente ${F(v)} B4T; evento Transfer`,
      Obtenido: `Saldos: ${resumenSaldos(s)}; evento Transfer ${okEv ? 'correcto' : 'NO encontrado'}`,
      Aprobado: rec.status === 1 && ok && okEv ? 'Sí' : 'No', Captura: extra.captura || '',
    });
  }

  // ---- Ayudante para transacciones que DEBEN fallar
  async function debeFallar(id, de, funcion, args, errorEsperado, textoParams, unidades, captura) {
    let errorObtenido = 'ninguno (no revirtió)';
    try { await C(de)[funcion].staticCall(...args); } catch (e) {
      let d = e.revert ? { name: e.revert.name } : null;
      if (!d && e.data) { try { d = iface.parseError(e.data); } catch { d = null; } }
      errorObtenido = d ? d.name : (e.shortMessage || e.message);
    }
    const antes = await saldos();
    const tx = await C(de)[funcion](...args, { gasLimit: 120000n, ...(await gas()) });
    let rec;
    try { rec = await tx.wait(); } catch (e) { rec = e.receipt; }
    const despues = await saldos();
    const sinCambio = CUENTAS.every(n => antes[n] === despues[n]);
    const sinEventos = rec ? rec.logs.length === 0 : false;
    registrar({
      ID: id, 'Cuenta que firma': de, Funcion: funcion, 'Parametros (B4T)': textoParams, 'Parametros (unidades)': unidades,
      Hash: tx.hash, Estado: rec && rec.status === 0 ? 'Falló (esperado)' : 'Éxito (inesperado)', 'Gas usado': rec ? rec.gasUsed : '', 'Costo (POL)': rec ? ethers.formatEther(rec.fee) : '',
      Esperado: `Revierte con ${errorEsperado}; ningún saldo cambia; sin eventos`,
      Obtenido: `Revirtió con ${errorObtenido}; saldos ${sinCambio ? 'sin cambio' : 'CAMBIARON'}; eventos: ${rec ? rec.logs.length : '?'}`,
      Aprobado: rec && rec.status === 0 && errorObtenido === errorEsperado && sinCambio && sinEventos ? 'Sí' : 'No', Captura: captura || '',
    });
  }

  // ---- A04: distribución inicial
  for (const [i, n] of ['I1', 'I2', 'I3', 'I4'].entries()) await transferir(`A04-${i + 1}`, 'D', n, 250000);
  await foto('Después de A04 (distribución)');

  // ---- A05: 12 transferencias entre pares
  const pares = [['I1', 'I2', '10'], ['I1', 'I3', '20'], ['I1', 'I4', '30'], ['I2', 'I1', '1.5'], ['I2', 'I3', '40'], ['I2', 'I4', '50'],
    ['I3', 'I1', '60'], ['I3', 'I2', '70'], ['I3', 'I4', '0.25'], ['I4', 'I1', '80'], ['I4', 'I2', '90'], ['I4', 'I3', '100']];
  for (const [i, [de, a, m]] of pares.entries()) await transferir(`A05-${i + 1}`, de, a, m);
  await foto('Después de A05 (12 transferencias entre pares)');

  // ---- A06: monto mínimo (1 unidad)
  await transferir('A06', 'I1', 'I2', 1n, { esperado: 'I1 baja 1 unidad mínima e I2 sube 1 unidad mínima' });
  // ---- A07: saldo completo de I4 hacia D
  await transferir('A07', 'I4', 'D', await c.balanceOf(A.I4), { esperado: 'I4 queda en 0 y D recibe todo su saldo' });
  await foto('Después de A07 (saldo completo de I4 a D)');
  // ---- A08: monto cero
  await transferir('A08', 'I1', 'I2', 0n, { esperado: 'Se acepta, emite Transfer con valor 0 y ningún saldo cambia' });
  // ---- A09: autotransferencia
  await transferir('A09', 'I3', 'I3', 5, { esperado: 'Se acepta, emite Transfer y el saldo de I3 no cambia' });

  // ---- A10: saldo insuficiente (I4 tiene 0)
  await debeFallar('A10', 'I4', 'transfer', [A.I1, U(1)], 'ERC20InsufficientBalance', 'I1 · 1.0 B4T (I4 tiene 0)', String(U(1)));
  // ---- A11: dirección cero
  await debeFallar('A11', 'I1', 'transfer', [ethers.ZeroAddress, U(1)], 'ERC20InvalidReceiver', '0x000…000 · 1.0 B4T', String(U(1)));

  // ---- A12: approve
  {
    const v = U(100);
    const tx = await C('I1').approve(A.I2, v, await gas()); const rec = await tx.wait();
    const al = await c.allowance(A.I1, A.I2); const ev = eventos(rec, 'Approval')[0];
    const okEv = ev && ev.args[0] === A.I1 && ev.args[1] === A.I2 && ev.args[2] === v;
    registrar({
      ID: 'A12', 'Cuenta que firma': 'I1', Funcion: 'approve', 'Parametros (B4T)': 'I2 · 100.0 B4T', 'Parametros (unidades)': String(v),
      Hash: tx.hash, Estado: rec.status === 1 ? 'Éxito' : 'Falló', 'Gas usado': rec.gasUsed, 'Costo (POL)': ethers.formatEther(rec.fee),
      Esperado: 'allowance(I1, I2) = 100 B4T; evento Approval', Obtenido: `allowance = ${F(al)} B4T; evento Approval ${okEv ? 'correcto' : 'NO encontrado'}`,
      Aprobado: rec.status === 1 && al === v && okEv ? 'Sí' : 'No',
    });
  }
  // ---- A13: transferFrom dentro del límite
  {
    const v = U(40);
    const tx = await C('I2').transferFrom(A.I1, A.I3, v, await gas()); const rec = await tx.wait();
    esperado.I1 -= v; esperado.I3 += v;
    const { ok, s } = await cuadra(); const al = await c.allowance(A.I1, A.I2);
    registrar({
      ID: 'A13', 'Cuenta que firma': 'I2', Funcion: 'transferFrom', 'Parametros (B4T)': 'de I1 a I3 · 40.0 B4T', 'Parametros (unidades)': String(v),
      Hash: tx.hash, Estado: rec.status === 1 ? 'Éxito' : 'Falló', 'Gas usado': rec.gasUsed, 'Costo (POL)': ethers.formatEther(rec.fee),
      Esperado: 'I1 baja 40, I3 sube 40 y allowance(I1, I2) queda en 60 B4T', Obtenido: `allowance = ${F(al)} B4T; saldos: ${resumenSaldos(s)}`,
      Aprobado: rec.status === 1 && ok && al === U(60) ? 'Sí' : 'No',
    });
  }
  await foto('Después de A13 (gasto delegado)');
  // ---- A14: exceso de autorización
  await debeFallar('A14', 'I2', 'transferFrom', [A.I1, A.I3, U(61)], 'ERC20InsufficientAllowance', 'de I1 a I3 · 61.0 B4T (autorizado: 60)', String(U(61)));
  // ---- A15: cambio de autorización (a 0 y luego a 50)
  for (const [sub, monto] of [['A15-1', 0], ['A15-2', 50]]) {
    const v = U(monto);
    const tx = await C('I1').approve(A.I2, v, await gas()); const rec = await tx.wait();
    const al = await c.allowance(A.I1, A.I2);
    registrar({
      ID: sub, 'Cuenta que firma': 'I1', Funcion: 'approve', 'Parametros (B4T)': `I2 · ${F(v)} B4T`, 'Parametros (unidades)': String(v),
      Hash: tx.hash, Estado: rec.status === 1 ? 'Éxito' : 'Falló', 'Gas usado': rec.gasUsed, 'Costo (POL)': ethers.formatEther(rec.fee),
      Esperado: `allowance(I1, I2) = ${F(v)} B4T`, Obtenido: `allowance = ${F(al)} B4T`, Aprobado: rec.status === 1 && al === v ? 'Sí' : 'No',
    });
  }

  // ---- A16: sin funciones privilegiadas
  {
    const funciones = comp.abi.filter(x => x.type === 'function').map(x => x.name).sort();
    const prohibidas = funciones.filter(n => /mint|burn|pause|owner|admin|role|upgrade|blacklist|block|fee|tax|withdraw/i.test(n));
    const estandar = ['INITIAL_SUPPLY', 'allowance', 'approve', 'balanceOf', 'decimals', 'name', 'symbol', 'totalSupply', 'transfer', 'transferFrom'];
    registrar({
      ID: 'A16', 'Cuenta que firma': '-', Funcion: 'revisión ABI', Estado: 'Consulta',
      Esperado: 'Solo funciones ERC-20 estándar e INITIAL_SUPPLY; ninguna función mint, burn, pause, owner ni administrativa',
      Obtenido: `Funciones: ${funciones.join(', ')}${prohibidas.length ? ' · PROHIBIDAS: ' + prohibidas.join(', ') : ''}`,
      Aprobado: prohibidas.length === 0 && JSON.stringify(funciones) === JSON.stringify(estandar.sort()) ? 'Sí' : 'No', Captura: 'A16_funciones.png',
    });
    fs.writeFileSync(path.join(DIR_EVID, 'verificacion', 'abi.json'), JSON.stringify(comp.abi, null, 2) + '\n');
  }

  // ---- A17: conciliación final
  {
    const s = await saldos(); const ts = await c.totalSupply();
    const suma = CUENTAS.reduce((a, n) => a + s[n], 0n);
    const tabla = { D: U('249810.25'), I1: U('250041.499999999999999999'), I2: U('250078.500000000000000001'), I3: U('250069.75'), I4: 0n };
    const okTabla = CUENTAS.every(n => s[n] === tabla[n]);
    registrar({
      ID: 'A17', 'Cuenta que firma': '-', Funcion: 'conciliación', Estado: 'Consulta',
      Esperado: 'Suma de saldos = totalSupply = 1 000 000 B4T; saldos iguales a la tabla del plan',
      Obtenido: `Suma = ${F(suma)}; totalSupply = ${F(ts)}; ${resumenSaldos(s)}`,
      Aprobado: suma === ts && ts === S && okTabla ? 'Sí' : 'No', Captura: 'A17_conciliacion.png',
    });
    await foto('Final (A17)');
  }

  // ---- A18: en Amoy queda para npm run verificar; en la red simulada se hace la
  // verificación equivalente: recompilar desde la entrada estándar y comparar el bytecode desplegado.
  if (local) {
    const solc = require('solc');
    const entrada = JSON.parse(JSON.stringify(comp.entradaEstandar));
    entrada.settings.outputSelection = { '*': { '*': ['evm.deployedBytecode.object'] } };
    const salida = JSON.parse(solc.compile(JSON.stringify(entrada)));
    const esperadoRt = '0x' + salida.contracts['contracts/B4T.sol'].B4T.evm.deployedBytecode.object;
    const desplegado = await provider.getCode(dirC);
    const igual = desplegado.toLowerCase() === esperadoRt.toLowerCase();
    registrar({
      ID: 'A18', 'Cuenta que firma': '-', Funcion: 'verificación', Estado: 'Consulta',
      Esperado: 'El bytecode desplegado coincide con el que produce el código fuente publicado (equivalente local de la verificación en Polygonscan)',
      Obtenido: `Recompilado desde verificacion/standard_input.json: bytecode ${igual ? 'idéntico' : 'DISTINTO'} (${(desplegado.length - 2) / 2} bytes)`,
      Aprobado: igual ? 'Sí' : 'No', Captura: '',
    });
  } else {
    registrar({
      ID: 'A18', 'Cuenta que firma': '-', Funcion: 'verificación', Estado: 'Pendiente',
      Esperado: 'Código fuente verificado en el explorador de Amoy', Obtenido: 'Pendiente: correr npm run verificar',
      Aprobado: '', Captura: 'A18_verificacion.png',
    });
  }

  escribirResumen(dirC, txDesp.hash, fondeo);
}

function escribirResumen(dirC, hashDesp, fondeo) {
  const tx = filas.filter(f => f.Hash);
  const gasTotal = tx.reduce((a, f) => a + BigInt(f['Gas usado'] || 0), 0n);
  const costo = tx.reduce((a, f) => a + ethers.parseEther(f['Costo (POL)'] || '0'), 0n);
  const aprob = filas.filter(f => f.Aprobado === 'Sí').length;
  const casos = filas.filter(f => f.Aprobado === 'Sí' || f.Aprobado === 'No').length;
  let md = local ? `# Resultados de las pruebas en red simulada\n\n> Ejecución en una blockchain local (Hardhat, chain ID 31337, reglas de Ethereum \`cancun\`) por falta de POL de prueba en Amoy: los faucets exigen saldo en Ethereum mainnet. El contrato, la configuración del compilador y los casos son los mismos de la matriz A01–A18; los costos se calcularon con una propina de 30 gwei, como en Amoy, y están en POL simulado. Los hashes no son consultables en Polygonscan.\n\n` : `# Resultados de las pruebas en Polygon Amoy\n\n`;
  md += `Generado: ${ahora()} (hora de Bogotá)\n\n`;
  md += `- Contrato: ${local ? dirC : `[${dirC}](${explorador}/address/${dirC})`}\n`;
  md += `- Transacción de despliegue: ${local ? hashDesp : `[${hashDesp.slice(0, 18)}…](${explorador}/tx/${hashDesp})`}\n`;
  md += `- Compilador: solc ${COMPILADOR.version}, optimización ${COMPILADOR.optimizer.runs} runs, EVM ${COMPILADOR.evmVersion}\n`;
  md += `- Filas aprobadas: ${aprob} de ${casos}${local ? '' : ' (A18 se completa con `npm run verificar`)'}\n`;
  md += `- Transacciones del token: ${tx.length} · gas total: ${gasTotal} · costo total: ${ethers.formatEther(costo)} POL\n\n`;
  md += `| ID | Firma | Función | Estado | Aprobado | Transacción |\n| --- | --- | --- | --- | --- | --- |\n`;
  for (const f of filas) md += `| ${f.ID} | ${f['Cuenta que firma']} | ${f.Funcion} | ${f.Estado} | ${f.Aprobado || 'Pendiente'} | ${f.Hash ? (local ? f.Hash.slice(0, 12) : `[ver](${f['Enlace Polygonscan']})`) : '—'} |\n`;
  if (fondeo.length) md += `\nFondeo de POL desde D hacia I1–I4 (no son casos de prueba): ver \`fondeo_pol.csv\`.\n`;
  md += `\nDetalle completo: \`matriz_${SUFIJO}.csv\` · Saldos por etapa: \`saldos_${SUFIJO}.csv\`\n`;
  fs.writeFileSync(path.join(DIR_EVID, 'resumen_pruebas.md'), md);
  console.log(`\nListo: ${aprob} de ${casos} filas aprobadas. Revisa evidencias/${SUFIJO}/resumen_pruebas.md`);
  if (!local) console.log('Siguiente paso: npm run verificar');
}

main().catch(e => {
  guardarParcial();
  console.error('\nSe detuvo: ' + (e.shortMessage || e.message));
  if (filas.length) console.error(`Lo que alcanzó a correr quedó guardado en evidencias/${SUFIJO}/matriz_${SUFIJO}.csv`);
  process.exit(1);
});
