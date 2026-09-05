from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageOps
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PDF = ROOT / "output" / "pdf" / "petites-histoires-du-maroc.pdf"
PUBLIC_PDF = ROOT / "public" / "assets" / "mediatheque" / "bouquins" / "petites-histoires-du-maroc.pdf"
TMP_DIR = ROOT / "tmp" / "pdfs" / "petites-histoires-du-maroc"

IMAGE_LIBRARY = ROOT / "public" / "assets" / "games" / "mission-zellige" / "mission-bibliotheque-v1-1280.webp"
IMAGE_MARKET = ROOT / "public" / "assets" / "games" / "mission-zellige" / "mission-marche-v1-1280.webp"
IMAGE_NEIGHBORHOOD = ROOT / "public" / "assets" / "games" / "mission-zellige" / "mission-quartier-v1-1280.webp"

FONT_REGULAR = Path("C:/Windows/Fonts/DejaVuSans.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/DejaVuSans-Bold.ttf")
FONT_SERIF = Path("C:/Windows/Fonts/DejaVuSerif.ttf")
FONT_SERIF_BOLD = Path("C:/Windows/Fonts/DejaVuSerif-Bold.ttf")

NAVY = HexColor("#071E33")
INK = HexColor("#13283A")
IVORY = HexColor("#FBF7EE")
TEAL = HexColor("#187F76")
PALE_TEAL = HexColor("#E5F3EF")
GOLD = HexColor("#E5AA27")
PALE_GOLD = HexColor("#FFF2CC")
CORAL = HexColor("#D96B4C")
MUTED = HexColor("#5E6E79")
LINE = HexColor("#DCCFB8")

PAGE_W, PAGE_H = A4
MARGIN = 42


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("JE-Sans", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("JE-Sans-Bold", str(FONT_BOLD)))
    pdfmetrics.registerFont(TTFont("JE-Serif", str(FONT_SERIF)))
    pdfmetrics.registerFont(TTFont("JE-Serif-Bold", str(FONT_SERIF_BOLD)))


def style(name: str, **kwargs) -> ParagraphStyle:
    defaults = {
        "fontName": "JE-Sans",
        "fontSize": 11.2,
        "leading": 17,
        "textColor": INK,
        "alignment": TA_LEFT,
        "spaceAfter": 8,
    }
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)


BODY = None
BODY_LARGE = None
TITLE = None
SUBTITLE = None
LABEL = None
QUOTE = None


def make_styles() -> None:
    global BODY, BODY_LARGE, TITLE, SUBTITLE, LABEL, QUOTE
    BODY = style("body")
    BODY_LARGE = style("body-large", fontSize=12.4, leading=19)
    TITLE = style("title", fontName="JE-Serif-Bold", fontSize=27, leading=31, textColor=NAVY)
    SUBTITLE = style("subtitle", fontName="JE-Sans-Bold", fontSize=16, leading=21, textColor=TEAL)
    LABEL = style("label", fontName="JE-Sans-Bold", fontSize=8.5, leading=10, textColor=TEAL)
    QUOTE = style("quote", fontName="JE-Serif", fontSize=12.2, leading=19, textColor=NAVY)


def crop_image(source: Path, name: str, ratio: float = 1.82) -> Path:
    target = TMP_DIR / f"{name}.jpg"
    with Image.open(source) as image:
        image = image.convert("RGB")
        width = 1400
        height = int(width / ratio)
        ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS).save(
            target, "JPEG", quality=92, optimize=True
        )
    return target


def paragraph(pdf: canvas.Canvas, text: str, x: float, top: float, width: float, paragraph_style=None) -> float:
    p = Paragraph(text, paragraph_style or BODY)
    _, height = p.wrap(width, PAGE_H)
    p.drawOn(pdf, x, top - height)
    return top - height


def round_box(pdf: canvas.Canvas, x: float, y: float, width: float, height: float, fill, stroke=LINE, radius=12) -> None:
    pdf.setFillColor(fill)
    pdf.setStrokeColor(stroke)
    pdf.setLineWidth(0.8)
    pdf.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def draw_image_cover(pdf: canvas.Canvas, image_path: Path, x: float, y: float, width: float, height: float) -> None:
    pdf.drawImage(ImageReader(str(image_path)), x, y, width, height, preserveAspectRatio=True, mask="auto")


