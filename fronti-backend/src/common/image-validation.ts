import { BadRequestException } from '@nestjs/common';

const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const maxImageBytes = 10 * 1024 * 1024;

export function validateImageValue(value?: string | null, field = 'imagen') {
  if (!value) {
    return;
  }

  const cleanValue = value.trim().toLowerCase();
  const dataUrlMatch = cleanValue.match(/^data:image\/(jpg|jpeg|png|webp);base64,(.+)$/);
  const isDataUrl = Boolean(dataUrlMatch);
  const isUrlWithExtension = allowedImageExtensions.some((extension) => {
    const path = cleanValue.split('?')[0].split('#')[0];
    return path.endsWith(`.${extension}`);
  });

  if (!isDataUrl && !isUrlWithExtension) {
    throw new BadRequestException(
      `${field} debe ser una imagen jpg, jpeg, png o webp.`,
    );
  }

  if (dataUrlMatch) {
    const base64 = dataUrlMatch[2];
    const estimatedBytes = Math.ceil((base64.length * 3) / 4);

    if (estimatedBytes > maxImageBytes) {
      throw new BadRequestException(
        `${field} supera el límite de 10 MB. Intenta con una imagen más pequeña.`,
      );
    }
  }
}

export function validateImageGallery(values?: string[] | null) {
  if (!values?.length) {
    return;
  }

  values.forEach((value, index) =>
    validateImageValue(value, `galeriaImagenes[${index}]`),
  );
}
