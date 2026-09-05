from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".codex-tmp" / "python-packages"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import imageio_ffmpeg  # noqa: E402


WIDTH, HEIGHT = 1280, 720
FPS = 12
TOTAL_DURATION = 36.3

ASSETS = ROOT / "public" / "assets" / "games" / "mission-zellige"
NARRATION = ROOT / ".codex-tmp" / "secrets-medina-narration.wav"
TMP_VIDEO = ROOT / ".codex-tmp" / "les-secrets-de-la-medina-silent.webm"
OUTPUT_DIR = ROOT / "public" / "assets" / "mediatheque" / "video"
OUTPUT_VIDEO = OUTPUT_DIR / "les-secrets-de-la-medina.webm"
OUTPUT_POSTER = OUTPUT_DIR / "les-secrets-de-la-medina-poster.webp"
OUTPUT_CAPTIONS = OUTPUT_DIR / "les-secrets-de-la-medina.vtt"

FONT_BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/segoeui.ttf")
FONT_SERIF = Path("C:/Windows/Fonts/georgiab.ttf")


SLIDES = [
    {
        "start": 0.0,
        "end": 7.1,
        "image": ASSETS / "mission-chemin-v1-1280.webp",
        "kicker": "DÉCOUVRIR",
        "title": "Les secrets de la médina",
        "caption": "Un quartier ancien, entouré de remparts, où chaque chemin raconte une histoire.",
    },
    {
        "start": 7.1,
        "end": 14.8,
        "image": ASSETS / "mission-marche-v1-1280.webp",
        "kicker": "OBSERVER",
        "title": "Des ruelles pleines de vie",
        "caption": "On marche entre les maisons, les fontaines et les petits commerces.",
    },
    {
        "start": 14.8,
        "end": 23.1,
        "image": ASSETS / "mission-bibliotheque-v1-1280.webp",
        "kicker": "COMPRENDRE",
        "title": "Des gestes transmis",
        "caption": "Dans les ateliers, les motifs et les couleurs prennent forme avec patience.",
    },
    {
        "start": 23.1,
        "end": 29.4,
        "image": ASSETS / "mission-quartier-v1-1280.webp",
        "kicker": "PRÉSERVER",
        "title": "Un patrimoine vivant",
        "caption": "Habitants, artisans et visiteurs contribuent tous à faire vivre la médina.",
    },
    {
        "start": 29.4,
        "end": TOTAL_DURATION,
        "image": ASSETS / "mission-chemin-v1-1280.webp",
        "kicker": "TA MISSION",
        "title": "À toi de raconter",
        "caption": "Cite deux lieux de la médina et explique pourquoi il faut les préserver.",
    },
]


def cover(image: Image.Image, target_width: int, target_height: int, zoom: float) -> Image.Image:
    source_ratio = image.width / image.height
    target_ratio = target_width / target_height
    if source_ratio > target_ratio:
        crop_height = image.height
        crop_width = int(crop_height * target_ratio)
    else:
        crop_width = image.width
        crop_height = int(crop_width / target_ratio)
    crop_width = max(1, int(crop_width / zoom))
    crop_height = max(1, int(crop_height / zoom))
    left = (image.width - crop_width) // 2
    top = max(0, (image.height - crop_height) // 2 - int(10 * (zoom - 1)))
    return image.crop((left, top, left + crop_width, top + crop_height)).resize(
        (target_width, target_height), Image.Resampling.LANCZOS
    )


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def frame_for(slide: dict[str, object], progress: float) -> Image.Image:
    source = Image.open(Path(slide["image"])).convert("RGB")
    base = cover(source, WIDTH, HEIGHT, 1.0 + 0.035 * progress)
    base = ImageEnhance.Color(base).enhance(0.92)
    canvas = base.convert("RGBA")
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    shade_draw.rectangle((0, 0, WIDTH, 112), fill=(3, 24, 47, 120))
    shade_draw.rectangle((0, 430, WIDTH, HEIGHT), fill=(3, 24, 47, 72))
    canvas.alpha_composite(shade)

    draw = ImageDraw.Draw(canvas)
    small_font = ImageFont.truetype(str(FONT_BOLD), 19)
    kicker_font = ImageFont.truetype(str(FONT_BOLD), 20)
    title_font = ImageFont.truetype(str(FONT_SERIF), 43)
    caption_font = ImageFont.truetype(str(FONT_REGULAR), 26)
    draw.text((60, 44), "JET D’ENCRE  ·  MÉDIATHÈQUE", font=small_font, fill=(255, 255, 255, 245))
    draw.rounded_rectangle(
        (56, 458, 1224, 678),
        radius=28,
        fill=(5, 28, 52, 232),
        outline=(230, 171, 29, 230),
        width=2,
    )
    draw.text((90, 490), str(slide["kicker"]), font=kicker_font, fill=(241, 180, 31, 255))
    draw.text((90, 527), str(slide["title"]), font=title_font, fill=(255, 255, 255, 255))
    lines = wrap_text(draw, str(slide["caption"]), caption_font, 1080)
    for index, line in enumerate(lines[:2]):
        draw.text((90, 595 + index * 34), line, font=caption_font, fill=(226, 239, 237, 255))
    return canvas.convert("RGB")


def current_slide(time_seconds: float) -> tuple[dict[str, object], float]:
    for slide in SLIDES:
        if time_seconds < float(slide["end"]):
            duration = float(slide["end"]) - float(slide["start"])
            progress = (time_seconds - float(slide["start"])) / duration
            return slide, min(1.0, max(0.0, progress))
    return SLIDES[-1], 1.0


def write_video() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    first_frame = frame_for(SLIDES[0], 0.0)
    first_frame.save(OUTPUT_POSTER, "WEBP", quality=88, method=6)

    writer = imageio_ffmpeg.write_frames(
        str(TMP_VIDEO),
        (WIDTH, HEIGHT),
        fps=FPS,
        codec="libvpx-vp9",
        pix_fmt_in="rgb24",
        pix_fmt_out="yuv420p",
        output_params=["-deadline", "realtime", "-cpu-used", "5", "-crf", "34", "-b:v", "0"],
    )
    writer.send(None)
    total_frames = int(TOTAL_DURATION * FPS)
    try:
        for index in range(total_frames):
            slide, progress = current_slide(index / FPS)
            writer.send(np.asarray(frame_for(slide, progress)))
    finally:
        writer.close()

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(TMP_VIDEO),
        "-i",
        str(NARRATION),
        "-c:v",
        "copy",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        "-shortest",
        str(OUTPUT_VIDEO),
    ]
    subprocess.run(command, check=True, capture_output=True)

    captions = """WEBVTT

00:00:00.000 --> 00:00:07.100
Au cœur de la ville, la médina est un quartier ancien entouré de remparts.

00:00:07.100 --> 00:00:14.800
Ses ruelles étroites permettent de marcher entre les maisons, les fontaines et les petits commerces.

00:00:14.800 --> 00:00:23.100
Dans mon atelier, je dessine d’abord le motif, puis je choisis les couleurs avant de commencer mon travail.

00:00:23.100 --> 00:00:29.400
Les habitants, les artisans et les visiteurs contribuent tous à faire vivre ce patrimoine.

00:00:29.400 --> 00:00:36.300
Après la vidéo, cite deux lieux de la médina et explique pourquoi il faut les préserver.
"""
    OUTPUT_CAPTIONS.write_text(captions, encoding="utf-8")
    print(OUTPUT_VIDEO)
    print(OUTPUT_POSTER)
    print(OUTPUT_CAPTIONS)


if __name__ == "__main__":
    write_video()
