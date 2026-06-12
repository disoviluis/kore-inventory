# Guía Paso a Paso: Google Search Console

## 🎯 Objetivo
Registrar tu sitio en Google Search Console para que Google indexe kinventoryservices.com

---

## 📋 Paso 1: Acceder a Google Search Console

1. Ve a: https://search.google.com/search-console
2. Inicia sesión con tu cuenta de Google (usa una cuenta de la empresa)

---

## 📋 Paso 2: Agregar tu propiedad

### Opción A: Dominio completo (RECOMENDADO)

1. Click en "Agregar propiedad"
2. Selecciona **"Dominio"** (no "Prefijo de URL")
3. Escribe: `kinventoryservices.com` (sin https://)
4. Click en "Continuar"

**Ventajas**:
- Incluye automáticamente www y sin www
- Incluye http y https
- Incluye todos los subdominios

### Opción B: Prefijo de URL (Alternativa)

Si tienes problemas con DNS, usa:
- URL: `https://kinventoryservices.com`

---

## 📋 Paso 3: Verificar la propiedad

Google te pedirá verificar que eres dueño del dominio.

### Método 1: Verificación DNS (RECOMENDADO para dominio completo)

Google te dará un código como este:
```
google-site-verification=ABCDefgh123456789XYZ
```

#### Si usas AWS Route 53:

1. Ve a AWS Console → Route 53
2. Selecciona tu zona hospedada: `kinventoryservices.com`
3. Click en "Create record"
4. Configura:
   - **Tipo de registro**: TXT
   - **Nombre**: @ (o deja vacío)
   - **Valor**: pega el código completo que te dio Google
   - **TTL**: 300 (5 minutos)
5. Click en "Create records"
6. Regresa a Google Search Console
7. Click en "Verificar"

**Tiempo de propagación**: 5-30 minutos

#### Si usas otro proveedor DNS:

1. Accede al panel de tu proveedor DNS (GoDaddy, Namecheap, Cloudflare, etc.)
2. Busca la opción "Administrar DNS" o "DNS Records"
3. Agrega un registro TXT:
   - Host: @ o deja vacío
   - Valor: el código de Google
   - TTL: 300 o automático
4. Guarda los cambios
5. Regresa a Google y verifica

---

### Método 2: Archivo HTML (si elegiste prefijo de URL)

1. Google te dará un archivo como: `google1234567890abcdef.html`
2. Descarga el archivo
3. Súbelo a: `c:\xampp\htdocs\kore-inventory\frontend\public\`
4. Verifica que sea accesible en:
   ```
   https://kinventoryservices.com/google1234567890abcdef.html
   ```
5. Regresa a Google Search Console
6. Click en "Verificar"

---

### Método 3: Meta tag HTML (alternativa rápida)

1. Google te dará un código como:
   ```html
   <meta name="google-site-verification" content="ABC123XYZ" />
   ```
2. Abre: `c:\xampp\htdocs\kore-inventory\frontend\public\index.html`
3. Agrega el meta tag dentro de `<head>`, por ejemplo después de:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <!-- Agregar aquí -->
   <meta name="google-site-verification" content="ABC123XYZ" />
   ```
4. Guarda el archivo
5. Despliega los cambios al servidor
6. Verifica que el meta tag esté presente en:
   ```
   https://kinventoryservices.com
   ```
7. Regresa a Google Search Console
8. Click en "Verificar"

---

## 📋 Paso 4: Enviar el Sitemap

Una vez verificada la propiedad:

1. En el menú izquierdo, busca "Sitemaps"
2. En "Agregar un sitemap nuevo"
3. Escribe: `sitemap.xml`
4. Click en "Enviar"

Google comenzará a rastrear tu sitio usando el sitemap.

**Verificación**:
```
https://kinventoryservices.com/sitemap.xml
```

---

## 📋 Paso 5: Solicitar indexación (Opcional pero recomendado)

Para acelerar el proceso:

1. En el menú, selecciona "Inspección de URLs"
2. En la barra superior, pega:
   ```
   https://kinventoryservices.com
   ```
3. Presiona Enter
4. Si aparece "La URL no está en Google", click en:
   **"Solicitar indexación"**
5. Espera 1-2 minutos mientras Google analiza la página
6. Click en "Solicitar indexación"

Repite esto para las páginas más importantes:
- `https://kinventoryservices.com/index.html`
- `https://kinventoryservices.com/erp-inventarios.html`

---

## 📋 Paso 6: Verificar en Google

Después de 24-48 horas, busca en Google:

```
site:kinventoryservices.com
```

Deberías ver resultados como:
- kinventoryservices.com
- kinventoryservices.com/erp-inventarios.html

---

## ⚠️ Problemas comunes

### "No se pudo verificar la propiedad"

**Solución DNS**:
- Espera 30 minutos y vuelve a intentar
- Verifica que el registro TXT esté creado correctamente
- Usa herramientas como: https://dnschecker.org

**Solución archivo HTML**:
- Verifica que el archivo esté en la raíz del servidor
- Accede directamente a la URL en el navegador
- Asegúrate de que no redirija a otra página

**Solución meta tag**:
- Verifica que el código esté dentro de `<head>`
- Inspecciona la página con F12 (DevTools) y busca el meta tag
- Asegúrate de que no haya errores en el HTML

---

### "El sitemap no se puede leer"

**Solución**:
1. Verifica que sitemap.xml sea accesible:
   ```
   https://kinventoryservices.com/sitemap.xml
   ```
2. Verifica que el archivo XML esté bien formado
3. Asegúrate de que el servidor envíe el header correcto:
   ```
   Content-Type: application/xml
   ```

---

### "Google no encuentra mi sitio"

**Solución**:
1. Verifica que robots.txt permita el rastreo:
   ```
   https://kinventoryservices.com/robots.txt
   ```
   Debe decir: `Allow: /`

2. Verifica que no haya etiquetas que bloqueen indexación en index.html:
   ```html
   <!-- MALO -->
   <meta name="robots" content="noindex">
   
   <!-- BUENO -->
   <meta name="robots" content="index, follow">
   ```

---

## 📊 Monitorear el progreso

En Google Search Console verás:

### Rendimiento
- Impresiones: cuántas veces aparece tu sitio en resultados
- Clics: cuántos usuarios hacen clic
- CTR: porcentaje de clics
- Posición promedio

### Cobertura
- Páginas indexadas
- Páginas con errores
- Páginas excluidas

### Mejoras
- Experiencia en la página
- Datos estructurados
- Velocidad

---

## ✅ Checklist de verificación

- [ ] Cuenta de Google creada
- [ ] Acceso a Google Search Console
- [ ] Propiedad agregada (dominio o prefijo)
- [ ] Método de verificación elegido (DNS/archivo/meta tag)
- [ ] Verificación completada exitosamente
- [ ] Sitemap enviado (sitemap.xml)
- [ ] Indexación solicitada para páginas principales
- [ ] Búsqueda `site:kinventoryservices.com` muestra resultados

---

## 📅 Timeline esperado

| Tiempo | Acción |
|--------|--------|
| Día 1 | Configurar Search Console |
| Día 1-2 | Google verifica y acepta sitemap |
| Día 2-7 | Primeras páginas indexadas |
| Semana 2 | Aparece en búsqueda de marca |
| Mes 1 | Primeras impresiones orgánicas |

---

## 🆘 Soporte adicional

Si tienes problemas:

1. **Centro de ayuda de Google**:
   https://support.google.com/webmasters

2. **Foro de Search Console**:
   https://support.google.com/webmasters/community

3. **Video tutorial oficial**:
   https://www.youtube.com/watch?v=pRwLW1J9Mx4

---

## 📚 Recursos útiles

- **Validador de sitemap**: https://www.xml-sitemaps.com/validate-xml-sitemap.html
- **Verificador DNS**: https://dnschecker.org
- **Test robots.txt**: https://support.google.com/webmasters/answer/6062598
- **Structured Data Testing**: https://validator.schema.org

---

**Última actualización**: 2026-06-12
**Próximo paso**: Ver GUIA_SEO_IMPLEMENTACION.md para acciones adicionales
