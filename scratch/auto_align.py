import os
from PIL import Image

# Paths
src_path = r"C:\Users\Asus\.gemini\antigravity-ide\brain\dbc7bbd7-ab43-47d2-9219-03380297237b\manager_sprite_sheet_1781395256472.png"
dest_path = r"c:\laragon\www\botbitkup\frontend\public\sprites\manager_idle.png"

# Open the original image
img = Image.open(src_path).convert("RGBA")

# Split the 1024x1024 image into four 512x512 quadrants
q_w, q_h = 512, 512
q1 = img.crop((0, 0, q_w, q_h))
q2 = img.crop((q_w, 0, q_w * 2, q_h))
q3 = img.crop((0, q_h, q_w, q_h * 2))
q4 = img.crop((q_w, q_h, q_w * 2, q_h * 2))

quadrants = [q1, q2, q3, q4]

# Define a stable reference region in Q1 (the computer monitor area, which is static)
tx1, ty1, tx2, ty2 = 300, 220, 420, 360
template = q1.crop((tx1, ty1, tx2, ty2))
t_w, t_h = template.size

# Calculate SAD
def get_sad(q_other, dx, dy):
    sad = 0
    p_temp = template.load()
    p_other = q_other.load()
    
    for y in range(t_h):
        for x in range(t_w):
            ox = tx1 + dx + x
            oy = ty1 + dy + y
            if 0 <= ox < q_w and 0 <= oy < q_h:
                r1, g1, b1, _ = p_temp[x, y]
                r2, g2, b2, _ = p_other[ox, oy]
                sad += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
            else:
                sad += 1000
    return sad

# Search alignment offsets
offsets = [(0, 0)]
search_range = 30

for i in range(1, 4):
    q_other = quadrants[i]
    min_sad = float('inf')
    best_offset = (0, 0)
    for dy in range(-search_range, search_range + 1):
        for dx in range(-search_range, search_range + 1):
            sad = get_sad(q_other, dx, dy)
            if sad < min_sad:
                min_sad = sad
                best_offset = (dx, dy)
    offsets.append(best_offset)
    print(f"Quadrant {i+1} offset: dx={best_offset[0]}, dy={best_offset[1]}")

# Crop the frames using computed offsets and preserve full high-resolution (380x380 px)
# This prevents blurring and losing pixel-art details!
base_x = 81
base_y = 90
size = 380 # Keep original crop size (380x380)

# Create high-res output image (1520x380 px)
out_img = Image.new("RGBA", (size * 4, size))

for i, (dx, dy) in enumerate(offsets):
    q_img = quadrants[i]
    box = (base_x + dx, base_y + dy, base_x + dx + size, base_y + dy + size)
    cropped = q_img.crop(box)
    out_img.paste(cropped, (i * size, 0))

# Save output
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
out_img.save(dest_path)
print("Successfully saved HIGH-RES ALIGNED sprite sheet to:", dest_path)
