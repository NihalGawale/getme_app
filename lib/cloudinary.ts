// Uploads an image (already square-cropped at 0.8 quality by the caller via
// expo-image-picker options) to Cloudinary and returns the resulting secure
// URL, or null on failure.
export async function uploadToCloudinary(uri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", {
      uri,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);
    formData.append("upload_preset", "getme_profiles");
    formData.append(
      "cloud_name",
      process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );

    const data = await response.json();
    return data.secure_url ?? null;
  } catch (e) {
    return null;
  }
}