def page_chrome(pdf: canvas.Canvas, page_number: int, section: str) -> None:
    pdf.setFillColor(IVORY)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.rect(0, PAGE_H - 30, PAGE_W, 30, fill=1, stroke=0)
    pdf.setFillColor(GOLD)
    pdf.setFont("JE-Sans-Bold", 8)
    pdf.drawString(MARGIN, PAGE_H - 19, "JET D'ENCRE - PETITES HISTOIRES DU MAROC")
    pdf.setFillColor(white)
    pdf.drawRightString(PAGE_W - MARGIN, PAGE_H - 19, section.upper())
    pdf.setStrokeColor(LINE)
    pdf.line(MARGIN, 28, PAGE_W - MARGIN, 28)
    pdf.setFillColor(MUTED)
    pdf.setFont("JE-Sans", 8.5)
    pdf.drawString(MARGIN, 14, "Lis, comprends, puis raconte avec tes mots.")
    pdf.setFillColor(NAVY)
    pdf.setFont("JE-Sans-Bold", 9)
    pdf.drawRightString(PAGE_W - MARGIN, 14, str(page_number))


def story_header(pdf: canvas.Canvas, kicker: str, title: str, top: float) -> float:
    top = paragraph(pdf, kicker.upper(), MARGIN, top, PAGE_W - 2 * MARGIN, LABEL)
    return paragraph(pdf, title, MARGIN, top - 7, PAGE_W - 2 * MARGIN, TITLE)


def draw_cover(pdf: canvas.Canvas, image_path: Path) -> None:
    pdf.setFillColor(NAVY)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    image_h = PAGE_H * 0.54
    draw_image_cover(pdf, image_path, 0, PAGE_H - image_h, PAGE_W, image_h)
    pdf.saveState()
    pdf.setFillColorRGB(0.03, 0.12, 0.20, alpha=0.3)
    pdf.rect(0, PAGE_H - image_h, PAGE_W, image_h, fill=1, stroke=0)
    pdf.restoreState()

    pdf.setFillColor(GOLD)
    pdf.roundRect(MARGIN, PAGE_H - image_h - 44, 126, 25, 12, fill=1, stroke=0)
    pdf.setFillColor(NAVY)
    pdf.setFont("JE-Sans-Bold", 9)
    pdf.drawCentredString(MARGIN + 63, PAGE_H - image_h - 35, "LECTURE - 4e / 5e AEP")

    paragraph(pdf, "Petites histoires<br/>du Maroc", MARGIN, PAGE_H - image_h - 76, PAGE_W - 2 * MARGIN,
              style("cover-title", fontName="JE-Serif-Bold", fontSize=35, leading=39, textColor=white))
    paragraph(pdf, "Trois aventures pour lire, comprendre et raconter", MARGIN, 179, PAGE_W - 2 * MARGIN,
              style("cover-subtitle", fontName="JE-Sans", fontSize=14, leading=19, textColor=HexColor("#EAF4F1")))
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(3)
    pdf.line(MARGIN, 128, MARGIN + 78, 128)
    pdf.setFillColor(white)
    pdf.setFont("JE-Sans-Bold", 10)
    pdf.drawString(MARGIN, 104, "COLLECTION JET D'ENCRE")
    pdf.setFont("JE-Sans", 9)
    pdf.setFillColor(HexColor("#BDD2D3"))
    pdf.drawString(MARGIN, 84, "Édition de démonstration - contenu original")


