"""One-off script to generate a nature-themed favicon (leaf icon).
Run with: python scripts/make_favicon.py
"""
from PIL import Image, ImageDraw, ImageChops

S = 1024  # working resolution, downscaled afterwards for crisp anti-aliasing


def vesica_mask(cx, cy, radius, separation):
    """Lens ("leaf") shape: intersection of two equal circles - pointed top & bottom."""
    m1 = Image.new("L", (S, S), 0)
    m2 = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m1).ellipse(
        (cx - separation / 2 - radius, cy - radius, cx - separation / 2 + radius, cy + radius),
        fill=255,
    )
    ImageDraw.Draw(m2).ellipse(
        (cx + separation / 2 - radius, cy - radius, cx + separation / 2 + radius, cy + radius),
        fill=255,
    )
    return ImageChops.multiply(m1, m2)


def make_canvas():
    cx, cy = S // 2, S // 2
    radius = S * 0.34
    separation = S * 0.34

    leaf_green = (52, 138, 68, 255)
    leaf_green_light = (102, 190, 108, 255)
    vein_color = (30, 86, 42, 255)
    stem_color = (96, 64, 38, 255)

    mask = vesica_mask(cx, cy, radius, separation)

    body = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    body.paste(Image.new("RGBA", (S, S), leaf_green), (0, 0), mask)

    # Soft highlight near the top point for a glossy, fresh look.
    highlight = Image.new("L", (S, S), 0)
    ImageDraw.Draw(highlight).ellipse(
        (cx - radius * 0.55, cy - radius * 1.5, cx + radius * 0.25, cy - radius * 0.25),
        fill=160,
    )
    highlight = ImageChops.multiply(highlight, mask)
    hl_layer = Image.new("RGBA", (S, S), (*leaf_green_light[:3], 0))
    body.paste(hl_layer, (0, 0), highlight)

    # Center vein running pole-to-pole, plus a few angled side veins, clipped to the leaf mask.
    veins = Image.new("L", (S, S), 0)
    vd = ImageDraw.Draw(veins)
    vein_w = max(3, int(S / 110))
    top = (cx, cy - radius * 0.98)
    bottom = (cx, cy + radius * 0.98)
    vd.line([top, bottom], fill=255, width=vein_w)
    for frac in (0.3, 0.52, 0.74):
        vy = top[1] + (bottom[1] - top[1]) * frac
        spread = radius * 0.5 * (1 - abs(frac - 0.5))
        for sign in (1, -1):
            vd.line(
                [(cx, vy), (cx + sign * spread, vy + spread * 0.55)],
                fill=255,
                width=max(2, vein_w - 2),
            )
    veins = ImageChops.multiply(veins, mask)
    vein_layer = Image.new("RGBA", (S, S), (*vein_color[:3], 255))
    body.paste(vein_layer, (0, 0), veins)

    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(body)

    # Small stem at the bottom tip.
    stem = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stem)
    sd.line(
        [(cx, cy + radius * 0.92), (cx + radius * 0.18, cy + radius * 1.22)],
        fill=stem_color,
        width=max(5, int(S / 60)),
    )
    canvas.alpha_composite(stem)

    # Rotate so the leaf points toward the upper-right, which reads better at small sizes.
    canvas = canvas.rotate(-35, resample=Image.BICUBIC, center=(cx, cy))
    return canvas


def main():
    canvas = make_canvas()

    sizes = [16, 24, 32, 48, 64, 128, 180, 256]
    resized = {sz: canvas.resize((sz, sz), Image.LANCZOS) for sz in sizes}

    resized[256].save(
        "public/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    resized[32].save("public/favicon-32x32.png")
    resized[16].save("public/favicon-16x16.png")
    resized[180].save("public/apple-touch-icon.png")

    print("Favicon assets written to public/")


if __name__ == "__main__":
    main()
