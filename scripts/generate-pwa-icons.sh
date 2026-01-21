#!/bin/bash
# PWA 图标生成脚本
# 需要 ImageMagick (convert 命令)
# 安装: brew install imagemagick (macOS) 或 apt install imagemagick (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/../frontend/public/icons"
SVG_FILE="$ICONS_DIR/icon.svg"

# 检查 SVG 文件是否存在
if [ ! -f "$SVG_FILE" ]; then
    echo "错误: 找不到 SVG 文件: $SVG_FILE"
    exit 1
fi

# 检查是否安装了 ImageMagick
if ! command -v convert &> /dev/null; then
    echo "错误: 需要安装 ImageMagick"
    echo "macOS: brew install imagemagick"
    echo "Linux: sudo apt install imagemagick"
    exit 1
fi

echo "开始生成 PWA 图标..."

# 生成各尺寸的图标
SIZES=(16 32 72 96 128 144 152 192 384 512)

for size in "${SIZES[@]}"; do
    output="$ICONS_DIR/icon-${size}x${size}.png"
    echo "生成 $output"
    convert -background none -resize ${size}x${size} "$SVG_FILE" "$output"
done

# 生成 Apple Touch Icon (180x180)
echo "生成 apple-touch-icon.png"
convert -background none -resize 180x180 "$SVG_FILE" "$ICONS_DIR/apple-touch-icon.png"

# 生成 maskable icon (需要更大的安全边距)
echo "生成 maskable-icon.png"
convert -background "#3b82f6" -resize 400x400 -gravity center -extent 512x512 "$SVG_FILE" "$ICONS_DIR/maskable-icon.png"

# 生成 favicon.ico
echo "生成 favicon.ico"
convert -background none -resize 32x32 "$SVG_FILE" "$ICONS_DIR/../favicon.ico"

echo "图标生成完成!"
echo ""
echo "生成的文件:"
ls -la "$ICONS_DIR"
