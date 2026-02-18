# 📷 Lector de Código de Barras con Cámara Móvil

## 🎯 Objetivo
Convertir la cámara del móvil en un lector de códigos de barras profesional para el POS, sin necesidad de hardware adicional.

---

## 🚀 Soluciones Recomendadas

### **Opción 1: QuaggaJS** ⭐ (Recomendada)
**¿Por qué?** Librería JavaScript pura, sin dependencias, funciona offline

```html
<!-- Agregar al HTML -->
<script src="https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js"></script>
```

```javascript
// Inicializar scanner
function iniciarScannerCodigo() {
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-container'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Cámara trasera
            }
        },
        decoder: {
            readers: [
                "ean_reader",      // EAN-13, EAN-8
                "code_128_reader", // Code 128
                "code_39_reader",  // Code 39
                "upc_reader"       // UPC-A, UPC-E
            ]
        }
    }, function(err) {
        if (err) {
            console.error(err);
            return;
        }
        Quagga.start();
    });

    // Detectar código
    Quagga.onDetected(function(result) {
        const codigo = result.codeResult.code;
        console.log("Código detectado:", codigo);
        
        // Buscar producto por código de barras
        buscarProductoPorCodigo(codigo);
        
        // Sonido de confirmación
        reproducirSonido('success');
        
        // Detener scanner
        Quagga.stop();
        cerrarModalScanner();
    });
}
```

---

### **Opción 2: ZXing (Google)** 
**¿Por qué?** Librería oficial de Google, muy precisa

```html
<script src="https://unpkg.com/@zxing/library@latest"></script>
```

```javascript
const codeReader = new ZXing.BrowserMultiFormatReader();

async function iniciarScannerZXing() {
    try {
        const videoInputDevices = await codeReader.listVideoInputDevices();
        
        // Seleccionar cámara trasera
        const camaraTraseraId = videoInputDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear')
        )?.deviceId || videoInputDevices[0].deviceId;

        codeReader.decodeFromVideoDevice(
            camaraTraseraId, 
            'video-scanner', 
            (result, err) => {
                if (result) {
                    console.log('Código detectado:', result.text);
                    buscarProductoPorCodigo(result.text);
                    codeReader.reset();
                    cerrarModalScanner();
                }
            }
        );
    } catch (err) {
        console.error(err);
    }
}
```

---

### **Opción 3: html5-qrcode** (Muy Fácil)
**¿Por qué?** La más fácil de implementar, UI incluida

```html
<script src="https://unpkg.com/html5-qrcode"></script>
```

```javascript
function iniciarScannerHTML5() {
    const html5QrCode = new Html5Qrcode("scanner-container");
    
    const qrCodeSuccessCallback = (decodedText) => {
        console.log(`Código detectado: ${decodedText}`);
        buscarProductoPorCodigo(decodedText);
        html5QrCode.stop();
        cerrarModalScanner();
    };

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        qrCodeSuccessCallback
    );
}
```

---

## 📱 Implementación en tu POS

### 1. Agregar Modal de Scanner

```html
<!-- Modal Scanner de Código de Barras -->
<div class="modal fade" id="scannerModal" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark">
            <div class="modal-header border-0">
                <h5 class="modal-title text-white">
                    <i class="bi bi-camera me-2"></i>Escanear Código de Barras
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
                <div id="scanner-container" style="width: 100%; height: 400px;">
                    <!-- Cámara se renderiza aquí -->
                </div>
                
                <!-- Instrucciones -->
                <div class="p-3 bg-secondary text-white text-center">
                    <i class="bi bi-info-circle me-2"></i>
                    Apunta la cámara al código de barras
                </div>
            </div>
        </div>
    </div>
</div>
```

### 2. Botón para Abrir Scanner

