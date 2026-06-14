import os
from PIL import Image

# Paths
src_path = r"C:\Users\Asus\.gemini\antigravity-ide\brain\dbc7bbd7-ab43-47d2-9219-03380297237b\manager_sprite_sheet_1781395256472.png"
dest_path = r"c:\laragon\www\botbitkup\frontend\public\sprites\manager_idle.png"

# Open the original image
img = Image.open(src_path)

# Symmetrical relative offset within each 512x512 quadrant
# dx: horizontal margin from the left of the quadrant
# dy: vertical margin from the top of the quadrant
# size: dimension of the cropped square (must be identical to keep proportions)
dx = 81
dy = 100
size = 392

# Coordinates for each quadrant
crops = [
    (dx, dy, dx + size, dy + size),                 # Top-Left (0, 0 offset)
    (512 + dx, dy, 512 + dx + size, dy + size),     # Top-Right (512, 0 offset)
    (dx, 512 + dy, dx + size, 512 + dy + size),     # Bottom-Left (0, 512 offset)
    (512 + dx, 512 + dy, 512 + dx + size, 512 + dy + size) # Bottom-Right (512, 512 offset)
]

# Output dimensions
frame_size = 32
out_img = Image.new("RGBA", (frame_size * 4, frame_size))

# Crop, resize and paste
for i, box in enumerate(crops):
    cropped = img.crop(box)
    # Resize with NEAREST to keep pixel art crisp
    resized = cropped.resize((frame_size, frame_size), Image.Resampling.NEAREST)
    out_img.paste(resized, (i * frame_size, 0))

# Save output
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
out_img.save(dest_path)
print("Successfully processed and saved ALIGNED sprite sheet to:", dest_path)
