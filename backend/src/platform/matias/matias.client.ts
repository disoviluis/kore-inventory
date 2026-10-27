import https from 'https';

export interface MatiasProbeResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

export interface MatiasInvoiceResult extends MatiasProbeResult {
  code?: string;
  reference?: string;
}

export async function emitMatiasInvoice(
  baseUrl: string,
  token: string,
  clientUuid: string | null,
  payload: any,
  timeoutMs = 30000
): Promise<MatiasInvoiceResult> {
  let url: URL;
  try {
    url = new URL(`${baseUrl.replace(/\/$/, '')}/invoice`);
    if (clientUuid) url.searchParams.set('client_uuid', clientUuid);
  } catch {
    return { ok: false, status: 0, error: 'URL base invalida' };
  }

  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    return { ok: false, status: 0, error: 'Matias requiere HTTPS en produccion' };
  }

  const body = JSON.stringify(payload);
  return new Promise(resolve => {
    const request = https.request(url, {
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
        Authorization: `Bearer ${token}`
      }
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        let data: any;
        try { data = responseBody ? JSON.parse(responseBody) : undefined; } catch { data = undefined; }
        const status = response.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          data,
          code: data?.code,
          reference: data?.reference,
          error: data?.message || (status ? `Matias respondio HTTP ${status}` : 'Sin respuesta de Matias')
        });
      });
    });

    request.on('timeout', () => request.destroy(new Error('Tiempo de espera agotado al emitir factura sandbox')));
    request.on('error', error => resolve({ ok: false, status: 0, error: error.message }));
    request.end(body);
  });
}

export async function probeMatias(baseUrl: string, token: string, timeoutMs = 10000): Promise<MatiasProbeResult> {
  let url: URL;
  try {
    url = new URL(`${baseUrl.replace(/\/$/, '')}/auth/user`);
  } catch {
    return { ok: false, status: 0, error: 'URL base invalida' };
  }

  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    return { ok: false, status: 0, error: 'Matias requiere HTTPS en produccion' };
  }

  return new Promise(resolve => {
    const request = https.request(url, {
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let data: any;
        try { data = body ? JSON.parse(body) : undefined; } catch { data = undefined; }
        const status = response.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          data,
          error: status >= 200 && status < 300 ? undefined : (data?.message || `Matias respondio HTTP ${status}`)
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Tiempo de espera agotado al conectar con Matias'));
    });
    request.on('error', error => resolve({ ok: false, status: 0, error: error.message }));
    request.end();
  });
}