def draw_welcome(pdf: canvas.Canvas) -> None:
    page_chrome(pdf, 2, "Avant de lire")
    top = story_header(pdf, "Bienvenue", "Un carnet à parcourir à ton rythme", PAGE_H - 66)
    top = paragraph(pdf,
        "Dans ces pages, tu vas suivre Lina dans trois lieux familiers : une petite place près d'une bibliothèque, un souk animé et un jardin de quartier. Chaque histoire est courte. Tu peux donc t'arrêter, observer l'image et reprendre plus tard.",
        MARGIN, top - 8, PAGE_W - 2 * MARGIN, BODY_LARGE)

    cards = [
        ("1", "Le carnet sous le banc", "Observer et décrire un lieu."),
        ("2", "Au souk des couleurs", "Comprendre un dialogue poli."),
        ("3", "Une place plus propre", "Raconter une action collective."),
    ]
    y = 412
    for number, title, copy in cards:
        round_box(pdf, MARGIN, y, PAGE_W - 2 * MARGIN, 78, white)
        pdf.setFillColor(TEAL)
        pdf.circle(MARGIN + 32, y + 39, 18, fill=1, stroke=0)
        pdf.setFillColor(white)
        pdf.setFont("JE-Sans-Bold", 13)
        pdf.drawCentredString(MARGIN + 32, y + 34, number)
        paragraph(pdf, title, MARGIN + 64, y + 57, PAGE_W - 2 * MARGIN - 82, SUBTITLE)
        paragraph(pdf, copy, MARGIN + 64, y + 29, PAGE_W - 2 * MARGIN - 82, BODY)
        y -= 93

    round_box(pdf, MARGIN, 76, PAGE_W - 2 * MARGIN, 72, PALE_GOLD, GOLD)
    paragraph(pdf, "CONSEIL DE LECTURE", MARGIN + 16, 130, PAGE_W - 2 * MARGIN - 32,
              style("tip-label", fontName="JE-Sans-Bold", fontSize=8.5, leading=10, textColor=CORAL))
    paragraph(pdf, "Après chaque page, choisis une phrase que tu aimerais lire à voix haute.", MARGIN + 16, 110,
              PAGE_W - 2 * MARGIN - 32, BODY)


def draw_story_one(pdf: canvas.Canvas, image_path: Path) -> None:
    page_chrome(pdf, 3, "Histoire 1")
    draw_image_cover(pdf, image_path, MARGIN, 475, PAGE_W - 2 * MARGIN, 278)
    top = story_header(pdf, "Histoire 1", "Le carnet sous le banc", 452)
    top = paragraph(pdf,
        "En sortant de l'école, Lina traverse la petite place. Sous l'oranger, un garçon lit près de la fontaine. Un vieux monsieur indique le chemin de la bibliothèque à une jeune élève.",
        MARGIN, top - 4, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "Lina s'assoit un instant. Sous le banc, elle aperçoit un carnet bleu. Sur la première page, elle lit : « Mes mots nouveaux ». Il n'y a ni nom ni adresse.",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, BODY_LARGE)
    round_box(pdf, MARGIN, 66, PAGE_W - 2 * MARGIN, 72, PALE_TEAL, TEAL)
    paragraph(pdf, "À TON AVIS", MARGIN + 16, 120, 120, LABEL)
    paragraph(pdf, "Que doit faire Lina pour retrouver la personne qui a perdu le carnet ?", MARGIN + 16, 99,
              PAGE_W - 2 * MARGIN - 32, BODY)


def draw_story_one_end(pdf: canvas.Canvas) -> None:
    page_chrome(pdf, 4, "Histoire 1")
    top = story_header(pdf, "La suite", "Une petite enquête de voisinage", PAGE_H - 68)
    top = paragraph(pdf,
        "Lina montre le carnet à la bibliothécaire. Ensemble, elles observent les mots écrits : fontaine, ruelle, échoppe et jasmin. Une phrase parle aussi d'un chat roux qui dort devant le café.",
        MARGIN, top - 6, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "La bibliothécaire sourit. Elle connaît ce chat : il appartient à Yassine, un lecteur qui vient chaque mercredi. Elles déposent le carnet à l'accueil avec un petit mot. Le lendemain, Yassine revient et remercie Lina.",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "« Grâce à toi, je peux continuer ma collection de mots », dit-il. Lina décide alors de commencer son propre carnet.",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, QUOTE)

    paragraph(pdf, "MOTS À GARDER", MARGIN, 360, PAGE_W - 2 * MARGIN, LABEL)
    words = [
        ("apercevoir", "Voir quelque chose rapidement."),
        ("accueil", "Endroit où l'on reçoit les visiteurs."),
        ("retrouver", "Découvrir de nouveau où se trouve une personne ou un objet."),
    ]
    y = 277
    for word, definition in words:
        round_box(pdf, MARGIN, y, PAGE_W - 2 * MARGIN, 66, white)
        paragraph(pdf, word, MARGIN + 16, y + 48, 125,
                  style(f"word-{word}", fontName="JE-Sans-Bold", fontSize=12, leading=14, textColor=TEAL))
        paragraph(pdf, definition, MARGIN + 150, y + 48, PAGE_W - 2 * MARGIN - 168, BODY)
        y -= 79


