from PIL import Image, ImageDraw

# Create 128x128 transparent image
size = 128
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Draw red X
padding = 20
line_width = 20

# Top-left to bottom-right
draw.line([(padding, padding), (size-padding, size-padding)], fill='#FF0000', width=line_width)

# Top-right to bottom-left
draw.line([(size-padding, padding), (padding, size-padding)], fill='#FF0000', width=line_width)

# Save
img.save('modules/paint-canvas/android/src/main/res/drawable/wrong_mark.png')
print('✅ wrong_mark.png created!')
