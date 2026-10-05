window.comprimirImagen = function comprimirImagen(file, maxWidth = 800, maxHeight = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        let { width, height } = image;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        context.drawImage(image, 0, 0, width, height);

        const mime = canvas.toDataURL('image/webp').startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg';
        canvas.toBlob(
          (blob) => blob ? resolve({ blob, mime }) : reject(new Error('No se pudo comprimir la imagen')),
          mime,
          quality
        );
      };
      image.onerror = () => reject(new Error('No se pudo leer la imagen'));
      image.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
};
