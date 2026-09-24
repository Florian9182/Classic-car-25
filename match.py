#!/usr/bin/env python3
"""Radar Import CC25 — rapprochement annonces UE ↔ comparables France.
Usage : python3 match.py raw.json scan.json
Règles :
- Comparable = même modèle AutoScout24, même variante normalisée (si connue), puissance ±10 ch, année ±1.
- Exclut préparations et séries spéciales (ABT, Brabus, CS…) sauf si l'annonce source est la même série.
- Prix de revente = 40e centile des comparables les plus proches, ramenés au km et à l'année, × 0,97.
- Au moins 4 comparables, sinon l'annonce est ignorée.
"""
import json, re, sys, statistics

SPECIAL = re.compile(r"\b(abt|brabus|mansory|novitec|techart|liberty|cs|gt3|gt2|gt4|rs\s?-?r|performante|black series|pista|clubsport|replica|umbau|export|unfall|motorschaden|defekt|bastler)\b", re.I)
RISK = re.compile(r"\b(promo|promozione|finanziamento|finanziato|leasing|mietkauf|export|netto export|händler|gewerbe|export only)\b", re.I)

def body(a):
    t = (a.get("variante", "") + " " + a.get("titre", "")).lower()
    for k, v in (("cabrio", "cabrio"), ("roadster", "roadster"), ("spyder", "roadster"), ("targa", "targa"), ("avant", "break"),
                 ("touring", "break"), ("kombi", "break"), ("t-modell", "break"), ("estate", "break"), ("break", "break"),
                 ("sportback", "sportback"), ("limousine", "berline"), ("berline", "berline"), ("sedan", "berline"), ("coup", "coupe")):
        if k in t: return v
    return ""

def specials(a):
    return set(m.lower().replace(" ", "") for m in SPECIAL.findall(a.get("titre", "") + " " + a.get("variante", "")))

def comps_for(a, fr):
    sa = specials(a); ba = body(a)
    out = []
    for c in fr:
        if c["modele_groupe"] != a["modele_groupe"]: continue
        if abs(c["annee"] - a["annee"]) > 1: continue
        if not a["ps"] or not c["ps"] or abs(a["ps"] - c["ps"]) > 10: continue
        if a["variante"] and c["variante"] and a["variante"] != c["variante"]: continue
        if (not a["variante"] or not c["variante"]) and ba and body(c) and ba != body(c): continue
        if specials(c) != sa: continue
        out.append(c)
    return out

def pct(vals, q):
    vals = sorted(vals); k = (len(vals) - 1) * q; f = int(k); c = min(f + 1, len(vals) - 1)
    return vals[f] + (vals[c] - vals[f]) * (k - f)

def valeur_fr(a, cs):
    if len(cs) < 4: return None, [], None
    base = statistics.median(c["prix"] for c in cs)
    xs = [c["km"] for c in cs]; ys = [c["prix"] for c in cs]; slope = None
    if len(cs) >= 6 and max(xs) - min(xs) > 25000:
        mx, my = statistics.mean(xs), statistics.mean(ys)
        den = sum((x - mx) ** 2 for x in xs)
        if den: slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    lo, hi = -0.006 * base / 1000, -0.0008 * base / 1000
    if slope is None or not (lo <= slope <= hi): slope = -0.0025 * base / 1000
    adj = []
    for c in cs:
        p = (c["prix"] + slope * (a["km"] - c["km"])) * (1 + 0.05 * (a["annee"] - c["annee"]))
        adj.append((abs(a["km"] - c["km"]) + 20000 * abs(a["annee"] - c["annee"]), p, c))
    adj.sort(key=lambda x: x[0])
    near = adj[:8]
    ps = [p for _, p, _ in near]
    est = pct(ps, 0.40) * 0.97
    disp = (pct(ps, 0.75) - pct(ps, 0.25)) / statistics.median(ps)
    show = [{"prix": c["prix"], "km": c["km"], "immat": c["immat"], "ville": c["ville"], "titre": c["titre"][:70], "lien": c["lien"]} for _, _, c in near[:6]]
    return round(est, -2), show, round(disp, 3)

def main():
    raw = json.load(open(sys.argv[1])); res = []
    for r in raw["recherches"]:
        s = r["cfg"]
        for a in r["ue"]:
            if specials(a) & {"unfall", "motorschaden", "defekt", "bastler", "export", "umbau", "replica"}: continue
            cs = comps_for(a, r["fr"])
            est, show, disp = valeur_fr(a, cs)
            if not est: continue
            risques = []
            if RISK.search(a.get("titre", "")): risques.append("Titre de l'annonce à vérifier (promotion, financement ou export)")
            if a["vendeur_type"] == "particulier": risques.append("Vendeur particulier : pas de garantie, facture sous régime de marge")
            if disp and disp > 0.18: risques.append("Prix français très dispersés : estimation moins sûre")
            a.update({"segment": s.get("segment", ""), "recherche": s["label"], "prixFR": est, "comparables_fr": show,
                      "nb_comparables": len(cs), "dispersion": disp, "stock_fr": r.get("stock_fr"), "masse": s.get("masse", 1600),
                      "energie": s.get("energie", "ICE"), "co2": a["co2"] or s.get("co2_defaut", 200),
                      "co2_source": "annonce (WLTP)" if a["co2"] else "valeur type du modèle", "risques": risques})
            res.append(a)
    json.dump({"date": raw["date"], "journal": raw["journal"], "annonces": res}, open(sys.argv[2], "w"), ensure_ascii=False)
    print(len(res), "annonces avec au moins 4 comparables", file=sys.stderr)

if __name__ == "__main__":
    main()