```html
<!-- En la sección de búsqueda de productos -->
<div class="input-group">
    <span class="input-group-text"><i class="bi bi-search"></i></span>
    <input type="text" class="form-control" id="buscarProducto" 
           placeholder="Buscar por nombre, SKU o código...">
    <button class="btn btn-primary" onclick="abrirScanner()">
        <i class="bi bi-camera"></i> Scanner
    </button>
</div>
```

### 3. Función para Abrir Scanner

```javascript
function abrirScanner() {
    const modal = new bootstrap.Modal(document.getElementById('scannerModal'));
    modal.show();
    
    // Iniciar scanner después de que el modal esté visible
    setTimeout(() => {
        iniciarScannerCodigo(); // QuaggaJS
        // O: iniciarScannerZXing();
        // O: iniciarScannerHTML5();
    }, 500);
}

function cerrarModalScanner() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('scannerModal'));
    if (modal) {
        modal.hide();
    }
}
```

### 4. Buscar Producto por Código

```javascript
async function buscarProductoPorCodigo(codigo) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-producto?empresaId=${currentEmpresa.id}&busqueda=${codigo}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al buscar producto');

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            // Producto encontrado
            agregarProducto(data.data[0]);
            mostrarAlerta(`✅ ${data.data[0].nombre} agregado`, 'success');
            reproducirSonido('add');
        } else {
            // No encontrado
            mostrarAlerta('Producto no encontrado', 'warning');
            reproducirSonido('error');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al buscar producto', 'danger');
    }
}
```

---

## 🎨 Mejoras Visuales

### Overlay de Escaneo

```css
#scanner-container {
    position: relative;
    background: #000;
}

#scanner-container::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 250px;
    height: 250px;
    border: 3px solid #00ff00;
    border-radius: 10px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    z-index: 10;
    pointer-events: none;
}

.scanner-line {
    position: absolute;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00ff00, transparent);
    animation: scan 2s infinite;
    z-index: 11;
}

@keyframes scan {
    0%, 100% { top: 20%; }
    50% { top: 80%; }
}
```

---

## 📊 Comparación de Librerías

| Característica | QuaggaJS | ZXing | html5-qrcode |
|----------------|----------|-------|--------------|
| **Facilidad** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Precisión** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Velocidad** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Tamaño** | 256 KB | 180 KB | 120 KB |
| **Offline** | ✅ | ✅ | ✅ |
| **Tipos soportados** | EAN, Code128, Code39, UPC | Todos | QR + Barras |

---

## 🎯 Recomendación Final

### Para tu Caso: **QuaggaJS**

**Por qué:**
1. ✅ Soporta EAN-13 (más común en Colombia)
2. ✅ Funciona offline
3. ✅ Muy buena precisión
4. ✅ Fácil de personalizar
5. ✅ No requiere backend

### Implementación en 3 Pasos:

1. **Agregar librería al HTML**
2. **Agregar modal de scanner**
3. **Implementar funciones**

---

## 🔧 Instalación Rápida

```bash
# En tu proyecto
npm install @ericblade/quagga2

# O directamente en HTML:
<script src="https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js"></script>
```

---

## 📱 Optimización para Móviles

```javascript
// Detectar móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);

if (isMobile) {
    // Configuración optimizada para móvil
    Quagga.init({
        inputStream: {
            constraints: {
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 },
                facingMode: "environment",
                aspectRatio: { min: 1, max: 2 }
            }
        }
    });
}
```

---

## 🚀 Próximos Pasos

1. ✅ Agregar botón "Scanner" en búsqueda de productos
2. ✅ Implementar modal con QuaggaJS
3. ✅ Probar con códigos EAN-13
4. ✅ Agregar feedback visual y sonoro
5. ✅ Optimizar para diferentes móviles

---

## 📞 Soporte

- **QuaggaJS Docs:** https://github.com/ericblade/quagga2
- **Demo Interactiva:** https://ericblade.github.io/quagga2/
- **ZXing:** https://github.com/zxing-js/library

---

**✨ Listo para implementar cuando quieras!**
