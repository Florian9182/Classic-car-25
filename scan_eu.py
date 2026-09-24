#!/usr/bin/env python3
"""Radar Import CC25 — scanner Europe (AutoScout24, pages de résultats uniquement).

- Lit les pages de résultats AutoScout24 (autorisées par robots.txt pour tous les agents),
  avec un user-agent honnête et une pause entre requêtes. Ne lit jamais les pages /angebote/.
- Source : UE hors France (DE, AT, BE, IT, ES, LU, NL). Comparables : France (cy=F).
- Sortie : JSON {annonces:[...]} avec, pour chaque annonce, ses comparables français réels.
Usage : python3 scan_eu.py config.json sortie.json
"""
import json, re, sys, time, statistics, urllib.request, urllib.parse, datetime

UA = "Claude-User (+https://support.anthropic.com/) CC25-radar"
PAUSE = 2.0
BASE = "https://www.autoscout24.de/lst/{make}/{model}"
EU = "D,A,B,I,E,L,NL"
CC = {"DE": "DE", "AT": "AT", "BE": "BE", "IT": "IT", "ES": "ES", "LU": "LU", "NL": "NL", "FR": "FR"}

def fetch(url, tries=3):
    assert "/angebote/" not in url and "cat=" not in url
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9"})
            with urllib.request.urlopen(req, timeout=40) as r:
                h = r.read().decode("utf-8", "ignore")
            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', h, re.S)
            if not m:
                raise ValueError("pas de données")
            return json.loads(m.group(1))["props"]["pageProps"]
        except Exception as e:
            code = getattr(e, "code", None)
            if code in (403, 429):
                print("  refusé", code, "— arrêt de cette recherche", file=sys.stderr); return None
            time.sleep(4 * (i + 1))
    return None

def num(s):
    s = re.sub(r"[^\d]", "", str(s or ""))
    return int(s) if s else None

def parse(l):
    v = l.get("vehicle", {}); t = l.get("tracking", {}); p = l.get("price", {})
    det = [x.get("data", "") for x in l.get("vehicleDetails", [])]
    ps = None; co2 = None
    for d in det:
        m = re.search(r"\((\d+)\s*PS\)", d)
        if m: ps = int(m.group(1))
        m = re.search(r"(\d+)\s*g/km", d)
        if m: co2 = int(m.group(1))
    fr = t.get("firstRegistration") or ""
    mm, yy = (fr.split("-") + ["", ""])[:2]
    if not yy: return None
    seller = l.get("seller", {})
    phones = [x.get("formattedNumber") for x in seller.get("phones", []) or [] if x.get("formattedNumber")]
    loc = l.get("location", {})
    return {
        "as24_id": l.get("id"),
        "lien": "https://www.autoscout24.de" + l["url"] if l.get("url", "").startswith("/") else l.get("url"),
        "marque": v.get("make"), "modele_groupe": v.get("modelGroup"), "variante": v.get("variant") or "",
        "titre": v.get("modelVersionInput") or "", "ps": ps, "co2": co2,
        "immat": f"{yy}-{mm.zfill(2)}", "annee": int(yy), "km": num(t.get("mileage")),
        "prix": p.get("priceRaw") or num(t.get("price")),
        "tva": "deductible" if (p.get("vatLabel") or "").strip() else "marge",
        "boite": next((d for d in det if d in ("Automatik", "Schaltgetriebe", "Halbautomatik")), ""),
        "carburant": v.get("fuel") or "",
        "pays": CC.get(loc.get("countryCode"), loc.get("countryCode")), "ville": (loc.get("city") or "").strip(),
        "vendeur_type": "pro" if seller.get("type") == "Dealer" else "particulier",
        "vendeur": seller.get("companyName") or ("Particulier" if seller.get("type") != "Dealer" else ""),
        "tel": phones[0] if phones and seller.get("type") == "Dealer" else "",
        "photo": (l.get("images") or [None])[0],
        "evaluation_as24": t.get("priceLabel") if t.get("priceLabel") not in (None, "unknown") else "",
    }

def search(s, cy, pages):
    q = {"atype": "C", "cy": cy, "fregfrom": s["annees"][0], "fregto": s["annees"][1], "sort": "price", "desc": "0",
         "damaged_listing": "exclude", "ustate": "N,U", "pricefrom": s.get("prix_min", 15000)}
    if cy != "F": q["priceto"] = s.get("prix_max", 100000)
    if s.get("fuel"): q["fuel"] = s["fuel"]
    out = []; total = None; seen = set()
    for page in range(1, pages + 1):
        q["page"] = page
        url = BASE.format(make=s["make"], model=s["model"]) + "?" + urllib.parse.urlencode(q, safe=",")
        pp = fetch(url); time.sleep(PAUSE)
        if not pp: break
        total = pp.get("numberOfResults")
        for l in pp.get("listings", []):
            try:
                a = parse(l)
            except Exception:
                a = None
            if a and a["prix"] and a["km"] is not None and a["as24_id"] not in seen:
                key = (a["prix"], a["km"], a["immat"])
                if key in seen: continue
                seen.add(a["as24_id"]); seen.add(key); out.append(a)
        if page >= (pp.get("numberOfPages") or 1): break
    return out, total

def main():
    cfg = json.load(open(sys.argv[1])); outp = sys.argv[2]
    raw = {"date": datetime.date.today().isoformat(), "journal": [], "recherches": []}
    for s in cfg["recherches"]:
        print("•", s["label"], file=sys.stderr)
        eu, n_eu = search(s, EU, s.get("pages_eu", 4))
        fr, n_fr = search(s, "F", s.get("pages_fr", 8))
        raw["journal"].append({"recherche": s["label"], "annonces_ue": n_eu, "lues_ue": len(eu), "annonces_fr": n_fr, "lues_fr": len(fr)})
        raw["recherches"].append({"cfg": s, "ue": eu, "fr": fr, "stock_fr": n_fr})
        json.dump(raw, open(outp, "w"), ensure_ascii=False)
    print("terminé", file=sys.stderr)

if __name__ == "__main__":
    main()
