const DEFAULT_MAX_SIZE = 1.5 * 1024 * 1024;
const DEFAULT_MAX_DIMENSION = 1600;

const loadImage = (file) =>
    new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("이미지를 불러오지 못했습니다."));
        };
        image.src = url;
    });

const canvasToBlob = (canvas, quality) =>
    new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export const compressImageFile = async (
    file,
    { maxSize = DEFAULT_MAX_SIZE, maxDimension = DEFAULT_MAX_DIMENSION } = {}
) => {
    if (!file?.type?.startsWith("image/")) return file;
    if (file.type === "image/svg+xml") return file;
    if (file.size <= maxSize) return file;

    const image = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    let blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > maxSize && quality > 0.5) {
        quality -= 0.08;
        blob = await canvasToBlob(canvas, quality);
    }

    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
    });
};

export const compressImageFiles = (files) =>
    Promise.all(files.map((file) => compressImageFile(file)));