def draw_story_two(pdf: canvas.Canvas, image_path: Path) -> None:
    page_chrome(pdf, 5, "Histoire 2")
    draw_image_cover(pdf, image_path, MARGIN, 475, PAGE_W - 2 * MARGIN, 278)
    top = story_header(pdf, "Histoire 2", "Au souk des couleurs", 452)
    top = paragraph(pdf,
        "Samedi matin, Lina accompagne sa tante au souk. Les paniers d'oranges brillent sous le soleil. À côté, les tomates rouges, les fèves vertes et les pains ronds forment un tableau plein de couleurs.",
        MARGIN, top - 4, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "Sa tante lui confie une mission : acheter deux oranges et un petit pain. Lina vérifie la monnaie dans sa poche, puis s'avance vers l'étal.",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, BODY_LARGE)
    round_box(pdf, MARGIN, 66, PAGE_W - 2 * MARGIN, 82, PALE_GOLD, GOLD)
    paragraph(pdf, "OBSERVE", MARGIN + 16, 132, 100, LABEL)
    paragraph(pdf, "Nomme trois produits, puis décris leur couleur ou leur forme.", MARGIN + 16, 108,
              PAGE_W - 2 * MARGIN - 32, BODY)


def draw_story_two_end(pdf: canvas.Canvas) -> None:
    page_chrome(pdf, 6, "Histoire 2")
    top = story_header(pdf, "Le dialogue", "Des mots simples et polis", PAGE_H - 68)
    round_box(pdf, MARGIN, 524, PAGE_W - 2 * MARGIN, 176, white)
    conversation = (
        "<b>Lina :</b> Bonjour madame. Je voudrais deux oranges et un petit pain, s'il vous plaît.<br/><br/>"
        "<b>La vendeuse :</b> Bien sûr. Voilà. Cela fait huit dirhams.<br/><br/>"
        "<b>Lina :</b> Merci beaucoup. Bonne journée !<br/><br/>"
        "<b>La vendeuse :</b> Bonne journée à toi aussi."
    )
    paragraph(pdf, conversation, MARGIN + 20, 676, PAGE_W - 2 * MARGIN - 40, BODY_LARGE)
    top = paragraph(pdf,
        "Lina rapporte la monnaie et les achats à sa tante. Elle est fière : elle a parlé clairement, vérifié les quantités et utilisé une formule polie.",
        MARGIN, 492, PAGE_W - 2 * MARGIN, BODY_LARGE)

    paragraph(pdf, "TROIS EXPRESSIONS UTILES", MARGIN, top - 28, PAGE_W - 2 * MARGIN, LABEL)
    expressions = ["Bonjour, je voudrais...", "S'il vous plaît.", "Merci, bonne journée !"]
    y = 308
    for index, expression in enumerate(expressions, start=1):
        fill = PALE_TEAL if index != 2 else PALE_GOLD
        round_box(pdf, MARGIN, y, PAGE_W - 2 * MARGIN, 54, fill, TEAL if index != 2 else GOLD)
        pdf.setFillColor(NAVY)
        pdf.setFont("JE-Sans-Bold", 10)
        pdf.drawCentredString(MARGIN + 25, y + 21, str(index))
        paragraph(pdf, expression, MARGIN + 49, y + 37, PAGE_W - 2 * MARGIN - 65, BODY)
        y -= 67


def draw_story_three(pdf: canvas.Canvas, image_path: Path) -> None:
    page_chrome(pdf, 7, "Histoire 3")
    draw_image_cover(pdf, image_path, MARGIN, 475, PAGE_W - 2 * MARGIN, 278)
    top = story_header(pdf, "Histoire 3", "Une place plus propre", 452)
    top = paragraph(pdf,
        "Lundi après-midi, la classe rejoint le jardin du quartier. Près d'un banc, les élèves trouvent une bouteille vide, du papier et une petite boîte en carton.",
        MARGIN, top - 4, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "Ils mettent des gants et observent les trois bacs de tri. Le bleu reçoit le papier, le jaune le plastique et le vert le verre. Chacun choisit un déchet et explique son geste.",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, BODY_LARGE)
    top = paragraph(pdf,
        "À la fin, la place est propre. Les élèves préparent une affiche : « Notre quartier est notre espace commun. Prenons-en soin ! »",
        MARGIN, top - 5, PAGE_W - 2 * MARGIN, QUOTE)
    round_box(pdf, MARGIN, 66, PAGE_W - 2 * MARGIN, 72, PALE_TEAL, TEAL)
    paragraph(pdf, "PARLE AVEC UN CAMARADE", MARGIN + 16, 120, PAGE_W - 2 * MARGIN - 32, LABEL)
    paragraph(pdf, "Quelle petite action peux-tu réaliser pour améliorer ton école ou ton quartier ?", MARGIN + 16, 99,
              PAGE_W - 2 * MARGIN - 32, BODY)


