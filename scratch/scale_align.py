import os
from PIL import Image

# Paths
src_path = r"C:\Users\Asus\.gemini\antigravity-ide\brain\dbc7bbd7-ab43-47d2-9219-03380297237b\manager_sprite_sheet_1781395256472.png"
dest_path = r"c:\laragon\www\botbitkup\frontend\public\sprites\manager_idle.png"

# Open original image
img = Image.open(src_path).convert("RGBA")

# Split quadrants (each is 512x512)
q_w, q_h = 512, 512
q1 = img.crop((0, 0, q_w, q_h))
q2 = img.crop((q_w, 0, q_w * 2, q_h))
q3 = img.crop((0, q_h, q_w, q_h * 2))
q4 = img.crop((q_w, q_h, q_w * 2, q_h * 2))

# Scale and align adjustments for each quadrant to match Q1's camera zoom and position:
# Q1: Base reference (no scale/offset change)
# Q2: Identical zoom, small translation offset
# Q3: Zoomed in! Needs downscaling by ~84%
# Q4: Zoomed in even more! Needs downscaling by ~75%

# Adjustments: (scale_factor, crop_x, crop_y)
# Crop coordinates are applied to the scaled quadrants to align the desk and character.
adjustments = [
    (1.0, 81, 100),       # Q1: no scale, base crop
    (1.0, 50, 95),        # Q2: no scale, translate left by 31px
    (0.85, 42, 60),       # Q3: downscale to 85%, adjust crop
    (0.77, 30, 48)        # Q4: downscale to 77%, adjust crop
]

size = 380
frame_size = 380
out_img = Image.new("RGBA", (frame_size * 4, frame_size))

quads = [q1, q2, q3, q4]

for i, (scale, cx, cy) in enumerate(adjustments):
    q = quads[i]
    if scale != 1.0:
        # Resize using LANCZOS or BILINEAR for smooth downscaling, then NEAREST to restore pixel edges
        new_w = int(q_w * scale)
        new_h = int(q_h * scale)
        q = q.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
    # Crop the aligned frame
    cropped = q.crop((cx, cy, cx + size, cy + size))
    
    # Ensure it's exactly frame_size x frame_size
    if cropped.size != (frame_size, frame_size):
        cropped = cropped.resize((frame_size, frame_size), Image.Resampling.NEAREST)
        
    out_img.paste(cropped, (i * frame_size, 0))

# Save output
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
out_img.save(dest_path)
print("Successfully processed SCALE and TRANSLATION alignment. Saved to:", dest_path)
