/**
 * 前端图片压缩工具
 * 使用 Canvas API 在浏览器端压缩图片，减少上传带宽占用
 */

interface CompressOptions {
  /** 最大宽度，默认 1920 */
  maxWidth?: number;
  /** 最大高度，默认 1920 */
  maxHeight?: number;
  /** 压缩质量 0-1，默认 0.8 */
  quality?: number;
  /** 输出格式，默认 image/jpeg */
  outputType?: string;
  /** 文件大小阈值（字节），小于此值不压缩，默认 200KB */
  skipThreshold?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  outputType: 'image/jpeg',
  skipThreshold: 200 * 1024, // 200KB
};

/**
 * 将 File 加载为 HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

/**
 * 计算等比缩放后的尺寸
 */
function calcSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * 压缩图片文件
 *
 * - 小于 skipThreshold 的文件直接返回（不做处理）
 * - GIF 文件直接返回（可能含动画）
 * - PNG 带透明通道时使用 image/png 格式，否则转 JPEG 以获得更好的压缩率
 * - 等比缩放至 maxWidth x maxHeight 以内
 *
 * @returns 压缩后的 File 对象
 */
export async function compressImage(
  file: File,
  options?: CompressOptions,
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // GIF 可能含动画，跳过压缩
  if (file.type === 'image/gif') {
    return file;
  }

  // 小文件跳过压缩
  if (file.size <= opts.skipThreshold) {
    return file;
  }

  const img = await loadImage(file);
  const { width, height } = calcSize(
    img.width,
    img.height,
    opts.maxWidth,
    opts.maxHeight,
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Canvas 不可用，返回原文件
    return file;
  }

  // PNG 可能有透明度，保留 PNG 格式
  const outputType =
    file.type === 'image/png' ? 'image/png' : opts.outputType;

  // 非透明图片填充白色背景（JPEG 不支持透明度）
  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  // Canvas -> Blob -> File
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('图片压缩失败'));
      },
      outputType,
      opts.quality,
    );
  });

  // 如果压缩后反而更大，返回原文件
  if (blob.size >= file.size) {
    return file;
  }

  // 保留原文件名，修正扩展名
  const ext = outputType === 'image/png' ? '.png' : '.jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newFile = new File([blob], baseName + ext, { type: outputType });

  return newFile;
}
