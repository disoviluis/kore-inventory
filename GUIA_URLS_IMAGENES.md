# 📸 Guía de URLs de Imágenes para Productos

## ❌ URLs INCORRECTAS (NO funcionan)

### Pixabay - Página HTML
```
❌ https://pixabay.com/es/vectors/taladro-el%c3%a9ctrico-martillo-taladro-154903/
```
Esta es la URL de la **página web**, no de la imagen directa.

### Amazon - Página de producto
```
❌ https://www.amazon.com/dp/B08XYZ123
```

### MercadoLibre - Página de producto
```
❌ https://articulo.mercadolibre.com.co/MCO-123456789
```

---

## ✅ URLs CORRECTAS (Funcionan)

### Pixabay - Imagen directa CDN
```
✅ https://cdn.pixabay.com/photo/2013/07/12/14/15/drill-148093_640.png
✅ https://cdn.pixabay.com/photo/2013/07/12/14/15/drill-148093_1280.png
```

**Cómo obtenerla:**
1. Ir a la página de Pixabay
2. Click derecho en la imagen → "Copiar dirección de imagen"
3. O usar el botón de descarga y copiar la URL del CDN

### Unsplash - Imagen directa
```
✅ https://images.unsplash.com/photo-1234567890?w=640
```

### CloudFront / S3 AWS
```
✅ https://d2xyz123.cloudfront.net/products/taladro.jpg
✅ https://mi-bucket.s3.amazonaws.com/productos/taladro.jpg
```

### Imgur
```
✅ https://i.imgur.com/abc123.jpg
✅ https://i.imgur.com/abc123.png
```

### Google Drive (público)
```
✅ https://drive.google.com/uc?export=view&id=FILE_ID
```

---

## 🎯 FORMATO CORRECTO DE URL

Una URL de imagen válida debe:

1. ✅ Terminar en extensión de imagen: `.jpg`, `.png`, `.webp`, `.gif`
2. ✅ Apuntar directamente al archivo (no a una página HTML)
3. ✅ Ser accesible públicamente (sin login)
4. ✅ Soportar HTTPS

---

## 🔧 CÓMO OBTENER LA URL CORRECTA

### Método 1: Click derecho
1. Click derecho en la imagen
2. "Copiar dirección de imagen" / "Copy image address"
3. Pegar en el campo URL

### Método 2: Inspeccionar elemento
1. Click derecho → "Inspeccionar"
2. Buscar el tag `<img src="...">`
3. Copiar el valor de `src`

### Método 3: Ver código fuente
1. Ver código fuente de la página (Ctrl + U)
2. Buscar la imagen
3. Copiar URL completa

---

## 📦 SERVICIOS RECOMENDADOS PARA HOSTING DE IMÁGENES

### Gratuitos:
1. **Imgur** - https://imgur.com
   - ✅ Sin registro necesario
   - ✅ URLs permanentes
   - ✅ Fast CDN
   
2. **Cloudinary** - https://cloudinary.com
   - ✅ 25GB gratis
   - ✅ Optimización automática
   - ✅ Transformaciones on-the-fly

3. **ImageBB** - https://imgbb.com
   - ✅ Simple y rápido
   - ✅ No expira

### Profesionales:
1. **AWS S3 + CloudFront**
   - ✅ Alta disponibilidad
   - ✅ CDN global
   - 💰 ~$0.023 por GB

2. **Google Cloud Storage**
   - ✅ Integración con Firebase
   - ✅ CDN incluido

3. **Azure Blob Storage**
   - ✅ CDN incluido
   - ✅ Integrado con Microsoft

---

## 🚀 MEJORES PRÁCTICAS

### Tamaño recomendado:
- **Miniatura:** 150x150px
- **Lista:** 300x300px
- **Detalle:** 800x800px
- **HD:** 1200x1200px

### Formato recomendado:
1. **WebP** (mejor compresión, soporte moderno)
2. **JPEG** (compatibilidad universal)
3. **PNG** (transparencia, logos)

### Optimización:
- Usar herramientas como TinyPNG, ImageOptim
- Comprimir antes de subir
- Usar CDN para delivery rápido

---

## 📋 EJEMPLO COMPLETO: SUBIR IMAGEN A IMGUR

### Paso 1: Subir
```bash
curl -X POST https://api.imgur.com/3/image \
  -H "Authorization: Client-ID YOUR_CLIENT_ID" \
  -F "image=@taladro.jpg"
```

### Paso 2: Obtener URL
Respuesta:
```json
{
  "data": {
    "link": "https://i.imgur.com/abc123.jpg"
  }
}
```

### Paso 3: Usar en KORE Inventory
```
https://i.imgur.com/abc123.jpg
```

---

## 🐛 SOLUCIÓN A PROBLEMAS COMUNES

### Error: "Error al cargar imagen"
**Causa:** URL no es imagen directa  
**Solución:** Verificar que termine en .jpg/.png/.webp

### Error: CORS blocked
**Causa:** Servidor no permite hotlinking  
**Solución:** Descargar imagen y subirla a Imgur/S3

### Imagen no se ve
**Causa:** URL privada o requiere autenticación  
**Solución:** Hacer la imagen pública o usar otro hosting

---

## 💡 RECOMENDACIÓN FINAL

Para KORE Inventory, te recomendamos:

1. **Desarrollo/Pruebas:** Usar Imgur (gratis, rápido)
2. **Producción:** AWS S3 + CloudFront (profesional, escalable)
3. **Backup:** Mantener imágenes también en el servidor local

---

## 🔗 EJEMPLO DE URL CORRECTA PARA TU TALADRO

En lugar de:
```
❌ https://pixabay.com/es/vectors/taladro-el%c3%a9ctrico-martillo-taladro-154903/
```

Usa:
```
✅ https://cdn.pixabay.com/photo/2013/07/12/14/15/drill-148093_640.png
```

O busca en Google Images → Click derecho → Copiar dirección de imagen:
```
✅ https://example.com/images/taladro-percutor.jpg
```
