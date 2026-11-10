"""Safe image uploads: size/format validation and re-encoding (which drops EXIF, including GPS tags).

We do NOT claim automatic face or number-plate redaction. Users are told not to capture them.
"""

import io
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .exceptions import ZpotAPIError

Image.MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb guard


def sanitise_image(upload, *, max_side=2048):
    if upload is None:
        raise ZpotAPIError("Attach an image file.", code="file_required")
    if upload.size > settings.UPLOAD_MAX_BYTES:
        raise ZpotAPIError(
            f"Image is too large (max {settings.UPLOAD_MAX_BYTES // (1024 * 1024)} MB).",
            code="file_too_large",
            status_code=413,
        )
    try:
        img = Image.open(upload)
        fmt = img.format
        img.verify()
        upload.seek(0)
        img = Image.open(upload)
        # Pillow only raises DecompressionBombError above 2× MAX_IMAGE_PIXELS; reject before decoding anything.
        if img.width * img.height > Image.MAX_IMAGE_PIXELS:
            raise Image.DecompressionBombError("image has too many pixels")
        if img.format == "JPEG":
            img.draft("RGB", (max_side * 2, max_side * 2))  # decode large photos at reduced scale (less memory)
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ZpotAPIError("File is not a valid image.", code="invalid_image", status_code=400) from exc
    if fmt not in settings.UPLOAD_ALLOWED_FORMATS:
        raise ZpotAPIError("Use a JPEG, PNG or WebP image.", code="unsupported_format", status_code=415)
    img = ImageOps.exif_transpose(img)  # keep orientation, then drop all metadata on re-encode
    img.thumbnail((max_side, max_side))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    data = buf.getvalue()
    return ContentFile(data, name=f"{uuid.uuid4().hex}.jpg"), {
        "width": img.width,
        "height": img.height,
        "size": len(data),
        "content_type": "image/jpeg",
    }
