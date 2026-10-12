"""Erzeugt reisen/welt.svg und reisen/laender.json aus Natural-Earth-TopoJSON.

Aufruf: python3 -I gen_map.py <datenordner> <zielordner>
"""
import json
import math
import sys

data_dir, out_dir = sys.argv[1], sys.argv[2]

topo = json.load(open(f"{data_dir}/countries-110m.json"))
codes = json.load(open(f"{data_dir}/codes.json"))
names_de = json.load(open(f"{data_dir}/de.json"))["countries"]
clist = json.load(open(f"{data_dir}/countries-list.json"))

num_to_a2 = {c[2]: c[0] for c in codes}
name_fallback = {"Kosovo": "XK", "N. Cyprus": "CY", "Somaliland": "SO"}

# Equal Earth, wie d3.geoEqualEarth
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2


def equal_earth(lon, lat):
    lam, phi = math.radians(lon), math.radians(lat)
    l = math.asin(M * math.sin(phi))
    l2 = l * l
    l6 = l2 * l2 * l2
    x = lam * math.cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)))
    y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))
    return x, y


# TopoJSON-Arcs dekodieren (quantisiert, delta-kodiert)
sx, sy = topo["transform"]["scale"]
tx0, ty0 = topo["transform"]["translate"]
arcs = []
for arc in topo["arcs"]:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx
        y += dy
        pts.append((x * sx + tx0, y * sy + ty0))
    arcs.append(pts)


def ring(indices):
    pts = []
    for i in indices:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def ueber_datumsgrenze(pts):
    """Ringe, die über ±180° springen, auf eine Seite legen (sonst Linie quer über die Karte)."""
    if not any(abs(pts[i][0] - pts[i - 1][0]) > 180 for i in range(1, len(pts))):
        return pts
    ost = sum(1 for lon, _ in pts if lon > 0) >= len(pts) / 2
    return [(min(lon if lon > 0 else lon + 360, 180) if ost else max(lon if lon < 0 else lon - 360, -180), lat)
            for lon, lat in pts]


features = []
for g in topo["objects"]["countries"]["geometries"]:
    gid = g.get("id")
    if gid == "010":  # Antarktis
        continue
    a2 = num_to_a2.get(gid) or name_fallback.get(g["properties"]["name"])
    if g["type"] == "Polygon":
        polys = [g["arcs"]]
    elif g["type"] == "MultiPolygon":
        polys = g["arcs"]
    else:
        continue
    rings = [[equal_earth(lon, lat) for lon, lat in ueber_datumsgrenze(ring(r))] for p in polys for r in p]
    name = names_de.get(a2, g["properties"]["name"]) if a2 else g["properties"]["name"]
    if isinstance(name, list):
        name = name[-1]
    if a2 == "FR":
        # Französisch-Guayana hängt in Natural Earth an Frankreich; als eigenes Gebiet führen
        haupt = [p for p in polys if ring(p[0])[0][0] > -30]
        gf = [p for p in polys if ring(p[0])[0][0] <= -30]
        if gf:
            features.append(("GF", names_de.get("GF", "Französisch-Guayana"),
                             [[equal_earth(lon, lat) for lon, lat in ring(r)] for p in gf for r in p]))
            rings = [[equal_earth(lon, lat) for lon, lat in ring(r)] for p in haupt for r in p]
    features.append((a2, name, rings))

xs = [x for _, _, rs in features for r in rs for x, _ in r]
ys = [y for _, _, rs in features for r in rs for _, y in r]
W, PAD = 1000, 4
k = (W - 2 * PAD) / (max(xs) - min(xs))
tx = PAD - min(xs) * k
ty = PAD + max(ys) * k
H = round((max(ys) - min(ys)) * k + 2 * PAD)


def path_d(rings):
    out = []
    for r in rings:
        pts = [(tx + k * x, ty - k * y) for x, y in r]
        cmds = []
        last = None
        for px, py in pts:
            p = (round(px, 1), round(py, 1))
            if p != last:
                cmds.append(f"{p[0]:g},{p[1]:g}")
                last = p
        if len(cmds) > 2:
            out.append("M" + "L".join(cmds) + "Z")
    return "".join(out)


paths = []
for a2, name, rings in sorted(features, key=lambda f: f[0] or ""):
    iso = f' data-iso="{a2}"' if a2 else ""
    paths.append(f'<path{iso} d="{path_d(rings)}"><title>{name}</title></path>')

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
    f'data-k="{k:.6f}" data-tx="{tx:.4f}" data-ty="{ty:.4f}" role="img" '
    f'aria-label="Weltkarte">\n<g class="laender">\n' + "\n".join(paths) + "\n</g>\n</svg>\n"
)
open(f"{out_dir}/welt.svg", "w").write(svg)

kontinente = {"AF": "Afrika", "AN": "Antarktis", "AS": "Asien", "EU": "Europa",
              "NA": "Nordamerika", "OC": "Ozeanien", "SA": "Südamerika"}
laender = {}
for a2, info in sorted(clist.items()):
    n = names_de.get(a2, info["name"])
    if isinstance(n, list):
        n = n[-1]
    laender[a2] = {"name": n, "kontinent": kontinente[info["continent"]]}
json.dump(laender, open(f"{out_dir}/laender.json", "w"), ensure_ascii=False, separators=(",", ":"))

print(f"welt.svg {W}x{H}, {len(paths)} Länder, k={k:.3f}; laender.json {len(laender)} Einträge")
print("Lissabon ->", tuple(round(v, 1) for v in (tx + k * equal_earth(-9.1393, 38.7223)[0], ty - k * equal_earth(-9.1393, 38.7223)[1])))
