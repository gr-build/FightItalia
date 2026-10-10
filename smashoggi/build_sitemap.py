"""Scrive docs/sitemap.xml e docs/robots.txt. Il dominio si legge da docs/CNAME se c'e', altrimenti si usa quello provvisorio."""
from pathlib import Path

DOCS = Path(__file__).parent / "docs"
PROVVISORIO = "https://gr-build.github.io/smashoggi"
cname = DOCS / "CNAME"
base = f"https://{cname.read_text().strip()}" if cname.exists() else PROVVISORIO
pagine = ["index.html", "partite.html", "calendario.html", "classifiche.html", "notizie.html", "chi-siamo.html", "seguici.html"]
urls = "".join(f"  <url><loc>{base}/{'' if p == 'index.html' else p}</loc></url>\n" for p in pagine)
(DOCS / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding="utf-8")
(DOCS / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
print("Sitemap per", base)
