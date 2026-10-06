const path = require('node:path');
const backend = path.resolve(__dirname, '../backend');
require(path.join(backend, 'node_modules/dotenv')).config({ path: path.join(backend, '.env') });
const pool = require(path.join(backend, 'dist/shared/database')).default;
const { runSubscriptionMaintenance } = require(path.join(backend, 'dist/core/auth/subscription.job'));
runSubscriptionMaintenance().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error('La revision de suscripciones fallo:', error.code || error.name);
  process.exitCode = 1;
}).finally(() => pool.end());