def draw_final(pdf: canvas.Canvas) -> None:
    page_chrome(pdf, 8, "À toi de raconter")
    top = story_header(pdf, "Mission finale", "Deviens le narrateur de ton quartier", PAGE_H - 68)
    top = paragraph(pdf,
        "Choisis un lieu que tu connais bien : une rue, un parc, une bibliothèque, une place ou un souk. Prépare ensuite une courte histoire en quatre étapes.",
        MARGIN, top - 6, PAGE_W - 2 * MARGIN, BODY_LARGE)

    steps = [
        ("1", "Le lieu", "Où se passe ton histoire ? Que vois-tu ?"),
        ("2", "Le personnage", "Qui arrive dans ce lieu ? Que veut-il faire ?"),
        ("3", "Le petit problème", "Quel objet manque ou quel événement surprend le personnage ?"),
        ("4", "La solution", "Comment l'histoire se termine-t-elle ?"),
    ]
    y = 470
    for number, title, copy in steps:
        round_box(pdf, MARGIN, y, PAGE_W - 2 * MARGIN, 70, white)
        pdf.setFillColor(GOLD if int(number) % 2 == 0 else TEAL)
        pdf.circle(MARGIN + 30, y + 35, 17, fill=1, stroke=0)
        pdf.setFillColor(NAVY if int(number) % 2 == 0 else white)
        pdf.setFont("JE-Sans-Bold", 11)
        pdf.drawCentredString(MARGIN + 30, y + 31, number)
        paragraph(pdf, title, MARGIN + 58, y + 52, 132,
                  style(f"step-{number}", fontName="JE-Sans-Bold", fontSize=11.5, leading=14, textColor=NAVY))
        paragraph(pdf, copy, MARGIN + 196, y + 52, PAGE_W - 2 * MARGIN - 196, BODY)
        y -= 82

    round_box(pdf, MARGIN, 70, PAGE_W - 2 * MARGIN, 90, NAVY, NAVY)
    paragraph(pdf, "Tu peux raconter ton histoire à voix haute, l'écrire ou l'enregistrer.", MARGIN + 20, 144,
              PAGE_W - 2 * MARGIN - 40,
              style("final-message", fontName="JE-Serif-Bold", fontSize=13, leading=19, textColor=white, alignment=TA_CENTER))
    paragraph(pdf, "Le plus important est de transmettre un message clair.", MARGIN + 20, 96,
              PAGE_W - 2 * MARGIN - 40,
              style("final-note", fontName="JE-Sans", fontSize=10.5, leading=15, textColor=HexColor("#CBE3DF"), alignment=TA_CENTER))


def build_pdf() -> None:
    register_fonts()
    make_styles()
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_PDF.parent.mkdir(parents=True, exist_ok=True)

    library = crop_image(IMAGE_LIBRARY, "library")
    market = crop_image(IMAGE_MARKET, "market")
    neighborhood = crop_image(IMAGE_NEIGHBORHOOD, "neighborhood")

    pdf = canvas.Canvas(str(OUTPUT_PDF), pagesize=A4, pageCompression=1)
    pdf.setTitle("Petites histoires du Maroc")
    pdf.setAuthor("Jet d'Encre Éditions")
    pdf.setSubject("Lecture FLE pour les élèves marocains de 4e et 5e AEP")
    pdf.setCreator("Jet d'Encre Éditions")

    draw_cover(pdf, library)
    pdf.showPage()
    draw_welcome(pdf)
    pdf.showPage()
    draw_story_one(pdf, library)
    pdf.showPage()
    draw_story_one_end(pdf)
    pdf.showPage()
    draw_story_two(pdf, market)
    pdf.showPage()
    draw_story_two_end(pdf)
    pdf.showPage()
    draw_story_three(pdf, neighborhood)
    pdf.showPage()
    draw_final(pdf)
    pdf.showPage()
    pdf.save()

    shutil.copy2(OUTPUT_PDF, PUBLIC_PDF)
    shutil.rmtree(TMP_DIR, ignore_errors=True)
    print(OUTPUT_PDF)
    print(PUBLIC_PDF)


if __name__ == "__main__":
    build_pdf()
