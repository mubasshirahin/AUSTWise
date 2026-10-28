import austwiseIcon from '../assets/austwise-icon-final.svg';

let iconPngPromise;

export function getAustwiseIconPng() {
  if (!iconPngPromise) {
    iconPngPromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth || 256;
        canvas.height = image.naturalHeight || 256;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not prepare the AUSTWise export icon.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('Could not load the AUSTWise export icon.'));
      image.src = austwiseIcon;
    });
  }
  return iconPngPromise;
}
