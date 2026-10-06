import { enforceSubscription } from '../auth/subscription.service';

export const verificarLicenciaActiva = enforceSubscription;
export const verificarEmpresaActiva = enforceSubscription;
export default { verificarLicenciaActiva, verificarEmpresaActiva };